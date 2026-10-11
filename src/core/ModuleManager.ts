import { withPresentationQueue } from './simulation/presentation'
import { profiler } from './performance/Profiler'
/**
 * 模块管理器：引擎唯一持有的"根场景"
 *
 * 自身实现 GameScene 契约，并将渲染帧拆成固定逻辑步——
 * 引擎只知道每帧驱动一个场景，至于当前是矿洞还是据点，由本管理器转发。
 */
import type { EngineContext, GameScene } from './types'
import { EventBus } from './EventBus'
import type { IGameModule, ModuleContext } from './module'
import { SimulationClock } from './SimulationClock'
import { FixedStep } from './simulation/FixedStep'
import { SimulationSession, ReplayRecorder, stateChecksum, sessionChecksum, SIMULATION_VERSION, type SimulationReplay, type SessionSnapshot } from './simulation/SimulationSession'
import { withInterpolation } from './simulation/interpolation'
import { withoutPersistence, setSimulationReadOnly } from './simulation/persistence'
let managerSequence=0

export interface SimulationSnapshot {
  version: number
  contentVersion: string
  module: string
  state: unknown
  session: SessionSnapshot
  time: number
  timing: { hitStop: number }
}

export class ModuleManager<E extends object = Record<string, unknown>>
  implements GameScene
{
  readonly bus: EventBus<E> = new EventBus<E>()
  readonly clock = new SimulationClock()
  simulation = new SimulationSession()
  readonly fixedStep = new FixedStep()
  private tickRateStarted = performance.now()
  private tickRateCount = 0
  private tickRateValue = 0
  /** 每秒实际执行的逻辑步数；真实时间只用于性能统计，不参与玩法计时。 */
  get tps(): number {
    const now = performance.now(), elapsed = now - this.tickRateStarted
    if (elapsed >= 500) {
      this.tickRateValue = this.tickRateCount * 1000 / elapsed
      this.tickRateStarted = now; this.tickRateCount = 0
    }
    return this.clock.paused || this.transition || !this.current ? 0 : this.tickRateValue
  }
  private resetTickRate(): void {
    this.tickRateStarted = performance.now(); this.tickRateCount = 0; this.tickRateValue = 0
  }
  contentVersion: () => string = () => `模拟${SIMULATION_VERSION}`
  private readonly recorder = new ReplayRecorder<SimulationSnapshot>()
  private externalChecksum = ''
  private playback: { replay: SimulationReplay<SimulationSnapshot>; cursor: number; returnTo: SimulationSnapshot } | null = null
  lastReplay: SimulationReplay<SimulationSnapshot> | null = null
  onReplayError: ((error: unknown) => void) | null = null
  get recording(): boolean { return this.recorder.recording }
  get replaying(): boolean { return this.playback !== null }
  private resetFrameTime = true
  private readonly persistenceKey=`回放:${++managerSequence}`
  setPaused(reason: string, paused: boolean): void {
    const wasPaused=this.clock.paused
    this.clock.setPaused(reason, paused)
    if(wasPaused!==this.clock.paused){this.resetFrameTime=true;this.fixedStep.reset();this.resetTickRate()}
  }
  private modules = new Map<string, IGameModule>()
  private current: IGameModule | null = null
  private mctx: ModuleContext<E>
  onTransition: ((state: { destination: string; failed: boolean } | null) => void) | null = null
  private transition: { id: string; payload?: unknown; start: number; switched: boolean } | null = null

  /** 幕间全遮挡时交接模块；短暂停留不是实际加载进度。 */
  transitionTo(id: string, payload?: unknown, failed = false): void {
    if (this.transition || this.playback) return
    if (!this.modules.has(id)) throw new Error(`ModuleManager：未注册的模块「${id}」`)
    this.transition = { id, payload, start: performance.now(), switched: false }
    this.onTransition?.({ destination: id, failed })
  }

  get transitioning(): boolean { return this.transition !== null }

  constructor() {
    // engine 在 enter（引擎挂载）时才就位，先占位
    this.mctx = {
      engine: null as unknown as EngineContext,
      bus: this.bus as EventBus<E>,
      manager: this
    } as ModuleContext<E>
  }

  /** 注册模块（不触发 onEnter） */
  register(mod: IGameModule): void {
    this.modules.set(mod.id, mod)
  }

  /** GameScene 钩子：引擎挂载时注入引擎上下文 */
  enter(engine: EngineContext): void {
    ;(this.mctx as { engine: EngineContext }).engine = engine
  }

  /** 切换当前模块（旧模块 onExit → 新模块 onEnter） */
  switchTo(id: string, payload?: unknown): void {
    const next = this.modules.get(id)
    if (!next) throw new Error(`ModuleManager：未注册的模块「${id}」`)
    this.current?.onExit()
    this.current = next
    this.fixedStep.reset()
    this.resetTickRate()
    this.mctx.engine.input.discardPending()
    this.mctx.engine.restoreTiming?.({hitStop:0})
    this.simulation.run(() => next.onEnter(this.mctx, payload))
  }

  get currentId(): string | null {
    return this.current?.id ?? null
  }

  /** 返回标题或读取其他档时释放当前场景，撤销剧情与输入监听。 */
  leave(): void {
    this.finishRecording()
    if(this.playback)this.stopReplay()
    this.transition = null
    this.onTransition = null
    this.current?.onExit()
    this.fixedStep.reset()
    this.mctx.engine.input.discardPending()
    this.current = null
    this.resetTickRate()
  }

  /** 当前模块的 HUD 快照（无模块/无实现时返回 null） */
  getHudState(): Record<string, unknown> | null {
    return this.current?.getHudState?.() ?? null
  }

  captureSimulation(): SimulationSnapshot {
    if (!this.current?.captureSimulation || this.transition) throw new Error('当前场景暂时不能建立模拟快照')
    return { version: SIMULATION_VERSION, contentVersion: this.contentVersion(), module: this.current.id, state: this.current.captureSimulation(), session: this.simulation.snapshot(), time: this.clock.time, timing: this.mctx.engine.captureTiming?.() ?? { hitStop: 0 } }
  }
  private inputStateChecksum():string {
    return stateChecksum({module:this.currentId,state:this.current?.captureInputState?.()??this.current?.captureSimulation?.()})
  }

  restoreSimulation(snapshot: SimulationSnapshot): void {
    if (snapshot.version !== SIMULATION_VERSION || snapshot.contentVersion !== this.contentVersion()) throw new Error('模拟快照与当前内容版本不兼容')
    let backup: SimulationSnapshot | null = null
    try { backup=this.captureSimulation() } catch { /* 演出结束或回放收尾时仍允许恢复已验证的快照。 */ }
    try { this.applySimulation(snapshot) }
    catch(error) {
      if(backup)withoutPersistence(()=>this.applySimulation(backup!))
      throw error
    }
  }

  private applySimulation(snapshot: SimulationSnapshot): void {
    const module = this.modules.get(snapshot.module)
    if (!module?.restoreSimulation) throw new Error('快照对应的场景不支持恢复')
    const listener = this.simulation.onEvents
    if (snapshot.session.random.seed !== this.simulation.random.seed) this.simulation = new SimulationSession(snapshot.session.random.seed)
    this.simulation.onEvents = listener
    this.simulation.run(() => {
      if (this.current !== module) this.switchTo(module.id)
      module.restoreSimulation!(structuredClone(snapshot.state))
    })
    this.simulation.restore(snapshot.session); this.clock.restoreTime(snapshot.time)
    this.mctx.engine.restoreTiming?.(snapshot.timing)
    this.fixedStep.reset(); this.mctx.engine.input.reset()
    this.resetTickRate()
  }

  startRecording(): void {
    if (this.playback) throw new Error('回放期间不能开始录制')
    const snapshot = this.captureSimulation()
    this.lastReplay = null
    this.recorder.start(snapshot, snapshot.session, snapshot.contentVersion)
    this.externalChecksum = this.inputStateChecksum()
  }

  finishRecording(): SimulationReplay<SimulationSnapshot> | null {
    const replay = this.recorder.finish()
    if (replay) this.lastReplay = replay
    return replay
  }

  playReplay(replay: SimulationReplay<SimulationSnapshot>): void {
    if (replay.version !== SIMULATION_VERSION || replay.dt !== FixedStep.DT || replay.contentVersion !== this.contentVersion() || !Array.isArray(replay.commands) || !Array.isArray(replay.checkpoints)) throw new Error('录像与当前内容版本不兼容')
    if(replay.commands.some((command,index)=>command.tick!==replay.session.tick+index+1))throw new Error('录像输入时序不连续')
    const returnTo = this.captureSimulation()
    this.finishRecording()
    withoutPersistence(() => this.restoreSimulation(replay.initial))
    this.playback = { replay: structuredClone(replay), cursor: 0, returnTo }
    setSimulationReadOnly(this.persistenceKey,true)
    this.mctx.engine.input.setCommandSource(() => this.playback?.replay.commands[this.playback.cursor] ?? null)
  }

  stopReplay(): void {
    const playback = this.playback
    this.playback = null; this.mctx.engine.input.setCommandSource(null)
    setSimulationReadOnly(this.persistenceKey,false)
    if (playback) withoutPersistence(() => this.restoreSimulation(playback.returnTo))
  }

  update(dt: number, engine: EngineContext): void {
    const transition = this.transition
    if (transition) { this.fixedStep.reset(); engine.input.discardPending() }
    if (transition) {
      const elapsed = performance.now() - transition.start
      if (!transition.switched && elapsed >= 300) {
        transition.switched = true
        this.switchTo(transition.id, transition.payload)
        // 至少渲染一次新场景，再允许解除覆盖层与输入锁。
        return
      }
      if (elapsed >= 2500) {
        engine.input.reset()
        this.transition = null
        this.onTransition?.(null)
      }
      return
    }
    const current = this.current
    current?.handleUIInput?.(engine)
    // 界面按真实渲染帧响应；暂停期间不积攒玩法输入或追赶欠账。
    if (this.clock.paused || !current) {
      this.fixedStep.reset(); engine.input.discardPending()
      current?.updatePaused?.(engine)
      return
    }
    // 后台标签页可能几分钟都没有渲染帧；恢复的首帧丢弃真实时间差。
    if(this.resetFrameTime){
      this.resetFrameTime=false;this.fixedStep.reset();engine.input.discardPending()
      current.updatePaused?.(engine)
      return
    }
    engine.input.captureFrame()
    this.fixedStep.advance(dt, stepDt => {
      if (this.playback && this.playback.cursor >= this.playback.replay.commands.length) { this.stopReplay(); return false }
      // 只在显式录制时捕获外部变更，正常游玩不逐帧序列化整个地图。
      let external: SimulationSnapshot | undefined
      if (this.recording) {
        try { if (this.inputStateChecksum() !== this.externalChecksum) external = this.captureSimulation() }
        catch { this.finishRecording() }
      }
      this.clock.advance(stepDt)
      const command = engine.input.beginTick(this.simulation.tick + 1)
      if (external) command.external = external
      try {
        if (this.playback && command.external) {
          const snapshot = command.external as SimulationSnapshot
          withoutPersistence(() => this.restoreSimulation(snapshot))
          this.clock.advance(stepDt)
          // 恢复会清掉设备残留，但本逻辑步继续使用已录制的输入。
          engine.input.beginTick(command.tick)
        }
        if (command.tick !== this.simulation.tick + 1) throw new Error('录像输入时序不连续')
        const update = () => this.simulation.step(() => withPresentationQueue(() => this.current?.update(stepDt, engine)))
        if (this.playback) withoutPersistence(update); else update()
        this.tickRateCount++
        this.recorder.record(command)
        if (this.recording) {
          try {
            this.externalChecksum = this.inputStateChecksum()
            if (this.simulation.tick % 300 === 0) {const snapshot=this.captureSimulation();this.recorder.checkpoint(snapshot, snapshot.session)}
          } catch { this.finishRecording() }
        }
        if (this.playback) {
          const offset = ++this.playback.cursor
          const checkpoint = this.playback.replay.checkpoints.find(point => point.offset === offset)
          if (checkpoint && (stateChecksum(this.captureSimulation().state) !== stateChecksum(checkpoint.state.state) || sessionChecksum(this.simulation.snapshot()) !== sessionChecksum(checkpoint.session))) throw new Error('录像状态校验失败')
        }
      } catch (error) {
        if (!this.playback) throw error
        this.stopReplay(); this.onReplayError?.(error)
        return false
      }
      finally { engine.input.endTick() }
      return !this.clock.paused && !this.transition && this.current === current
    })
  }

  render(g: CanvasRenderingContext2D, engine: EngineContext): void {
    profiler.count('tps',this.tps)
    this.simulation.run(() => withInterpolation(this.clock.paused ? 1 : this.fixedStep.alpha, () => this.current?.render(g, engine)))
  }
}
