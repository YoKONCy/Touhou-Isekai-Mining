import type { EnemyAppearanceView } from '../types'

export function drawSlimeWarning(v: EnemyAppearanceView): void {
  const { ctx, windupProgress: wk, pounceProgress: pk } = v
    // 环弹蓄力：身体外先亮起 16 颗毒点 + 虚线圈，提前预告弹幕方位
    if (v.alive && v.windup === 'ring') {
      const ringR = v.r + 9
      ctx.fillStyle = `rgba(168,236,120,${0.25 + 0.55 * wk})`
      const ringN = v.ringCount
      for (let i = 0; i < ringN; i++) {
        const a = (i / ringN) * Math.PI * 2 + v.phase * 0.07
        ctx.beginPath()
        ctx.arc(v.x + Math.cos(a) * ringR, v.y + Math.sin(a) * ringR, 1.2 + 1.3 * wk, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.strokeStyle = `rgba(210,255,170,${0.15 + 0.45 * wk})`
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 5])
      ctx.beginPath()
      ctx.arc(v.x, v.y, ringR, 0, Math.PI * 2)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 猛扑蓄力告警（世界坐标）：收缩红圈 + 前方红色锥形指向，箭头随蓄力跟踪玩家
    if (v.alive && v.pounceState === 'windup') {
      const a = v.pounceAngle
      // 收缩的红色警示圈（蓄力越满圈越贴身）
      ctx.strokeStyle = `rgba(255,86,108,${0.28 + 0.5 * pk})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(v.x, v.y, v.r + 12 - 8 * pk, 0, Math.PI * 2)
      ctx.stroke()
      // 前方锥形方向标（身体前沿外，透明度随蓄力增强）
      const d = v.r + 13
      const bx = v.x + Math.cos(a) * d
      const by = v.y + Math.sin(a) * d
      ctx.fillStyle = `rgba(255,96,118,${0.5 + 0.45 * pk})`
      ctx.beginPath()
      ctx.moveTo(bx + Math.cos(a) * (10 + 5 * pk), by + Math.sin(a) * (10 + 5 * pk))
      ctx.lineTo(bx + Math.cos(a + 2.5) * 8, by + Math.sin(a + 2.5) * 8)
      ctx.lineTo(bx + Math.cos(a - 2.5) * 8, by + Math.sin(a - 2.5) * 8)
      ctx.closePath()
      ctx.fill()
    }

}

export function drawSlimeMotion(v: EnemyAppearanceView): void {
  const { ctx } = v
      // 猛扑中：身后三道红色速度线（世界坐标，强化爆发冲刺感）
      if (v.pounceState === 'lunge') {
        const back = v.pounceAngle + Math.PI
        const sideA = v.pounceAngle + Math.PI / 2
        ctx.strokeStyle = 'rgba(255,120,140,0.75)'
        ctx.lineWidth = 2
        ctx.lineCap = 'round'
        for (const off of [-8, 0, 8]) {
          const sx = v.x + Math.cos(back) * v.r * 0.8 + Math.cos(sideA) * off
          const sy = v.y + Math.sin(back) * v.r * 0.8 + Math.sin(sideA) * off
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + Math.cos(back) * (10 + Math.abs(off) * 0.4), sy + Math.sin(back) * (10 + Math.abs(off) * 0.4))
          ctx.stroke()
        }
      }

}
