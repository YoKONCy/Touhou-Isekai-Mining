import type { ActionId } from './keymap'
export interface GamepadFrame { down:Set<ActionId>;pressed:Set<ActionId>;released:Set<ActionId>;movement?:{x:number;y:number};aim?:{x:number;y:number};active:boolean;connected?:boolean }
const BUTTONS:ReadonlyArray<readonly [ActionId,number]>=[['attack',7],['special',1],['dodge',0],['interact',2],['spellA',3],['spellB',6],['quick1',12],['quick2',15],['quick3',13],['map',14],['panel',8],['pause',9]]
/** 主控手柄只返回语义动作，已分配给其他玩家的手柄由上层排除。 */
export class GamepadInput {
  private previous:boolean[]=[]
  private index=-1
  private untilReleased=false
  reset():void { this.untilReleased=true }
  read(index:number,hand:number):GamepadFrame {
    const frame:GamepadFrame={down:new Set(),pressed:new Set(),released:new Set(),active:false}
    const pad=index>=0&&typeof navigator!=='undefined'?navigator.getGamepads?.()[index]:null
    if(!pad?.connected){this.previous=[];this.index=-1;return frame}
    frame.connected=true
    if(this.index!==index){this.index=index;this.previous=[];this.untilReleased=false}
    const buttons=pad.buttons.map(button=>button.pressed||button.value>.25)
    if(this.untilReleased){this.previous=buttons;if(buttons.some(Boolean))return frame;this.untilReleased=false}
    const axis=(n:number)=>{const v=pad.axes[n]??0;return Number.isFinite(v)&&Math.abs(v)>.18?v:0}
    const x=axis(0),y=axis(1),ax=axis(2),ay=axis(3)
    if(x||y)frame.movement={x,y}
    if(ax||ay)frame.aim={x:ax,y:ay}
    for(const [action,button] of BUTTONS){
      if(buttons[button])frame.down.add(action)
      if(buttons[button]&&!this.previous[button])frame.pressed.add(action)
      if(!buttons[button]&&this.previous[button])frame.released.add(action)
    }
    if(buttons[4]&&!this.previous[4])frame.pressed.add((['hand1','hand2','hand3'] as const)[(hand+2)%3]!)
    if(buttons[5]&&!this.previous[5])frame.pressed.add((['hand1','hand2','hand3'] as const)[(hand+1)%3]!)
    frame.active=!!(x||y||ax||ay||buttons.some(Boolean)||frame.released.size)
    this.previous=buttons;return frame
  }
}
