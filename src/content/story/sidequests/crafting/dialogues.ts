import { sequence } from '../../sequence'

export const CRAFT_INTRO_TREE='touhou:craft_intro'
export const TETANUS_SPEAR_TREE='touhou:tetanus_spear_intro'
export const IRON_WORK_TREE='touhou:iron_work_intro'
export const FIRST_IRON_WEAPON_TREE='touhou:first_iron_weapon'
export const craftingTrees=[
  sequence(CRAFT_INTRO_TREE,'quest.craft_intro',['reimu','hero','reimu','narration','reimu','reimu','hero','reimu','reimu','reimu','hero']),
  sequence(TETANUS_SPEAR_TREE,'quest.tetanus_intro',['hero','reimu','hero','reimu','narration','hero','reimu']),
  sequence(IRON_WORK_TREE,'quest.iron_work',['hero','reimu','hero','reimu','narration','hero','reimu','hero']),
  sequence(FIRST_IRON_WEAPON_TREE,'quest.first_iron_weapon',['reimu','hero','reimu','hero','reimu','hero'])
]
