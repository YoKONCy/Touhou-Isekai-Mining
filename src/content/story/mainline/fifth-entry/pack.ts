import type { StoryPack } from '../../types'
import { FIFTH_TREES, FIFTH_MEAT_LATER } from './dialogues'
import { FIFTH_FLAGS, hasReturnedPork } from './state'
import { FOURTH_FLAGS } from '../fourth-rescue/state'
import zhCn from './lang/zh_cn.json'

export default {
  id: 'touhou:fifth_entry', languages: { zh_cn: zhCn },
  trees: [...Object.values(FIFTH_TREES), FIFTH_MEAT_LATER],
  scenes: [
    { id: FIFTH_TREES.approach.id, save: 'none' },
    { id: FIFTH_TREES.vista.id, save: 'none' },
    { id: FIFTH_TREES.report.id, event: 'camp.fifth', priority: 90, save: 'flags',
      when: ({ profile }) => profile.flagBool(FOURTH_FLAGS.asked) && profile.flagBool(FIFTH_FLAGS.returned) && !profile.flagBool(FIFTH_FLAGS.reported),
      completeFlags: [FIFTH_FLAGS.reported],
      next: ({ profile }) => hasReturnedPork(profile) && !profile.flagBool(FIFTH_FLAGS.meatSeen) ? FIFTH_TREES.meat.id : FIFTH_TREES.empty.id },
    { id: FIFTH_TREES.empty.id, event: 'camp.fifth', priority: 70, save: 'flags',
      when: ({ profile }) => profile.flagBool(FIFTH_FLAGS.reported) && !profile.flagBool(FIFTH_FLAGS.emptySeen) && !profile.flagBool(FIFTH_FLAGS.meatSeen) && !hasReturnedPork(profile),
      completeFlags: [FIFTH_FLAGS.emptySeen] },
    { id: FIFTH_TREES.meat.id, save: 'flags',
      when: ({ profile }) => !profile.flagBool(FIFTH_FLAGS.meatSeen) && hasReturnedPork(profile),
      completeFlags: [FIFTH_FLAGS.meatSeen] },
    { id: FIFTH_MEAT_LATER.id, event: 'camp.fifth', priority: 80, save: 'flags',
      when: ({ profile }) => profile.flagBool(FOURTH_FLAGS.asked) && profile.flagBool(FIFTH_FLAGS.reported) && !profile.flagBool(FIFTH_FLAGS.meatSeen) && hasReturnedPork(profile),
      completeFlags: [FIFTH_FLAGS.meatSeen] }
  ]
} satisfies StoryPack
