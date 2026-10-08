import type { StoryScene } from '../../../../game/story/storyDirector'
import { materialCount } from '../../../../shared/production'
import { ROCK_SALT_ID } from '../../../items/vanilla/ids'
import { SALT_FOUND_TREE, SALT_MISSING_TREE, SALT_DELIVERY_TREE, FAREWELL_TREE } from './dialogues'

export const saltSoupScenes:readonly StoryScene[]=[
  {
    id:SALT_DELIVERY_TREE,event:'camp.idle',priority:100,
    when:({profile})=>profile.flagBool('quest.saltSoup.done')&&!profile.flagBool('story.saltDelivery.seen'),
    completeFlags:['story.saltDelivery.seen']
  },
  {
    id:SALT_FOUND_TREE,event:'camp.idle',priority:40,
    when:({profile})=>profile.flagBool('quest.reimu.cooking.done')&&!profile.flagBool('recipe.saltSoup.unlocked')&&profile.flagBool('story.secondFloor.returned')&&materialCount(profile,ROCK_SALT_ID)>0,
    completeFlags:['recipe.saltSoup.unlocked'],notification:'ui.progress.salt_recipe',consumeData:['fromFloor']
  },
  {
    id:SALT_MISSING_TREE,event:'camp.idle',priority:30,
    when:({profile,data})=>profile.flagBool('quest.reimu.cooking.done')&&!profile.flagBool('recipe.saltSoup.unlocked')&&!profile.flagBool('story.saltMissing.seen')&&data?.fromFloor===2,
    completeFlags:['story.saltMissing.seen'],consumeData:['fromFloor']
  },
  {
    id:FAREWELL_TREE,event:'camp.departure',
    when:({profile})=>profile.flagBool('quest.saltSoup.done')&&!profile.flagBool('story.farewell.seen'),
    completeFlags:['story.farewell.seen']
  }
]
