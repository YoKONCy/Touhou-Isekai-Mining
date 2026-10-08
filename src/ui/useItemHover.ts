import { shallowRef, ref, onMounted, onBeforeUnmount } from 'vue'
import type { ItemId } from '../shared/itemDefs'
import type { ItemSlotKey } from './inventorySlots'

export interface ItemHover {id?:ItemId;empty?:string;target?:ItemSlotKey;anchor?:HTMLElement;x:number;y:number}

/** 共享悬浮卡允许跨过槽位与卡片之间的间隙，Shift 展开后可进入卡片操作。 */
export function useItemHover(){
  const tip=shallowRef<ItemHover|null>(null),expanded=ref(false),interactive=ref(false)
  let pending:ItemHover|null=null,frame=0
  let timer:ReturnType<typeof setTimeout>|null=null,inside=false,leaving=false,shift=false
  let idle:ReturnType<typeof setTimeout>|null=null,lastMove=0
  function moving(){
    interactive.value=false;lastMove=performance.now()
    const settled=()=>{const left=90-(performance.now()-lastMove);if(left>0)idle=setTimeout(settled,left);else {idle=null;if(tip.value)interactive.value=true}}
    if(idle===null)idle=setTimeout(settled,90)
  }
  const clear=()=>{if(timer!==null)clearTimeout(timer);timer=null}
  const cancelFrame=()=>{if(frame)cancelAnimationFrame(frame);frame=0;pending=null}
  // 高频鼠标事件只提交本帧最后一次悬停，避免同一帧反复构造详情组件。
  function queue(value:ItemHover){pending=value;if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(pending)tip.value=pending;pending=null})}
  function hide(){clear();cancelFrame();if(idle!==null)clearTimeout(idle);idle=null;interactive.value=false;tip.value=null;inside=false;leaving=false;expanded.value=false}
  function show(e:MouseEvent,id?:ItemId|null,empty?:string){
    clear();inside=false;leaving=false;shift=e.shiftKey;expanded.value=shift
    if(!id&&!empty){leave();return}
    moving()
    const target=(e.currentTarget as HTMLElement)?.dataset.drop as ItemSlotKey|undefined
    queue({id:id??undefined,empty,target,anchor:e.currentTarget as HTMLElement,x:e.clientX+17,y:e.clientY+15})
  }
  function move(e:MouseEvent){const current=pending??tip.value;if(!current||inside||leaving||e.target instanceof Element&&e.target.closest('.item-hover-card'))return;moving();shift=e.shiftKey;expanded.value=shift;queue({...current,x:e.clientX+17,y:e.clientY+15})}
  function leave(){clear();cancelFrame();leaving=true;timer=setTimeout(hide,220)}
  function enterCard(){clear();cancelFrame();inside=true;leaving=false}
  function leaveCard(){inside=false;expanded.value=shift;leave()}
  function key(e:KeyboardEvent){shift=e.shiftKey;if(!inside||shift)expanded.value=shift}
  onMounted(()=>{window.addEventListener('keydown',key);window.addEventListener('keyup',key);window.addEventListener('blur',hide)})
  onBeforeUnmount(()=>{hide();window.removeEventListener('keydown',key);window.removeEventListener('keyup',key);window.removeEventListener('blur',hide)})
  return {tip,expanded,interactive,show,move,leave,hide,enterCard,leaveCard}
}
