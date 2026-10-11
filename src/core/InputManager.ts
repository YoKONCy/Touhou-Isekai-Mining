/**
 * 键鼠输入管理器
 * - 键盘：持续按下（isDown）+ 边沿触发（justPressed，本帧消费一次）
 * - 鼠标：屏幕坐标、世界坐标（由场景每帧通过 setWorldMouse 回填）、左键边沿
 * - action 语义：玩法层优先用 isActionDown/actionPressed（读 keymap 绑定，支持改键）
 */
import { emptyCommand, type InputCommand } from './simulation/InputCommand'
import { FixedStep } from './simulation/FixedStep'
import type { PlayerCommand } from './simulation/PlayerCommand'
import type { SearchCommand } from '../shared/search'
import { keymap, MOUSE_LEFT, MOUSE_RIGHT, type ActionId, type BindToken } from './keymap'
import { GamepadInput, type GamepadFrame } from './GamepadInput'
import { displaySettings, viewport, touchControls, activateGamepad, deactivateGamepad } from '../browser/display'

export class InputManager {
  private readonly gamepad=new GamepadInput()
  private gamepadContext:(()=>{index:number;hand:number})|null=null
  private pad:GamepadFrame={down:new Set(),pressed:new Set(),released:new Set(),active:false}
  private padAim:{x:number;y:number}|null=null
  private padsAvailable=false
  setGamepadContext(read:()=>{index:number;hand:number}):void { this.gamepadContext=read }
  pollDevices():void {
    if(!this.padsAvailable&&!this.pad.connected){
      if(viewport.lastInput==='gamepad'){this.cancelTouchActions();this.padAim=null;deactivateGamepad()}
      return
    }
    const connected=this.pad.connected
    try {
      const context=!document.hidden?this.gamepadContext?.():undefined
      this.pad=this.gamepad.read(displaySettings.controls==='auto'&&context?context.index:-1,context?.hand??0)
    } catch { this.pad={down:new Set(),pressed:new Set(),released:new Set(),active:false} }
    if(!this.pad.connected&&(connected||viewport.lastInput==='gamepad')){this.cancelTouchActions();this.padAim=null;deactivateGamepad()}
    if(this.pad.active)activateGamepad()
    if(this.pad.aim){const length=Math.hypot(this.pad.aim.x,this.pad.aim.y);this.padAim={x:this.pad.aim.x/length,y:this.pad.aim.y/length}}
  }
  private touchDown = new Set<ActionId>()
  private touchPressed = new Set<ActionId>()
  private touchReleased = new Set<ActionId>()
  private touchMove: { x: number; y: number } | null = null
  private touchAim: { x: number; y: number } | null = null
  private touchCancel = false
  /** 触控入口只提交语义动作，不派发虚假的键鼠事件。 */
  setTouchAction(action: ActionId, held: boolean): void {
    if (held && !this.touchDown.has(action)) this.touchPressed.add(action)
    if (!held && this.touchDown.has(action)) this.touchReleased.add(action)
    if (held) this.touchDown.add(action); else this.touchDown.delete(action)
  }
  setTouchMove(x: number, y: number): void { this.touchMove = { x, y } }
  setTouchAim(x: number, y: number): void { const length = Math.hypot(x, y); if (length > .01) this.touchAim = { x: x / length, y: y / length } }
  cancelTouchAction(action: ActionId): void {
    this.touchDown.delete(action); this.touchPressed.delete(action); this.touchReleased.delete(action)
    this.queued.actionsDown = this.queued.actionsDown.filter(value => value !== action)
    this.queued.actionsPressed = this.queued.actionsPressed.filter(value => value !== action)
    this.queued.actionsReleased = this.queued.actionsReleased.filter(value => value !== action)
    this.touchCancel = true; this.queued.cancelActions = true
  }
  cancelTouchActions(): void {
    this.touchAim = null
    this.touchDown.clear(); this.touchPressed.clear(); this.touchReleased.clear(); this.touchMove = null; this.touchCancel = true
    this.queued.actionsDown = []; this.queued.actionsPressed = []; this.queued.actionsReleased = []; this.queued.movement = undefined; this.queued.cancelActions = true
  }
  get movement(): { x: number; y: number } | undefined { return this.suppressed ? undefined : this.command ? this.command.movement : touchControls.value?this.touchMove??undefined:viewport.lastInput==='gamepad'?this.pad.movement:undefined }
  get cancelActions(): boolean { return this.command?.cancelActions === true }
  private command: InputCommand | null = null
  private queued = emptyCommand(0)
  private readonly heldTicks = new Map<string, number>()
  private commandSource: ((tick: number) => InputCommand | null) | null = null
  /** 注入录像或脚本操作；空值恢复真实设备输入。 */
  setCommandSource(source: ((tick: number) => InputCommand | null) | null): void { this.commandSource = source; this.discardPending(true) }
  /** 界面先消费自己的快捷键，剩余边沿留到下一次逻辑更新。 */
  captureFrame(): void {
    const q = this.queued
    q.down = this.suppressed ? [] : [...this.down]
    q.actionsDown = Object.keys(keymap.bindings).filter(a => this.isActionDown(a as ActionId))
    q.mouseX = this.mouseX; q.mouseY = this.mouseY
    for (const code of this.pressed) if (!this.suppressed && !q.pressed.includes(code)) q.pressed.push(code)
    for (const code of this.released) if (!this.suppressed && !q.released.includes(code)) q.released.push(code)
    for (const action of Object.keys(keymap.bindings) as ActionId[]) {
      if (this.actionPressed(action) && !q.actionsPressed.includes(action)) q.actionsPressed.push(action)
      if (this.actionReleased(action) && !q.actionsReleased.includes(action)) q.actionsReleased.push(action)
    }
    if (this.mousePressed && !q.pressed.includes(MOUSE_LEFT)) q.pressed.push(MOUSE_LEFT)
    if (this.mouseRightPressed && !q.pressed.includes(MOUSE_RIGHT)) q.pressed.push(MOUSE_RIGHT)
    if (this._mouseReleased && !this.suppressed && !q.released.includes(MOUSE_LEFT)) q.released.push(MOUSE_LEFT)
    if (this._mouseRightReleased && !this.suppressed && !q.released.includes(MOUSE_RIGHT)) q.released.push(MOUSE_RIGHT)
    if (this._mouseDown && !this.suppressed) q.down.push(MOUSE_LEFT)
    if (this._mouseRightDown && !this.suppressed) q.down.push(MOUSE_RIGHT)
    q.wheel += this.wheelDelta
    const movement=this.movement
    q.movement = movement?{...movement}:undefined
    if (this.touchCancel) q.cancelActions = true
  }
  beginTick(tick: number): InputCommand {
    // 真实设备边沿队列在下方换成新数组，当前指令可以直接持有旧数组。
    this.command = this.commandSource ? structuredClone(this.commandSource(tick) ?? emptyCommand(tick)) : { ...this.queued, tick }
    if(this.commandSource&&this.command.actionVersion!==2){
      // 旧录像的符卡、道具与暂停仍记录物理键，只在导入旧指令时迁移一次。
      const legacy=[['pause','Escape'],['spellA','KeyE'],['spellB','KeyR'],['quick1','Digit4'],['quick2','Digit5'],['quick3','Digit6']] as const
      for(const [action,code] of legacy){
        if(this.command.down.includes(code)&&!this.command.actionsDown.includes(action))this.command.actionsDown.push(action)
        if(this.command.pressed.includes(code)&&!this.command.actionsPressed.includes(action))this.command.actionsPressed.push(action)
        if(this.command.released.includes(code)&&!this.command.actionsReleased.includes(action))this.command.actionsReleased.push(action)
      }
      this.command.actionVersion=2
    }
    this.queued.pressed = []; this.queued.released = []
    this.queued.actionsPressed = []; this.queued.actionsReleased = []; this.queued.wheel = 0
    this.queued.searchActions = []
    this.queued.cancelActions = false
    this.touchCancel = false
    this.mouseX = this.command.mouseX; this.mouseY = this.command.mouseY
    for (const key of [...this.heldTicks.keys()]) if (!this.command.down.includes(key)) this.heldTicks.delete(key)
    for (const key of this.command.down) this.heldTicks.set(key, (this.heldTicks.get(key) ?? 0) + 1)
    return this.command
  }
  endTick(): void { this.command = null }
  /** 搜索界面只排队语义动作，拿取在固定逻辑步执行并写入录像。 */
  queueSearch(action: SearchCommand): void {
    if (this.commandSource) return
    ;(this.queued.searchActions ??= []).push({ ...action })
  }
  get searchActions(): readonly SearchCommand[] { return this.command?.searchActions ?? [] }
  /** 录制保存每名参与者的实际语义输入，回放不会重新读取物理手柄。 */
  resolvePlayerCommands(read: () => PlayerCommand[]): PlayerCommand[] {
    if (this.commandSource) return this.command?.players ?? []
    const commands = read()
    if (this.command) this.command.players = commands
    return commands
  }
  resolveWorldPointer(x: number, y: number, anchor?: { x: number; y: number; facing?:number }): { x: number; y: number } {
    if(this.commandSource && this.command?.worldPointer)return this.command.worldPointer
    const aim=touchControls.value?this.touchAim:viewport.lastInput==='gamepad'?this.padAim:null
    const direction=aim??{x:Math.cos(anchor?.facing??0),y:Math.sin(anchor?.facing??0)}
    const pointer=anchor&&(touchControls.value||viewport.lastInput==='gamepad') ? {x:anchor.x+direction.x*160,y:anchor.y+direction.y*160} : {x,y}
    if(this.command)this.command.worldPointer=pointer
    this.worldMouseX=pointer.x;this.worldMouseY=pointer.y
    return pointer
  }
  discardPending(resetHolds=false): void { this.queued = emptyCommand(0); if(resetHolds)this.heldTicks.clear() }

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
  /** 仅供表现层切换画布准星与界面指针，不参与模拟和录像。 */
  pointerOverCanvas = false
  /** 鼠标世界坐标（由相机反算后回填） */
  worldMouseX = 0
  worldMouseY = 0

  /** 左键是否按住（suppressed 期间对外恒为 false，物理状态仍记录在 _mouseDown） */
  get mouseDown(): boolean {
    return !this.suppressed && (this.command ? this.command.down.includes(MOUSE_LEFT) : this._mouseDown)
  }
  /** 左键本帧是否刚按下（suppressed 期间对外恒为 false） */
  get mousePressed(): boolean {
    return !this.suppressed && (this.command ? this.command.pressed.includes(MOUSE_LEFT) : this._mousePressed)
  }
  /** 右键本帧是否刚按下（suppressed 期间对外恒为 false） */
  get mouseRightPressed(): boolean {
    return !this.suppressed && (this.command ? this.command.pressed.includes(MOUSE_RIGHT) : this._mouseRightPressed)
  }
  /** 滚轮本帧增量（suppressed 期间对外恒为 0） */
  get wheelDelta(): number {
    return this.suppressed ? 0 : this.command?.wheel ?? this._wheelDelta
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
    this.onGamepadDisconnected()
    window.addEventListener('gamepadconnected', this.onGamepadConnected)
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('blur', this.onBlur)
    el.addEventListener('mousemove', this.onMouseMove)
    el.addEventListener('mouseenter', this.onCanvasEnter)
    el.addEventListener('mouseleave', this.onCanvasLeave)
    el.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    el.addEventListener('contextmenu', this.onContextMenu)
    el.addEventListener('wheel', this.onWheel, { passive: true })
  }

  /** 解绑所有监听 */
  detach(): void {
    window.removeEventListener('gamepadconnected', this.onGamepadConnected)
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected)
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('blur', this.onBlur)
    this.el?.removeEventListener('mousemove', this.onMouseMove)
    this.el?.removeEventListener('mouseenter', this.onCanvasEnter)
    this.el?.removeEventListener('mouseleave', this.onCanvasLeave)
    this.el?.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    this.el?.removeEventListener('contextmenu', this.onContextMenu)
    this.el?.removeEventListener('wheel', this.onWheel)
    this.el = null
    this.pointerOverCanvas = false
  }

  /** 转场结束时丢弃过渡期间的输入，避免按住交互或攻击漏入新场景。 */
  reset(): void {
    this.gamepad.reset();this.pad={down:new Set(),pressed:new Set(),released:new Set(),active:false};this.padAim=null
    this.cancelTouchActions()
    this.onBlur()
    this.discardPending()
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
    return !this.suppressed && codes.some((c) => this.command ? this.command.down.includes(c) : this.down.has(c))
  }

  /** 按键是否在本帧刚按下（边沿触发，不消费，帧末自动清除）；抑制期间恒 false */
  justPressed(...codes: string[]): boolean {
    return !this.suppressed && codes.some((c) => this.command ? this.command.pressed.includes(c) : this.pressed.has(c))
  }

  /** 按键是否在本帧刚松开；抑制期间恒 false */
  justReleased(...codes: string[]): boolean {
    return !this.suppressed && codes.some((c) => this.command ? this.command.released.includes(c) : this.released.has(c))
  }

  /** 按键已持续按住的秒数（未按下返回 0） */
  holdSeconds(code: string): number {
    if (this.command) return (this.heldTicks.get(code) ?? 0) * FixedStep.DT
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
    return !this.suppressed && (this.command ? this.command.actionsDown.includes(action) : this.touchDown.has(action) || this.pad.down.has(action) || keymap.bindings[action].some((t) => this.tokenDown(t)))
  }

  /** action 本帧是否刚按下 */
  actionPressed(action: ActionId): boolean {
    return !this.suppressed && (this.command ? this.command.actionsPressed.includes(action) : this.touchPressed.has(action) || this.pad.pressed.has(action) || keymap.bindings[action].some((t) => this.tokenPressed(t)))
  }

  /** action 本帧是否刚松开 */
  actionReleased(action: ActionId): boolean {
    return !this.suppressed && (this.command ? this.command.actionsReleased.includes(action) : this.touchReleased.has(action) || this.pad.released.has(action) || keymap.bindings[action].some((t) => this.tokenReleased(t)))
  }

  /** 帧末清理边沿状态（由引擎在每帧逻辑结束后调用） */
  endFrame(): void {
    this.touchPressed.clear(); this.touchReleased.clear()
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

  private onGamepadConnected = (): void => { this.padsAvailable=true }
  private onGamepadDisconnected = (): void => {
    try { this.padsAvailable=navigator.getGamepads?.().some(pad=>pad?.connected)??false }
    catch { this.padsAvailable=false }
  }

  private onKeyUp = (e: KeyboardEvent): void => {
    if (this.down.has(e.code)) this.released.add(e.code)
    this.down.delete(e.code)
    this.downAt.delete(e.code)
  }

  /** 窗口失焦时清空所有按键，防止"卡键"（场景层据 held=false 自行回收按压判定） */
  private onBlur = (): void => {
    this.gamepad.reset();this.pad={down:new Set(),pressed:new Set(),released:new Set(),active:false};this.padAim=null
    this.cancelTouchActions()
    this.touchAim = null
    this.down.clear()
    this.heldTicks.clear()
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
    this.pointerOverCanvas = true
    this.updateMousePos(e)
  }

  private onCanvasEnter = (e: MouseEvent): void => {
    this.pointerOverCanvas = true
    this.updateMousePos(e)
  }

  private onCanvasLeave = (): void => {
    this.pointerOverCanvas = false
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
