import { sequence } from '../../sequence'

export const SALT_FOUND_TREE='touhou:salt_found'
export const SALT_MISSING_TREE='touhou:salt_missing'
export const SALT_DELIVERY_TREE='touhou:salt_soup_delivery'
export const FAREWELL_TREE='touhou:reimu_farewell'
export const saltSoupTrees=[
  sequence(SALT_FOUND_TREE,'quest.salt_found',['narration','reimu','hero','narration','reimu','hero','reimu','hero','reimu','hero','reimu']),
  sequence(SALT_MISSING_TREE,'quest.salt_missing',['reimu','hero','reimu']),
  sequence(SALT_DELIVERY_TREE,'quest.salt_delivery',['narration','reimu','hero','reimu','hero','reimu','narration','hero','reimu','narration','hero','reimu','hero','reimu','hero','reimu','hero','reimu','hero']),
  sequence(FAREWELL_TREE,'quest.farewell',['reimu','hero','reimu','reimu','hero'])
]
saltSoupTrees.find(tree=>tree.id===FAREWELL_TREE)!.nodes.s3!.autoNextMs=900
