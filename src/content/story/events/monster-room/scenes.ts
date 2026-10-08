import type { StoryScene } from '../../../../game/story/storyDirector'
import { MONSTER_ROOM_TREE } from './dialogues'
export const monsterRoomScenes:readonly StoryScene[]=[{
  id:MONSTER_ROOM_TREE,event:'cave.monsterRoom',
  when:({profile})=>!profile.flagBool('story.monsterRoom.seen'),
  startFlags:['story.monsterRoom.seen'],save:'flags'
}]
