import { svgIcon, type ItemDef } from '../../types'
import { RANGER_MEDAL_ID } from '../ids'

/** 被动按装备槽聚合，放在背包或备用武器栏不会获得效果。 */
export default {
  id:RANGER_MEDAL_ID,kind:'armor',equipSlot:'trinket',grade:2,maxStack:1,
  color:'#768564',hi:'#d4cf9b',text:'#c7d2ac',
  rangedChargeRoll:{critChance:.25,nameKey:'skill.ranger_medal.name',descriptionKey:'skill.ranger_medal.desc'},
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g stroke="#30333a" stroke-width="1.3" stroke-linejoin="round"><path d="M12 4L23 7L19 24L9 16ZM25 7L36 4L39 16L29 24Z" fill="#4f6658"/><path d="M14 5L18 6L15 19M31 6L34 5L36 18" fill="none" stroke="#b3be8e" stroke-width="1.3"/><path d="M24 16L29 20L36 21L36 28L39 33L34 38L32 44L24 42L16 44L14 38L9 33L12 28L12 21L19 20Z" fill="#9c9570"/><circle cx="24" cy="31" r="10" fill="#414e47" stroke="#d0c48f"/><path d="M20 24Q31 31 20 38M20 24V38M17 31H31M28 28L32 31L28 34" fill="none" stroke="#e4deb4" stroke-width="1.2"/><path d="M14 36Q13 26 18 22M34 36Q35 26 30 22" fill="none" stroke="#7b976f" stroke-width="1.3"/></g></svg>'),
  tags:['trinket','ranger','bow']
} satisfies ItemDef
