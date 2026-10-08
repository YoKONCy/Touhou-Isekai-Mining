import type { CharacterProfile } from '../../shared/profile'
import { dialogue } from '../dialogue/dialogueService'
import { saveService } from '../../core/save/saveService'

export interface NpcConversation {
  id:string;treeId:string
  pickEntry:(profile:CharacterProfile)=>string
  persistFlags:(entry:string)=>readonly string[]
}
const conversations=new Map<string,NpcConversation>()
export function registerNpcConversation(conversation:NpcConversation):void{conversations.set(conversation.id,conversation)}
export function talkToNpc(id:string,profile:CharacterProfile):boolean{
  const conversation=conversations.get(id)
  if(!conversation||dialogue.isActive||!dialogue.hasTree(conversation.treeId))return false
  const entry=conversation.pickEntry(profile)
  dialogue.start(conversation.treeId,entry,()=>{
    for(const key of conversation.persistFlags(entry))void saveService.persistStoryFlag(key)
  })
  return true
}
