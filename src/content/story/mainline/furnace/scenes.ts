import type { StoryScene } from '../../../../game/story/storyDirector'
import { furnaceStage, materialCount } from '../../../../shared/production'
import { OLD_FURNACE_PARTS_ID } from '../../../items/vanilla/ids'
import { deliverFurnaceParts } from './transactions'
import { FURNACE_INSPECT_TREE, FURNACE_KEY_TREE, FURNACE_PARTS_TREE, FURNACE_READY_TREE, WRECK_INTRO_TREE, WRECK_FOUND_TREE, WRECK_EMPTY_TREE } from './dialogues'

export const furnaceScenes:readonly StoryScene[]=[
  {
    id:FURNACE_INSPECT_TREE,event:'camp.furnace',
    when:({profile})=>profile.flagBool('quest.saltSoup.done')&&!profile.flagBool('base.furnace.inspected'),
    completeFlags:['base.furnace.inspected']
  },
  {
    id:FURNACE_PARTS_TREE,event:'camp.idle',priority:70,
    when:({profile})=>!profile.flagBool('story.furnaceParts.seen')&&(profile.flagBool('quest.furnaceParts.done')||furnaceStage(profile)===2&&materialCount(profile,OLD_FURNACE_PARTS_ID)>0),
    prepare:({profile})=>profile.flagBool('quest.furnaceParts.done')||deliverFurnaceParts(profile),
    completeFlags:['story.furnaceParts.seen']
  },
  {
    id:FURNACE_KEY_TREE,event:['camp.idle','furnace.repaired'],priority:60,
    when:({profile})=>furnaceStage(profile)===2&&!profile.flagBool('story.furnaceKey.seen'),
    completeFlags:['story.furnaceKey.seen']
  },
  {
    id:FURNACE_READY_TREE,event:['camp.idle','furnace.repaired'],priority:50,
    when:({profile})=>furnaceStage(profile)===3&&!profile.flagBool('story.furnaceReady.seen'),
    completeFlags:['story.furnaceReady.seen']
  },
  {
    id:WRECK_INTRO_TREE,event:'cave.furnaceSearch',priority:100,
    when:({profile})=>!profile.flagBool('story.wreckIntro.seen'),
    startFlags:['story.wreckIntro.seen'],save:'flags',
    next:({data})=>data?.found?WRECK_FOUND_TREE:WRECK_EMPTY_TREE
  },
  {id:WRECK_FOUND_TREE,event:'cave.furnaceSearch',when:({data})=>data?.found===true,save:'none'},
  {id:WRECK_EMPTY_TREE,event:'cave.furnaceSearch',when:({data})=>data?.found===false,save:'none'}
]
