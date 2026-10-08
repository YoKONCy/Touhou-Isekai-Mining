import { RUBY_ID } from '../ids'
import { MINERAL_RUBY_ID } from '../../../minerals/vanilla/ids'
import { svgIcon, type ItemDef } from '../../types'

/** 不规则宝石断面与少量母岩；沿用矿石的暗描边和克制亮棱。 */
const def: ItemDef = {
  id: RUBY_ID,
  kind: 'material',
  tier: 3,
  color: '#a43c50',
  hi: '#e7a0a1',
  text: '#dfa0a1',
  maxStack: 999,
  mineral: MINERAL_RUBY_ID,
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="m8 27 6-8 10-2 13 8 5 8-8 7-17-2Z" fill="#75666c" stroke="#302b38" stroke-width="1.6" stroke-linejoin="round"/><path d="m12 25 9-8 13 5 4 11-8 5-15-4Z" fill="#4f404d"/><path d="m15 13 10-6 11 8 2 14-13 8-12-12Z" fill="#9b3b50" stroke="#302b38" stroke-width="1.6" stroke-linejoin="round"/><path d="m15 13 10-6 4 11-10 5-6 2Z" fill="#c7727b"/><path d="m25 7 11 8-7 3Z" fill="#ae4e61"/><path d="m29 18 7-3 2 14-13 8 4-12Z" fill="#612c40"/><path d="m19 23 10-5v7l-4 12-12-12Z" fill="#943448"/><path d="m19 23 10-5-4 7Z" fill="#d08a8b"/><path d="m16 14 8-5m-7 13 3 1 6-3m8 1 1 5" fill="none" stroke="#e8b4ac" stroke-width="1.1" stroke-linecap="round"/><path d="m23 12 2 3-3 4m1 8 2 3m-15 1 4-1m18 7 4-2" fill="none" stroke="#573646" stroke-width=".9"/></svg>`),
  tags: ['material', 'gem']
}
export default def
