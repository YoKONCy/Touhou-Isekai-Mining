import { svgIcon } from '../../../types'
import { SPEAR_LENGTH_SCALE } from './appearance'

/** 图标与手持矛共享石片分面、深色握带和粗麻绳的造型。 */
export const STONE_SPEAR_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="spear-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#c0a17a"/><stop offset=".4" stop-color="#8d6746"/><stop offset="1" stop-color="#50392c"/></linearGradient></defs>
  <g transform="translate(15 49) rotate(-45) scale(${SPEAR_LENGTH_SCALE} 1)" stroke-linejoin="bevel">
    <path d="M-3-2 45-2.4 46 2.4-3 2Z" fill="url(#spear-wood)" stroke="#29221e" stroke-width="1.4"/>
    <path d="M0-1 16-1M28-1 39-1" stroke="#dbc399" stroke-width=".7"/>
    <path d="M17-2.6H29V2.6H17Z" fill="#554031"/>
    <path d="m18-2 1.5 4m2-4 1.5 4m2-4 1.5 4m2-4 1.5 4" stroke="#b29b76" stroke-width="1"/>
    <path d="M42-5 47-7 51-5 54-5.4 65 0 57 3.4 55 3 49 6.7 44 4 40 1Z" fill="#858a7e" stroke="#293029" stroke-width="1.4"/>
    <path d="M43-4.6 47-6.1 53-4.4 63-.5 47-.7 41 1Z" fill="#c1c0a7"/>
    <path d="M47-.7 65 0 49 6.7 51 1.7Z" fill="#4d5a51"/>
    <path d="M46 1 49-2 52 1.5 47 4Z" fill="#a0a396"/>
    <path d="m46-5 2 1m6 .4 7 3m-14-.6-3 3" fill="none" stroke="#e0ddc1" stroke-width=".8"/>
    <path d="m38-3 1.5 6m1-6 1.5 6m1-6 1.5 6m-6-5 8 4m-8 1 7-5" fill="none" stroke="#49392c" stroke-width="2.2"/>
    <path d="m38-3 1.5 6m1-6 1.5 6m1-6 1.5 6m-6-5 8 4m-8 1 7-5" fill="none" stroke="#c4aa7c" stroke-width="1"/>
    <path d="m-1-2 1 4m1-4 1 4" stroke="#b8a17b" stroke-width="1"/>
  </g>
</svg>`)
