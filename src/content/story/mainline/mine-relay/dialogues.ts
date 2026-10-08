import type { DialogueTree } from '../../../../game/dialogue/types'
import { sequence } from '../../sequence'
import { sfx } from '../../../../game/audio/Sfx'
import { bindStoryCG, storyCGs } from '../../cg'

export const METAL_FIRST_TREE = 'touhou:metal_first'
export const RELAY_INTRO_TREE = 'touhou:mine_relay_intro'
export const RELAY_COLLAPSE_TREE = 'touhou:mine_relay_collapse'
export const RELAY_DISCOVERY_TREE = 'touhou:mine_relay_discovery'
export const RELAY_REMINDER_TREE = 'touhou:mine_relay_reminder'
export const RELAY_REPORT_TREE = 'touhou:mine_relay_report'

const metal = sequence(METAL_FIRST_TREE, 'story.mineRelay.metal', ['narration', 'hero', 'reimu', 'hero', 'reimu', 'narration', 'hero', 'reimu', 'reimu'])
// sd-03：第一炉金属锭的烫手桥段，不能挂到序章营地拌嘴。
bindStoryCG(metal, ['s5', 's6', 's7', 's8', 's9'], storyCGs.hotIngot)
metal.nodes.s7.onEnter = () => sfx.hotIngot()
metal.nodes.s8.autoNextMs = 950
const intro = sequence(RELAY_INTRO_TREE, 'story.mineRelay.intro', ['narration', 'narration', 'narration'])
intro.nodes.s1.onEnter = () => sfx.mineDistant()
const collapse = sequence(RELAY_COLLAPSE_TREE, 'story.mineRelay.collapse', ['narration', 'narration', 'narration'])
collapse.nodes.s1.autoNextMs = 2400
collapse.nodes.s1.onEnter = () => sfx.mineCollapse()
const discovery = sequence(RELAY_DISCOVERY_TREE, 'story.mineRelay.discovery', ['narration', 'narration', 'narration', 'narration', 'narration'])
discovery.nodes.s4.onEnter = () => sfx.minePebbles()
export const mineRelayTrees: readonly DialogueTree[] = [
  metal, intro, collapse, discovery,
  sequence(RELAY_REMINDER_TREE, 'story.mineRelay.reminder', ['narration', 'narration', 'narration']),
  sequence(RELAY_REPORT_TREE, 'story.mineRelay.report', ['reimu', 'reimu', 'hero', 'reimu', 'hero', 'hero', 'reimu', 'hero', 'reimu', 'hero', 'reimu', 'reimu', 'hero'])
]
