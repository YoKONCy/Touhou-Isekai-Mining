import { ORE_GOLD_ID } from '../ids'
import { MINERAL_GOLD_ID } from '../../../minerals/vanilla/ids'
import { svgIcon, type ItemDef } from '../../types'

// 双峰深色母岩露出暖金矿脉，以嵌矿面积而非整块金属区分金矿。
const ICON = svgIcon(`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 23L14 15L22 16L27 8L36 10L42 22L39 34L29 40L16 38L7 31Z" fill="#847b70"/>
  <path d="M7 23L14 15L22 16L27 8L36 10L33 21L23 26L15 24Z" fill="#a39984"/>
  <path d="M33 21L36 10L42 22L39 34L29 40L27 29Z" fill="#615b60"/>
  <path d="M7 31L15 24L23 26L27 29L29 40L16 38Z" fill="#75685f"/>
  <path d="M28 12L34 13L36 19L31 23L29 29L24 31L21 28L25 24L27 20Z" fill="#bd9651"/>
  <path d="M29 14L32 14L33 19L29 22L27 27L24 28L26 23L29 19Z" fill="#e2c581"/>
  <path d="M30 14L32 15L32 18" fill="none" stroke="#efe0b0" stroke-width="1.3" stroke-linecap="round"/>
  <path d="M12 23L16 20L20 22L18 27L13 28Z" fill="#c3a05b"/>
  <path d="M13 23L16 22L18 23" fill="none" stroke="#e3c98e" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M32 31L35 29L36 32L33 34Z" fill="#aa8648"/>
  <path d="M18 30L21 33L20 36M23 18L24 21" fill="none" stroke="#514550" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M7 23L14 15L22 16L27 8L36 10L42 22L39 34L29 40L16 38L7 31Z" fill="none" stroke="#302b38" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`)

const def: ItemDef = {
  id: ORE_GOLD_ID,
  kind: 'material',
  tier: 3,
  color: '#d9aa3c',
  hi: '#ffe98f',
  text: '#ffe27a',
  maxStack: 999,
  icon: ICON,
  mineral: MINERAL_GOLD_ID,
  tags: ['material', 'metal', 'ore']
}

export default def
