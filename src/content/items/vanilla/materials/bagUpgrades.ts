import { svgIcon, type ItemDef } from '../../types'

export const BAG_REINFORCE_ID = 'touhou:bag_reinforce'
/** 工作桌升级图样只展示囊袋，制作直接加固现有行囊。 */
export const bagUpgrades: ItemDef[] = [BAG_REINFORCE_ID].map(id => ({
  id, kind: 'misc', maxStack: 1, color: '#9b8260', hi: '#d6c29d', text: '#d6c29d', tags: ['recipe_only', 'inventory_upgrade'],
  icon: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g stroke="#40332a" stroke-width="1.5" stroke-linejoin="round"><path d="M12 18Q7 27 9 41L36 41Q40 25 34 18Z" fill="#978061"/><path d="M12 18L17 8L30 8L34 18L24 24Z" fill="#c2ad87"/><path d="M12 20L14 38L20 40L18 24Z" fill="#745d46"/><path d="M31 23L35 24L34 38L29 38Z" fill="#ad9570"/><path d="M19 24L19 31L28 31L28 24Z" fill="#594532"/><path d="M21 23L26 23L26 28L21 28Z" fill="#d7ba7e"/><path d="M12 17Q23 20 34 17M12 34L33 34" fill="none" stroke="#e0cda155"/></g></svg>')
}))
