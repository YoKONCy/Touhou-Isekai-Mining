import type { DialogueTree } from '../../game/dialogue/types'
import type { QuestDefinition } from '../../shared/quests'
import type { StoryScene } from '../../game/story/storyDirector'
import type { NpcConversation } from '../../game/story/npcDialogue'

/** 每个章节、NPC 或独立事件提供一个内容包，入口自动发现，不再维护多处注册清单。 */
export interface StoryPack {
  id:string
  languages:Record<string,Record<string,string>>
  trees:readonly DialogueTree[]
  quests?:readonly QuestDefinition[]
  scenes?:readonly StoryScene[]
  npcs?:readonly NpcConversation[]
}
