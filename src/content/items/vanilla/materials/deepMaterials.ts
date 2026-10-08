import type { ItemDef } from '../../types'
import { COAL_ID, ROCK_SALT_ID, FLAX_ID, BAT_WING_ID, CRYSTAL_CORE_ID } from '../ids'
import { supplyIcon } from './supplyAppearance'
import { coalIconShape, crystalCoreIconShape, batWingIconShape, drawCoalGround, drawCrystalCoreGround, drawBatWingGround } from './deepMaterialAppearance'

const shapes = [
  coalIconShape,
  '<path d="M8 30L12 18L23 13L31 17L40 14L43 32L31 40L14 39Z" fill="#c8c3b4"/><path d="M12 18L22 26L23 13M22 26L31 17L43 32L31 40Z" fill="#e4dfcf"/><path d="M14 27L20 32L16 37M27 21L33 25L36 19" fill="none" stroke="#f6f1df" stroke-width="2"/><path d="M8 30L14 39L31 40L26 33Z" fill="#9d9e99"/>',
  '<path d="M18 42L23 13M25 42L30 10M21 42L15 20" stroke="#7f915b" stroke-width="2"/><path d="M22 27L12 23L18 34M28 24L38 18L29 32M25 17L17 13L24 23" fill="#6d865a"/><path d="M18 39L29 38L30 42L17 44Z" fill="#b49b70"/><g fill="#9ab4d2" stroke="#566e94" stroke-width=".9"><path d="M21 7L25 10L24 14L20 14L18 10Z"/><path d="M30 5L34 8L33 12L29 13L26 9Z"/><path d="M12 15L16 17L16 21L12 22L9 18Z"/></g>',
  batWingIconShape,
  crystalCoreIconShape
]
const resources = [
  [COAL_ID, '#383e43'], [ROCK_SALT_ID, '#d7d0bc'], [FLAX_ID, '#8f9c6d'],
  [BAT_WING_ID, '#8b6b87'], [CRYSTAL_CORE_ID, '#e7e7e3']
] as const

/** 深层素材沿用手绘物资图标，落地形状分别保留晶块、茎束和翼膜特征。 */
export const deepMaterials: ItemDef[] = resources.map(([id, color], index) => ({
  id, kind: 'material', tier: 1, maxStack: 9999, color, hi: index===4?'#f4f3ed':index===0?'#9ea6ab':'#d5c6a4', text: index===4?'#ece7dd':'#d3c6ae',
  icon: supplyIcon(shapes[index]!), tags: ['deep_cave_supply'],
  ground: index===0?drawCoalGround:index===3?drawBatWingGround:index===4?drawCrystalCoreGround:({ ctx, x, y }) => {
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#302b38'; ctx.lineWidth = 1.2; ctx.fillStyle = color
    ctx.beginPath()
    if (index === 2) { ctx.moveTo(-5, 4); ctx.lineTo(1, -7); ctx.lineTo(5, -5); ctx.lineTo(0, 5) }
    else { ctx.moveTo(-7, 1); ctx.lineTo(-3, -6); ctx.lineTo(4, -5); ctx.lineTo(8, 1); ctx.lineTo(3, 6); ctx.lineTo(-5, 5) }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.strokeStyle = index === 0 ? '#98919b' : '#e0d8ba'
    ctx.beginPath(); ctx.moveTo(-3, -3); ctx.lineTo(1, -1); ctx.lineTo(4, -3); ctx.stroke(); ctx.restore()
  }
}))
