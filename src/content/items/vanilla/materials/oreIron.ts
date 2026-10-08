import { ORE_IRON_ID } from '../ids'
import { MINERAL_IRON_ID } from '../../../minerals/vanilla/ids'
import { svgIcon, type ItemDef } from '../../types'

// 扁斜岩片的银灰矿脉与母岩分面，避免整片纯白反光。
const ICON = svgIcon(`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M6 25L14 12L27 8L39 18L42 29L32 38L17 40L7 34Z" fill="#818997"/>
  <path d="M6 25L14 12L27 8L39 18L27 23L15 26Z" fill="#a0a6ae"/>
  <path d="M27 23L39 18L42 29L32 38L27 32Z" fill="#606775"/>
  <path d="M7 34L15 26L27 32L32 38L17 40Z" fill="#737988"/>
  <path d="M13 20L17 15L23 14L26 17L32 16L34 19L26 22L22 20L18 22L16 29L13 30L14 24Z" fill="#bec6c8"/>
  <path d="M17 17L23 16L26 19L31 18" fill="none" stroke="#e1e1d4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 25L15 28" stroke="#d5d7ce" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M26 26L23 29L25 34M23 29L19 30" fill="none" stroke="#4d4c5b" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M30 30L34 27L36 30L32 33Z" fill="#959da7"/>
  <path d="M6 25L14 12L27 8L39 18L42 29L32 38L17 40L7 34Z" fill="none" stroke="#302b38" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`)

const def: ItemDef = {
  id: ORE_IRON_ID,
  kind: 'material',
  tier: 2,
  color: '#8993a2',
  hi: '#c2cbd8',
  text: '#cfd6e0',
  maxStack: 999,
  icon: ICON,
  mineral: MINERAL_IRON_ID,
  tags: ['material', 'metal', 'ore']
}

export default def
