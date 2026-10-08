import { SWORD_RUSTY_ID } from '../../ids'
import { stats } from './stats'
import { svgIcon, type ItemDef } from '../../../types'
import { TETANUS_SLOW } from './statuses'

const def: ItemDef = {
  ...stats,
  id: SWORD_RUSTY_ID,
  kind: 'weapon',
  color: '#847664',
  hi: '#b8b2a4',
  text: '#c79a78',
  icon: svgIcon(`<svg viewBox="0 0 48 48"><g transform="rotate(35 24 24)" stroke="#302821" stroke-width="1.5" stroke-linejoin="round"><path d="M24 8 28 15 27 19 29 21 27 24 28 30 20 30 19 15Z" fill="#8a8170"/><path d="M24 9 24 29 21 29 20 16Z" fill="#b8b2a4" stroke="none"/><path d="m25 16 2 2-1 5-2-1Zm-4 8 3 2-1 3-3-1Z" fill="#96522e" stroke="none"/><path d="M16 29 32 29 32 33 16 33Z" fill="#716048"/><path d="M22 33h4v9h-4Z" fill="#654630"/><path d="m22 35 4 1m-4 2 4 1" stroke="#a1845b"/><path d="M21 42h6v3h-6Z" fill="#847664"/></g></svg>`),
  weapon: { criticalPassive: { multiplier: 2.5, effects: [TETANUS_SLOW], nameKey: 'skill.tetanus.name', descriptionKey: 'skill.tetanus.desc' }, combo: true, legacyHeld: true, drawHeld(ctx) {
    ctx.save(); ctx.strokeStyle = '#2a201f'; ctx.lineWidth = 1.1
    ctx.fillStyle = '#704f3a'; ctx.fillRect(-5, -1.7, 8, 3.4); ctx.strokeRect(-5, -1.7, 8, 3.4)
    ctx.fillStyle = '#78604a'; ctx.fillRect(2, -5, 2, 10); ctx.strokeRect(2, -5, 2, 10)
    ctx.beginPath(); ctx.moveTo(4,-2.3); ctx.lineTo(17,-1.5); ctx.lineTo(21,0); ctx.lineTo(17,1.5); ctx.lineTo(14,.6); ctx.lineTo(13,2); ctx.lineTo(4,2.3); ctx.closePath(); ctx.fillStyle='#938a86'; ctx.fill(); ctx.stroke()
    ctx.fillStyle='#905739'; ctx.fillRect(7,-1.5,4,1.6); ctx.fillRect(15,-.8,2,1)
    ctx.strokeStyle='#c1b39c'; ctx.lineWidth=.8; ctx.beginPath(); ctx.moveTo(4,-2); ctx.lineTo(17,-1.2); ctx.stroke(); ctx.restore()
  } }, tags: ['weapon', 'sword']
}
export default def
