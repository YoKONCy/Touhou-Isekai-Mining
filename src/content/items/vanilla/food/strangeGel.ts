import { svgIcon, type ItemDef } from '../../types'
import { STRANGE_GEL_ID } from '../ids'
import { NAUSEA } from '../../../statuses/nausea'

/** 湿润半透明的软胶，边缘塌落，内部留有颜色游移的细纹。 */
const strangeGel: ItemDef = {
  id: STRANGE_GEL_ID, kind: 'consumable', material: true, tier: 2, maxStack: 9999,
  color: '#939e86', hi: '#dfdbc2', text: '#c4c9ad', tags: ['food', 'slime'],
  consume: { heal: 20, status: NAUSEA },
  icon: svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><radialGradient id="gel-body" cx=".32" cy=".25" r=".85"><stop stop-color="#d9dcc4"/><stop offset=".5" stop-color="#9da990"/><stop offset="1" stop-color="#637b76"/></radialGradient></defs><ellipse cx="24" cy="39" rx="19" ry="4" fill="#302b32" opacity=".3"/><path d="M5 33Q5 25 12 24Q10 9 23 8Q33 7 35 23Q44 23 44 33Q45 42 32 41Q28 44 23 40Q11 44 5 37Z" fill="url(#gel-body)" stroke="#414a4a" stroke-width="1.5"/><path d="M12 25Q17 30 24 22Q31 15 33 27Q35 33 40 32" fill="none" stroke="#809aa8" stroke-width="2" opacity=".65"/><path d="M9 34Q16 29 21 33Q30 39 36 32" fill="none" stroke="#b3a085" stroke-width="2" opacity=".7"/><path d="M17 15Q20 10 25 12M8 29L8 32M14 37Q20 39 23 36" fill="none" stroke="#f1ecd6" stroke-linecap="round" stroke-width="2"/><ellipse cx="27" cy="26" rx="2" ry="3" fill="#dae0c2" opacity=".65"/><circle cx="20" cy="30" r="1.2" fill="#ebead2" opacity=".6"/></svg>'),
  ground: ({ ctx, x, y }) => {
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'
    ctx.fillStyle = '#929f88'; ctx.strokeStyle = '#414a4a'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(-10, 3); ctx.quadraticCurveTo(-11, -2, -6, -3); ctx.bezierCurveTo(-7, -13, 5, -15, 6, -3); ctx.quadraticCurveTo(13, -3, 11, 5); ctx.quadraticCurveTo(5, 9, 0, 6); ctx.quadraticCurveTo(-10, 10, -10, 3); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#809da6'; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, 3, 3, -2); ctx.quadraticCurveTo(5, 1, 8, 2); ctx.stroke()
    ctx.strokeStyle = '#edebd1'; ctx.beginPath(); ctx.moveTo(-3, -8); ctx.quadraticCurveTo(-1, -11, 2, -9); ctx.stroke()
    ctx.fillStyle = '#d7dbc1'; ctx.beginPath(); ctx.ellipse(1, 2, 1, 1.5, .4, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
}
export default strangeGel
