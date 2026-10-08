import type { StoryScene } from '../../../../game/story/storyDirector'
import { RELAY_FLAGS, needsMineRelay } from './state'
import { METAL_FIRST_TREE, RELAY_INTRO_TREE, RELAY_COLLAPSE_TREE, RELAY_DISCOVERY_TREE, RELAY_REMINDER_TREE, RELAY_REPORT_TREE } from './dialogues'

export const mineRelayScenes: readonly StoryScene[] = [
  { id: METAL_FIRST_TREE, event: ['furnace.claimed', 'camp.idle'], priority: 45,
    when: ({ profile }) => profile.flagBool(RELAY_FLAGS.metalClaimed) && !profile.flagBool(RELAY_FLAGS.metalSeen), completeFlags: [RELAY_FLAGS.metalSeen] },
  { id: RELAY_REMINDER_TREE, event: 'camp.idle', priority: 42,
    when: ({ profile }) => needsMineRelay(profile) && profile.flagBool(RELAY_FLAGS.shallowReturned) && !profile.flagBool(RELAY_FLAGS.hintSeen), completeFlags: [RELAY_FLAGS.hintSeen] },
  { id: RELAY_REPORT_TREE, event: 'camp.idle', priority: 120,
    when: ({ profile }) => profile.flagBool(RELAY_FLAGS.returned) && !profile.flagBool(RELAY_FLAGS.reported), completeFlags: [RELAY_FLAGS.reported], notification: 'story.mineRelay.fourth_opened' },
  { id: RELAY_INTRO_TREE, save: 'none' },
  { id: RELAY_COLLAPSE_TREE, save: 'none' },
  { id: RELAY_DISCOVERY_TREE, save: 'none' }
]
