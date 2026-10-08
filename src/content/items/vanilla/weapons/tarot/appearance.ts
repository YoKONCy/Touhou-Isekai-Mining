import { svgIcon } from '../../../types'

/** 所有弹幕只显示牌背；乳白纸边、紫绒背面和月纹使用克制的赛璐璐色阶。 */
export function drawTarotBack(g: CanvasRenderingContext2D): void {
  g.save(); g.lineJoin = 'miter'
  g.fillStyle = '#241e32'; g.fillRect(-8.5, -12.5, 17, 25)
  g.fillStyle = '#eee1c7'; g.fillRect(-7.5, -11.5, 15, 23)
  g.fillStyle = '#57436d'; g.fillRect(-6, -10, 12, 20)
  g.fillStyle = '#79618e'; g.fillRect(-5.5, -9.5, 11, 7)
  g.fillStyle = '#423452'; g.fillRect(-5.5, 3, 11, 6.5)
  g.strokeStyle = '#c5a674'; g.lineWidth = .55; g.strokeRect(-5, -9, 10, 18)
  g.fillStyle = '#e8cc91'; g.beginPath(); g.arc(0, 0, 3.6, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#665079'; g.beginPath(); g.arc(1.5, -1, 3.1, 0, Math.PI * 2); g.fill()
  for (const y of [-6.5, 6.5]) {
    g.fillStyle = '#dcc08b'; g.beginPath(); g.moveTo(0, y - 1.3); g.lineTo(1, y); g.lineTo(0, y + 1.3); g.lineTo(-1, y); g.closePath(); g.fill()
  }
  g.fillStyle = '#b39abc44'; g.fillRect(-3.5, -8, .5, 1); g.fillRect(3, 7, .5, 1)
  g.fillStyle = '#fff4db'; g.fillRect(-7, -11, 1, 9); g.restore()
}
export const tarotIcon = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="rotate(-12 32 32)"><path d="M13 10H45V55H13Z" fill="#bdafd0" stroke="#342a44" stroke-width="1.6"/></g><path d="M20 6H52V52H20Z" fill="#ede0c7" stroke="#302638" stroke-width="1.5"/><path d="M23 9H49V49H23Z" fill="#58436f"/><path d="M24 10H48V25H24Z" fill="#78608d"/><path d="M24 36H48V48H24Z" fill="#403350"/><path d="M26 12H46V46H26Z" fill="none" stroke="#c6a874" stroke-width="1"/><circle cx="36" cy="29" r="7" fill="#edcf95"/><circle cx="39" cy="27" r="6" fill="#69527e"/><path d="M36 15L38 18L36 21L34 18ZM36 38L38 41L36 44L34 41Z" fill="#dfbd85"/><path d="M21 7H50M21 7V46" fill="none" stroke="#fff4dc" stroke-width="1"/><path d="M28 14H29V16H28ZM43 42H44V44H43Z" fill="#b995bc" opacity=".5"/></svg>')
