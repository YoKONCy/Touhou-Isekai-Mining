import type { Player,PlayerInput } from '../Player'
import type { Inventory,Slot } from '../../shared/inventory'
import type { SearchView,SearchFeedback,SearchPlacement } from '../../shared/search'
import { getItemDef } from '../../shared/itemDefs'
import { isEquipmentItem,itemQualityLevel,itemIsPrismatic,itemSearchDuration } from '../../shared/itemQuality'
import { randomGeneration } from '../../core/simulation/random'
import { createSearchContents } from './searchLayout'
import { resolveSearchRules, applySearchEffects } from '../../content/search/rules'
import type { ResolvedSearchRules, SearchContainerKind, SearchRoomContext, SearchProfile, SearchEffectContext, SearchFields } from '../../content/search/types'

export interface SearchContainer {
  id:string;x:number;y:number;range:number;cols:number;rows:number
  nameKey:string;table:string;chestId?:number;ref?:string
  seed:number;slots:Slot[]|null;placements:SearchPlacement[]
  revealed:number;revealedAt:number[];complete:boolean
  kind?:SearchContainerKind;sourceId?:string;context?:SearchRoomContext;profile?:SearchProfile
  fields?:SearchFields
  rules?:ResolvedSearchRules;generatedWith?:SearchEffectContext
}
interface SearchSession {
  containerId:string;elapsed:number;openingRemaining:number;scanElapsed:number
  x:number;y:number;damage:number;hp:number;tool:string|null;initialRevealed:number;searching:boolean
}
const OPEN_DURATION=.3
export function searchFeedback(id:string|undefined):SearchFeedback {
  if(!id)return 'ordinary'
  const def=getItemDef(id),level=itemQualityLevel(def),equipment=isEquipmentItem(def)
  if(level>=(equipment?4:5))return 'legendary'
  if(level>=(equipment?2:3))return 'rare'
  return equipment?'equipment':'ordinary'
}

/** 容器保存整件物品与矩形占位，翻找进度和结果由全部玩家共享。 */
export class SearchSystem {
  readonly containers:SearchContainer[]=[]
  private sessions=new Map<string,SearchSession>()
  /** 保留旧快照字段；实际计时统一读取物品的分级时长。 */
  readonly secondsPerSlot=.8

  add(container:Omit<SearchContainer,'seed'|'slots'|'placements'|'revealed'|'revealedAt'|'complete'> & {seed?:number}):void {
    if(this.containers.some(c=>c.id===container.id))return
    const kind=container.kind??(container.chestId!==undefined||container.cols===4?'chest':container.cols===2?'small':'large')
    const context=structuredClone(container.context??{floor:1})
    const rules=resolveSearchRules(context,kind,container.sourceId,container.table,container.profile)
    this.containers.push({...container,fields:structuredClone(container.fields),kind,context,rules,seed:container.seed??Math.floor(randomGeneration()*4294967296),slots:null,placements:[],revealed:0,revealedAt:[],complete:false})
  }
  /** 旧战斗快照仍保留已有物品与揭示状态，迁移不重抽、不丢弃奖励。 */
  private normalize(c:SearchContainer):SearchContainer {
    if(c.cols===undefined){
      const oldRows=c.rows
      c.cols=c.chestId!==undefined?4:oldRows===2?2:3;c.rows=c.cols===2?3:4
      let seed=2166136261
      for(let i=0;i<c.id.length;i++)seed=Math.imul(seed^c.id.charCodeAt(i),16777619)
      c.seed=seed>>>0
      c.placements=(c.slots??[]).map((_,i)=>({x:i%c.cols,y:Math.floor(i/c.cols),width:1,height:1,rotated:false}))
      c.complete=c.slots!==null&&c.revealed>=oldRows*2
    }
    return c
  }
  nearest(player:Player,accessible?:(container:SearchContainer)=>boolean):SearchContainer|undefined {
    let nearest:SearchContainer|undefined,distance=Infinity
    for(const raw of this.containers){
      const c=this.normalize(raw)
      if(c.complete&&!c.slots?.some(Boolean))continue
      const d=(player.x-c.x)**2+(player.y-c.y)**2
      if(d<=c.range*c.range&&d<distance&&(!accessible||accessible(c))){nearest=c;distance=d}
    }
    return nearest
  }
  container(id:string):SearchContainer|undefined {
    const c=this.containers.find(c=>c.id===id)
    return c?this.normalize(c):undefined
  }
  hasSession(player:Player):boolean{return this.sessions.has(player.entityId)}
  stop(player:Player):void {
    const session=this.sessions.get(player.entityId)
    if(session){session.searching=false;session.elapsed=0;session.openingRemaining=0;session.scanElapsed=0}
    player.setSearching(false)
  }
  blockedByOther(player:Player,containerId:string):boolean {
    for(const [id,session] of this.sessions)if(id!==player.entityId&&session.containerId===containerId&&session.searching)return true
    return false
  }
  cancel(player:Player):void{this.sessions.delete(player.entityId);player.setSearching(false)}
  cancelAll(players:readonly Player[]):void{for(const player of players)this.cancel(player);this.sessions.clear()}
  private session(player:Player,c:SearchContainer,searching:boolean):void {
    const alreadyOpen=this.sessions.get(player.entityId)?.containerId===c.id
    this.cancel(player)
    this.sessions.set(player.entityId,{containerId:c.id,elapsed:0,openingRemaining:alreadyOpen?0:OPEN_DURATION,scanElapsed:0,x:player.x,y:player.y,damage:player.damageRevision,hp:player.hp,tool:player.activeToolId,initialRevealed:c.revealed,searching})
    player.setSearching(searching)
  }
  /** 拿取不受自己的移动和攻击阻碍，但尊重同伴正在翻找的占用。 */
  open(player:Player,container:SearchContainer):boolean {
    const c=this.normalize(container)
    if(!player.alive||!c.slots||Math.hypot(player.x-c.x,player.y-c.y)>c.range||this.blockedByOther(player,c.id))return false
    this.session(player,c,false);return true
  }
  begin(player:Player,container:SearchContainer,effects:SearchEffectContext={}):boolean {
    const c=this.normalize(container)
    if(!player.alive||player.isChanneling||Math.hypot(player.x-c.x,player.y-c.y)>c.range||this.blockedByOther(player,c.id))return false
    if(c.complete)return this.open(player,c)
    if(player.swingPhase!=='none'||player.dodgePhase!=='none'||player.chargeProgress>0||Math.hypot(player.vx,player.vy)>1)return false
    if(!c.slots){
      const room=c.context??{floor:1},kind=c.kind??(c.chestId!==undefined||c.cols===4?'chest':c.cols===2?'small':'large')
      const base=c.rules??resolveSearchRules(room,kind,c.sourceId,c.table,c.profile)
      const generatedWith=structuredClone({...effects,actorId:effects.actorId??player.entityId})
      const rules=applySearchEffects(base,{phase:'contents',room,kind,sourceId:c.sourceId,containerId:c.id,containerFields:c.fields,seed:c.seed,effects:generatedWith})
      const contents=createSearchContents(c.table,c.cols,c.rows,c.seed,rules)
      // 先生成再锁定纯数据，重开、换人和续战都复用同一批奖励与修正。
      c.rules=rules;c.generatedWith=generatedWith;c.slots=contents.slots;c.placements=contents.placements
    }
    this.session(player,c,true);return true
  }
  beforeInput(player:Player,input:PlayerInput):void {
    if(!this.hasSession(player))return
    if(input.moveX||input.moveY||input.attackPressed||input.attackHeld||input.specialPressed||input.specialHeld||input.dodgePressed||input.dodgeHeld)this.stop(player)
  }
  update(dt:number,time:number,players:readonly Player[],reveal:(player:Player,container:SearchContainer,index:number)=>void,complete:(player:Player,container:SearchContainer)=>void,scan?:(player:Player,container:SearchContainer)=>void):void {
    for(const [id,session] of this.sessions){
      const player=players.find(p=>p.entityId===id),c=this.container(session.containerId)
      if(!player||!c){this.sessions.delete(id);if(player)player.setSearching(false);continue}
      if(!player.alive||Math.hypot(player.x-c.x,player.y-c.y)>c.range){this.cancel(player);continue}
      if(!session.searching){session.openingRemaining=Math.max(0,(session.openingRemaining??0)-dt);continue}
      if(!player.searching||player.isChanneling||player.damageRevision!==session.damage||player.hp<session.hp||player.activeToolId!==session.tool||Math.hypot(player.x-session.x,player.y-session.y)>.5){this.stop(player);continue}
      session.hp=player.hp
      const opening=Math.min(dt,session.openingRemaining??0)
      session.openingRemaining=Math.max(0,(session.openingRemaining??0)-dt)
      const workDt=Math.max(0,dt-opening)
      if(session.openingRemaining>1e-8)continue
      session.elapsed+=workDt;session.scanElapsed=(session.scanElapsed??0)+workDt
      if(session.scanElapsed>=.48){session.scanElapsed%=.48;scan?.(player,c)}
      while(c.revealed<(c.slots?.length??0)){
        const stack=c.slots![c.revealed]
        const duration=stack?itemSearchDuration(getItemDef(stack.id)):0
        if(session.elapsed+1e-8<duration)break
        session.elapsed=Math.max(0,session.elapsed-duration)
        const index=c.revealed++;c.revealedAt[index]=time
        if(stack)reveal(player,c,index)
      }
      if(c.revealed===(c.slots?.length??0)&&!c.complete){c.complete=true;this.stop(player);complete(player,c)}
    }
  }
  take(player:Player,containerId:string,index:number,inventory:Inventory,found:(slot:NonNullable<Slot>)=>void,special?:(id:string)=>boolean|undefined):number {
    const c=this.container(containerId)
    if(!player.alive||player.isChanneling||!c||this.blockedByOther(player,containerId)||Math.hypot(player.x-c.x,player.y-c.y)>c.range)return 0
    const start=index===-1?0:index,end=index===-1?c.revealed:index+1
    if(!Number.isInteger(index)||start<0||end>c.revealed)return 0
    let total=0
    for(let i=start;i<end;i++){
      const stack=c.slots?.[i];if(!stack)continue
      const collected=special?.(stack.id)
      if(collected!==undefined){c.slots![i]=null;if(collected){total++;found({...stack,qty:1})}continue}
      const added=inventory.add(stack.id,stack.qty,stack.durability);if(!added)continue
      total+=added;found({...stack,qty:added});stack.qty-=added
      if(!stack.qty)c.slots![i]=null
    }
    return total
  }
  view(player:Player,time:number):SearchView|null {
    const session=this.sessions.get(player.entityId),c=session?this.container(session.containerId):undefined
    if(!c||!session)return null
    const opening=Math.max(0,Math.min(1,1-(session.openingRemaining??0)/OPEN_DURATION))
    const active=c.complete||!session.searching||opening<1?-1:c.revealed
    const current=active>=0?c.slots?.[active]:null,duration=current?itemSearchDuration(getItemDef(current.id)):.8
    return {id:c.id,nameKey:c.nameKey,cols:c.cols,rows:c.rows,opening,active,progress:Math.min(1,session.elapsed/duration),complete:c.complete,searching:session.searching,blocked:this.blockedByOther(player,c.id),
      slots:(c.slots??[]).map((stack,index)=>{
        const revealed=index<c.revealed,item=revealed?stack:null,def=item?getItemDef(item.id):null
        return {...c.placements[index]!,revealed,item:item?{...item}:null,age:revealed?index<session.initialRevealed?1:Math.max(0,time-c.revealedAt[index]!):-1,feedback:revealed?searchFeedback(item?.id):'ordinary',quality:def?itemQualityLevel(def):0,prismatic:!!def&&itemIsPrismatic(def)}
      })}
  }
}

