/**
 * 教程气泡服务（全局单例）
 *
 * 与对话的区别：不冻结游戏、无说话人、无选项——屏幕上一块小木牌，
 * 玩家可以边操作边读；支持"等待确认"（modal，需按 F/点击消失）与
 * 自动消失两种。序章导演用它做操作教学，未来路途提示也走它。
 *
 * 文本同样只存 i18n 键。
 */
import { ref, type Ref } from 'vue'

export interface TutorialState {
  /** i18n 键 */
  key: string
  /** 插值参数 */
  params?: Record<string, string | number>
  /** 是否需要按键确认（true＝挡住推进直到确认） */
  modal: boolean
  /** 每次显示自增（重放 CSS 动画） */
  seq: number
}

class TutorialService {
  /** 当前气泡（null＝不显示；同一时刻只允许一条，后到覆盖） */
  readonly current: Ref<TutorialState | null> = ref(null)
  private seqCounter = 0
  private hideTimer = 0

  /**
   * 显示一条教程气泡。
   * @param key i18n 键
   * @param modal true＝需 F/点击确认才消失；false＝durationMs 后自动消失
   */
  show(key: string, opts?: { modal?: boolean; durationMs?: number; params?: Record<string, string | number> }): void {
    clearTimeout(this.hideTimer)
    this.seqCounter++
    this.current.value = {
      key,
      params: opts?.params,
      modal: opts?.modal ?? false,
      seq: this.seqCounter
    }
    if (!opts?.modal) {
      this.hideTimer = window.setTimeout(() => {
        this.current.value = null
      }, opts?.durationMs ?? 3600)
    }
  }

  /** 确认/关闭（modal 气泡用；非 modal 也允许提前关） */
  dismiss(): void {
    clearTimeout(this.hideTimer)
    this.current.value = null
  }

  get isModal(): boolean {
    return this.current.value?.modal === true
  }
}

export const tutorial = new TutorialService()
