import { svgIcon, type HeldWeaponView, type GroundRenderer, type WeaponMotionView } from '../../../types'
import { katanaBladeReveal, katanaReadyPose, katanaSheathing } from './motion'
import { quantizeDir4 } from '../../../../../game/art/rig/skeleton'

const INK = '#362f42'
export const KATANA_FORGED_ICON = svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><g stroke="#282332" stroke-linejoin="miter"><path d="M12 37L8 42L5 40L10 34Z" fill="#35424b" stroke-width="1.2"/><path d="M10 35L16 27L19 30L13 38Z" fill="#344b55" stroke-width="1.2"/><path d="M11 35L15 35L13 32L17 32L15 29" fill="none" stroke="#cfbf96" stroke-width="1.2"/><path d="M18 27Q28 12 40 4L44 8Q32 23 22 31Z" fill="#353f4d" stroke-width="1.3"/><path d="M19 27Q29 14 41 6L42 8Q31 19 20 29Z" fill="#566477" stroke="none"/><path d="M22 29Q34 17 43 8" fill="none" stroke="#202a38" stroke-width="1.1"/><path d="M18 27L22 31L24 29L20 25Z" fill="#b39b62" stroke-width=".8"/><path d="M39 5L43 9L45 7L41 3Z" fill="#b39b62" stroke-width=".8"/><path d="M22 22L27 25M24 20L29 23" fill="none" stroke="#91a2a9" stroke-width="1.2"/><path d="M13 27L21 33L23 30L15 24Z" fill="#b39b62" stroke-width="1"/><path d="M15 25L21 30M19 26Q30 12 40 5" fill="none" stroke="#c9bb96" stroke-width=".6"/></g></svg>')

export function drawForgedKatana(ctx: CanvasRenderingContext2D, view: HeldWeaponView = {}): void {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'
  ctx.strokeStyle = INK; ctx.lineWidth = 1.05
  ctx.fillStyle = '#394a59'; ctx.beginPath(); ctx.roundRect(-8, -1.8, 11, 3.6, 1); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = '#d2c198'; ctx.lineWidth = .7
  for (let x = -6; x < 1; x += 2.5) { ctx.beginPath(); ctx.moveTo(x, -1.4); ctx.lineTo(x + 1.7, 1.4); ctx.moveTo(x, 1.4); ctx.lineTo(x + 1.7, -1.4); ctx.stroke() }
  ctx.fillStyle = '#a88b5a'; ctx.strokeStyle = INK; ctx.lineWidth = .8
  ctx.fillRect(-9, -2, 2, 4); ctx.strokeRect(-9, -2, 2, 4)
  ctx.beginPath(); ctx.ellipse(3, 0, 1.5, 3.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  const motion = view.motion
  const drawProgress = katanaBladeReveal(motion)
  // 待机完全藏刃；出鞘使用裁切显露，刀身不再随着进度拉伸变形。
  if (drawProgress <= 0) { ctx.restore(); return }
  ctx.save(); ctx.beginPath(); ctx.rect(3, -9, 56 * drawProgress, 14); ctx.clip()
  // 刀身缩短约三分之一、收细约四成，刀柄与护手保留正常握持尺寸。
  ctx.translate(5, 0); ctx.scale(.68, .58); ctx.translate(-5, 0)
  ctx.beginPath(); ctx.moveTo(5, -2.5); ctx.quadraticCurveTo(50, -3.5, 83, -10); ctx.quadraticCurveTo(78, -1, 66, 1.7); ctx.quadraticCurveTo(31, 5.3, 5, 2.5); ctx.closePath()
  ctx.fillStyle = '#b8c9cb'; ctx.strokeStyle = INK; ctx.lineWidth = .9; ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(6, .5); ctx.quadraticCurveTo(47, 1, 81, -8); ctx.quadraticCurveTo(74, 1.1, 66, 1.7); ctx.quadraticCurveTo(31, 5.3, 6, 2.5); ctx.closePath(); ctx.fillStyle = '#859dad'; ctx.fill()
  ctx.strokeStyle = '#f1e8cf'; ctx.lineWidth = .85; ctx.beginPath(); ctx.moveTo(7, -1.9); ctx.quadraticCurveTo(50, -2.7, 81, -9); ctx.stroke()
  // 波纹刃文是细密银线，保留钢刃质感，不画成持续发光的能量刀。
  ctx.strokeStyle = '#d8e2db'; ctx.lineWidth = .65; ctx.beginPath(); ctx.moveTo(8, 1.3)
  for (let x = 12; x <= 68; x += 7) ctx.quadraticCurveTo(x - 3, x < 45 ? 2.1 : -.5, x, .9 - Math.max(0, x - 35) * .055)
  ctx.stroke(); ctx.restore(); ctx.restore()
}
export const drawGroundKatana: GroundRenderer = ({ ctx, x, y }) => {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.72); ctx.scale(.42, .42); ctx.translate(-30, 0); drawForgedKatana(ctx); ctx.restore()
}
export function drawKatanaSheath(ctx: CanvasRenderingContext2D, view: WeaponMotionView & { x: number; y: number; bodyFacing: number; hand: {x:number;y:number;angle:number}; supportHand: {x:number;y:number} }): void {
  const layout = katanaReadyPose(view, view.bodyFacing), angle = view.phase === 'none' ? view.hand.angle : layout.angle
  let x: number, y: number
  if (view.phase === 'none') {
    // 鞘口与刀镡共轴，主手握柄、副手握住鞘口后方，不另画一根独立斜杆。
    x = view.hand.x + Math.cos(angle) * 3; y = view.hand.y + Math.sin(angle) * 3
  } else if (view.segment < 2 || katanaSheathing(view) > 0) {
    x = view.supportHand.x - Math.cos(angle) * 3; y = view.supportHand.y - Math.sin(angle) * 3
  } else {
    const mirror = quantizeDir4(view.bodyFacing) === 'right' ? -1 : 1
    x = view.x + layout.main.x * mirror + Math.cos(angle) * 3
    y = view.y + layout.main.y + Math.sin(angle) * 3
  }
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
  if (quantizeDir4(view.bodyFacing) === 'right') ctx.scale(1, -1)
  ctx.fillStyle = '#353f4d'; ctx.strokeStyle = INK; ctx.lineWidth = .9
  ctx.beginPath(); ctx.moveTo(0, -1.8); ctx.quadraticCurveTo(28, -1.2, 55, -4.9); ctx.lineTo(56, -1.6); ctx.quadraticCurveTo(28, 2.5, 0, 1.8); ctx.closePath(); ctx.fill(); ctx.stroke()
  ctx.strokeStyle = '#8d9ea6'; ctx.lineWidth = .55; ctx.beginPath(); ctx.moveTo(4, -1); ctx.quadraticCurveTo(30, 0, 52, -3.6); ctx.stroke()
  ctx.fillStyle = '#ad9163'; ctx.fillRect(-1, -2.1, 3, 4.2); ctx.fillRect(52, -4.5, 3, 3)
  ctx.strokeStyle = '#8399a0'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(7, -2); ctx.lineTo(7, 3); ctx.moveTo(10, -2); ctx.lineTo(10, 3); ctx.stroke(); ctx.restore()
}
