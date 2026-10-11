import type { InputManager } from '../../core/InputManager'
export interface PlayerIntent {
  moveX:number;moveY:number
  dodgePressed:boolean;dodgeHeld:boolean;dodgeReleased:boolean
  attackPressed:boolean;attackHeld:boolean;attackReleased?:boolean
  specialPressed:boolean;specialHeld?:boolean;specialReleased?:boolean
  pointerX:number;pointerY:number;interactPressed:boolean
  cancelActions?:boolean
}
/** 键鼠、回放和脚本最终进入同一套动作数据，不让房间依赖设备事件。 */
export function readPlayerIntent(input:InputManager,pointerX:number,pointerY:number,allowDodge=true):PlayerIntent {
  return {moveX:input.movement?.x??Number(input.isActionDown('moveRight'))-Number(input.isActionDown('moveLeft')),moveY:input.movement?.y??Number(input.isActionDown('moveDown'))-Number(input.isActionDown('moveUp')),cancelActions:input.cancelActions,
    // 面板禁止闪避时同时屏蔽按下、长按与松开，已有待判定按压也会自然取消。
    dodgePressed:allowDodge&&input.actionPressed('dodge'),dodgeHeld:allowDodge&&input.isActionDown('dodge'),dodgeReleased:allowDodge&&input.actionReleased('dodge'),
    attackPressed:input.actionPressed('attack'),attackHeld:input.isActionDown('attack'),attackReleased:input.actionReleased('attack'),
    specialPressed:input.actionPressed('special'),specialHeld:input.isActionDown('special'),specialReleased:input.actionReleased('special'),
    pointerX,pointerY,interactPressed:input.actionPressed('interact')}
}
