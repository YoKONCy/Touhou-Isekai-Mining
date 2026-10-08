/**
 * 轻量键位映射层（action → 物理键）
 *
 * 玩法代码只认 action（moveUp/attack/interact…），不直接写死 KeyW / 鼠标左键；
 * 默认绑定见 DEFAULT_BINDINGS，以后键位设置界面直接改 keymaps.bindings 即可，
 * 教学键帽（KeyCap 组件）会响应式跟随。
 *
 * 绑定记号：键盘用 KeyboardEvent.code（'KeyW' / 'Digit3' / 'ShiftLeft'）；
 * 鼠标用 MOUSE_LEFT / MOUSE_RIGHT。
 */
import { reactive } from 'vue'

export type ActionId =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'attack'
  | 'special'
  | 'dodge'
  | 'interact'
  | 'hand1'
  | 'hand2'
  | 'hand3'
  | 'panel'
  | 'map'

/** 绑定记号：KeyboardEvent.code 或鼠标特殊记号 */
export type BindToken = string

export const MOUSE_LEFT = 'Mouse0'
export const MOUSE_RIGHT = 'Mouse2'

/** 默认键位（每个 action 可绑多个，如移动同时支持 WASD 与方向键） */
const DEFAULT_BINDINGS: Record<ActionId, BindToken[]> = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  attack: [MOUSE_LEFT],
  special: ['Mouse2'],
  dodge: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyF'],
  hand1: ['Digit1'],
  hand2: ['Digit2'],
  hand3: ['Digit3'],
  // 背包面板（CaveModule 实际读取 Tab/KeyI；绑定登记在此让教学键帽可渲染可改键）
  panel: ['Tab', 'KeyI'],
  map: ['KeyM']
}

/** 记号是否鼠标键 */
export function isMouseToken(token: BindToken): boolean {
  return token === MOUSE_LEFT || token === MOUSE_RIGHT
}

/**
 * 键盘 code → 键帽显示文字（鼠标记号返回空串，由 KeyCap 组件画图标）
 */
export function keyLabel(token: BindToken): string {
  if (isMouseToken(token)) return ''
  if (/^Key[A-Z]$/.test(token)) return token.slice(3)
  if (/^Digit\d$/.test(token)) return token.slice(5)
  if (/^Numpad\d$/.test(token)) return token.slice(6)
  const named: Record<string, string> = {
    Space: '空格',
    ShiftLeft: 'Shift',
    ShiftRight: 'Shift',
    ControlLeft: 'Ctrl',
    ControlRight: 'Ctrl',
    AltLeft: 'Alt',
    AltRight: 'Alt',
    Enter: '回车',
    Escape: 'Esc',
    Tab: 'Tab',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→'
  }
  return named[token] ?? token
}

class KeymapService {
  /** 当前绑定表（reactive：KeyCap 等 UI 跟随改键即时刷新） */
  readonly bindings = reactive<Record<ActionId, BindToken[]>>(
    JSON.parse(JSON.stringify(DEFAULT_BINDINGS)) as Record<ActionId, BindToken[]>
  )

  /** 主绑定（键帽显示用：取第一个记号） */
  primary(action: ActionId): BindToken {
    return this.bindings[action][0] ?? ''
  }

  /** 恢复默认键位（设置界面"重置"按钮用） */
  reset(): void {
    for (const a of Object.keys(this.bindings) as ActionId[]) {
      this.bindings[a] = [...DEFAULT_BINDINGS[a]]
    }
  }
}

export const keymap = new KeymapService()
