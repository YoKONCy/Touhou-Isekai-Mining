import type { CharacterProfile } from './profile'

export type QuestCategory='mainline'|'side'

export interface QuestMaterial {id:string;required:number;available:number}
export interface QuestObjective {
  id:string;title:string;complete:boolean;current?:boolean;locked?:boolean;note?:string
  materials?:readonly QuestMaterial[];metered?:boolean
  location?:{text:string;status:string;ready:boolean}
}
export interface QuestJournalData {
  category?:QuestCategory
  id:string;chapter:string;title:string;summary:string;giver:string;status:string;completed:boolean
  objectives:readonly QuestObjective[];goal:string;action?:{label:string;disabled:boolean}
}
export interface QuestActionResult {ok:boolean;message:string;scene?:string}
/** 任务定义属于内容；手账只渲染状态，交付仍由各任务的原子事务处理。 */
export interface QuestDefinition {
  id:string
  category:QuestCategory
  order:number
  visible:(profile:CharacterProfile)=>boolean
  journal:(profile:CharacterProfile)=>QuestJournalData
  action?:(profile:CharacterProfile)=>QuestActionResult
}
