import { sequence } from '../../sequence'

export const FURNACE_INSPECT_TREE='touhou:furnace_inspect'
export const FURNACE_KEY_TREE='touhou:furnace_key'
export const FURNACE_PARTS_TREE='touhou:furnace_parts'
export const FURNACE_READY_TREE='touhou:furnace_ready'
export const WRECK_INTRO_TREE='touhou:wreck_intro'
export const WRECK_EMPTY_TREE='touhou:wreck_empty'
export const WRECK_FOUND_TREE='touhou:wreck_found'
export const furnaceTrees=[
  sequence(FURNACE_INSPECT_TREE,'quest.furnace_inspect',['reimu','hero','reimu','hero','reimu','hero']),
  sequence(FURNACE_KEY_TREE,'quest.furnace_key',['reimu','hero','reimu','hero','reimu','hero','hero','reimu','hero','reimu']),
  sequence(FURNACE_PARTS_TREE,'quest.furnace_parts',['hero','reimu','hero','reimu','hero']),
  sequence(FURNACE_READY_TREE,'quest.furnace_ready',['narration','hero','reimu','hero','reimu','hero','reimu','hero','reimu','hero']),
  sequence(WRECK_INTRO_TREE,'quest.wreck_intro',['narration','narration','narration']),
  sequence(WRECK_EMPTY_TREE,'quest.wreck_empty',['narration']),
  sequence(WRECK_FOUND_TREE,'quest.wreck_found',['narration'])
]
