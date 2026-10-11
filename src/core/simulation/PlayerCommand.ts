/** 多人指令只携带语义操作和世界坐标，可来自手柄、脚本或未来的网络。 */
export interface PlayerCommand {
  playerId: string
  moveX: number; moveY: number
  pointerX: number; pointerY: number
  attackPressed: boolean; attackHeld: boolean; attackReleased: boolean
  specialPressed: boolean; specialHeld: boolean; specialReleased: boolean
  dodgePressed: boolean; dodgeHeld: boolean; dodgeReleased: boolean
  interactPressed: boolean
  /** 控制器暂不可用时明确取消蓄势，回放也执行同一语义。 */
  cancelActions?: boolean
  hand?: number
  quickSlot?: number
  spellSlot?: 0 | 1
}
export function idlePlayerCommand(playerId: string, x: number, y: number, aim = 0): PlayerCommand {
  return {playerId,moveX:0,moveY:0,pointerX:x+Math.cos(aim)*300,pointerY:y+Math.sin(aim)*300,
    attackPressed:false,attackHeld:false,attackReleased:false,specialPressed:false,specialHeld:false,specialReleased:false,
    dodgePressed:false,dodgeHeld:false,dodgeReleased:false,interactPressed:false}
}
