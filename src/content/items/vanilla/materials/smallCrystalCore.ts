import type { ItemDef } from '../../types'
import { SMALL_CRYSTAL_CORE_ID } from '../ids'
import { supplyIcon } from './supplyAppearance'

/** 护卫胶体内凝成的小型晶核，独立物品而非晶核的显示缩放。 */
const def: ItemDef = {
  id: SMALL_CRYSTAL_CORE_ID, kind: 'material', tier: 1, maxStack: 9999,
  color: '#bdcfc4', hi: '#eceddb', text: '#d6e0d1', tags: ['deep_cave_supply', 'crystal', 'guardian'],
  icon: supplyIcon('<path d="M18 13L28 10L35 21L30 34L20 38L13 26Z" fill="#bdcfc4"/><path d="M18 13L24 24L13 26Z" fill="#eef0dc" stroke="none"/><path d="M18 13L28 10L24 24Z" fill="#dbe4d4" stroke="none"/><path d="M28 10L35 21L24 24Z" fill="#cadbce" stroke="none"/><path d="M24 24L35 21L30 34L20 38Z" fill="#819f9f" stroke="none"/><path d="M13 26L24 24L20 38Z" fill="#a7bcb2" stroke="none"/><path d="M18 14L24 24L29 12M24 24L20 36M24 24L33 22" fill="none" stroke="#f5efda" stroke-width=".8"/><path d="M28 27L30 24M17 23L18 19" stroke="#eef5e7" stroke-width="1.2"/>'),
  ground: ({ ctx: g, x, y }) => {
    g.save(); g.translate(x, y); g.lineJoin = 'round'; g.strokeStyle = '#3d4650'; g.lineWidth = .75
    for (const [shape, color] of [['M-3-6L2-7L5-1L-1 0Z', '#e0e8d8'], ['M-3-6L-1 0L-3 6L-6 1Z', '#b0c4b8'], ['M-1 0L5-1L3 5L-3 6Z', '#86a5a1']]) {
      const p = new Path2D(shape); g.fillStyle = color; g.fill(p); g.stroke(p)
    }
    g.strokeStyle = '#f6f1df'; g.lineWidth = .6; g.beginPath(); g.moveTo(-3, -5); g.lineTo(-1, 0); g.lineTo(-3, 5); g.stroke(); g.restore()
  }
}
export default def
