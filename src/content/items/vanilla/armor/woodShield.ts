import { svgIcon, type ItemDef } from '../../types'
import { WOOD_SHIELD_ID } from '../ids'

/** 饰品木盾不占武器手，只提供命中后的固定弹幕减伤。 */
export default {
  id: WOOD_SHIELD_ID, kind: 'armor', equipSlot: 'trinket', rarity: 1, tier: 1, maxStack: 1,
  color: '#98724e', hi: '#d3b389', text: '#d0b692', combat: { projectileReduction: 2 },
  icon: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M9 9L24 5L39 9V26Q36 36 24 43Q12 36 9 26Z" fill="#654936" stroke="#312b31" stroke-width="1.6"/><path d="M11 10L24 7L37 10V25Q33 34 24 40Q15 34 11 25Z" fill="#ac8257"/><path d="M12 10L19 8V36L13 29Z" fill="#c09a6e"/><path d="M28 8L36 10V25L28 36Z" fill="#896447"/><path d="M19 8V36M28 8V36" stroke="#5d4335" stroke-width="1"/><path d="M11 17H37V21H11ZM14 29H34L31 33H17Z" fill="#7f7770" stroke="#39353b" stroke-width=".8"/><path d="M12 17.5H36M16 29.5H32" stroke="#b9b29b" stroke-width=".8"/><path d="M14 18H15V20H14ZM33 18H34V20H33ZM18 30H19V32H18ZM28 30H29V32H28Z" fill="#d5c4a0"/><path d="M14 12L16 11M23 25V29M31 12V15" stroke="#d9b887" stroke-width=".6"/></svg>'),
  tags: ['trinket', 'shield', 'wood', 'crafting']
} satisfies ItemDef
