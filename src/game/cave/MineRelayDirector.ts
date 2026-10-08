import type { CharacterProfile } from '../../shared/profile'
import { CONFIG } from '../config'
import { t } from '../../i18n'
import { playStory } from '../story/storyDirector'
import { dialogue } from '../dialogue/dialogueService'
import { sfx } from '../audio/Sfx'
import type { Player } from '../Player'
import type { RoomRuntime } from './RoomRuntime'
import type { EngineContext } from '../../core/types'
import { RELAY_INTRO_TREE, RELAY_COLLAPSE_TREE, RELAY_DISCOVERY_TREE } from '../../content/story/mainline/mine-relay/dialogues'
import { MineCollapse, drawLoosePebbles } from '../art/mineCollapse'
import { drawCraftMarker } from '../art/workshopScene'

/** 前往三层途中的专用导演；死亡重试重新生成，不提前写入塌方后的入口状态。 */
export class MineRelayDirector {
  readonly collapse=new MineCollapse()
  completed=false
  private introStarted=false
  private collapseStarted=false
  private inspectReady=false
  private seenRooms=new Set<number>()
  private roomAge=0
  private roomId=-1
  private pebbleCue=false
  private discoveryPebbles=false
  private gravel:{x:number;y:number;age:number;roof:boolean}|null=null
  constructor(private readonly profile:CharacterProfile,private readonly extract:()=>void){}
  onRoomEnter(id:number,room:RoomRuntime):void{
    this.roomId=id;this.roomAge=0;this.pebbleCue=this.seenRooms.has(id);this.seenRooms.add(id)
    if(id===3&&!this.collapseStarted)room.map.setStoryArea(21,4,27,16)
  }
  get blocksInput():boolean{return this.collapse.falling}
  update(dt:number,engine:EngineContext,room:RoomRuntime,player:Player):void{
    this.roomAge+=dt;this.collapse.update(dt)
    if(this.gravel){this.gravel.age+=dt;if(this.gravel.age>1.3)this.gravel=null}
    const node=dialogue.state.value
    if(node?.treeId===RELAY_DISCOVERY_TREE&&node.node.id==='s4'&&!this.discoveryPebbles){
      this.discoveryPebbles=true;this.gravel={x:player.x+32,y:player.y+12,age:0,roof:true}
    }
    if(dialogue.isActive||!player.alive)return
    if(!this.introStarted){
      if(playStory(RELAY_INTRO_TREE,{profile:this.profile})){
        this.introStarted=true;this.gravel={x:player.x+18,y:player.y+15,age:0,roof:false};engine.shake(.12)
      }
      return
    }
    if(this.roomId>0&&this.roomId<3&&!this.pebbleCue&&this.roomAge>.9){
      this.pebbleCue=true;sfx.minePebbles();this.gravel={x:player.x+100,y:player.y+15,age:0,roof:true};engine.shake(.055)
    }
    if(this.roomId===3&&room.isCleared&&!this.collapseStarted&&player.x>16*CONFIG.tile){
      const started=playStory(RELAY_COLLAPSE_TREE,{profile:this.profile},{onEnd:()=>{
        this.inspectReady=true;room.addSpecialInteractable(21*CONFIG.tile,12*CONFIG.tile,100,'mine-relay:inspect',t('story.mineRelay.inspect'))
      }})
      if(started){
        this.collapseStarted=true;this.collapse.start();player.vx=0;player.vy=0;engine.shake(.65)
        room.map.setStoryArea(23,5,27,15,true)
      }
    }
  }
  onInteract(ref?:string):void{
    if(ref!=='mine-relay:inspect'||!this.inspectReady)return
    if(playStory(RELAY_DISCOVERY_TREE,{profile:this.profile},{onEnd:()=>{this.completed=true;this.extract()}}))this.inspectReady=false
  }
  render(g:CanvasRenderingContext2D):void{
    if(this.roomId===3){
      this.collapse.render(g)
      if(this.inspectReady)drawCraftMarker(g,21*CONFIG.tile,12*CONFIG.tile+26,this.roomAge)
    }
    if(this.gravel)drawLoosePebbles(g,this.gravel.x,this.gravel.y,this.gravel.age,this.gravel.roof)
  }
}
