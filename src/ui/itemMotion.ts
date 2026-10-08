import { getItemDef, type ItemId } from '../shared/itemDefs'
import type { ItemSlotKey } from './inventorySlots'

interface Point {x:number;y:number}
interface Flight {key:string;from:ItemSlotKey;to:ItemSlotKey;id:ItemId;qty:number;start?:Point}
interface Flying {flight:Flight;animation:Animation;node:HTMLElement;count:HTMLElement}

/** 转移数据立即提交；同帧飞行合并排队，最多十二个图案同时播放，避免扫格时堆积动效。 */
export function itemMotion(root:()=>HTMLElement|null){
  const queue=new Map<string,Flight>(),active=new Map<string,Flying>(),pulses=new Set<Animation>()
  let frame=0,disposed=false
  const schedule=()=>{if(!frame&&!disposed&&queue.size&&active.size<12)frame=requestAnimationFrame(flush)}
  function transfer(from:ItemSlotKey,to:ItemSlotKey,stack:{id:ItemId;qty:number},start?:Point){
    if(disposed||from===to||from.startsWith('storage:')===to.startsWith('storage:')||stack.qty<=0)return
    const key=`${from}>${to}:${stack.id}`,flying=active.get(key)
    if(flying){flying.flight.qty+=stack.qty;flying.count.textContent=String(flying.flight.qty);return}
    const pending=queue.get(key)
    if(pending){pending.qty+=stack.qty;return}
    if(queue.size>=96)return
    queue.set(key,{key,from,to,id:stack.id,qty:stack.qty,start});schedule()
  }
  function flush(){
    frame=0;const panel=root();if(disposed||!panel?.isConnected){queue.clear();return}
    const nodes=new Map(Array.from(panel.querySelectorAll<HTMLElement>('[data-drop]'),el=>[el.dataset.drop as ItemSlotKey,el] as const))
    const rects=new Map<HTMLElement,DOMRect>(),rect=(node:HTMLElement)=>{let r=rects.get(node);if(!r){r=node.getBoundingClientRect();rects.set(node,r)}return r}
    const point=(node:HTMLElement):Point=>{
      const r=rect(node),p={x:r.left+r.width/2,y:r.top+r.height/2}
      // 未显示的目标格落到所在容器边缘，不为播放动画自动滚动玩家的视野。
      for(const clip of [node.closest<HTMLElement>('.shelf-viewport'),node.closest<HTMLElement>('.container-shelves'),panel])if(clip){const c=rect(clip);p.x=Math.max(c.left+6,Math.min(p.x,c.right-6));p.y=Math.max(c.top+6,Math.min(p.y,c.bottom-6))}
      return p
    }
    const jobs:Array<{flight:Flight;a:Point;b:Point;target:HTMLElement}>=[]
    for(const f of Array.from(queue.values()).slice(0,Math.min(4,12-active.size))){
      queue.delete(f.key);const from=nodes.get(f.from),to=nodes.get(f.to)
      if(from&&to)jobs.push({flight:f,a:f.start??point(from),b:point(to),target:to})
    }
    // 先批量读位置，再创建动画节点，避免交替读写造成强制布局。
    jobs.forEach((job,index)=>launch(job.flight,job.a,job.b,job.target,index*12))
    schedule()
  }
  function launch(flight:Flight,a:Point,b:Point,target:HTMLElement,delay:number){
    const node=document.createElement('div'),icon=document.createElement('span'),count=document.createElement('span')
    node.className='item-flight';node.setAttribute('aria-hidden','true');icon.className='item-flight-icon';count.className='item-flight-count';count.textContent=flight.qty>1?String(flight.qty):''
    const data=getItemDef(flight.id).icon
    if(data.type==='svg')icon.innerHTML=data.svg
    else {const image=document.createElement('img');image.src=data.src;image.alt='';icon.appendChild(image)}
    node.append(icon,count);document.body.appendChild(node)
    const distance=Math.hypot(b.x-a.x,b.y-a.y),lift=Math.min(48,Math.max(10,distance*.12)),keys:Keyframe[]=[]
    for(let i=0;i<=20;i++){
      const t=i/20,x=a.x+(b.x-a.x)*t-18,y=a.y+(b.y-a.y)*t-4*lift*t*(1-t)-18
      keys.push({transform:`translate3d(${x}px,${y}px,0) scale(${1+.04*Math.sin(Math.PI*t)-.2*t*t})`,opacity:t<.82?.96:.96*(1-t)/.18,offset:t})
    }
    const animation=node.animate(keys,{duration:Math.min(390,280+distance*.08),delay,easing:'cubic-bezier(.2,.65,.2,1)',fill:'backwards'})
    active.set(flight.key,{flight,animation,node,count})
    const finish=()=>{node.remove();active.delete(flight.key);schedule()}
    animation.oncancel=finish
    animation.onfinish=()=>{
      finish();if(disposed||!target.isConnected)return
      const pulse=target.animate([{filter:'brightness(1)'},{filter:'brightness(1.3)',offset:.35},{filter:'brightness(1)'}],{duration:190,easing:'ease-out'})
      pulses.add(pulse);pulse.onfinish=pulse.oncancel=()=>{pulses.delete(pulse)}
    }
  }
  function dispose(){disposed=true;if(frame)cancelAnimationFrame(frame);frame=0;queue.clear();for(const flight of active.values()){flight.animation.cancel();flight.node.remove()}active.clear();for(const pulse of pulses)pulse.cancel();pulses.clear()}
  return {transfer,dispose}
}
