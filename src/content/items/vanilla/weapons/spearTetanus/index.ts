import type { ItemDef } from '../../../types'
import { svgIcon } from '../../../types'
import { SPEAR_TETANUS_ID } from '../../ids'
import stoneSpear from '../spearStone'
import { drawStoneSpear } from '../spearStone/appearance'
import { TETANUS_SLOW } from '../swordRusty/statuses'

/** 沿用石矛的杆身、握点与突刺动作，石尖换成胶粘绑牢的生锈短刃。 */
function drawTetanusSpear(g: CanvasRenderingContext2D): void {
  g.save(); g.beginPath(); g.rect(-32, -10, 76, 20); g.clip(); drawStoneSpear(g); g.restore()
  g.save(); g.lineJoin = 'bevel'; g.strokeStyle = '#352a2b'; g.lineWidth = .8
  g.fillStyle = '#777576'; g.beginPath(); g.moveTo(43, -3); g.lineTo(55, -2.5); g.lineTo(61, -4); g.lineTo(67, 0); g.lineTo(60, 3); g.lineTo(56, 2); g.lineTo(53, 3.4); g.lineTo(43, 3); g.closePath(); g.fill(); g.stroke()
  g.fillStyle = '#b6aa98'; g.beginPath(); g.moveTo(44, -2.7); g.lineTo(56, -2); g.lineTo(61, -3.1); g.lineTo(65, -.5); g.lineTo(46, -.7); g.closePath(); g.fill()
  g.fillStyle = '#965a3c'; g.fillRect(49, -.3, 4, 2); g.fillRect(58, -.6, 3, 1.4)
  g.fillStyle = '#809484'; g.fillRect(42, -3.1, 4, 6.2)
  g.strokeStyle = '#c2a880'; g.lineWidth = .85
  for (let x = 40; x < 47; x += 1.5) { g.beginPath(); g.moveTo(x, -3.3); g.lineTo(x + 1, 3.3); g.stroke() }
  g.restore()
}

export default {
  ...stoneSpear, id: SPEAR_TETANUS_ID, color: '#94745b', hi: '#c4b59e', text: '#c5a17d',
  combat: { ...stoneSpear.combat, critChance: .18 },
  melee: { ...stoneSpear.melee!, damage: 19, windup: stoneSpear.melee!.windup + .02, recover: stoneSpear.melee!.recover + .02 },
  icon: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(13 51) rotate(-45)" stroke="#352a2b" stroke-linejoin="bevel"><path d="M-3-2H37V2H-3Z" fill="#8d6746" stroke-width="1.2"/><path d="M0-1H30" stroke="#c3a57e" stroke-width=".7"/><path d="M13-2.5H24V2.5H13Z" fill="#554031"/><path d="M14-2L16 2M18-2L20 2M22-2L24 2" stroke="#baa076" stroke-width="1"/><path d="M34-4L43-3L48-5L56 0L48 4L45 2L41 4L34 3Z" fill="#8b8176" stroke-width="1.2"/><path d="M35-3L43-2L48-4L53-1L36 0Z" fill="#c2b8a2" stroke="none"/><path d="M41 0L45 1L44 3L40 2M48-1L51 0L50 2L47 1" fill="#965a3c" stroke="none"/><path d="M31-3.5H35V3.5H31Z" fill="#809484"/><path d="M30-3L32 3M33-3L35 3M36-3L38 3" stroke="#c4ac84" stroke-width="1.3"/></g></svg>'),
  weapon: { ...stoneSpear.weapon, drawHeld: drawTetanusSpear, criticalPassive: { multiplier: 2.5, effects: [TETANUS_SLOW], nameKey: 'skill.tetanus.name', descriptionKey: 'skill.tetanus.desc' } },
  ground: ({ ctx, x, y }) => { ctx.save(); ctx.translate(x, y); ctx.rotate(-.45); ctx.scale(.55, .55); ctx.translate(-21, 0); drawTetanusSpear(ctx); ctx.restore() },
  tags: ['weapon', 'spear', 'rust', 'crafting']
} satisfies ItemDef
