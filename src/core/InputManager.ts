/**
 * 键鼠输入管理器
 * - 键盘：持续按下（isDown）+ 边沿触发（justPressed，本帧消费一次）
 * - 鼠标：屏幕坐标、世界坐标（由场景每帧通过 setWorldMouse 回填）、左键边沿
 * - action 语义：玩法层优先用 isActionDown/actionPressed（读 keymap 绑定，支持改键）
 */
import { keymap, MOUSE_LEFT, MOUSE_RIGHT, type ActionId, type BindToken } from './keymap'

export class InputManager {
  /** 当前持续按下的物理按键 code 集合 */
  private down = new Set<string>()
  /** 本帧刚按下的边沿集合（帧末清空） */
  private pressed = new Set<string>()
  /** 本帧刚松开的边沿集合（帧末清空） */
  private released = new Set<string>()
  /** 各按键按下时刻（performance.now 毫秒） */
  private downAt = new Map<string, number>()

  /** 鼠标屏幕坐标（CSS 像素，相对 canvas 左上角） */
  mouseX = 0
  mouseY = 0
  /** 鼠标世界坐标（由相机反算后回填） */
  worldMouseX = 0
  worldMouseY = 0

  /** 左键是否按住（suppressed 期间对外恒为 false，物理状态仍记录在 _mouseDown） */
  get mouseDown(): boolean {
    return !this.suppressed && this._mouseDown
  }
  /** 左键本帧是否刚按下（suppressed 期间对外恒为 false） */
  get mousePressed(): boolean {
    return !this.suppressed && this._mousePressed
  }
  /** 右键本帧是否刚按下（suppressed 期间对外恒为 false） */
  get mouseRightPressed(): boolean {
    return !this.suppressed && this._mouseRightPressed
  }
  /** 滚轮本帧增量（suppressed 期间对外恒为 0） */
  get wheelDelta(): number {
    return this.suppressed ? 0 : this._wheelDelta
  }
  private _mouseDown = false
  private _mousePressed = false
  private _mouseReleased = false
  private _mouseRightPressed = false
  private _mouseRightDown = false
  private _mouseRightReleased = false
  private _wheelDelta = 0

  /**
   * 输入抑制（调试控制台打开时置 true）：
   * 所有玩法查询（键盘/鼠标/action）对外恒为"未按下"，
   * 物理按键仍照常记录，关闭控制台时由调用方 reset() 清场，防止卡键与漏击。
   */
  suppressed = false

  private el: HTMLElement | null = null

  /** 绑定到指定元素（通常是 canvas） */
  attach(el: HTMLElement): void {
    this.el = el
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    el.addEventListener('mousemove', this.onMouseMove)
    el.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    el.addEventListener('contextmenu', this.onContextMenu)
    el.addEventListener('wheel', this.onWheel, { passive: true })
  }

  /** 解绑所有监听 */
  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.el?.removeEventListener('mousemove', this.onMouseMove)
    this.el?.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.el?.removeEventListener('contextmenu', this.onContextMenu)
    this.el?.removeEventListener('wheel', this.onWheel)
    this.el = null
  }

  /** 转场结束时丢弃过渡期间的输入，避免按住交互或攻击漏入新场景。 */
  reset(): void {
    this.onBlur()
    this.pressed.clear()
    this.released.clear()
    this._mousePressed = false
    this._mouseReleased = false
    this._mouseRightPressed = false
    this._mouseRightReleased = false
    this._wheelDelta = 0
  }

  /** 按键是否按住（如 KeyW / Space）；控制台抑制期间恒 false */
  isDown(...codes: string[]): boolean {
    return !this.suppressed && codes.some((c) => this.down.has(c))
  }

  /** 按键是否在本帧刚按下（边沿触发，不消费，帧末自动清除）；抑制期间恒 false */
  justPressed(...codes: string[]): boolean {
    return !this.suppressed && codes.some((c) => this.pressed.has(c))
  }

  /** 按键是否在本帧刚松开；抑制期间恒 false */
  justReleased(...codes: string[]): boolean {
    return !this.suppressed && codes.some((c) => this.released.has(c))
  }

  /** 按键已持续按住的秒数（未按下返回 0） */
  holdSeconds(code: string): number {
    const t = this.downAt.get(code)
    if (t === undefined) return 0
    return (performance.now() - t) / 1000
  }

  // —— action 语义（绑定表在 keymap，支持玩家改键） ——

  /** 单个绑定记号当前是否按住（含鼠标左右键）；抑制期间恒 false */
  private tokenDown(token: BindToken): boolean {
    if (this.suppressed) return false
    if (token === MOUSE_LEFT) return this._mouseDown
    if (token === MOUSE_RIGHT) return this._mouseRightDown
    return this.down.has(token)
  }

  private tokenPressed(token: BindToken): boolean {
    if (this.suppressed) return false
    if (token === MOUSE_LEFT) return this._mousePressed
    if (token === MOUSE_RIGHT) return this._mouseRightPressed
    return this.pressed.has(token)
  }

  private tokenReleased(token: BindToken): boolean {
    if (this.suppressed) return false
    if (token === MOUSE_LEFT) return this._mouseReleased
    if (token === MOUSE_RIGHT) return this._mouseRightReleased
    return this.released.has(token)
  }

  /** action 是否按住（任一绑定命中即可） */
  isActionDown(action: ActionId): boolean {
    return keymap.bindings[action].some((t) => this.tokenDown(t))
  }

  /** action 本帧是否刚按下 */
  actionPressed(action: ActionId): boolean {
    return keymap.bindings[action].some((t) => this.tokenPressed(t))
  }

  /** action 本帧是否刚松开 */
  actionReleased(action: ActionId): boolean {
    return keymap.bindings[action].some((t) => this.tokenReleased(t))
  }

  /** 帧末清理边沿状态（由引擎在每帧逻辑结束后调用） */
  endFrame(): void {
    this.pressed.clear()
    this.released.clear()
    this._mousePressed = false
    this._mouseReleased = false
    this._mouseRightPressed = false
    this._mouseRightReleased = false
    this._wheelDelta = 0
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    // 阻止空格/方向键滚动页面；阻止 Shift 触发 Windows 粘滞键提示；Tab 留给背包开关
    if (
      [
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ShiftLeft',
        'ShiftRight',
        'Tab'
      ].includes(e.code)
    ) {
      e.preventDefault()
    }
    if (!this.down.has(e.code)) {
      this.pressed.add(e.code)
      this.downAt.set(e.code, performance.now())
    }
    this.down.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.down.has(e.code)) this.released.add(e.code)
    this.down.delete(e.code)
    this.downAt.delete(e.code)
  }

  /** 窗口失焦时清空所有按键，防止"卡键"（场景层据 held=false 自行回收按压判定） */
  private onBlur = (): void => {
    this.down.clear()
    this.downAt.clear()
    this._mouseDown = false
    this._mouseReleased = false
    this._mouseRightDown = false
    this._mouseRightReleased = false
  }

  private updateMousePos(e: MouseEvent): void {
    const rect = this.el?.getBoundingClientRect()
    if (!rect) return
    this.mouseX = e.clientX - rect.left
    this.mouseY = e.clientY - rect.top
  }

  private onMouseMove = (e: MouseEvent): void => {
    this.updateMousePos(e)
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.updateMousePos(e)
    if (e.button === 0) {
      this._mouseDown = true
      this._mousePressed = true
    } else if (e.button === 2) {
      this._mouseRightPressed = !this._mouseRightDown
      this._mouseRightDown = true
    }
  }

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) {
      this._mouseReleased = this._mouseDown
      this._mouseDown = false
    } else if (e.button === 2) {
      this._mouseRightReleased = this._mouseRightDown
      this._mouseRightDown = false
    }
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault()
  }

  private onWheel = (e: WheelEvent): void => {
    this._wheelDelta = e.deltaY
  }
}
