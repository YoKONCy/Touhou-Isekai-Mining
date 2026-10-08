import { svgIcon } from '../../../types'
import { STAFF_LENGTH_SCALE } from './appearance'

export const WOOD_STAFF_ICON = svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="staff-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#e0bd8b"/><stop offset=".3" stop-color="#ae804b"/><stop offset=".65" stop-color="#805331"/><stop offset="1" stop-color="#4a3425"/></linearGradient></defs>
  <g transform="translate(14 50) rotate(-45) scale(${STAFF_LENGTH_SCALE} 1)">
    <path d="M-5-3 60-3.5 64-2 64 2 60 3.5-5 3Z" fill="url(#staff-wood)" stroke="#32251d" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M0-1.8 19-1.5M36-2 59-2M40 .6Q46-.8 55 1" fill="none" stroke="#e8cd9e" stroke-width=".7"/>
    <path d="M39 1Q49 2.9 57 .8" fill="none" stroke="#513728" stroke-width=".8"/>
    <ellipse cx="49" cy=".3" rx="3.4" ry="1" fill="none" stroke="#6b462e" stroke-width=".7"/>
    <path d="M-2-3.4H2V3.4H-2ZM57-3.8H61V3.8H57Z" fill="#575a4c" stroke="#343a30" stroke-width=".8"/>
    <path d="M-1.4-2.6H1.4M57.7-2.8H60.3" stroke="#b9b294" stroke-width="1"/>
    <path d="M21-3.7H35V3.7H21Z" fill="#68513c" stroke="#3e3025" stroke-width="1"/>
    <path d="m22-3 2 6m1-6 2 6m1-6 2 6m1-6 2 6m1-6 2 6" stroke="#bfa37a" stroke-width="1"/>
    <path d="M21-2.8H35" stroke="#dcc69a" stroke-width=".6"/>
    <path d="m63-1.7 0 3.4m-67-3 0 2.6" stroke="#c2a078" stroke-width=".8"/>
  </g>
</svg>`)
