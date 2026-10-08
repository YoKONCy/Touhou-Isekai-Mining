/**
 * 程序合成音效引擎 v2（WebAudio，零音频资源）。
 *
 * 与 v1 的本质区别：v1 是"单振荡器+单滤波噪声"提示交互；
 * v2 按【声音产生的物理过程】建模——模态合成（岩石/金属固有频率）、
 * FM（金属/木鱼）、颗粒（碎石）、湿摩擦 LFO（砍入果冻）、对数扫频+whip
 * 包络（兵器破空）、程序卷积混响（洞穴空间）。
 *
 * 总线：音源 → sfxBus/envBus → compressor → master → 输出
 *       各音源按需 send → convolver（程序生成 IR）→ 回路
 *
 * 浏览器策略：AudioContext 必须在用户手势后出声，懒初始化由输入层 ensure。
 */

import { MusicPlayer, MUSIC_TRACKS } from './MusicPlayer'
import { AmbientPlayer, type AmbientHandle } from './AmbientPlayer'
import { AudioMixer, type AudioSettings } from './AudioMixer'
import { createBowReleaseSample } from './bowSound'
export type { AudioSettings } from './AudioMixer'

/** 命中/死亡音按敌人物理材质分派（与 EnemyDef.hitMaterial 同字面量，避免运行时循环依赖） */
type FleshKind = 'slime' | 'venom' | 'bat'

type AmbientStop = { stop: () => void }

export class AudioEngine {
  private ctx: AudioContext | null = null
  private mixer: AudioMixer | null = null
  private master: GainNode | null = null
  private sfxBus: GainNode | null = null
  private envBus: GainNode | null = null
  private musicBus: GainNode | null = null
  readonly music = new MusicPlayer(() => this.ctx && this.musicBus ? { context: this.ctx, bus: this.musicBus } : null)
  private musicScene: 'title' | 'cave' | 'trial' | 'kedama' | 'base' | null = null
  private baseTrackIndex = 0

  /** 背景音乐互斥；关闭其他场景不误停当前音乐。 */
  private setMusic(scene: 'title' | 'cave' | 'trial' | 'kedama' | 'base', enabled: boolean): void {
    if (!enabled && this.musicScene !== scene) return
    const entering = this.musicScene !== scene
    this.musicScene = enabled ? scene : null
    if (!enabled) { this.music.select(null); return }
    if (scene === 'cave') {
      // 每趟矿洞随机起曲，之后顺序轮播；重复启用不打断当前音乐。
      if (entering) this.music.selectPlaylist(MUSIC_TRACKS.cave, Math.floor(Math.random() * MUSIC_TRACKS.cave.length))
    } else {
      this.music.select(scene === 'base' ? MUSIC_TRACKS.base[this.baseTrackIndex] : scene === 'title' ? MUSIC_TRACKS.title : scene === 'kedama' ? MUSIC_TRACKS.kedama : MUSIC_TRACKS.trial)
    }
    this.ensure()
  }
  setTitleMusic(enabled: boolean): void { this.setMusic('title', enabled) }
  setCaveMusic(enabled: boolean): void { this.setMusic('cave', enabled) }
  setTrialMusic(enabled: boolean): void { this.setMusic('trial', enabled) }
  setKedamaMusic(enabled: boolean): void { this.setMusic('kedama', enabled) }
  setBaseMusic(enabled: boolean): void { this.setMusic('base', enabled) }
  nextBaseTrack(): string {
    this.baseTrackIndex = (this.baseTrackIndex + 1) % MUSIC_TRACKS.base.length
    if (this.musicScene === 'base') {
      this.ensure(); this.music.select(MUSIC_TRACKS.base[this.baseTrackIndex]); this.music.restart()
    }
    return this.baseTrackName
  }
  get baseTrackName(): string { return MUSIC_TRACKS.base[this.baseTrackIndex].nameKey }
  private comp: DynamicsCompressorNode | null = null
  private rev: ConvolverNode | null = null
  private white: AudioBuffer | null = null
  private brown: AudioBuffer | null = null
  get brownNoise(): AudioBuffer | undefined { return this.brown ?? undefined }
  readonly ambient = new AmbientPlayer()
  constructor() {
    this.ambient.register('cave', () => this.startAmbient())
    this.ambient.register('campfire', () => this.startCampfire())
  }

  /** 营火独立于音乐与矿洞环境，离开基地即释放所有循环节点。 */
  setCampfireAmbient(enabled: boolean): void {
    this.ambient.set('campfire', enabled)
    if (enabled) this.ensure()
  }

  private startCampfire(): AmbientHandle | null {
    const c = this.ctx, bus = this.envBus
    if (!c || !bus) return null
    // 长缓冲内固定轻微爆裂，循环首尾用同一底噪衔接，避免定时器叠音。
    const buffer = c.createBuffer(1, c.sampleRate * 19, c.sampleRate)
    const data = buffer.getChannelData(0)
    let low = 0
    for (let i = 0; i < data.length; i++) {
      low = low * .985 + (Math.random() * 2 - 1) * .015
      data[i] = low * .7
    }
    for (let at = .4; at < 18.6; at += .3 + Math.random() * .9) {
      const length = Math.floor(c.sampleRate * (.015 + Math.random() * .05))
      const start = Math.floor(at * c.sampleRate), volume = .08 + Math.random() * .13
      for (let j = 0; j < length; j++) data[start + j] += (Math.random() * 2 - 1) * volume * Math.exp(-j / (length * .16))
    }
    const source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain()
    source.buffer = buffer; source.loop = true
    filter.type = 'lowpass'; filter.frequency.value = 2400
    gain.gain.setValueAtTime(0, c.currentTime); gain.gain.linearRampToValueAtTime(.45, c.currentTime + .8)
    source.connect(filter); filter.connect(gain); gain.connect(bus); source.start()
    return { stop: () => { source.stop(); source.disconnect(); filter.disconnect(); gain.disconnect() } }
  }

  /** 环境循环只属于矿洞，初始化音频或打开基地面板不得启动它。 */
  setCaveAmbient(enabled: boolean): void {
    this.ambient.set('cave', enabled)
  }
  /** 同类音效最小触发间隔（群殴/环弹撞墙防叠音糊团） */
  private lastPlay = new Map<string, number>()
  /** 静音（UI 不动，键盘 M 切换） */
  muted = false
  /** 火把噼啪节流 */
  private crackleLockUntil = 0
  /** 用户音量百分比（ESC 菜单可调；在 ensure 前也允许预设，建总线时取用） */
  settings: AudioSettings = { master: 1, sfx: 1, music: 0.6 }

  /** 懒初始化 + 解锁（首次用户手势调用，重复调用安全） */
  ensure(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const c = (this.ctx = new AC())

      this.mixer = new AudioMixer(c,this.makeImpulse(1.7,2.6),this.settings,this.muted)
      this.master=this.mixer.master;this.comp=this.mixer.compressor
      this.sfxBus=this.mixer.effects;this.envBus=this.mixer.ambience
      this.musicBus=this.mixer.music;this.rev=this.mixer.reverb

      // 2s 白噪 / 棕噪缓冲（全引擎共用）
      this.white = this.makeNoise('white')
      this.brown = this.makeNoise('brown')

    }
    this.ambient.sync()
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    this.music.sync()
  }

  /** 应用卸载时释放循环、定时器与上下文；下次使用可重新初始化。 */
  dispose(): void {
    this.stopFootsteps(); this.ambient.dispose(); this.music.dispose(); this.musicScene = null
    const context = this.ctx
    this.mixer?.dispose();this.mixer=null
    this.ctx = null; this.master = null; this.sfxBus = null; this.envBus = null; this.musicBus = null
    this.comp = null; this.rev = null; this.white = null; this.brown = null; this.lastPlay.clear()
    if (context) void context.close()
  }

  /** J 批次：应用音量设置（滑条拖动实时调用；setTargetAtTime 防爆音） */
  applySettings(s: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...s }
    this.mixer?.apply(this.settings,this.muted)
  }

  /** 切换静音（返回切换后的状态） */
  toggleMute(): boolean {
    this.muted = !this.muted
    this.mixer?.apply(this.settings,this.muted)
    return this.muted
  }

  // ============================================================
  // 内部工具
  // ============================================================

  private rand(a: number, b: number): number {
    return a + Math.random() * (b - a)
  }
  /** ±5% 全局扰动：同种音每次不完全一样（挖矿一小时不折磨耳朵） */
  private j(x: number, amt = 0.05): number {
    return x * (1 + (Math.random() * 2 - 1) * amt)
  }

  /** 同类事件节流：间隔内只放第一声 */
  gate(key: string, gap: number): boolean {
    const c = this.ctx
    if (!c) return false
    const now = c.currentTime
    const last = this.lastPlay.get(key) ?? -1
    if (now - last < gap) return false
    this.lastPlay.set(key, now)
    return true
  }

  /** 程序生成混响脉冲响应：前 40ms 几颗早期反射 + 之后指数衰减立体声尾 */
  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const c = this.ctx as AudioContext
    const rate = c.sampleRate
    const len = Math.floor(rate * seconds)
    const buf = c.createBuffer(2, len, rate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
      ;[0.011, 0.019, 0.031, 0.037].forEach((t, k) => {
        const idx = Math.floor(t * rate)
        if (idx < len) d[idx] = (ch ? -0.5 : 0.6) * (1 - k * 0.18)
      })
    }
    return buf
  }

  private makeNoise(type: 'white' | 'brown'): AudioBuffer {
    const c = this.ctx as AudioContext
    const len = c.sampleRate * 2
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    if (type === 'brown') {
      let last = 0
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1
        last = (last + 0.02 * w) / 1.02
        d[i] = last * 3.2
      }
    } else {
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    }
    return buf
  }

  /** 对数空间扫频点列（人耳音高是对数感知，线性插值上挑会前慢后快） */
  sweep(f0: number, f1: number, n = 24): Float32Array {
    const pts = new Float32Array(n)
    for (let i = 0; i < n; i++) pts[i] = f0 * Math.pow(f1 / f0, i / (n - 1))
    return pts
  }
  /** 对数拱形扫频：upAt 前 f0→fPeak 指数上挑，之后回落到 f1 */
  sweepArch(f0: number, fPeak: number, f1: number, upAt = 0.55, n = 30): Float32Array {
    const pts = new Float32Array(n)
    const up = Math.round(n * upAt)
    for (let i = 0; i < n; i++) {
      if (i <= up) pts[i] = f0 * Math.pow(fPeak / f0, i / Math.max(1, up))
      else pts[i] = fPeak * Math.pow(f1 / fPeak, (i - up) / Math.max(1, n - 1 - up))
    }
    return pts
  }

  /**
   * 噪声 → 滤波 → 包络。
   * env：'hit' 8ms 快 attack（打击）｜'whip' 快起长尾（兵器掠过）｜'swell' 对称纺锤（环境风）
   */
  noise(o: {
    dur: number
    type?: BiquadFilterType
    f0?: number
    curve?: Float32Array | number[]
    q?: number
    vol: number
    at?: number
    pan?: number
    rev?: number
    bus?: GainNode
    env?: 'hit' | 'whip' | 'swell'
    buf?: AudioBuffer
  }): void {
    const c = this.ctx
    const m = this.sfxBus
    const rev = this.rev
    if (!c || !m || !rev || !this.white) return
    const t = c.currentTime + (o.at ?? 0)
    const src = c.createBufferSource()
    src.buffer = o.buf ?? this.white
    src.loop = true
    const flt = c.createBiquadFilter()
    flt.type = o.type ?? 'bandpass'
    flt.Q.value = o.q ?? 1
    if (o.curve) flt.frequency.setValueCurveAtTime(o.curve.map((v) => Math.max(30, v)), t, o.dur)
    else flt.frequency.setValueAtTime(o.f0 ?? 800, t)
    const g = c.createGain()
    const env = o.env ?? 'hit'
    if (env === 'whip') {
      const n = 44
      const cv = new Float32Array(n)
      for (let i = 0; i < n; i++) {
        const t01 = i / (n - 1)
        const k = t01 < 0.15 ? t01 / 0.15 : Math.pow(1 - (t01 - 0.15) / 0.85, 1.35)
        cv[i] = 0.0001 + k * o.vol
      }
      g.gain.setValueCurveAtTime(cv, t, o.dur)
    } else if (env === 'swell') {
      const n = 40
      const cv = new Float32Array(n)
      for (let i = 0; i < n; i++) cv[i] = 0.0001 + Math.sin((Math.PI * i) / (n - 1)) ** 2 * o.vol
      g.gain.setValueCurveAtTime(cv, t, o.dur)
    } else {
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(o.vol, t + Math.min(0.008, o.dur * 0.3))
      g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    }
    src.connect(flt)
    flt.connect(g)
    this.route(g, o.pan ?? 0, o.rev ?? 0, o.bus ?? m, rev)
    src.start(t)
    src.stop(t + o.dur + 0.05)
  }

  /** 单振荡器音（attack 可调：软腔体 pop 需要 18~22ms 软起音避免木鱼感） */
  osc(o: {
    wave: OscillatorType
    f0: number
    f1?: number
    dur: number
    vol: number
    at?: number
    pan?: number
    rev?: number
    attack?: number
    lp?: number
    bus?: GainNode
  }): void {
    const c = this.ctx
    const m = this.sfxBus
    const rev = this.rev
    if (!c || !m || !rev) return
    const t = c.currentTime + (o.at ?? 0)
    const oscN = c.createOscillator()
    oscN.type = o.wave
    oscN.frequency.setValueAtTime(o.f0, t)
    if (o.f1) oscN.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur)
    let head: AudioNode = oscN
    if (o.lp) {
      const flt = c.createBiquadFilter()
      flt.type = 'lowpass'
      flt.frequency.value = o.lp
      oscN.connect(flt)
      head = flt
    }
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(o.vol, t + (o.attack ?? 0.008))
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    head.connect(g)
    this.route(g, o.pan ?? 0, o.rev ?? 0, o.bus ?? m, rev)
    oscN.start(t)
    oscN.stop(t + o.dur + 0.05)
  }

  /**
   * 模态合成：物体碰撞 = 多个固有频率各自指数衰减。
   * 非谐比（1,2.32,3.88…）= 石头/自由棒；近整数比 = 金属/钟。
   */
  modal(
    base: number,
    ratios: number[],
    gains: number[],
    decays: number[],
    extra: { at?: number; pan?: number; rev?: number; vol?: number; bus?: GainNode } = {}
  ): void {
    ratios.forEach((r, i) => {
      this.osc({
        wave: 'sine',
        f0: this.j(base * r, 0.03),
        dur: decays[i],
        vol: gains[i] * (extra.vol ?? 1),
        at: extra.at,
        pan: extra.pan,
        rev: extra.rev,
        bus: extra.bus
      })
    })
  }

  /** FM 两算子（金属振铃/木鱼/铃核心） */
  private fm(o: {
    f: number
    ratio?: number
    index?: number
    f1?: number
    dur: number
    vol: number
    at?: number
    pan?: number
    rev?: number
  }): void {
    const c = this.ctx
    const m = this.sfxBus
    const rev = this.rev
    if (!c || !m || !rev) return
    const t = c.currentTime + (o.at ?? 0)
    const car = c.createOscillator()
    const mod = c.createOscillator()
    const mg = c.createGain()
    const g = c.createGain()
    car.type = 'sine'
    mod.type = 'sine'
    car.frequency.setValueAtTime(this.j(o.f), t)
    if (o.f1) car.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur)
    mod.frequency.setValueAtTime(this.j(o.f * (o.ratio ?? 2)), t)
    mg.gain.setValueAtTime(o.index ?? 60, t)
    mg.gain.exponentialRampToValueAtTime(1, t + o.dur)
    mod.connect(mg)
    mg.connect(car.frequency)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(o.vol, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    car.connect(g)
    this.route(g, o.pan ?? 0, o.rev ?? 0.15, m, rev)
    car.start(t)
    mod.start(t)
    car.stop(t + o.dur + 0.05)
    mod.stop(t + o.dur + 0.05)
  }

  /**
   * 湿水噪（软组织/黏液专用）：带通频率沿曲线下滑，
   * LFO 同时调制滤波频率（黏颤）与音量（咕嘟）——刀刃切进果冻的 shlop 核心。
   */
  private wetNoise(o: {
    dur: number
    curve: number[]
    q?: number
    vol: number
    at?: number
    pan?: number
    rev?: number
    wob?: number
    wobDepth?: number
    trem?: number
  }): void {
    const c = this.ctx
    const m = this.sfxBus
    const rev = this.rev
    const buf = this.white
    if (!c || !m || !rev || !buf) return
    const t = c.currentTime + (o.at ?? 0)
    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = o.q ?? 1.3
    bp.frequency.setValueCurveAtTime(o.curve.map((v) => Math.max(40, v)), t, o.dur)
    const lfo = c.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = o.wob ?? 7
    const lfoG = c.createGain()
    lfoG.gain.value = o.wobDepth ?? 120
    lfo.connect(lfoG)
    lfoG.connect(bp.frequency)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(o.vol, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur)
    const tremLfo = c.createOscillator()
    tremLfo.frequency.value = (o.wob ?? 7) * 1.37
    const tremG = c.createGain()
    tremG.gain.value = o.vol * (o.trem ?? 0.35)
    tremLfo.connect(tremG)
    tremG.connect(g.gain)
    src.connect(bp)
    bp.connect(g)
    this.route(g, o.pan ?? 0, o.rev ?? 0.08, m, rev)
    src.start(t)
    lfo.start(t)
    tremLfo.start(t)
    src.stop(t + o.dur + 0.05)
    lfo.stop(t + o.dur + 0.05)
    tremLfo.stop(t + o.dur + 0.05)
  }

  /** 粗粝声腔：低频声带经双共振峰与不规则颤音形成非语言喉声。 */
  voice(o: { pitch: number; formants: [number[], number[]]; dur: number; vol: number; at?: number; pan?: number; rev?: number }): void {
    const c = this.ctx, bus = this.sfxBus, rev = this.rev
    if (!c || !bus || !rev) return
    const t = c.currentTime + (o.at ?? 0)
    const source = c.createOscillator(), sub = c.createOscillator()
    source.type = 'sawtooth'; sub.type = 'triangle'
    source.frequency.setValueCurveAtTime(new Float32Array([o.pitch, o.pitch * .91, o.pitch * 1.04, o.pitch * .82, o.pitch * .76]), t, o.dur)
    sub.frequency.setValueAtTime(o.pitch * .503, t)
    const jitter = c.createOscillator(), jitterGain = c.createGain()
    jitter.frequency.value = 23; jitterGain.gain.value = o.pitch * .065
    jitter.connect(jitterGain); jitterGain.connect(source.frequency)
    const output = c.createGain(), low = c.createBiquadFilter()
    low.type = 'lowpass'; low.frequency.value = 1350; low.Q.value = .5
    const envelope = new Float32Array(64)
    for (let i = 0; i < envelope.length; i++) {
      const u = i / (envelope.length - 1)
      const shape = Math.min(1, u / .09) * Math.pow(1 - u, 1.3)
      const syllable = .58 + .23 * Math.sin(u * 22 + .4) + .14 * Math.sin(u * 39)
      envelope[i] = .0001 + o.vol * shape * syllable
    }
    output.gain.setValueCurveAtTime(envelope, t, o.dur)
    for (let i = 0; i < 2; i++) {
      const throat = c.createBiquadFilter(), gain = c.createGain()
      throat.type = 'bandpass'; throat.Q.value = i ? 2.4 : 3.2
      throat.frequency.setValueCurveAtTime(o.formants[i], t, o.dur)
      gain.gain.value = i ? .48 : 1
      source.connect(throat); throat.connect(gain); gain.connect(low)
    }
    const chest = c.createGain(); chest.gain.value = .24
    sub.connect(chest); chest.connect(low); low.connect(output)
    this.route(output, o.pan ?? 0, o.rev ?? .65, bus, rev)
    source.start(t); sub.start(t); jitter.start(t)
    source.stop(t + o.dur); sub.stop(t + o.dur); jitter.stop(t + o.dur)
  }

  /** 干声 → 总线（可声像）；湿声 → 卷积混响 */
  private route(node: AudioNode, pan: number, revAmt: number, bus: GainNode, rev: ConvolverNode): void {
    const c = this.ctx as AudioContext
    if (pan !== 0) {
      const p = c.createStereoPanner()
      p.pan.value = pan
      node.connect(p)
      p.connect(bus)
    } else {
      node.connect(bus)
    }
    if (revAmt > 0) {
      const s = c.createGain()
      s.gain.value = revAmt
      node.connect(s)
      s.connect(rev)
    }
  }

  // ============================================================
  // 动态洞穴环境（常驻：呼吸风 + 拍频嗡鸣 + 随机水滴/远岩裂，非死循环）
  // ============================================================

  private startAmbient(): AmbientHandle | null {
    const c = this.ctx
    const bus = this.envBus
    const rev = this.rev
    const brown = this.brown
    if (!c || !bus || !rev || !brown) return null
    const stops: AmbientStop[] = []
    let ambTimer = 0, ambTimer2 = 0

    // 风：棕噪低通，双频 LFO 调 cutoff + gain（风在巷道里转弯）
    const src = c.createBufferSource()
    src.buffer = brown
    src.loop = true
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 220
    const g = c.createGain()
    g.gain.value = 0.16
    const lfo1 = c.createOscillator()
    const lfo1g = c.createGain()
    lfo1.frequency.value = 0.07
    lfo1g.gain.value = 110
    lfo1.connect(lfo1g)
    lfo1g.connect(lp.frequency)
    const lfo2 = c.createOscillator()
    const lfo2g = c.createGain()
    lfo2.frequency.value = 0.17
    lfo2g.gain.value = 0.06
    lfo2.connect(lfo2g)
    lfo2g.connect(g.gain)
    src.connect(lp)
    lp.connect(g)
    g.connect(bus)
    src.start()
    lfo1.start()
    lfo2.start()
    stops.push({ stop: () => { src.stop(); lfo1.stop(); lfo2.stop() } })

    // 洞穴低频嗡鸣：52/55.3Hz 拍频
    ;[52, 55.3].forEach((f) => {
      const o = c.createOscillator()
      o.frequency.value = f
      const og = c.createGain()
      og.gain.value = 0.02
      o.connect(og)
      og.connect(bus)
      o.start()
      stops.push({ stop: () => o.stop() })
    })

    // 随机水滴 / 远处岩层闷裂（链式自调度，永不重复）
    let alive = true
    const drip = (): void => {
      if (!alive || !this.ctx) return
      this.noise({ dur: 0.006, type: 'highpass', f0: 2500, vol: 0.07, bus, rev: 0 })
      this.osc({ wave: 'sine', f0: this.rand(800, 1400), f1: 500, dur: 0.14, vol: 0.06, rev: 0.7, bus })
      ambTimer = window.setTimeout(drip, this.rand(2500, 7000))
    }
    const rumble = (): void => {
      if (!alive || !this.ctx) return
      this.noise({
        dur: this.rand(0.5, 0.9),
        type: 'lowpass',
        f0: 70,
        vol: 0.09,
        bus,
        rev: 0.4,
        buf: brown
      })
      ambTimer2 = window.setTimeout(rumble, this.rand(6000, 12000))
    }
    ambTimer = window.setTimeout(drip, 1200)
    ambTimer2 = window.setTimeout(rumble, 4000)
    return { stop: () => {
      alive = false; clearTimeout(ambTimer); clearTimeout(ambTimer2)
      for (const handle of stops) handle.stop()
      for (const node of [src, lp, g, lfo1, lfo1g, lfo2, lfo2g]) node.disconnect()
    } }
  }

  // ============================================================
  // 游戏事件音效
  // ============================================================

  /**
   * 镐击岩石：实声 thock（铁镐咬进硬岩）。
   * 砂质咬入下滑 + 低基频实心岩石模态（45ms 快死）+ 镐头短铁声
   * + 低频闷锤 + 细石屑 + 2.6k 石质脆点；几乎全干声保近场实感。
   * hpRatio 越低（岩石越碎）整体越闷。
   */
  pickHit(hpRatio = 1): void {
    this.ensure()
    if (!this.gate('pickHit', 0.03)) return
    const v = this.j(1)
    this.noise({ dur: 0.022, curve: [2750, 1550, 880], q: 1.3, vol: 0.2 * v, rev: 0.04 })
    const base = 168 + hpRatio * 150
    this.modal(
      this.j(base, 0.045),
      [1, 1.83, 2.76, 3.91],
      [0.6, 0.3, 0.13, 0.05],
      [0.045, 0.03, 0.02, 0.013],
      { vol: 0.6 * v, rev: 0.05 }
    )
    this.fm({ f: this.j(1320 + hpRatio * 360), ratio: 2.47, index: 42, dur: 0.05, vol: 0.055 * v, rev: 0.06 })
    this.osc({ wave: 'sine', f0: this.j(92 + hpRatio * 30), f1: 52, dur: 0.055, vol: 0.34 * v })
    const n = 2 + (Math.random() < 0.5 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      this.noise({
        dur: this.rand(0.012, 0.026),
        type: 'bandpass',
        f0: this.rand(900, 2100),
        q: this.rand(1.5, 3),
        vol: this.rand(0.04, 0.09) * v,
        at: this.rand(0.004, 0.02),
        rev: 0.06
      })
    }
    this.noise({ dur: 0.014, type: 'bandpass', f0: 2600, q: 3, vol: 0.045 * v, rev: 0.03 })
  }

  /** 矿石破碎：初始闷击 + 22 颗碎石颗粒（先密后疏/随机声像）+ 大碎片延迟落地 */
  pickBreak(size = 1): void {
    this.ensure()
    if (!this.gate('pickBreak', 0.05)) return
    this.osc({ wave: 'sine', f0: this.j(120), f1: 48, dur: 0.13, vol: 0.4 * size })
    this.noise({ dur: 0.14, type: 'lowpass', f0: 240, vol: 0.3 * size, buf: this.brown ?? undefined })
    const n = Math.round(16 * size + 6)
    for (let i = 0; i < n; i++) {
      this.noise({
        dur: this.rand(0.012, 0.045),
        type: 'bandpass',
        f0: this.rand(700, 3800),
        q: this.rand(1.5, 4.5),
        vol: this.rand(0.05, 0.16) * size,
        at: Math.pow(Math.random(), 1.8) * 0.16,
        pan: this.rand(-0.8, 0.8),
        rev: 0.18
      })
    }
    const big = Math.round(3 * size + 1)
    for (let i = 0; i < big; i++) {
      const at = this.rand(0.1, 0.34)
      window.setTimeout(() => {
        if (!this.ctx) return
        this.modal(
          this.j(this.rand(180, 340)),
          [1, 2.32, 3.9],
          [0.4, 0.18, 0.07],
          [0.04, 0.025, 0.014],
          { vol: 0.3 * size, pan: this.rand(-0.7, 0.7), rev: 0.22 }
        )
      }, at * 1000)
    }
  }

  /**
   * 武器挥击：中 Q 带音高的对数深扫（音高随刃速飙升）
   * + whip 不对称包络（快起长尾=掠过耳边）+ 峰值一闪的空气丝。
   */
  swing(shape: 'slash' | 'stab' = 'slash'): void {
    this.ensure()
    if (shape === 'slash') {
      // 音量为主人试玩标定（主呼啸 0.11 / 空气丝 0.025，约为初版一半，不抢命中音）
      this.noise({ dur: 0.2, curve: this.sweepArch(340, 2350, 620), q: 2.4, vol: 0.11, env: 'whip' })
      this.noise({ dur: 0.09, curve: this.sweep(2200, 6200), q: 4, vol: 0.025, at: 0.035, env: 'whip' })
    } else {
      // 突刺：短、直、狠的对数上挑
      this.noise({ dur: 0.13, curve: this.sweep(460, 2850), q: 2.6, vol: 0.09, env: 'whip' })
      this.noise({ dur: 0.07, curve: this.sweep(2400, 6800), q: 4, vol: 0.02, at: 0.04, env: 'whip' })
    }
  }
  /** 木弓纤维拉紧与松弦，声音随自动拉弦/释放节点触发。 */
  bowDraw():void {this.ensure();this.noise({dur:.28,curve:this.sweep(240,620),q:.75,vol:.065,env:'swell'});this.noise({dur:.12,type:'lowpass',f0:450,vol:.035,env:'swell'})}
  bowReady():void {this.ensure();this.noise({dur:.055,type:'bandpass',f0:740,q:.7,vol:.045})}
  private readonly bowReleaseBuffers=new Map<boolean,AudioBuffer>()
  bowRelease(charged=false):void {
    this.ensure();const c=this.ctx,bus=this.sfxBus,rev=this.rev;if(!c||!bus||!rev)return
    let buffer=this.bowReleaseBuffers.get(charged)
    if(!buffer){const data=createBowReleaseSample(c.sampleRate,charged);buffer=c.createBuffer(1,data.length,c.sampleRate);buffer.getChannelData(0).set(data);this.bowReleaseBuffers.set(charged,buffer)}
    const source=c.createBufferSource(),gain=c.createGain();source.buffer=buffer;gain.gain.value=charged?.32:.25
    source.connect(gain);this.route(gain,0,.035,bus,rev);source.start()
  }

  /**
   * 砍中敌人：刃切入软组织的 shlop（湿摩擦主音 + 软腔体 pop + 黏液拉丝 + 闭合啵）。
   * venom 毒液怪更湿更亮；slime 偏果冻低频。
   */
  meleeHit(kind: FleshKind = 'slime'): void {
    this.ensure()
    if (!this.gate('meleeHit', 0.045)) return
    const v = this.j(1)
    if(kind==='bat'){
      // 翼膜受击：轻肉响与干燥擦翼，保持和胶质敌人不同的材质。
      this.noise({dur:.09,curve:[1100,650,320],q:.8,vol:.17*v})
      this.osc({wave:'triangle',f0:this.j(175),f1:65,dur:.07,vol:.1*v,attack:.005,lp:800});return
    }
    if (kind === 'venom') {
      this.wetNoise({ dur: 0.13, curve: [1150, 900, 620, 380, 250], q: 1.4, vol: 0.28 * v, wob: 9, wobDepth: 150 })
      this.osc({ wave: 'sine', f0: this.j(270), f1: 85, dur: 0.09, vol: 0.17 * v, attack: 0.018 })
      this.wetNoise({ dur: 0.09, curve: [800, 560, 360], q: 2, vol: 0.12 * v, at: 0.05, wob: 8, wobDepth: 90, trem: 0.5 })
    } else {
      this.wetNoise({ dur: 0.14, curve: [920, 740, 520, 330, 235], q: 1.2, vol: 0.3 * v, wob: 7.5, wobDepth: 130 })
      this.osc({ wave: 'sine', f0: this.j(235), f1: 72, dur: 0.1, vol: 0.2 * v, attack: 0.022 })
      this.osc({ wave: 'triangle', f0: this.j(180), f1: 80, dur: 0.09, vol: 0.07 * v, attack: 0.02, lp: 700 })
      this.wetNoise({ dur: 0.1, curve: [640, 470, 320, 200], q: 1.8, vol: 0.13 * v, at: 0.055, wob: 6, wobDepth: 70, trem: 0.5 })
      this.osc({ wave: 'sine', f0: this.j(175), f1: 95, dur: 0.06, vol: 0.1 * v, at: 0.145 })
      this.noise({ dur: 0.03, curve: [1200, 700], q: 2.5, vol: 0.05 * v, at: 0.14 })
    }
  }

  /** 非镐武器砍在矿石上：石质 chk 垫底 + 1.6k 钝铁一闪 120ms 死透（去清脆） */
  pickSpark(): void {
    this.ensure()
    if (!this.gate('pickSpark', 0.05)) return
    const v = this.j(1)
    this.noise({ dur: 0.009, type: 'highpass', f0: 3400, vol: 0.16 * v })
    this.modal(
      this.j(215, 0.05),
      [1, 2.32, 3.9],
      [0.4, 0.16, 0.06],
      [0.045, 0.028, 0.016],
      { vol: 0.55 * v, rev: 0.06 }
    )
    const f = this.j(1620, 0.05)
    this.modal(f, [1, 2.01, 2.98], [0.14, 0.07, 0.03], [0.12, 0.08, 0.05], { vol: 0.8 * v, rev: 0.12 })
    this.fm({ f: f * 0.98, f1: f * 1.03, ratio: 4.02, index: 12, dur: 0.06, vol: 0.025 * v, rev: 0.08 })
  }

  /** 挖矿爆怪·裂土预警：低频棕噪上行 + 土裂颗粒（0.35s 警示） */
  burrowWarn(pan = 0, delay = 0): void {
    this.ensure()
    const c = this.ctx
    const m = this.sfxBus
    const rev = this.rev
    const brown = this.brown
    if (!c || !m || !rev || !brown) return
    const t = c.currentTime + delay
    const src = c.createBufferSource()
    src.buffer = brown
    src.loop = true
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(80, t)
    lp.frequency.exponentialRampToValueAtTime(240, t + 0.35)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    src.connect(lp)
    lp.connect(g)
    this.route(g, pan, 0.25, m, rev)
    src.start(t)
    src.stop(t + 0.4)
    ;[0.08, 0.22].forEach((at) =>
      this.noise({ dur: 0.05, type: 'bandpass', f0: this.rand(180, 320), q: 2, vol: 0.12, at: delay + at, pan, rev: 0.2 })
    )
  }

  /** 挖矿爆怪·破土钻出：土爆闷击 + 12 颗土粒飞溅 */
  burrowEmerge(pan = 0): void {
    this.ensure()
    this.osc({ wave: 'sine', f0: 90, f1: 45, dur: 0.16, vol: 0.4, pan })
    this.noise({ dur: 0.18, type: 'lowpass', f0: 320, vol: 0.32, pan, rev: 0.15, buf: this.brown ?? undefined })
    for (let i = 0; i < 12; i++) {
      this.noise({
        dur: this.rand(0.02, 0.07),
        type: 'bandpass',
        f0: this.rand(150, 700),
        q: this.rand(1, 3),
        vol: this.rand(0.05, 0.14),
        at: Math.pow(Math.random(), 1.5) * 0.14,
        pan,
        rev: 0.2
      })
    }
    this.noise({ dur: 0.05, type: 'highpass', f0: 1800, vol: 0.06, pan })
  }

  /** 顶棚坠落砸地：短促重击、石粒弹跳与洞穴低频回响。 */
  ceilingImpact(pan=0):void{
    this.ensure()
    this.osc({wave:'sine',f0:130,f1:38,dur:.2,vol:.36,pan,rev:.22})
    this.noise({dur:.1,type:'lowpass',f0:780,vol:.28,pan,rev:.25,buf:this.brown??undefined})
    for(let i=0;i<6;i++)this.noise({dur:.025+i*.004,type:'bandpass',f0:420+i*270,q:1.8,vol:.09-i*.009,at:.035+i*.028,pan,rev:.2})
  }

  /** 毒液怪吐弹：straight=湿气泡上挑 blip；ring=一圈齐喷的厚湿 chuff */
  enemyShoot(kind: 'straight' | 'ring', pan = 0): void {
    this.ensure()
    if (!this.gate(`shoot:${kind}`, kind === 'ring' ? 0.12 : 0.05)) return
    if (kind === 'ring') {
      this.wetNoise({ dur: 0.18, curve: [360, 300, 230, 170], q: 1.1, vol: 0.26, pan, wob: 8, wobDepth: 60, trem: 0.25 })
      this.osc({ wave: 'sine', f0: 200, f1: 110, dur: 0.16, vol: 0.16, pan, attack: 0.015 })
      this.noise({ dur: 0.1, type: 'highpass', f0: 1500, vol: 0.05, at: 0.02, pan })
    } else {
      this.wetNoise({ dur: 0.07, curve: [500, 720, 900], q: 2, vol: 0.16, pan, wob: 10, wobDepth: 50, trem: 0.2 })
      this.osc({ wave: 'sine', f0: 300, f1: 540, dur: 0.09, vol: 0.12, pan, rev: 0.1 })
    }
  }

  /** 毒液弹撞墙：极短湿溅（环弹齐撞有节流兜底） */
  bulletSplat(pan = 0): void {
    this.ensure()
    if (!this.gate('bulletSplat', 0.05)) return
    this.noise({ dur: 0.05, curve: [900, 400], q: 2, vol: 0.07, pan })
    this.osc({ wave: 'sine', f0: 200, f1: 120, dur: 0.04, vol: 0.06, pan })
  }

  /**
   * 符卡·祓：阳光钟鸣 + 光脉绽开（重做，替代旧的廉价上行琶音）
   * @param pulse 第几波（0=首波低基频 E5 大钟；1=0.4s 后回响，高五度 B5、更轻更短）
   */
  spellCast(pulse = 0): void {
    this.ensure()
    const echo = pulse > 0
    // 首波 E5 大钟；第二声高五度，像光波二次绽开的泛音回响
    const base = echo ? 987.77 : 659.25
    const v = echo ? 0.78 : 1
    // —— 模态钟铃：近整数谐波 = 金属/钟（基频+八度+三重属音+泛音），尾音悠长 ——
    this.modal(
      base,
      echo ? [1, 2, 2.76, 4.07] : [1, 2, 2.76, 4.07, 5.4],
      echo ? [0.12, 0.06, 0.034, 0.016] : [0.15, 0.075, 0.045, 0.026, 0.014],
      echo ? [1.0, 0.8, 0.6, 0.45] : [1.5, 1.2, 0.95, 0.7, 0.5],
      { vol: v, rev: 0.55 }
    )
    // 起手晶亮"叮"（FM 高频金属振铃，钟声上方的光泽）
    this.fm({ f: base * 2.36, ratio: 2.0, index: 10, dur: echo ? 0.22 : 0.34, vol: 0.05 * v, rev: 0.55 })
    // —— 光脉绽开：带通噪声拱形扫频（低→明亮峰值→回落，伴随光波扩散） ——
    this.noise({
      dur: 0.55,
      curve: this.sweepArch(680, echo ? 4600 : 5800, 1100, 0.42),
      q: 1.7,
      vol: 0.1 * v,
      rev: 0.42
    })
    // —— 低频"嗡"冲击（给光浪重量，不飘） ——
    this.osc({ wave: 'sine', f0: echo ? 142 : 108, f1: 46, dur: 0.55, vol: 0.1 * v, rev: 0.25, attack: 0.005 })
    // 高频空气闪光（爆开瞬间的"嗤"）
    this.noise({ dur: 0.1, type: 'highpass', f0: 6200, vol: 0.045 * v })
  }

  /** 石门解封：低频 rumble + 石面摩擦颗粒 */
  doorOpen(): void {
    this.ensure()
    if (!this.gate('doorOpen', 0.15)) return
    this.noise({ dur: 0.9, type: 'lowpass', f0: 120, vol: 0.2, rev: 0.3, buf: this.brown ?? undefined })
    this.noise({ dur: 0.85, curve: [300, 420, 360, 480, 400], q: 2.5, vol: 0.08, at: 0.05, rev: 0.25 })
    this.osc({ wave: 'sine', f0: 58, dur: 0.9, vol: 0.14 })
  }

  /**
   * 序章破门·第一/二声闷敲：身体撞厚木门。
   * 低频冲击（60~75Hz 快衰）+ 木板非谐模态 + 槌头闷肉噪声；strong＝第二声略重。
   * @param delay 排队延迟（导演一次性排 0 / 0.55s 两敲）
   */
  doorKnock(pan = 0, strong = false, delay = 0): void {
    this.ensure()
    const v = strong ? 1.15 : 0.9
    const at = delay
    // 身体撞门的低频轰
    this.osc({ wave: 'sine', f0: strong ? 74 : 66, f1: 38, dur: 0.15, vol: 0.42 * v, at, pan, attack: 0.004 })
    // 厚木板模态（非谐比＝木自由板）
    this.modal(
      strong ? 118 : 106,
      [1, 2.12, 3.95, 5.6],
      [0.16, 0.07, 0.026, 0.012],
      [0.1, 0.07, 0.05, 0.035],
      { at, pan, vol: v, rev: 0.12 }
    )
    // 槌头闷肉声
    this.noise({ dur: 0.05, type: 'lowpass', f0: 250, vol: 0.16 * v, at, pan })
    // 门洞腔体回响
    this.noise({
      dur: 0.22,
      type: 'lowpass',
      f0: 150,
      vol: 0.1 * v,
      at: at + 0.01,
      pan,
      rev: 0.25,
      buf: this.brown ?? undefined
    })
  }

  /**
   * 序章破门·第三声撞破（嘭！！）：木纹劈裂 → 门闩崩断 → 门板轰开倒地 + 碎木飞溅。
   * @param delay 排队延迟（导演排在两声闷敲之后）
   */
  doorBust(pan = 0, delay = 0): void {
    this.ensure()
    // 0.00 木纹第一道劈裂（高频下扫的噼裂）
    this.noise({ dur: 0.12, curve: [1800, 900, 520], q: 1.8, vol: 0.2, at: delay, pan, env: 'whip' })
    // 0.03 门闩崩断
    this.noise({ dur: 0.045, type: 'highpass', f0: 2600, vol: 0.12, at: delay + 0.03, pan })
    this.osc({ wave: 'square', f0: 180, f1: 80, dur: 0.06, vol: 0.05, at: delay + 0.03, pan, lp: 900 })
    // 0.10 整块门板轰开
    this.osc({ wave: 'sine', f0: 78, f1: 36, dur: 0.32, vol: 0.46, at: delay + 0.1, pan, attack: 0.004 })
    this.noise({
      dur: 0.3,
      type: 'lowpass',
      f0: 210,
      vol: 0.3,
      at: delay + 0.1,
      pan,
      rev: 0.2,
      buf: this.brown ?? undefined
    })
    // 0.12 起碎木颗粒飞溅
    for (let i = 0; i < 9; i++) {
      this.noise({
        dur: this.rand(0.02, 0.08),
        type: 'bandpass',
        f0: this.rand(300, 1400),
        q: this.rand(1, 3),
        vol: this.rand(0.05, 0.13),
        at: delay + 0.12 + Math.pow(Math.random(), 1.4) * 0.2,
        pan,
        rev: 0.15
      })
    }
    // 0.3 门板砸地的第二记闷响
    this.osc({ wave: 'sine', f0: 62, f1: 34, dur: 0.18, vol: 0.22, at: delay + 0.3, pan, attack: 0.004 })
    this.noise({
      dur: 0.16,
      type: 'lowpass',
      f0: 170,
      vol: 0.14,
      at: delay + 0.3,
      pan,
      rev: 0.15,
      buf: this.brown ?? undefined
    })
  }

  /** 梦想封印·梦幻光弹：首爆立即出声，五爆声像由实际爆点提供。 */
  dreamSeal(pans: number[]): void {
    this.ensure()
    const c = this.ctx
    const bus = this.sfxBus
    const rev = this.rev
    if (!c || !bus || !rev) return
    const duration = 1.65
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * duration), c.sampleRate)
    const data = buffer.getChannelData(0)
    let low = 0
    let mid = 0
    let grit = 0
    for (let n = 0; n < data.length; n++) {
      const t = n / c.sampleRate
      const white = Math.random() * 2 - 1
      // 一阶滤波按真实采样率设置，分离压力、声体与破裂三个频段。
      low += (1 - Math.exp(-2 * Math.PI * 240 / c.sampleRate)) * (white - low)
      mid += (1 - Math.exp(-2 * Math.PI * 1800 / c.sampleRate)) * (white - mid)
      grit += (1 - Math.exp(-2 * Math.PI * 6200 / c.sampleRate)) * (white - grit)
      const attack = 1 - Math.exp(-t * 260)
      const tail = Math.pow(Math.max(0, 1 - t / duration), 1.7)
      const body = attack * Math.exp(-t * 1.7) * tail
      const rolling = 0.76 + 0.14 * Math.sin(t * 39) + 0.1 * Math.sin(t * 67 + 1.2)
      const expansion = 0.7 + 0.55 * Math.exp(-Math.pow((t - 0.12) / 0.1, 2))
      const crack = attack * Math.exp(-t * 19)
      data[n] = (low * 3.1 + (mid - low) * 1.45) * body * rolling * expansion
        + (grit - mid) * (crack * 0.45 + body * 0.34);
    }
    let peak = 0
    for (const value of data) peak = Math.max(peak, Math.abs(value))
    for (let n = 0; n < data.length; n++) data[n] *= 0.82 / Math.max(peak, 0.001)

    const play = (at: number, gain: number, pan: number, cutoff: number, rate = 1): void => {
      const source = c.createBufferSource()
      source.buffer = buffer
      source.playbackRate.value = rate
      const filter = c.createBiquadFilter()
      filter.type = 'lowpass'
      filter.Q.value = 0.65
      filter.frequency.setValueAtTime(cutoff, c.currentTime + at)
      filter.frequency.exponentialRampToValueAtTime(420, c.currentTime + at + duration / rate)
      const volume = c.createGain()
      volume.gain.value = gain
      source.connect(filter)
      filter.connect(volume)
      this.route(volume, pan, 0.48, bus, rev)
      source.start(c.currentTime + at)
      source.onended = () => { source.disconnect(); filter.disconnect(); volume.disconnect() }
    }
    // 梦幻光弹：展开光泽与微失谐泛音，不以铃声替换爆体重量。
    for (const [k, f] of [660, 990, 1320].entries()) {
      this.osc({ wave: 'sine', f0: f * 0.85, f1: f, dur: 0.75, vol: 0.023, attack: 0.45, pan: (k - 1) * 0.5, rev: 0.55 })
      this.osc({ wave: 'sine', f0: f * 1.004, dur: 1.5, vol: 0.022, at: 1.25 + k * 0.025, pan: (1 - k) * 0.45, rev: 0.65 })
    }
    for (let i = 0; i < 5; i++) {
      const at = i * 0.3
      const gain = i === 4 ? 0.48 : 0.36
      play(at, gain, pans[i], 7200, i === 4 ? 0.88 : 1 + i * 0.025)
      // 同源反射保留爆体相关性，不另敲一串噪声；左右错开形成扩散。
      play(at + 0.075, gain * 0.22, Math.max(-1, Math.min(1, -pans[i] - 0.15)), 3400)
      play(at + 0.14, gain * 0.15, pans[i] * 0.5 + 0.2, 2400, 0.96)
      play(at + 0.235, gain * 0.09, -0.3, 1600, 0.93)
      this.osc({ wave: 'sine', f0: 1440, f1: 720, dur: 0.5, vol: 0.04, at: at + 0.03, pan: pans[i], rev: 0.55, attack: 0.025 })
      this.fm({ f: 1080, ratio: 2.005, index: 170, dur: 0.75, vol: 0.026, at: at + 0.12, pan: -pans[i], rev: 0.6 })
    }
  }

  /**
   * 序章黑场行路·划火柴：磷头摩擦砂纸的细碎嘶响（0.2s）→ 火苗"噗"地燃起。
   * 黑场转入行路段时播一声，交代"点了根火柴照路"。
   */
  matchStrike(): void {
    this.ensure()
    // 磷头划过砂纸：高频嘶响，略带起伏
    this.noise({ dur: 0.22, curve: [1400, 2200, 2600, 1700], q: 2.2, vol: 0.07, env: 'whip' })
    // 0.16s 起火：低频软"噗" + 一小团暖色燃声
    this.osc({ wave: 'sine', f0: 92, dur: 0.12, vol: 0.06, at: 0.16, attack: 0.02 })
    this.noise({ dur: 0.16, type: 'bandpass', f0: 900, vol: 0.05, at: 0.16, env: 'swell' })
  }

  /** 行路脚步调度句柄（主角/灵梦两条独立随机步态链；空＝未在走） */
  private footTimers: ReturnType<typeof setTimeout>[] = []

  /**
   * 序章黑场行路：两条独立脚步链——主角（左、软底重步）与灵梦（右、轻步略带硬底脆响），
   * 各自步频不同且每步间隔随机抖动，永不机械同拍；每步音量/音高/落点随机、
   * 偶发碎石与衣料摩擦，轻混响裹出洞室空间感。stopFootsteps 停止。
   */
  startFootsteps(): void {
    this.ensure()
    if (this.footTimers.length) return
    // 错半拍起步：主角先落步，灵梦半拍后跟上
    this.scheduleFootstep('hero', 0.06)
    this.scheduleFootstep('reimu', 0.32)
  }

  /** 排程下一声脚步（递归 setTimeout；间隔随机＝真实步态的不均匀感） */
  private scheduleFootstep(who: 'hero' | 'reimu', delay: number): void {
    const timer = setTimeout(() => {
      this.footstep(who)
      // 主角步幅大、约 0.46~0.58s 一步；灵梦步幅小、约 0.5~0.64s 一步
      const next = who === 'hero' ? 0.46 + Math.random() * 0.12 : 0.5 + Math.random() * 0.14
      this.scheduleFootstep(who, next)
    }, delay * 1000)
    this.footTimers.push(timer)
  }

  /** 停止行路脚步（黑场淡出、基地浮现时调用） */
  stopFootsteps(): void {
    for (const t of this.footTimers) clearTimeout(t)
    this.footTimers = []
  }

  /**
   * 单声脚步（三层 + 随机）：
   * ① 脚掌落地低频"噗"：sine 70→36Hz 下坠，肉垫感；
   * ② 鞋底碾地闷响：棕噪低通短扫频，包络快起慢放；
   * ③ 质感层：主角偶发踏碎小石砾（中低频脆响），灵梦硬底一声轻"哒"（高频 click）；
   * 偶发衣料摩擦"沙"。每步力度/音高/声像独立抖动，轻混响交代洞穴纵深。
   */
  private footstep(who: 'hero' | 'reimu'): void {
    const hero = who === 'hero'
    const step = 0.82 + Math.random() * 0.36 // 每步落地力度 ±18%
    const pan = (hero ? -0.22 : 0.24) + (Math.random() - 0.5) * 0.08
    const vol = hero ? 1 : 0.72
    const pitch = hero ? 1 : 1.12
    const rev = 0.14

    // ① 低频肉垫"噗"（起音稍快、尾音自然散）
    this.osc({
      wave: 'sine',
      f0: 70 * pitch * (0.94 + Math.random() * 0.12),
      f1: 36 * pitch,
      dur: 0.14,
      vol: 0.09 * vol * step,
      pan,
      attack: 0.009,
      rev
    })
    // ② 鞋底碾地：棕噪低通，频率先顶起再回落（脚掌重心从脚跟滚到脚尖）
    this.noise({
      dur: 0.15,
      type: 'lowpass',
      curve: [170, 300, 250, 150].map((f) => f * pitch),
      q: 0.9,
      vol: 0.1 * vol * step,
      pan,
      buf: this.brown ?? undefined,
      env: 'hit',
      rev
    })
    // ③ 质感层
    if (hero) {
      // 主角：28% 概率踏到碎石——极短带通"咔嚓"
      if (Math.random() < 0.28) {
        this.noise({
          dur: 0.05,
          type: 'bandpass',
          f0: 680 + Math.random() * 320,
          q: 4,
          vol: 0.05 * step,
          pan,
          env: 'hit',
          rev: 0.1
        })
      }
    } else {
      // 灵梦：硬底每步一点轻"哒"（短脆 click，音量小，像薄底鞋/木屐）
      this.noise({
        dur: 0.045,
        type: 'bandpass',
        f0: 1250 + Math.random() * 260,
        q: 5,
        vol: 0.045 * step,
        pan,
        env: 'hit',
        rev: 0.12
      })
    }
    // 12% 概率衣料/装备摩擦的一声细"沙"（左右不绑定，模拟两人并排走的细碎动静）
    if (Math.random() < 0.12) {
      this.noise({
        dur: 0.09,
        type: 'highpass',
        f0: 3400,
        vol: 0.016,
        pan: pan * 0.6,
        env: 'swell'
      })
    }
  }

  /** 拾取掉落：FM 木鱼双音上扬叮咚 */
  pickup(): void {
    this.ensure()
    this.gate('pickup', 0.03)
    this.fm({ f: 880, ratio: 3.01, index: 30, dur: 0.09, vol: 0.1, rev: 0.25 })
    this.fm({ f: 1320, ratio: 3.01, index: 24, dur: 0.14, vol: 0.09, at: 0.07, rev: 0.3 })
  }

  /** 吃饭团：温暖柔和的上行短双音 */
  heal(): void {
    this.ensure()
    this.osc({ wave: 'sine', f0: 523, dur: 0.12, vol: 0.1, rev: 0.3, attack: 0.012 })
    this.osc({ wave: 'sine', f0: 784, dur: 0.18, vol: 0.1, at: 0.08, rev: 0.32, attack: 0.012 })
    this.fm({ f: 1047, ratio: 2, index: 8, dur: 0.16, vol: 0.03, at: 0.08, rev: 0.35 })
  }

  /** 玩家受伤：短促擦击、中频实体感与低频闷冲，略抬响度但快速收尾。 */
  hurt(): void {
    this.ensure()
    if (!this.gate('playerHurt', .075)) return
    const volume = this.j(1, .035), tone = this.j(1, .04)
    // 明确的起音帮助小音箱辨识受伤，宽带瞬态不使用尖锐金属鸣响。
    this.noise({ dur: .032, type: 'bandpass', curve: [2200, 1600, 850], q: .45, vol: .085 * volume, env: 'hit', rev: .025 })
    this.osc({ wave: 'sine', f0: 185 * tone, f1: 64, dur: .14, vol: .25 * volume, attack: .003, lp: 620, rev: .035 })
    this.osc({ wave: 'triangle', f0: 310 * tone, f1: 140, dur: .075, vol: .055 * volume, attack: .004, lp: 950, rev: .025 })
    // 衣料与身体的闷擦紧跟撞击，保持和砍中史莱姆的湿黏音色有区别。
    this.noise({ dur: .105, buf: this.brownNoise, type: 'bandpass', curve: [1000, 520, 260], q: .6, vol: .095 * volume, at: .012, env: 'hit', rev: .035 })
  }

  /** 玩家倒下：下行长哀音 */
  playerDie(): void {
    this.ensure()
    this.osc({ wave: 'sine', f0: 320, f1: 70, dur: 0.6, vol: 0.16, rev: 0.3, attack: 0.02 })
    this.noise({ dur: 0.4, curve: [500, 300, 150], q: 0.8, vol: 0.08, at: 0.05, env: 'swell' })
  }

  /** 史莱姆死亡：果冻爆浆（湿摩擦大下滑 + 软 pop + 小气泡） */
  enemyDie(kind: FleshKind = 'slime'): void {
    this.ensure()
    if (!this.gate('enemyDie', 0.03)) return
    const v = this.j(1)
    if(kind==='bat'){
      // 短促下滑的吱声配合翼膜收落，避免史莱姆爆浆声。
      this.osc({wave:'triangle',f0:this.j(1700),f1:420,dur:.15,vol:.075*v,attack:.01,lp:2600})
      this.noise({dur:.12,curve:[1300,650,240],q:.8,vol:.12*v,at:.06});return
    }
    const hi = kind === 'venom' ? 1150 : 920
    this.wetNoise({ dur: 0.18, curve: [hi, hi * 0.7, 420, 240, 160], q: 1.2, vol: 0.28 * v, wob: 7, wobDepth: 100 })
    this.osc({ wave: 'sine', f0: this.j(210), f1: 60, dur: 0.14, vol: 0.2 * v, attack: 0.015 })
    // 2~3 颗上升小气泡（胶体里逸出的泡）
    const n = 2 + (Math.random() < 0.5 ? 1 : 0)
    for (let i = 0; i < n; i++) {
      const f0 = this.rand(260, 420)
      this.osc({
        wave: 'sine',
        f0,
        f1: f0 * this.rand(1.5, 2.1),
        dur: 0.07,
        vol: 0.06 * v,
        at: 0.06 + i * 0.035,
        rev: 0.15
      })
    }
  }

  /** 房间清场：柔和三音琶音（松一口气） */
  roomClear(): void {
    this.ensure()
    ;[440, 554, 659].forEach((f, i) => {
      const last = i === 2
      this.osc({
        wave: 'triangle',
        f0: f,
        dur: last ? 0.4 : 0.24,
        vol: 0.1,
        at: i * 0.1,
        rev: 0.45,
        attack: 0.015
      })
      this.osc({
        wave: 'sine',
        f0: f * 2,
        dur: last ? 0.36 : 0.2,
        vol: 0.028,
        at: i * 0.1,
        rev: 0.5,
        attack: 0.015
      })
    })
  }

  /** 工作台制作：加工轻响配合两颗短钟音，连续点击时控制叠音密度。 */
  workbenchCraft(fiber:boolean):void{
    this.ensure()
    if(!this.gate('workbenchCraft',.1))return
    if(fiber){
      this.noise({dur:.19,curve:[900,1700,650],q:.7,vol:.045,env:'swell'})
      this.modal(360,[1,2.8],[.1,.03],[.04,.025],{at:.32,vol:.55})
    }else{
      this.noise({dur:.075,type:'lowpass',f0:1400,vol:.035})
      this.modal(245,[1,2.7,5.1],[.18,.06,.018],[.075,.035,.02],{at:.19,vol:.65,rev:.04})
      this.noise({dur:.018,type:'highpass',f0:1700,vol:.035,at:.19})
    }
    this.modal(660,[1,2.01],[.055,.012],[.13,.06],{at:.34,vol:.55,rev:.08})
    this.modal(880,[1,2.01],[.045,.01],[.17,.07],{at:.41,vol:.55,rev:.08})
  }

  /** 熔炉分步维修：砌补、缝补风箱、装接并试火，节奏对应界面的动作。 */
  furnaceRepair(stage:number):void{
    this.ensure()
    if(!this.gate('furnaceRepair',1.4))return
    if(stage===0){
      for(const at of [.375,.78,1.14]){
        this.modal(190,[1,2.32,3.88],[.14,.055,.016],[.12,.055,.03],{at,vol:.8,rev:.08})
        this.noise({dur:.045,curve:[1800,850,360],q:.8,vol:.065,at})
      }
    }else if(stage===1){
      for(const at of [.25,.48,.72])this.noise({dur:.12,curve:[1100,1700,750],q:.7,vol:.055,at,env:'swell'})
      this.modal(290,[1,2.7],[.12,.025],[.08,.04],{at:1.08,vol:.65})
      this.noise({dur:.2,curve:[420,1150,500],q:.6,vol:.09,at:1.17,env:'swell'})
    }else{
      this.modal(590,[1,2.01,3.98],[.11,.035,.012],[.15,.065,.035],{at:.5,vol:.7,rev:.08})
      this.noise({dur:.23,curve:[440,1350,580],q:.65,vol:.095,at:.64,env:'swell'})
      this.noise({dur:.28,type:'lowpass',f0:1600,vol:.1,at:.81,env:'swell',buf:this.brown??undefined})
      for(const at of [.86,.97,1.12])this.noise({dur:.035,type:'highpass',f0:2300,vol:.04,at})
    }
    this.modal(660,[1,2.01],[.08,.015],[.19,.08],{at:1.32,vol:.6,rev:.12})
    this.modal(880,[1,2.01],[.06,.01],[.24,.1],{at:1.39,vol:.6,rev:.12})
  }

  /** 热锭烫手：极短滋声配上更细的蒸汽尾声，与惨叫台词同帧触发。 */
  hotIngot():void{
    this.ensure()
    this.noise({dur:.075,type:'highpass',f0:2800,vol:.16,env:'hit',rev:.035})
    this.noise({dur:.23,type:'bandpass',curve:[1800,4300,1600],q:.7,vol:.09,at:.035,env:'swell',rev:.05})
  }
  /** 深处闷响保留石质摩擦，前奏不会误听成近身攻击。 */
  mineDistant():void{
    this.ensure()
    this.noise({dur:.8,type:'lowpass',curve:[90,240,150,70],q:.55,vol:.14,buf:this.brown??undefined,env:'swell',rev:.22})
    this.osc({wave:'sine',f0:61,f1:37,dur:.7,vol:.045,attack:.08,rev:.2})
  }
  /** 零星石屑撞地的短脆声，间距不均匀，和整片塌方区分。 */
  minePebbles():void{
    this.ensure()
    for(const [i,at]of [.035,.16,.32,.48].entries()){
      this.noise({dur:.025+i*.004,type:'bandpass',curve:[2300-i*260,850,320],q:.6,vol:.04+i*.008,at,rev:.11})
      this.modal(340+i*91,[1,2.43],[.08,.015],[.035,.02],{at,vol:.4,rev:.09})
    }
  }
  /** 崩塌分为断裂骤响、连续落石和低频轰鸣，随后碎石收尾。 */
  mineCollapse():void{
    this.ensure()
    this.noise({dur:.18,type:'bandpass',curve:[2200,1100,300],q:.5,vol:.3,env:'hit',rev:.16})
    this.noise({dur:2.1,type:'lowpass',curve:[95,450,750,420,80],q:.5,vol:.31,buf:this.brown??undefined,env:'swell',rev:.2})
    this.osc({wave:'sine',f0:94,f1:32,dur:1.5,vol:.12,attack:.012,rev:.13})
    for(let i=0;i<9;i++){
      const at=.12+i*.17
      this.noise({dur:.07,type:'bandpass',curve:[1500+i%3*250,580,170],q:.7,vol:.12-i*.007,at,rev:.12})
      this.modal(170+i%4*46,[1,2.37,4.12],[.14,.035,.012],[.09,.045,.025],{at,vol:.55,rev:.12})
    }
  }

  /** 熔炉出货：夹取摩擦、金属落盘，再用两声短亮音确认收好。 */
  furnaceClaim():void{
    this.ensure()
    if(!this.gate('furnaceClaim',.3))return
    this.noise({dur:.13,type:'bandpass',curve:[550,1100,430],q:.7,vol:.045,env:'swell',rev:.025})
    this.modal(350,[1,2.13,3.76],[.14,.045,.012],[.12,.065,.03],{at:.25,vol:.65,rev:.065})
    this.modal(660,[1,2.01],[.075,.015],[.2,.075],{at:.54,vol:.5,rev:.1})
    this.modal(880,[1,2.01],[.055,.01],[.24,.085],{at:.62,vol:.5,rev:.1})
  }

  /** 烹饪成功：温暖的上行钟音，最后一音带柔和和弦尾响。 */
  cookingSuccess():void{
    this.ensure()
    if(!this.gate('cookingSuccess',.3))return
    const notes=[523.25,659.25,783.99,1046.5]
    notes.forEach((frequency,i)=>{
      const at=i*.095,last=i===notes.length-1
      this.modal(frequency,[1,2.01,3.97],[.14,.045,.015],last?[.55,.32,.18]:[.25,.14,.08],{at,vol:.65,rev:.25})
      this.osc({wave:'sine',f0:frequency/2,dur:last?.45:.18,vol:.028,at,attack:.012,rev:.18})
    })
    this.osc({wave:'sine',f0:523.25,dur:.55,vol:.032,at:.285,attack:.025,rev:.3})
    this.osc({wave:'sine',f0:659.25,dur:.48,vol:.025,at:.285,attack:.025,rev:.3})
  }

  /** 火把点燃：一簇噼啪（0.45s 节流，避免全屋叠加爆音） */
  torchIgnite(): void {
    this.ensure()
    const c = this.ctx
    if (!c) return
    if (c.currentTime < this.crackleLockUntil) return
    this.crackleLockUntil = c.currentTime + 0.45
    for (let i = 0; i < 6; i++) {
      this.noise({
        dur: 0.05,
        type: 'highpass',
        f0: 1400 + Math.random() * 900,
        vol: 0.1 + Math.random() * 0.08,
        at: Math.random() * 0.35
      })
    }
  }

  /** 闪避：短而快的贴身气流 */
  dodge(): void {
    this.ensure()
    this.noise({ dur: 0.14, curve: this.sweep(400, 1500), q: 1.4, vol: 0.13, env: 'whip' })
    this.noise({ dur: 0.1, type: 'lowpass', f0: 300, vol: 0.07, env: 'whip', buf: this.brown ?? undefined })
  }

  /** UI 木质轻叩（预留：后续界面批次挂接） */
  uiTap(): void {
    this.ensure()
    this.modal(420, [1, 2.9, 5.4], [0.25, 0.1, 0.03], [0.03, 0.018, 0.01], { vol: 0.5, rev: 0.08 })
    this.noise({ dur: 0.006, type: 'highpass', f0: 2000, vol: 0.05 })
  }

  // ============================================================
  // 剧情音效（序章/基地对白节点经具名 action 触发）
  // ============================================================

  /**
   * 肚子咕噜叫：两团低频气音（棕噪低通 + 纺锤包络），
   * 第二声更长更沉，底下垫两音下潜的腹鸣正弦。
   */
  stomachGrowl(): void {
    this.ensure()
    this.noise({ dur: 0.5, type: 'lowpass', f0: 165, vol: 0.26, env: 'swell', buf: this.brown ?? undefined })
    this.osc({ wave: 'sine', f0: 78, f1: 50, dur: 0.46, vol: 0.1, attack: 0.03 })
    this.noise({ dur: 0.72, type: 'lowpass', f0: 130, vol: 0.3, at: 0.52, env: 'swell', buf: this.brown ?? undefined })
    this.osc({ wave: 'sine', f0: 66, f1: 42, dur: 0.66, vol: 0.12, at: 0.52, attack: 0.03 })
  }

  /**
   * 爬绳摩擦（约 2 秒）：中段一长条麻绳干摩擦（带通噪声纺锤），
   * 上面叠不规则的抓绳/蹬壁颗粒，偶有一声绳股绷紧的低鸣。
   */
  ropeClimb(): void {
    this.ensure()
    this.noise({ dur: 2.0, type: 'bandpass', f0: 760, q: 0.8, vol: 0.07, env: 'swell' })
    this.noise({ dur: 1.86, type: 'lowpass', f0: 240, vol: 0.05, at: 0.07, env: 'swell', buf: this.brown ?? undefined })
    for (let i = 0; i < 10; i++) {
      this.noise({
        dur: this.rand(0.05, 0.16),
        type: 'bandpass',
        f0: this.rand(520, 1700),
        q: this.rand(1, 2.6),
        vol: this.rand(0.04, 0.1),
        at: 0.08 + Math.pow(Math.random(), 0.8) * 1.75
      })
    }
    this.osc({ wave: 'sine', f0: 52, f1: 40, dur: 0.3, vol: 0.08, at: 0.9, attack: 0.05 })
  }

  /**
   * 开旧木箱：合叶吱呀（不规则扫频的干摩擦）→ 一团灰尘扑出
   * → 箱盖落定的木板闷响。总长约 0.7s。
   */
  chestOpen(): void {
    this.ensure()
    // 合叶吱呀：频率来回发涩的带通摩擦
    this.noise({ dur: 0.42, curve: [320, 560, 430, 820, 610], q: 2.4, vol: 0.1, env: 'whip' })
    this.osc({ wave: 'sawtooth', f0: 150, f1: 300, dur: 0.34, vol: 0.018, lp: 600 })
    // 拍灰：低通尘团 + 高频细尘
    this.noise({ dur: 0.42, type: 'lowpass', f0: 480, vol: 0.13, at: 0.16, env: 'swell', buf: this.brown ?? undefined })
    this.noise({ dur: 0.3, type: 'highpass', f0: 2600, vol: 0.025, at: 0.16 })
    // 箱盖落：木板非谐模态 + 一记低频木 thock
    this.modal(118, [1, 2.12, 3.95], [0.16, 0.07, 0.026], [0.09, 0.06, 0.04], { at: 0.46, vol: 0.9, rev: 0.1 })
    this.osc({ wave: 'sine', f0: 96, f1: 58, dur: 0.1, vol: 0.16, at: 0.46 })
  }

  /**
   * 收音机电流杂音：搜台噪扫（三段晃频）→ 噪声团中冒出两个柔和乐音，
   * 暗示盒子自己唱起歌来。
   */
  radioStatic(): void {
    this.ensure()
    this.noise({ dur: 1.0, type: 'bandpass', f0: 1700, q: 0.7, vol: 0.1, env: 'swell' })
    this.noise({ dur: 0.14, curve: this.sweep(900, 3200), q: 2, vol: 0.07, at: 0.12 })
    this.noise({ dur: 0.12, curve: this.sweep(2800, 1200), q: 2, vol: 0.06, at: 0.3 })
    this.noise({ dur: 0.1, curve: this.sweep(1400, 3600), q: 2.4, vol: 0.05, at: 0.46 })
    // 乐音从噪声里浮出来
    this.osc({ wave: 'triangle', f0: 659.25, dur: 0.22, vol: 0.06, at: 0.66, attack: 0.03 })
    this.osc({ wave: 'triangle', f0: 880, dur: 0.3, vol: 0.06, at: 0.8, attack: 0.03 })
  }

  /** 收音机切歌咔哒：开关短爆 + 一小截静电尾巴 */
  radioClick(): void {
    this.ensure()
    this.osc({ wave: 'square', f0: 130, f1: 70, dur: 0.045, vol: 0.05, lp: 900 })
    this.noise({ dur: 0.03, type: 'highpass', f0: 2200, vol: 0.09 })
    this.noise({ dur: 0.09, type: 'bandpass', f0: 2400, vol: 0.035, at: 0.02 })
  }
}

/** 全局单例 */
export const sfx = new AudioEngine()
