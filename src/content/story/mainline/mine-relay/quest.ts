import type { QuestDefinition } from '../../../../shared/quests'
import { t } from '../../../../i18n'
import { RELAY_FLAGS, mineRelayUnlocked } from './state'

export const mineRelayQuest: QuestDefinition = {
  id: 'mine-relay', category: 'mainline', order: 50,
  visible: profile => mineRelayUnlocked(profile),
  journal: profile => {
    const returned = profile.flagBool(RELAY_FLAGS.returned), completed = profile.flagBool(RELAY_FLAGS.reported)
    return { id: 'mine-relay', chapter: t('ui.progress.chapter'), title: t('story.mineRelay.quest.title'),
      summary: t('story.mineRelay.quest.summary'), giver: t('story.speaker.hero'), completed,
      status: t(completed ? 'ui.camp.done' : 'ui.camp.active'),
      objectives: [
        { id: 'old-road', title: t('story.mineRelay.quest.road'), complete: returned, current: !returned },
        { id: 'report', title: t('story.mineRelay.quest.report'), complete: completed, current: returned && !completed, locked: !returned }
      ], goal: t(completed ? 'story.mineRelay.quest.done' : returned ? 'story.mineRelay.quest.report' : 'story.mineRelay.quest.road') }
  }
}
