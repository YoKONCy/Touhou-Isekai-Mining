import type { StoryScene } from '../../../../game/story/storyDirector'
import { CRAFT_INTRO_TREE, TETANUS_SPEAR_TREE,IRON_WORK_TREE,FIRST_IRON_WEAPON_TREE } from './dialogues'
import {IRON_WORK_FLAGS,ironWorkPending} from './ironWork'
import { tetanusRecipePending } from './tetanus'

export const craftingScenes:readonly StoryScene[]=[{
  id:CRAFT_INTRO_TREE,event:'camp.worktable',
  when:({profile})=>profile.flagBool('quest.saltSoup.done')&&!profile.flagBool('base.crafting.unlocked'),
  completeFlags:['base.crafting.unlocked']
}, {
  id: TETANUS_SPEAR_TREE, event: 'camp.worktable', priority: 10,
  when: ({ profile }) => tetanusRecipePending(profile),
  completeFlags: ['recipe.tetanusSpear.unlocked']
},{
  id:IRON_WORK_TREE,event:'camp.worktable',priority:20,
  when:({profile})=>ironWorkPending(profile),completeFlags:[IRON_WORK_FLAGS.unlocked]
},{
  id:FIRST_IRON_WEAPON_TREE,event:'camp.idle',priority:30,
  when:({profile})=>profile.flagBool(IRON_WORK_FLAGS.crafted)&&!profile.flagBool(IRON_WORK_FLAGS.commentSeen),
  completeFlags:[IRON_WORK_FLAGS.commentSeen]
}]
