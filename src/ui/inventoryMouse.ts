import { getItemDef } from '../shared/itemDefs'
import type { Slot } from '../shared/inventory'
import type { InventorySlotAccess, ItemSlotKey } from './inventorySlots'
import type { ItemId } from '../shared/itemDefs'

type Stack=NonNullable<Slot>
interface Gesture {id:number;button:0|2;mode:'gather'|'right'|'distribute'|'transfer';startX:number;startY:number;last:ItemSlotKey|null;origin:ItemSlotKey;filter:ItemId|null;visited:Map<ItemSlotKey,HTMLElement>;moved:boolean}
interface Options {slots:InventorySlotAccess;containers:string;enabled?:()=>boolean;changed:()=>void;begin:()=>void;notify?:(key:string)=>void;moved?:(from:ItemSlotKey,to:ItemSlotKey,stack:Stack,start?:{x:number;y:number})=>void}
let active:{enabled:()=>boolean}|null=null
export const isInventoryMouseOpen=()=>active?.enabled()??false

/** MC 拿放与 Mouse Tweaks 扫格由同一个状态机处理，仓库和背包不再各自拆堆。 */
export function inventoryMouse(o:Options){
  let cursor:Stack|null=null,source:ItemSlotKey|null=null,snapshot:Map<ItemSlotKey,Slot>|null=null
  let gesture:Gesture|null=null,ghost:HTMLElement|null=null,hovered:ItemSlotKey|null=null
  let pointerPoint={x:0,y:0}
  let lastDown:{key:ItemSlotKey;id:ItemId|null;shift:boolean;time:number}|null=null,ignoreClickUntil=0
  const enabled=()=>o.enabled?.()??true,session={enabled}
  const keyOf=(el:HTMLElement|null):ItemSlotKey|null=>{const key=el?.dataset.drop as ItemSlotKey|undefined;return key&&o.slots.keys(true).includes(key)?key:null}
  const under=(x:number,y:number)=>document.elementFromPoint(x,y) as HTMLElement|null
  const element=(el:HTMLElement|null)=>el?.closest<HTMLElement>('[data-drop]')??null
  const inPanel=(el:HTMLElement|null)=>!!el?.closest(o.containers)
  const capacity=(key:ItemSlotKey,id:ItemId)=>key.startsWith('eq:')?1:getItemDef(id).maxStack
  const same=(a:Slot,b:Slot)=>a?.id===b?.id&&a?.qty===b?.qty
  function redraw(){
    if(cursor){
      if(!ghost){ghost=document.createElement('div');ghost.className='drag-ghost hold-ghost mouse-cursor';document.body.appendChild(ghost);document.body.classList.add('holding-item')}
      if(ghost.dataset.item!==cursor.id){
        ghost.replaceChildren();const icon=document.createElement('span');icon.className='item-icon';const data=getItemDef(cursor.id).icon
        if(data.type==='svg')icon.innerHTML=data.svg
        else {const img=document.createElement('img');img.src=data.src;img.alt='';img.style.cssText='width:100%;height:100%;object-fit:contain';icon.appendChild(img)}
        ghost.appendChild(icon);const qty=document.createElement('span');qty.className='hold-qty';ghost.appendChild(qty);ghost.dataset.item=cursor.id
      }
      ghost.querySelector('.hold-qty')!.textContent=cursor.qty>1?String(cursor.qty):''
    }else{ghost?.remove();ghost=null;document.body.classList.remove('holding-item');snapshot=null;source=null}
    o.changed()
  }
  function position(x:number,y:number){pointerPoint={x,y};if(ghost){ghost.style.left=`${x-24}px`;ghost.style.top=`${y-24}px`}}
  function clearPreview(){document.querySelectorAll('.mouse-distribute,.dragover,.draginvalid').forEach(el=>{el.classList.remove('mouse-distribute','dragover','draginvalid');delete (el as HTMLElement).dataset.distributeQty});document.body.classList.remove('discarding')}
  function reject(el:HTMLElement|null){if(!el)return;el.classList.add('dragbad');setTimeout(()=>el.classList.remove('dragbad'),300)}
  function take(key:ItemSlotKey,n:number):Stack|null{
    const s=o.slots.get(key);if(!s||!o.slots.canTake(key))return null
    const qty=Math.min(n,s.qty);if(qty<=0)return null
    if(!o.slots.set(key,s.qty>qty?{id:s.id,qty:s.qty-qty}:null))return null
    return {id:s.id,qty}
  }
  function deposit(key:ItemSlotKey,s:Stack,n:number):number{
    const dst=o.slots.get(key);if(!o.slots.accepts(key,s.id)||dst&&dst.id!==s.id)return 0
    const qty=Math.min(n,s.qty,capacity(key,s.id)-(dst?.qty??0));if(qty<=0)return 0
    return o.slots.set(key,{id:s.id,qty:(dst?.qty??0)+qty})?qty:0
  }
  function pick(key:ItemSlotKey,n:number){
    const before=new Map(o.slots.keys(true).map(k=>[k,o.slots.get(k)?{...o.slots.get(k)!}:null]))
    const s=take(key,n);if(!s)return false
    snapshot=before;source=key;cursor=s;redraw();return true
  }
  function place(key:ItemSlotKey,n:number,swap=true):boolean{
    if(!cursor)return false
    const dst=o.slots.get(key)
    if(dst&&dst.id!==cursor.id){
      if(!swap||!o.slots.canTake(key)&&key!=='eq:pick'||!o.slots.accepts(key,cursor.id)||cursor.qty>capacity(key,cursor.id))return false
      // 先验证再交换；手上物品与目标装备永远有且仅有一份。
      if(!o.slots.set(key,cursor))return false
      if(source)o.moved?.(source,key,{...cursor},pointerPoint)
      cursor={...dst};source=key;redraw();return true
    }
    const put=deposit(key,cursor,n);if(!put)return false
    if(source)o.moved?.(source,key,{id:cursor.id,qty:put},pointerPoint)
    cursor.qty-=put;if(!cursor.qty)cursor=null
    redraw();return true
  }
  function transfer(key:ItemSlotKey,n=Infinity):number{
    const s=o.slots.get(key);if(!s||!o.slots.canTake(key))return 0
    const targets=o.slots.targets(key,s.id),before=Math.min(n,s.qty);let remain=before
    // 已有同类堆优先，满堆不会被整堆交换。
    for(const filled of [true,false])for(const target of targets){
      if(!remain)break
      const dst=o.slots.get(target);if(filled?dst?.id!==s.id:!!dst)continue
      const put=deposit(target,{id:s.id,qty:remain},remain)
      if(put)o.moved?.(key,target,{id:s.id,qty:put})
      remain-=put
    }
    const moved=before-remain
    if(moved){o.slots.set(key,s.qty>moved?{id:s.id,qty:s.qty-moved}:null);redraw()}
    return moved
  }
  function collect(key?:ItemSlotKey){
    if(!cursor&&key){const s=o.slots.get(key);if(s)pick(key,s.qty)}
    if(!cursor)return
    const id=cursor.id,cap=getItemDef(id).maxStack
    // 双击先收未满堆，再收满堆；已穿戴装备不参与材料归并。
    for(const partial of [true,false])for(const k of o.slots.keys()){
      const s=o.slots.get(k);if(!s||s.id!==id||(s.qty<cap)!==partial||!cursor||cursor.qty>=cap)continue
      const got=take(k,cap-cursor.qty);if(got)cursor.qty+=got.qty
    }
    redraw()
  }
  function cancel(){
    gesture=null;lastDown=null;clearPreview()
    if(!cursor)return
    const original={...cursor},targets=[...(source?[source]:[]),...o.slots.keys()]
    for(const filled of [true,false])for(const key of [...new Set(targets)]){
      if(!cursor?.qty)break
      const s=o.slots.get(key);if(filled?s?.id!==cursor.id:!!s)continue
      cursor.qty-=deposit(key,cursor,cursor.qty)
    }
    if(cursor.qty>0&&snapshot){
      // 交换后的剩余物品无处归还时撤回整个拿放事务，保证满包换装也不吞物。
      for(const [key,s] of snapshot)if(!same(o.slots.get(key),s))o.slots.set(key,s)
      o.notify?.('ui.mouse.rollback')
    }else if(cursor.qty>0){cursor=original;redraw();return}
    cursor=null;redraw()
  }
  function drop(n:number){
    if(!cursor)return false
    const id=cursor.id,qty=Math.min(n,cursor.qty);if(!o.slots.drop({id,qty}))return false
    // 从归还快照中扣除已经落地的数量，后续撤回交换也不会复制已丢出的物品。
    if(snapshot){let left=qty;for(const [key,s] of snapshot){if(!left)break;if(s?.id!==id)continue;const count=Math.min(left,s.qty);snapshot.set(key,s.qty>count?{id,qty:s.qty-count}:null);left-=count}}
    cursor.qty-=qty;if(!cursor.qty)cursor=null
    redraw();return true
  }
  function preview(g:Gesture){
    if(!cursor)return
    const each=Math.floor(cursor.qty/g.visited.size)
    for(const [key,el] of g.visited){const s=o.slots.get(key),put=Math.min(each,capacity(key,cursor.id)-(s?.qty??0));el.classList.add('mouse-distribute');el.dataset.distributeQty=String((s?.qty??0)+put)}
  }
  function onDown(e:PointerEvent){
    if(!enabled()||e.button!==0&&e.button!==2||!(e.target instanceof Element)||e.target.closest('.item-hover-card'))return
    const el=element(e.target as HTMLElement),key=keyOf(el)
    if(!key&&!cursor)return
    if(key&&!inPanel(el))return
    pointerPoint={x:e.clientX,y:e.clientY}
    e.preventDefault();e.stopImmediatePropagation();ignoreClickUntil=performance.now()+400;o.begin();clearPreview()
    if(!key){if(!inPanel(e.target as HTMLElement)){if(!drop(e.button===0?Infinity:1))cancel()}return}
    hovered=key;const s=o.slots.get(key),now=performance.now(),button=e.button as 0|2
    const double=button===0&&lastDown?.key===key&&lastDown.shift===e.shiftKey&&now-lastDown.time<280
    const previousId=lastDown?.id??null;lastDown={key,id:s?.id??cursor?.id??null,shift:e.shiftKey,time:now}
    if(double){
      if(e.shiftKey){const id=s?.id??previousId;if(id)for(const k of o.slots.keys().filter(k=>k.split(':')[0]===key.split(':')[0]))if(o.slots.get(k)?.id===id)transfer(k)}
      else collect(key)
      lastDown=null;position(e.clientX,e.clientY);return
    }
    let mode:Gesture['mode'],filter:ItemId|null=null
    if(e.shiftKey&&button===0){mode='transfer';filter=cursor?.id??null;if(!filter||s?.id===filter)transfer(key)}
    else if(!cursor){
      if(!s||!pick(key,button===0?s.qty:Math.ceil(s.qty/2))){reject(el);return}
      mode=button===0?'gather':'right';filter=cursor!.id
    }else if(button===2){mode='right';filter=cursor.id;if(!place(key,1))reject(el)}
    else mode='distribute'
    gesture={id:e.pointerId,button,mode,startX:e.clientX,startY:e.clientY,last:key,origin:key,filter,visited:new Map(),moved:false}
    if(mode==='distribute'&&cursor&&o.slots.accepts(key,cursor.id)&&(!s||s.id===cursor.id)&&capacity(key,cursor.id)>(s?.qty??0))gesture.visited.set(key,el!)
    position(e.clientX,e.clientY)
  }
  function onMove(e:PointerEvent){
    if(!enabled())return
    // 空手划过时只记录快捷键目标，不查询整页高亮，也不强制读取命中布局。
    if(!cursor&&!gesture){hovered=keyOf(element(e.target instanceof Element?e.target as HTMLElement:null));return}
    position(e.clientX,e.clientY);const el=element(under(e.clientX,e.clientY)),key=keyOf(el)
    hovered=key;clearPreview()
    if(cursor&&el&&key)el.classList.add(o.slots.accepts(key,cursor.id)?'dragover':'draginvalid')
    else if(cursor&&!inPanel(under(e.clientX,e.clientY)))document.body.classList.add('discarding')
    const g=gesture;if(!g||g.id!==e.pointerId)return
    if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>5)g.moved=true
    if(g.mode==='distribute'){
      if(g.moved&&key&&el&&cursor&&!g.visited.has(key)&&g.visited.size<cursor.qty){const s=o.slots.get(key);if(o.slots.accepts(key,cursor.id)&&(!s||s.id===cursor.id)&&capacity(key,cursor.id)>(s?.qty??0))g.visited.set(key,el)}
      if(g.moved&&g.visited.size>1)preview(g)
      return
    }
    if(key===g.last)return;g.last=key;if(!key)return
    if(g.mode==='transfer'){if(e.shiftKey&&(!g.filter||o.slots.get(key)?.id===g.filter))transfer(key)}
    else if(g.mode==='gather'){
      const s=o.slots.get(key);if(!s||s.id!==g.filter)return
      if(e.shiftKey)transfer(key)
      else if(cursor){const got=take(key,getItemDef(cursor.id).maxStack-cursor.qty);if(got){cursor.qty+=got.qty;redraw()}}
    }else if(cursor)place(key,1,false)
  }
  function onUp(e:PointerEvent){
    const g=gesture;if(!g||g.id!==e.pointerId)return
    e.preventDefault();e.stopImmediatePropagation();gesture=null;clearPreview();ignoreClickUntil=performance.now()+300
    if(g.moved)lastDown=null
    if(g.mode==='distribute'&&cursor){
      if(g.moved&&g.visited.size>1){const each=Math.floor(cursor.qty/g.visited.size);for(const key of g.visited.keys())place(key,each,false)}
      else if(!place(g.origin,cursor.qty))reject(g.visited.get(g.origin)??null)
    }
  }
  function onKey(e:KeyboardEvent){
    if(!enabled()||e.altKey||e.metaKey||e.target instanceof Element&&e.target.closest('input,textarea,select'))return
    if(e.code==='KeyQ'){
      if(!cursor&&!hovered)return
      e.preventDefault();e.stopImmediatePropagation();o.begin()
      if(cursor)drop(e.ctrlKey?Infinity:1)
      else if(hovered){const s=o.slots.get(hovered),qty=s?(e.ctrlKey?s.qty:1):0;if(s&&o.slots.canTake(hovered)&&o.slots.drop({id:s.id,qty})){take(hovered,qty);redraw()}}
    }else if(!e.ctrlKey&&!cursor&&hovered&&/^Digit[1-6]$/.test(e.code)){
      const digit=Number(e.code.slice(-1)),target=(digit<=3?`eq:${['weaponA','weaponB','pick'][digit-1]}`:`quick:${digit-4}`) as ItemSlotKey
      if(target===hovered)return
      const a=o.slots.get(hovered),b=o.slots.get(target)
      if(!a||!o.slots.canTake(hovered)||!o.slots.accepts(target,a.id)||a.qty>capacity(target,a.id)||b&&!o.slots.accepts(hovered,b.id)||!b&&!o.slots.canTake(hovered))return
      e.preventDefault();e.stopImmediatePropagation();o.begin()
      if(o.slots.set(target,a)){o.slots.set(hovered,b);redraw()}
    }
  }
  function onClick(e:MouseEvent){if(enabled()&&e.target instanceof Element&&(keyOf(element(e.target as HTMLElement))&&inPanel(e.target as HTMLElement)||performance.now()<ignoreClickUntil&&!e.target.closest('.item-hover-card')&&e.target.matches('.inv-mask,.camp-mask,.storage-mask'))){e.preventDefault();e.stopImmediatePropagation()}}
  const onCancel=()=>{lastDown=null;cancel()}
  const onContext=(e:MouseEvent)=>{if(enabled()&&e.target instanceof Element&&(cursor||e.target.closest(o.containers)))e.preventDefault()}
  return {
    holding:()=>!!cursor,
    cancel,
    act:(key:ItemSlotKey)=>{if(cursor||gesture)return false;lastDown=null;const ok=o.slots.perform(key);if(ok)redraw();return ok},
    mount(){
      active=session
      window.addEventListener('pointerdown',onDown,true);window.addEventListener('pointermove',onMove,true);window.addEventListener('pointerup',onUp,true)
      window.addEventListener('pointercancel',onCancel,true);window.addEventListener('blur',onCancel)
      window.addEventListener('keydown',onKey,true);window.addEventListener('click',onClick,true);window.addEventListener('dblclick',onClick,true);window.addEventListener('contextmenu',onContext,true)
    },
    dispose(){
      cancel();if(active===session)active=null
      window.removeEventListener('pointerdown',onDown,true);window.removeEventListener('pointermove',onMove,true);window.removeEventListener('pointerup',onUp,true)
      window.removeEventListener('pointercancel',onCancel,true);window.removeEventListener('blur',onCancel)
      window.removeEventListener('keydown',onKey,true);window.removeEventListener('click',onClick,true);window.removeEventListener('dblclick',onClick,true);window.removeEventListener('contextmenu',onContext,true)
    }
  }
}
