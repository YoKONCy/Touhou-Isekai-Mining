import type { StoryPack } from '../../types'
import { FOURTH_TREES } from './dialogues'
import { FOURTH_FLAGS } from './state'
import zhCn from './lang/zh_cn.json'
import { t } from '../../../../i18n'

export default {
  id: 'touhou:fourth_rescue', languages: { zh_cn: zhCn }, trees: Object.values(FOURTH_TREES),
  scenes: Object.values(FOURTH_TREES).map(tree => ({ id: tree.id, save: 'none' as const })),
  quests: [{ id: 'fourth-bright-road', category: 'mainline', order: 50,
    visible: profile => profile.flagBool(FOURTH_FLAGS.asked),
    journal: profile => {
      const done = profile.flagBool('mine.floor.5.entered')
      return { id: 'fourth-bright-road', chapter: t('quest.fourth.chapter'), title: t('quest.fourth.title'), summary: t('quest.fourth.summary'),
        giver: t('story.speaker.rumia'), status: t(done ? 'quest.fourth.done' : 'quest.fourth.active'), completed: done,
        objectives: [{ id: 'fifth-floor', title: t('quest.fourth.goal'), complete: done, current: !done }], goal: t('quest.fourth.goal') }
    }
  }]
} satisfies StoryPack
