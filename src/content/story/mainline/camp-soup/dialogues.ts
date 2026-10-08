import type { DialogueTree } from '../../../../game/dialogue/types'
import { bindStoryCG, storyCGs } from '../../cg'


/**
 * 修锅小剧（修缮材料交齐、锅刚修好时由 CampPanel 关面板触发）：
 * 主角正得意 → 突然意识到没有水 → 灵梦丢来一颗史莱姆球：
 * 「一肚子水，挤一挤就有了，煮开了什么细菌都没了」——荒诞但自洽。
 * 只播一次：链尾落 base.pot.repair_talk.done。纯剧情，不给物品、不改煮汤配方。
 */
export const POT_REPAIR_TREE = 'touhou:pot_repair'

export const potRepairTree: DialogueTree = {
  id: POT_REPAIR_TREE,
  start: 'p1',
  nodes: {
    p1: { id: 'p1', narration: true, os: true, text: 'quest.pot.p1', next: 'p2' },
    p2: { id: 'p2', speaker: 'story.speaker.hero', text: 'quest.pot.p2', next: 'p3' },
    p3: { id: 'p3', speaker: 'story.speaker.reimu', text: 'quest.pot.p3', next: 'p4' },
    p4: { id: 'p4', speaker: 'story.speaker.hero', text: 'quest.pot.p4', next: 'p5' },
    p5: { id: 'p5', speaker: 'story.speaker.hero', text: 'quest.pot.p5', next: 'p6' },
    p6: { id: 'p6', speaker: 'story.speaker.reimu', text: 'quest.pot.p6', next: 'p7' },
    p7: { id: 'p7', speaker: 'story.speaker.hero', text: 'quest.pot.p7', next: 'p8' },
    p8: { id: 'p8', speaker: 'story.speaker.reimu', text: 'quest.pot.p8', next: 'p9' },
    p9: { id: 'p9', narration: true, os: true, text: 'quest.pot.p9', next: 'p10' },
    p10: { id: 'p10', speaker: 'story.speaker.reimu', text: 'quest.pot.p10', next: 'p11' },
    p11: { id: 'p11', speaker: 'story.speaker.hero', text: 'quest.pot.p11', next: 'p12' },
    p12: { id: 'p12', speaker: 'story.speaker.reimu', text: 'quest.pot.p12', next: 'p13' },
    p13: {
      id: 'p13',
      speaker: 'story.speaker.hero',
      text: 'quest.pot.p13',
      effects: [{ type: 'flagSet', key: 'base.pot.repair_talk.done' }]
    }
  }
}


export const SOUP_DELIVERY_TREE = 'touhou:soup_delivery'

/** 初次交汤后的营地小剧；完成委托后开放地下二层与后续找盐剧情。 */
export const soupDeliveryTree: DialogueTree = {
  id: SOUP_DELIVERY_TREE,
  start: 's1',
  nodes: {
    s1: { id: 's1', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s1', next: 's2' },
    s2: { id: 's2', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s2', next: 's3' },
    s3: { id: 's3', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s3', next: 's4' },
    s4: { id: 's4', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s4', next: 's5' },
    s5: { id: 's5', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s5', next: 's6' },
    s6: { id: 's6', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s6', next: 's7' },
    s7: { id: 's7', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s7', next: 's8' },
    s8: { id: 's8', narration: true, os: true, text: 'quest.soup_delivery.s8', next: 's9' },
    s9: { id: 's9', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s9', next: 's10' },
    s10: { id: 's10', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s10', next: 's11' },
    s11: { id: 's11', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s11', next: 's12' },
    s12: { id: 's12', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s12', next: 's13' },
    s13: { id: 's13', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s13', next: 's14' },
    s14: { id: 's14', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s14', next: 's15' },
    s15: { id: 's15', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s15', next: 's16' },
    s16: { id: 's16', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s16', next: 's17' },
    s17: { id: 's17', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s17', next: 's18' },
    s18: { id: 's18', narration: true, os: true, text: 'quest.soup_delivery.s18', next: 's19' },
    s19: { id: 's19', speaker: 'story.speaker.reimu', text: 'quest.soup_delivery.s19', next: 's20' },
    s20: { id: 's20', speaker: 'story.speaker.hero', text: 'quest.soup_delivery.s20' }
  }
}

// sd-02：史莱姆球入锅的喜剧桥段。
bindStoryCG(potRepairTree, ['p9'], storyCGs.slimeWater)

