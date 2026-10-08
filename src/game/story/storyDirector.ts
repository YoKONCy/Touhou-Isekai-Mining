import type { CharacterProfile } from '../../shared/profile'
import { dialogue } from '../dialogue/dialogueService'
import { saveService } from '../../core/save/saveService'

export interface StoryContext {
  profile:CharacterProfile
  /** 只承载事件参数，持久进度仍沿用角色档案。 */
  data?:Record<string,unknown>&{fromFloor?:number;repairStage?:number;found?:boolean}
}
export interface StoryScene {
  id:string
  event?:string|readonly string[]
  priority?:number
  when?:(context:StoryContext)=>boolean
  /** 仅在实际开播前执行；返回 false 时不播，例如零件交付空间不足。 */
  prepare?:(context:StoryContext)=>boolean
  startFlags?:readonly string[]
  completeFlags?:readonly string[]
  save?:'autosave'|'flags'|'none'
  notification?:string
  next?:string|((context:StoryContext)=>string)
  consumeData?:readonly (keyof NonNullable<StoryContext['data']>)[]
}
interface PlayOptions {onEnd?:(scene:StoryScene)=>void}
const scenes=new Map<string,StoryScene>()
const events=new Map<string,StoryScene[]>()
export function registerStoryScene(scene:StoryScene):void{
  const previous=scenes.get(scene.id)
  const eventNames=(value:StoryScene)=>typeof value.event==='string'?[value.event]:value.event??[]
  if(previous)for(const event of eventNames(previous))events.set(event,(events.get(event)??[]).filter(entry=>entry.id!==scene.id))
  scenes.set(scene.id,scene)
  for(const event of eventNames(scene)){
    const entries=events.get(event)??[]
    entries.push(scene);entries.sort((a,b)=>(b.priority??0)-(a.priority??0));events.set(event,entries)
  }
}
function remember(scene:StoryScene,context:StoryContext,flags:readonly string[]=[]):void{
  flags.forEach(key=>context.profile.setFlag(key,true))
  if(scene.save==='none')return
  if(scene.save==='flags')flags.forEach(key=>{void saveService.persistStoryFlag(key)})
  else void saveService.autosave()
}
export function storyAvailable(id:string,context:StoryContext):boolean{
  const scene=scenes.get(id)
  return !!scene&&(!scene.when||scene.when(context))
}
export function hasAvailableStory(event:string,context:StoryContext):boolean{
  return (events.get(event)??[]).some(scene=>dialogue.hasTree(scene.id)&&storyAvailable(scene.id,context))
}
/** 自然结束才落完成标记；取消不算完成，事务已提交的小剧可由相同条件补播。 */
export function playStory(id:string,context:StoryContext,options:PlayOptions={}):boolean{
  const scene=scenes.get(id)
  if(!scene||dialogue.isActive||!dialogue.hasTree(id)||!storyAvailable(id,context))return false
  if(scene.prepare&&!scene.prepare(context))return false
  if(scene.prepare||scene.startFlags?.length)remember(scene,context,scene.startFlags)
  for(const key of scene.consumeData??[])if(context.data)delete context.data[key]
  dialogue.start(id,undefined,()=>{
    remember(scene,context,scene.completeFlags)
    options.onEnd?.(scene)
    const next=typeof scene.next==='function'?scene.next(context):scene.next
    if(next)playStory(next,context)
  })
  return true
}
/** 同一事件按优先级只启动一段对白，条件与完成标记都由内容包声明。 */
export function playNextStory(event:string,context:StoryContext,options:PlayOptions={}):boolean{
  if(dialogue.isActive)return false
  const candidates=events.get(event)??[]
  return candidates.some(scene=>playStory(scene.id,context,options))
}
