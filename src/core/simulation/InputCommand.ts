/** 记录的是操作与指针，不是 DOM 事件；回放和无头驱动不依赖键盘设备。 */
import type { PlayerCommand } from './PlayerCommand'
import type { SearchCommand } from '../../shared/search'
export interface InputCommand {
  actionVersion?: 2
  tick: number
  down: string[]
  pressed: string[]
  released: string[]
  actionsDown: string[]
  actionsPressed: string[]
  actionsReleased: string[]
  mouseX: number
  mouseY: number
  wheel: number
  /** 触控摇杆与取消动作随逻辑指令录制，回放不读取设备状态。 */
  movement?: { x: number; y: number }
  cancelActions?: boolean
  /** 记录实际瞄准的世界点，回放不依赖录制时的分辨率和相机位置。 */
  worldPointer?: { x: number; y: number }
  /** 背包、控制台或剧情回调在逻辑步之间执行的外部状态变更。 */
  external?: unknown
  players?: PlayerCommand[]
  searchActions?: SearchCommand[]
}
export function emptyCommand(tick: number): InputCommand {
  return { actionVersion: 2, tick, down: [], pressed: [], released: [], actionsDown: [], actionsPressed: [], actionsReleased: [], mouseX: 0, mouseY: 0, wheel: 0 }
}
