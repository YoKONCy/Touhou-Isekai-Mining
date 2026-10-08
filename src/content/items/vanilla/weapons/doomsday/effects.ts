import { doomEmpoweredSweep } from './motion'

export interface DoomTrail { x: number; y: number; angle: number; reach: number; direction: number; life: number; empowered: boolean }

export function drawDoomTransition(ctx: CanvasRenderingContext2D, x: number, y: number, modeFx: number, equipped: boolean): void {
    const k = Math.abs(modeFx)
    if (k < 0.01 || !equipped) return
    const entering = modeFx > 0
    const progress = entering ? 1 - k : k
    ctx.save(); ctx.translate(x, y); ctx.globalCompositeOperation = 'lighter'
    const radius = 22 + progress * 190
    const alpha = (entering ? 1 - progress : progress) * 0.7
    const glow = ctx.createRadialGradient(0, 0, radius * 0.25, 0, 0, radius)
    glow.addColorStop(0, 'rgba(255,226,255,' + alpha * 0.32 + ')')
    glow.addColorStop(0.48, 'rgba(238,64,205,' + alpha * 0.16 + ')')
    glow.addColorStop(1, 'rgba(130,30,180,0)')
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,164,239,' + alpha + ')'; ctx.lineWidth = 3 + alpha * 8
    ctx.beginPath(); ctx.arc(0, 0, radius, -Math.PI * 0.92, Math.PI * 0.72); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,238,255,' + alpha * 0.8 + ')'; ctx.lineWidth = 1.5
    for (let i = 0; i < 7; i++) {
      const a = -1.1 + i * 0.39 + progress * 2.4
      const inner = radius * (0.52 + (i % 3) * 0.04), outer = radius * (0.82 + (i % 2) * 0.13)
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner)
      ctx.lineTo(Math.cos(a + 0.08) * outer, Math.sin(a + 0.08) * outer); ctx.stroke()
    }
    ctx.restore()
  }

function drawDoomTrail(ctx: CanvasRenderingContext2D, trail: { x: number; y: number; angle: number; reach: number; direction: number; life: number; empowered: boolean }): void {
    const age = 0.38 - trail.life
    const p = Math.min(1, Math.max(0, age / 0.1))
    const sweep = trail.empowered ? doomEmpoweredSweep(p) : p < 0.18 ? 0.06 * Math.pow(p / 0.18, 2)
      : p < 0.8 ? 0.06 + 0.9 * (1 - Math.pow(1 - (p - 0.18) / 0.62, 2))
      : 0.96 + 0.04 * (p - 0.8) / 0.2
    const head = -1.35 + sweep * 2.7
    const fade = Math.pow(Math.max(0, 1 - Math.max(0, age - 0.1) / 0.28), 1.6)
    ctx.save(); ctx.translate(trail.x, trail.y); ctx.rotate(trail.angle); ctx.scale(1, trail.direction)
    // 深紫底色保住轮廓；发光层不能把所有颜色叠成灰白纸片。
    const steps = 52
    for (let i = 0; i < steps; i++) {
      const a = -1.35 + i / steps * 2.7, b = Math.min(head, a + 2.7 / steps + 0.003)
      if (b <= a) continue
      const freshness = Math.exp(-(head - a) * 1.8)
      const radius = trail.reach * (1 + Math.sin(a * 8 + trail.direction) * 0.025)
      const width = (trail.empowered ? 15 : 8) + (trail.empowered ? 70 : 24) * Math.sin((a + 1.35) / 2.7 * Math.PI)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = fade * (0.18 + 0.72 * freshness)
      ctx.fillStyle = trail.empowered ? '#561653' : '#60215f'; ctx.beginPath(); ctx.arc(0, 0, radius + 2, a, b); ctx.arc(0, 0, radius - width, b, a, true); ctx.closePath(); ctx.fill()
      ctx.globalCompositeOperation = 'lighter'
      const gradient = ctx.createRadialGradient(0, 0, radius - width, 0, 0, radius)
      gradient.addColorStop(0, '#6f1ca000'); gradient.addColorStop(0.35, '#bd258e88'); gradient.addColorStop(0.8, '#f778bfd0'); gradient.addColorStop(1, '#ffe4c5')
      ctx.fillStyle = gradient; ctx.globalAlpha = fade * (0.1 + 0.8 * freshness)
      ctx.beginPath(); ctx.arc(0, 0, radius, a, b); ctx.arc(0, 0, radius - width, b, a, true); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = '#fff1d9'; ctx.lineWidth = 1.8 * freshness + 0.4; ctx.beginPath(); ctx.arc(0, 0, radius, a, b); ctx.stroke()
    }
    // 离刃的稀疏光丝，沿扫过方向继续飘散。
    ctx.globalAlpha = fade * 0.65; ctx.strokeStyle = '#f59bcf'; ctx.lineWidth = 1
    for (let i = 0; i < 5; i++) {
      const a = head - 0.18 - i * 0.21
      if (a < -1.35) continue
      const radius = trail.reach + 4 + i * 1.7 + age * 12
      ctx.beginPath(); ctx.arc(0, 0, radius, a, a + 0.055 + i * 0.012); ctx.stroke()
    }
    if (trail.empowered) {
      // 不规则断裂外弧与切向飞散碎光，随时间扩散，不能均匀切成七块。
      ctx.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 14; i++) {
        const a = -1.25 + i * 0.185
        if (a > head) continue
        const outward = Math.max(0, age - 0.035) * (24 + i % 4 * 18)
        const radius = trail.reach + outward + Math.sin(i * 5.7) * 8
        ctx.globalAlpha = fade * Math.exp(-(head - a) * 0.9) * 0.75
        ctx.strokeStyle = i % 3 ? '#fa88de' : '#ffe1aa'
        ctx.lineWidth = i % 3 === 0 ? 2 : 1
        ctx.beginPath(); ctx.arc(0, 0, radius, a, a + 0.035 + i % 4 * 0.015); ctx.stroke()
        const x = Math.cos(a) * radius, y = Math.sin(a) * radius
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - Math.sin(a) * (6 + age * 30), y + Math.cos(a) * (6 + age * 30)); ctx.stroke()
      }
    }
    ctx.restore()
  }

export function drawDoomCrescents(ctx: CanvasRenderingContext2D, trails: readonly DoomTrail[], filter: 'normal' | 'empowered' | 'all' = 'all'): void {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    for (const trail of trails) {
      if ((filter === 'normal' && trail.empowered) || (filter === 'empowered' && !trail.empowered)) continue
      drawDoomTrail(ctx, trail)
    }
    ctx.restore()
  }

