import { ROCK_STONE_ID } from '../ids'
import { svgIcon, type ItemDef } from '../../types'

// 宽厚碎岩：大切面承托体积，裂隙沿斜面延伸。
const ICON = svgIcon(`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <path d="M7 24L13 13L25 9L36 15L41 28L34 37L19 40L8 33Z" fill="#85858b"/>
  <path d="M13 13L25 9L36 15L27 22L16 23L7 24Z" fill="#b1afa9"/>
  <path d="M27 22L36 15L41 28L34 37L26 33Z" fill="#686773"/>
  <path d="M8 33L16 28L26 33L34 37L19 40Z" fill="#75747e"/>
  <path d="M13 15L24 12L29 15" fill="none" stroke="#d1c9b8" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M18 22L22 27L20 32M22 27L28 28M32 23L34 27" fill="none" stroke="#55515e" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 29L14 27L16 29L13 31Z" fill="#95939a"/>
  <path d="M7 24L13 13L25 9L36 15L41 28L34 37L19 40L8 33Z" fill="none" stroke="#302b38" stroke-width="1.6" stroke-linejoin="round"/>
</svg>`)

const def: ItemDef = {
  id: ROCK_STONE_ID,
  kind: 'material',
  tier: 1,
  color: '#7d838c',
  hi: '#aeb4bc',
  text: '#b8bec6',
  maxStack: 999,
  icon: ICON,
  tags: ['material', 'stone']
}

export default def
