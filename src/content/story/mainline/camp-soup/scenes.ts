import type { StoryScene } from '../../../../game/story/storyDirector'
import { POT_REPAIR_TREE, SOUP_DELIVERY_TREE } from './dialogues'

export const campSoupScenes:readonly StoryScene[]=[
  {id:POT_REPAIR_TREE,when:({profile})=>profile.flagBool('base.pot.repaired')&&!profile.flagBool('base.pot.repair_talk.done')},
  {id:SOUP_DELIVERY_TREE,when:({profile})=>profile.flagBool('quest.reimu.cooking.done')}
]
