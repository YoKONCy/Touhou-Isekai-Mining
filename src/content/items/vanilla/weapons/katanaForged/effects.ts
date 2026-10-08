import type { WeaponTrailView } from '../../../types'
import { drawForgedKatana } from './appearance'
import { katanaSweep } from './motion'

export const KATANA_TRAIL_DURATION = .27
/** 四段都由实际判定窗口推进剑影；细亮刃线、透明刀影与外缘风痕分层。 */
export function drawKatanaTrail(ctx: CanvasRenderingContext2D, view: WeaponTrailView): void {
  const p = Math.max(0, Math.min(1, view.age / Math.max(.001, view.activeDuration ?? .16)))
  const fade = Math.min(1, view.age / .018) * Math.pow(Math.max(0, 1 - view.age / KATANA_TRAIL_DURATION), 1.2)
  if (fade <= 0) return
  const segment = view.segment % 4, direction = segment === 1 ? -1 : 1
  ctx.save(); ctx.translate(view.x, view.y - 3); ctx.rotate(view.angle); ctx.lineJoin = 'round'
  if (segment === 2) {
    const length = 22 + 73 * Math.min(1, p / .62)
    // 下劈留下纵向刀影，视觉宽度贴合窄矩形判定，不填充虚假的大扇面。
    ctx.globalAlpha *= fade * .28; ctx.fillStyle = '#becfd4'
    ctx.beginPath(); ctx.moveTo(15, -8); ctx.quadraticCurveTo(length * .7, -12, length, 0); ctx.quadraticCurveTo(length * .7, 10, 15, 7); ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#f2eee0'; ctx.lineWidth = 1.5; ctx.globalAlpha = fade * .7
    ctx.beginPath(); ctx.moveTo(24, -1); ctx.lineTo(length, 0); ctx.stroke()
    ctx.strokeStyle = '#a6bdc8'; ctx.lineWidth = .65; ctx.globalAlpha = fade * .35
    ctx.beginPath(); ctx.moveTo(32, -7); ctx.lineTo(length - 5, -3); ctx.moveTo(25, 6); ctx.lineTo(length - 10, 3); ctx.stroke()
  } else {
    const arc = segment === 3 ? Math.PI : Math.PI * .4
    const sweep = katanaSweep(p), tip = direction * (-arc + arc * 2 * sweep)
    const span = Math.min(arc * 2 * sweep, segment === 3 ? 2.5 : 1.25)
    const begin = tip - direction * span
    // 只铺刀尖附近的薄带，仍能透过剑影看清角色、怪物与弹幕。
    for (let layer = 0; layer < 2; layer++) {
      const radius = 93 - layer * 14, width = layer === 0 ? 7 : 3.5
      ctx.beginPath()
      for (let i = 0; i <= 24; i++) {
        const k = i / 24, angle = begin + (tip - begin) * k, r = radius - Math.sin(k * Math.PI) * width
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r)
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r)
      }
      for (let i = 24; i >= 0; i--) { const angle = begin + (tip - begin) * i / 24; ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius) }
      ctx.closePath(); ctx.globalAlpha = fade * (layer === 0 ? .26 : .11); ctx.fillStyle = layer === 0 ? '#bfd4dd' : '#9cabbf'; ctx.fill()
      ctx.beginPath(); ctx.arc(0, 0, radius, begin, tip, direction < 0)
      ctx.globalAlpha = fade * (layer === 0 ? .75 : .3); ctx.strokeStyle = '#eeeddf'; ctx.lineWidth = layer === 0 ? 1 : .6; ctx.stroke()
    }
    if (segment === 3) {
      ctx.globalAlpha = fade * .19; ctx.strokeStyle = '#b6cbd2'; ctx.lineWidth = .6
      ctx.beginPath(); ctx.arc(0, 0, 82, -Math.PI, -Math.PI + Math.PI * 2 * sweep); ctx.stroke()
    }
  }
  // 每段都有真实刀身残影；下劈、反手和旋斩各自采样对应的历史位置。
  for (let ghost = 0; ghost < 3; ghost++) {
    const lag = .055 + ghost * .06, previous = Math.max(0, p - lag)
    if (p <= lag) continue
    const angle = segment === 2 ? -1.55 + 1.73 * Math.min(1, previous / .62)
      : direction * (-(segment === 3 ? Math.PI : Math.PI * .4) + (segment === 3 ? Math.PI * 2 : Math.PI * .8) * katanaSweep(previous))
    ctx.save(); ctx.rotate(angle); ctx.translate(segment >= 2 ? 5 : 11, -3)
    ctx.globalAlpha = fade * (.18 - ghost * .045); drawForgedKatana(ctx); ctx.restore()
  }
  ctx.restore()
}
