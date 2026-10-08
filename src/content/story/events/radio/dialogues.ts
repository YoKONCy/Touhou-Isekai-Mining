import type { DialogueTree } from '../../../../game/dialogue/types'

/**
 * 首次正常撤离回基地的收音机小剧：
 * 灵梦自称"附近转了一圈"捡来会自己响的破盒子 → 主角认出是收音机并质疑电与信号
 * → 霖之助店里也见过 → 能响就行 → 主角想起她本该守家 → 劳逸结合。
 * 链尾双效果：落 base.radio.unlocked（家具落地）+ base.radioReady（开 BGM、弹曲目 toast）。
 */
export const RADIO_FIND_TREE = 'touhou:radio_find'

export const radioFindTree: DialogueTree = {
  id: RADIO_FIND_TREE,
  start: 'rf1',
  nodes: {
    rf1: { id: 'rf1', speaker: 'story.speaker.reimu', text: 'quest.radio.rf1', next: 'rf2' },
    rf2: { id: 'rf2', speaker: 'story.speaker.hero', text: 'quest.radio.rf2', next: 'rf3' },
    rf3: { id: 'rf3', speaker: 'story.speaker.reimu', text: 'quest.radio.rf3', next: 'rf4' },
    // 电流杂音 + 音乐冒头（合成音效；真正的 BGM 在链尾 ready 后才起）
    rf4: {
      id: 'rf4',
      narration: true,
      os: true,
      text: 'quest.radio.rf4',
      next: 'rf5',
      effects: [{ type: 'action', name: 'sfx.radioStatic' }]
    },
    rf5: { id: 'rf5', speaker: 'story.speaker.hero', text: 'quest.radio.rf5', next: 'rf6' },
    rf6: { id: 'rf6', speaker: 'story.speaker.hero', text: 'quest.radio.rf6', next: 'rf7' },
    rf7: { id: 'rf7', speaker: 'story.speaker.reimu', text: 'quest.radio.rf7', next: 'rf8' },
    rf8: { id: 'rf8', speaker: 'story.speaker.reimu', text: 'quest.radio.rf8', next: 'rf9' },
    rf9: { id: 'rf9', speaker: 'story.speaker.hero', text: 'quest.radio.rf9', next: 'rf10' },
    rf10: { id: 'rf10', speaker: 'story.speaker.reimu', text: 'quest.radio.rf10', next: 'rf11' },
    rf11: {
      id: 'rf11',
      speaker: 'story.speaker.hero',
      text: 'quest.radio.rf11',
      effects: [
        { type: 'flagSet', key: 'base.radio.unlocked' },
        { type: 'action', name: 'base.radioReady' }
      ]
    }
  }
}
