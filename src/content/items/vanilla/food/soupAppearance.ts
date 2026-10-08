import type { GroundRenderer } from '../../types'
import { supplyIcon } from '../materials/supplyAppearance'

/** 保持陶碗与食材的共同画风，用釉色、细纹和汤色区分两种料理。 */
const plainPalette = { light: '#b39372', body: '#94715d', dark: '#705348', rim: '#d3bd94', broth: '#ad914f' }
const saltedPalette = { light: '#b8ae8c', body: '#93876c', dark: '#6b624f', rim: '#d9caaa', broth: '#bc8c50' }
export function soupIcon(salted = false) {
  const palette = salted ? saltedPalette : plainPalette
  const gradientId = salted ? 'soup-ceramic-salted' : 'soup-ceramic-plain'
  return supplyIcon(`<defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${palette.light}"/><stop offset=".45" stop-color="${palette.body}"/><stop offset="1" stop-color="${palette.dark}"/></linearGradient></defs>
    <ellipse cx="24" cy="43" rx="15" ry="2" fill="#211e2a" opacity=".3" stroke="none"/>
    <path d="M6 24Q8 41 24 42Q40 41 42 24" fill="url(#${gradientId})"/>
    <path d="M10 29Q13 37 20 38" fill="none" stroke="#c8ab84" stroke-width="2"/>
    <path d="M29 37Q35 35 37 31" fill="none" stroke="#6c5146" stroke-width="1" opacity=".55"/>
    ${salted ? '<path d="M11 32Q24 41 37 32" fill="none" stroke="#d8c9a6" stroke-width="1.7" opacity=".85"/><path d="M22 34L24 32L26 34L24 36Z" fill="#ded3b7" stroke="#766c56" stroke-width=".6"/>' : ''}
    <ellipse cx="24" cy="24" rx="18" ry="8" fill="${palette.rim}"/>
    <ellipse cx="24" cy="24" rx="14" ry="5" fill="${palette.broth}" stroke="#8e774e" stroke-width="1"/>
    <path d="M12 24Q18 28 25 27" fill="none" stroke="#d0b473" stroke-width=".8" opacity=".6"/>
    <path d="M14 23Q15 18 20 21L22 25L17 27ZM28 26Q28 20 33 23L35 26L31 28Z" fill="#e0cbab" stroke="#8d7856" stroke-width=".8"/>
    <path d="M16 22L19 24M30 24L32 26" fill="none" stroke="#ac9775" stroke-width=".6"/>
    <path d="M23 23L27 21M12 26L16 27M35 23L38 22" fill="none" stroke="#738255" stroke-width="1.5"/>
    ${salted ? '<g fill="#ece8d9" stroke="none"><path d="M23 25L24 24L25 25L24 26Z"/><circle cx="31" cy="23" r=".65"/><circle cx="18" cy="24" r=".65"/></g>' : ''}
    <path d="M17 14Q13 10 17 6M25 13Q29 9 25 4M33 15Q37 11 34 8" fill="none" stroke="#cabf9e" stroke-width="1.2" opacity=".65"/>`)
}

export function soupGround(salted = false): GroundRenderer {
  const palette = salted ? saltedPalette : plainPalette
  return ({ ctx, x, y }) => {
    ctx.save(); ctx.translate(x, y)
    ctx.fillStyle = '#201d29'; ctx.globalAlpha *= .25
    ctx.beginPath(); ctx.ellipse(0, 4, 9, 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.restore(); ctx.save(); ctx.translate(x, y)
    ctx.fillStyle = palette.body; ctx.strokeStyle = '#302b38'; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(-8, -2); ctx.quadraticCurveTo(-7, 6, 0, 6); ctx.quadraticCurveTo(7, 6, 8, -2); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.strokeStyle = '#c8ab84'; ctx.lineWidth = .8
    ctx.beginPath(); ctx.moveTo(-6, 1); ctx.quadraticCurveTo(-5, 4, -2, 4); ctx.stroke()
    if (salted) {
      ctx.strokeStyle = '#d8c9a6'; ctx.lineWidth = .8
      ctx.beginPath(); ctx.moveTo(-5, 2); ctx.quadraticCurveTo(0, 7, 5, 2); ctx.stroke()
      ctx.fillStyle = '#ded3b7'; ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(1, 2); ctx.lineTo(0, 3); ctx.lineTo(-1, 2); ctx.closePath(); ctx.fill()
    }
    ctx.fillStyle = palette.rim; ctx.strokeStyle = '#302b38'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.ellipse(0, -2, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.fillStyle = palette.broth; ctx.beginPath(); ctx.ellipse(0, -2, 6, 2, 0, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#e0cbab'; ctx.fillRect(-3, -3, 2, 2); ctx.fillRect(2, -2, 2, 1)
    ctx.strokeStyle = '#738255'; ctx.lineWidth = .8
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-4, -1); ctx.moveTo(0, -3); ctx.lineTo(1, -3.5); ctx.stroke()
    if (salted) {
      ctx.fillStyle = '#ece8d9'
      for (const [dx, dy] of [[-1, -1], [3, -3], [-4, -2]]) { ctx.beginPath(); ctx.arc(dx, dy, .45, 0, Math.PI * 2); ctx.fill() }
    }
    ctx.strokeStyle = '#cabf9e80'; ctx.lineWidth = .6
    ctx.beginPath(); ctx.moveTo(-3, -6); ctx.quadraticCurveTo(-5, -8, -3, -10); ctx.moveTo(3, -6); ctx.quadraticCurveTo(5, -8, 3, -11); ctx.stroke()
    ctx.restore()
  }
}
