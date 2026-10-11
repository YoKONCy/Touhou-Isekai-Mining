import type { GroundDropView, HeldWeaponView } from '../../../types'
import { scepterGripShift } from './motion'

let sprite: HTMLCanvasElement | null = null

/** 木芯和两端金属一次烘焙：两端各占全长十分之一，比原木明显粗一圈。 */
function scepterSprite(): HTMLCanvasElement {
  if (sprite) return sprite
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 40
  const g = canvas.getContext('2d')!; g.scale(2, 2); g.translate(64, 10); g.lineJoin = 'bevel'
  g.beginPath(); g.moveTo(-45, -3.1); g.lineTo(45, -3.1); g.lineTo(45, 3.1); g.lineTo(-45, 3.1); g.closePath()
  g.fillStyle = '#44312c'; g.fill(); g.strokeStyle = '#231c23'; g.lineWidth = 1; g.stroke()
  g.fillStyle = '#62483a'; g.fillRect(-44.8, -2.8, 89.6, 1.1)
  g.fillStyle = '#2e2426'; g.fillRect(-44.8, 1.1, 89.6, 1.7)
  g.strokeStyle = '#937057'; g.lineWidth = .45
  g.beginPath(); g.moveTo(-43, -2); g.bezierCurveTo(-24, -1.4, -16, -2.6, -3, -1.7)
  g.moveTo(5, -1.9); g.bezierCurveTo(16, -1.3, 29, -2.5, 43, -1.7); g.stroke()
  g.strokeStyle = '#211b21'; g.lineWidth = .55
  g.beginPath(); g.moveTo(-42, .7); g.bezierCurveTo(-29, -.4, -20, 1.8, -9, .6)
  g.moveTo(9, .6); g.bezierCurveTo(25, -.8, 29, 1.6, 42, .4); g.stroke()
  g.beginPath(); g.ellipse(24, .4, 3.8, .75, -.06, 0, Math.PI * 2); g.stroke()
  // 中段保留裸露、抛光的致密原木，不加包住木纹的整圈握带。
  g.strokeStyle = '#a7836055'; g.lineWidth = .4
  g.beginPath(); g.moveTo(-6, -.8); g.lineTo(6, -.8); g.moveTo(-5, 1.8); g.lineTo(5, 1.8); g.stroke()
  for (const x of [-56, 44.8]) {
    g.beginPath(); g.moveTo(x, -3.6); g.lineTo(x + 1.3, -4.7); g.lineTo(x + 9.9, -4.7)
    g.lineTo(x + 11.2, -3.6); g.lineTo(x + 11.2, 3.6); g.lineTo(x + 9.9, 4.7)
    g.lineTo(x + 1.3, 4.7); g.lineTo(x, 3.6); g.closePath()
    g.fillStyle = '#4b3e47'; g.fill(); g.strokeStyle = '#211e28'; g.lineWidth = 1; g.stroke()
    g.fillStyle = '#6a5962'; g.fillRect(x + 1.2, -3.7, 8.8, 1.2)
    g.fillStyle = '#302831'; g.fillRect(x + .7, 1.7, 9.8, 1.6)
    g.strokeStyle = '#9c8990'; g.lineWidth = .6
    g.beginPath(); g.moveTo(x + 2, -3.7); g.lineTo(x + 9.2, -3.7); g.stroke()
    g.strokeStyle = '#30252d'; g.lineWidth = .8
    g.beginPath(); g.moveTo(x + 3, -2); g.lineTo(x + 3, 2); g.moveTo(x + 8, -2); g.lineTo(x + 8, 2); g.stroke()
    g.fillStyle = '#85747b'; g.fillRect(x + 5, -.7, 1.2, 1.2)
  }
  sprite = canvas
  return canvas
}

export function drawBattleScepter(g: CanvasRenderingContext2D, view: HeldWeaponView): void {
  g.save()
  // 常态和横扫、花棍都双手握中段；下劈换到后半杆，绘制位移与两手握点一起变化。
  if (view.motion) g.translate(scepterGripShift(view.motion), 0)
  // 握持、掉落和棍影统一收细一半，纵向长度与两端占比保持一致。
  g.scale(1, .5)
  g.drawImage(scepterSprite(), -64, -10, 128, 20)
  g.restore()
}

export function drawGroundScepter({ ctx, x, y }: GroundDropView): void {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-.35); ctx.scale(.55, .55)
  drawBattleScepter(ctx, {}); ctx.restore()
}

export const SCEPTER_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g transform="translate(32 32) rotate(-45) scale(.55 .275)" stroke="#241e27" stroke-width="1.5" stroke-linejoin="bevel">
  <path d="M-45-3.2H45V3.2H-45Z" fill="#44312c"/>
  <path d="M-44-2.4H44" stroke="#87634c" stroke-width="1.1"/>
  <path d="M-44 1.5H44" stroke="#292124"/>
  <path d="M-41-.7Q-29-1.8-13-.6M9-.5Q24-2 42-.7" stroke="#a3835c" stroke-width=".65" fill="none"/>
  <ellipse cx="24" cy=".6" rx="4" ry=".9" fill="none" stroke="#251e23" stroke-width=".7"/>
  <path d="M-56-3.5-54.7-4.7H-46.1L-44.8-3.5V3.5L-46.1 4.7H-54.7L-56 3.5ZM44.8-3.5 46.1-4.7H54.7L56-3.5V3.5L54.7 4.7H46.1L44.8 3.5Z" fill="#4b3e47"/>
  <path d="M-54.5-3.5H-46.5M46.5-3.5H54.5" stroke="#a18d94" stroke-width="1"/>
  <path d="M-55 2.4H-46M46 2.4H55" stroke="#302831" stroke-width="1.5"/>
  <path d="M-53-2V2M-48-2V2M48-2V2M53-2V2" stroke="#31262f" stroke-width=".8"/>
</g></svg>`
