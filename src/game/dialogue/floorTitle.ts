/**
 * 楼层标题卡服务（全局单例）
 *
 * 进入序章/矿洞楼层时屏幕正中淡入大字（如「序章 · 迷失之境」
 * 「异界矿洞 · 地下一层」），时间线：淡入 → 停留 → 淡出。
 * 组件 FloorTitle.vue 订阅 phase 用 CSS 过渡呈现；本服务只管节拍与回调，
 * 背景的黑场/模糊显影由调用方（导演/切房流程）另行编排，互不耦合。
 */
import { ref, type Ref } from 'vue'

export type FloorTitlePhase = 'idle' | 'in' | 'hold' | 'out'

export interface FloorTitleState {
  /** 文案 i18n 键 */
  key: string
  /** 淡入中 / 停留 / 淡出（组件据此切透明度 class） */
  phase: FloorTitlePhase
  /** 每次显示自增（重放入场动画） */
  seq: number
}

/** 标题卡节拍（毫秒） */
const DEFAULT_TIMING = { inMs: 1000, holdMs: 1500, outMs: 900 }

class FloorTitleService {
  readonly current: Ref<FloorTitleState | null> = ref(null)
  private seqCounter = 0
  private timers: number[] = []
  private doneCb: (() => void) | null = null

  /**
   * 播放一张标题卡。
   * @param key 文案 i18n 键
   * @param onDone 完全淡出后回调（序章用来接续黑屏独白）
   */
  show(key: string, onDone?: () => void, timing: Partial<typeof DEFAULT_TIMING> = {}): void {
    this.cancelTimers()
    this.doneCb = onDone ?? null
    const tm = { ...DEFAULT_TIMING, ...timing }
    this.seqCounter++
    this.current.value = { key, phase: 'in', seq: this.seqCounter }
    // 淡入 → 停留 → 淡出 → 收工
    this.timers.push(
      window.setTimeout(() => this.setPhase('hold'), tm.inMs),
      window.setTimeout(() => this.setPhase('out'), tm.inMs + tm.holdMs),
      window.setTimeout(() => this.finish(), tm.inMs + tm.holdMs + tm.outMs)
    )
  }

  /** 立刻收起（切场景等兜底；不触发 onDone） */
  dismiss(): void {
    this.cancelTimers()
    this.doneCb = null
    this.current.value = null
  }

  get active(): boolean {
    return this.current.value !== null
  }

  private setPhase(phase: FloorTitlePhase): void {
    if (this.current.value) this.current.value = { ...this.current.value, phase }
  }

  private finish(): void {
    this.current.value = null
    const cb = this.doneCb
    this.doneCb = null
    cb?.()
  }

  private cancelTimers(): void {
    for (const id of this.timers) clearTimeout(id)
    this.timers = []
  }
}

export const floorTitle = new FloorTitleService()
