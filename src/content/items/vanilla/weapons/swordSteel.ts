import { svgIcon, type ItemDef } from '../../types'
import { SWORD_STEEL_ID } from '../ids'
import ironSword from './swordIron'

/** 沿用铁剑招式，独立绘制灰黑钢材，握持与物品栏保持相同色阶。 */
const steelSword: ItemDef = {
  ...ironSword,
  id: SWORD_STEEL_ID,
  grade: 1,
  combat: { ...ironSword.combat, penetration: 1, critChance: .06 },
  melee: { ...ironSword.melee!, damage: 26 },
  weapon: { ...ironSword.weapon, drawHeld: drawSteelSword },
  color: '#626970', hi: '#bfc6c8', text: '#c6c9ca',
  tags: [...(ironSword.tags ?? []), 'steel'],
  icon: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g transform="rotate(35 24 24)" stroke="#25232b" stroke-width="1.4" stroke-linejoin="round"><path d="M24 1 28 8 27 33 21 33 20 8Z" fill="#7c858b"/><path d="M24 2 27 8 26 32 24 32Z" fill="#4b535c" stroke="none"/><path d="M22 9v21" stroke="#c1c7c8" stroke-width="1"/><path d="M24 9v22" stroke="#373e47" stroke-width=".8"/><path d="m15 32 18 0 1 4-7-1h-6l-7 1Z" fill="#606870"/><path d="M16 33h16" stroke="#9ca4aa"/><path d="M22 35h4v8h-4Z" fill="#393031"/><path d="m22 36 4 1m-4 2 4 1m-4 2 4 1" stroke="#8d7963" stroke-width="1"/><path d="M21 43h6v3h-6Z" fill="#4c535a"/></g></svg>')
}

/** 暗灰剑面配窄刃口高光，保留直剑轮廓与原握点。 */
function drawSteelSword(g: CanvasRenderingContext2D): void {
  g.save(); g.strokeStyle = '#25232b'; g.lineWidth = 1.1
  g.fillStyle = '#4c535a'; g.fillRect(-7, -2, 3, 4); g.strokeRect(-7, -2, 3, 4)
  g.fillStyle = '#393031'; g.fillRect(-4, -1.8, 7, 3.6); g.strokeRect(-4, -1.8, 7, 3.6)
  g.strokeStyle = '#8d7963'; g.beginPath(); g.moveTo(-3, -1.5); g.lineTo(-2, 1.5); g.moveTo(-1, -1.5); g.lineTo(0, 1.5); g.stroke()
  g.fillStyle = '#606870'; g.strokeStyle = '#25232b'; g.fillRect(2, -6, 2.8, 12); g.strokeRect(2, -6, 2.8, 12)
  g.beginPath(); g.moveTo(5, -2.6); g.lineTo(32, -1.8); g.lineTo(40, 0); g.lineTo(32, 1.8); g.lineTo(5, 2.6); g.closePath(); g.fillStyle = '#7c858b'; g.fill(); g.stroke()
  g.beginPath(); g.moveTo(5, 0); g.lineTo(40, 0); g.lineTo(32, 1.8); g.lineTo(5, 2.6); g.closePath(); g.fillStyle = '#4b535c'; g.fill()
  g.strokeStyle = '#c1c7c8'; g.lineWidth = .8; g.beginPath(); g.moveTo(6, -2); g.lineTo(32, -1.3); g.lineTo(38, 0); g.stroke()
  g.strokeStyle = '#373e47'; g.beginPath(); g.moveTo(8, 0); g.lineTo(31, 0); g.stroke()
  g.restore()
}

export default steelSword
