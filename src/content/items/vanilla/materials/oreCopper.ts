import { ORE_COPPER_ID } from '../ids'
import { MINERAL_COPPER_ID } from '../../../minerals/vanilla/ids'
import { svgIcon, type ItemDef } from '../../types'

// 圆钝母岩中嵌入铜斑，亮边仅落在上侧矿面。
const ICON = svgIcon(`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M8 19L15 9L26 7L36 13L41 24L37 35L26 41L14 37L7 29Z" fill="#897869"/>
  <path d="M8 19L15 9L26 7L36 13L26 20L16 22Z" fill="#ab9780"/>
  <path d="M26 20L36 13L41 24L37 35L26 41L25 30Z" fill="#695b57"/>
  <path d="M7 29L16 27L25 30L26 41L14 37Z" fill="#79675e"/>
  <path d="M26 12L32 11L36 15L33 21L27 20L24 16Z" fill="#bb7c50"/>
  <path d="M26 13L31 12L34 15L30 17L26 16Z" fill="#dfa675"/>
  <path d="M11 25L16 22L21 25L18 30L12 29Z" fill="#b57b53"/>
  <path d="M12 25L16 24L19 25" fill="none" stroke="#dfb080" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M29 31L34 28L36 31L32 35L28 34Z" fill="#a26c49"/>
  <path d="M19 17L21 22L19 26M21 22L25 24" fill="none" stroke="#554652" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M13 16L17 12L23 10" fill="none" stroke="#c8b69a" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M8 19L15 9L26 7L36 13L41 24L37 35L26 41L14 37L7 29Z" fill="none" stroke="#302b38" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`)

const def: ItemDef = {
  id: ORE_COPPER_ID,
  kind: 'material',
  tier: 1,
  color: '#c0703f',
  hi: '#f0a86c',
  text: '#ffb27a',
  maxStack: 999,
  icon: ICON,
  mineral: MINERAL_COPPER_ID,
  tags: ['material', 'metal', 'ore']
}

export default def
