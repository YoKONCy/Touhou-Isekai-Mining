/**
 * 序章基地·手绘摆件（Canvas2D 矢量，批次 E 同款画风）
 *
 * 全部为俯视 2.5D 小道具，经 RoomRuntime.addSortable 注册后参与全屋 y-sort：
 * - 篝火：石圈 + 交叉木柴 + 三层摇曳火焰（光源由 RoomRuntime.addCustomLight 另挂）
 * - 旧锅：黑铁锅 + 双耳 + 三脚支架
 * - 破提灯：倒地油灯，玻璃罩里一点残光
 * - 木箱：俯视角板条箱
 * - 草铺：卷起来的铺盖卷
 *
 * 本轮均为占位美术（与灵梦 NPC 同一轮替换），只保证"有人落过脚"的叙事可读性。
 */

const TAU = Math.PI * 2

/** 篝火（x/y＝火堆中心地面点；火焰向上方燃起） */
export function drawCampfire(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  // 地面烤痕（暗色椭圆）
  ctx.fillStyle = 'rgba(48,30,18,0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + 4, 36, 15, 0, 0, TAU)
  ctx.fill()

  // 石圈：8 块圆角灰岩围着柴堆
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU
    const sx = x + Math.cos(a) * 31
    const sy = y + Math.sin(a) * 12
    ctx.fillStyle = i % 2 ? '#7d766c' : '#8d867b'
    ctx.beginPath()
    ctx.ellipse(sx, sy, 7, 5.5, a, 0, TAU)
    ctx.fill()
    ctx.strokeStyle = 'rgba(40,36,32,0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // 交叉木柴（两根圆木，俯视压扁）
  const logs: Array<[number, number, number]> = [
    [-0.4, -4, 0.5],
    [0.4, -2, -0.5]
  ]
  for (const [, ly, rot] of logs) {
    ctx.save()
    ctx.translate(x, y + ly)
    ctx.rotate(rot)
    ctx.fillStyle = '#6e4526'
    ctx.beginPath()
    ctx.ellipse(0, 0, 20, 6, 0, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#8a5a30'
    ctx.beginPath()
    ctx.ellipse(-2, -1.5, 17, 3.4, 0, 0, TAU)
    ctx.fill()
    // 木端面年轮
    ctx.fillStyle = '#5a371d'
    ctx.beginPath()
    ctx.ellipse(-19, 0, 3.4, 5.4, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // 火焰：三层水滴，随双频噪声摇曳（外焰橙红 / 中焰橙黄 / 焰心亮黄白）
  const sway = Math.sin(time * 11.3) * 2.2 + Math.sin(time * 23.7) * 1.1
  const breathe = 1 + 0.1 * Math.sin(time * 9.1)
  const drawFlame = (w: number, h: number, cy: number, color: string, seed: number): void => {
    const sw = sway * seed
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(x + sw, cy - h * breathe)
    ctx.bezierCurveTo(x + w + sw * 0.4, cy - h * 0.55, x + w * 0.7, cy + 2, x, cy + 3)
    ctx.bezierCurveTo(x - w * 0.7, cy + 2, x - w - sw * 0.4, cy - h * 0.55, x + sw, cy - h * breathe)
    ctx.closePath()
    ctx.fill()
  }
  drawFlame(13, 34, y - 4, 'rgba(232,96,32,0.92)', 1)
  drawFlame(9, 25, y - 4, 'rgba(255,158,46,0.95)', 0.6)
  drawFlame(4.5, 15, y - 5, 'rgba(255,236,170,0.95)', 0.3)
}

/** 旧锅架在篝火北侧（黑铁锅 + 双耳 + 三脚架） */
export function drawOldPot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  // 三脚架细杆
  ctx.strokeStyle = '#3a332c'
  ctx.lineWidth = 2
  for (const dx of [-12, 12]) {
    ctx.beginPath()
    ctx.moveTo(x + dx * 0.4, y - 6)
    ctx.lineTo(x + dx, y + 12)
    ctx.stroke()
  }
  // 锅身（俯视圆盘 + 厚度）
  ctx.fillStyle = '#26221e'
  ctx.beginPath()
  ctx.ellipse(x, y, 17, 11, 0, 0, TAU)
  ctx.fill()
  ctx.fillStyle = '#34302b'
  ctx.beginPath()
  ctx.ellipse(x, y - 2, 15, 9, 0, 0, TAU)
  ctx.fill()
  // 锅沿与汤面暗圈
  ctx.strokeStyle = '#4a443c'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(x, y - 2, 15, 9, 0, 0, TAU)
  ctx.stroke()
  ctx.fillStyle = '#1d1a17'
  ctx.beginPath()
  ctx.ellipse(x, y - 2.5, 11, 6, 0, 0, TAU)
  ctx.fill()
  // 双耳
  ctx.strokeStyle = '#3a332c'
  ctx.lineWidth = 2
  for (const sx of [-1, 1]) {
    ctx.beginPath()
    ctx.arc(x + sx * 16, y - 2, 3.2, -0.6, 0.6)
    ctx.stroke()
  }
}

/** 倒地的破提灯（残光一点，主要靠篝火照明；此处仅画玻璃微光） */
export function drawLantern(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.35)
  // 灯座
  ctx.fillStyle = '#4a3b28'
  ctx.beginPath()
  ctx.roundRect(-7, 4, 14, 5, 2)
  ctx.fill()
  // 玻璃罩
  const glow = 0.5 + 0.16 * Math.sin(time * 5 + x)
  ctx.fillStyle = `rgba(255,176,74,${0.28 * glow})`
  ctx.beginPath()
  ctx.ellipse(0, -2, 8, 8, 0, 0, TAU)
  ctx.fill()
  ctx.strokeStyle = '#54452f'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.ellipse(0, -2, 6.5, 7.5, 0, 0, TAU)
  ctx.stroke()
  // 灯芯
  ctx.fillStyle = `rgba(255,214,130,${0.8 * glow})`
  ctx.beginPath()
  ctx.arc(0, 0, 1.8, 0, TAU)
  ctx.fill()
  // 提手环（倒地侧出）
  ctx.strokeStyle = '#3a2f20'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.arc(7, -4, 4.5, -1.1, 1.1)
  ctx.stroke()
  ctx.restore()
}

/** 木箱（俯视板条箱；size＝像素边长） */
export function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, size = 34): void {
  const s = size
  // 接地阴影
  ctx.fillStyle = 'rgba(30,22,14,0.3)'
  ctx.beginPath()
  ctx.ellipse(x, y + s * 0.42, s * 0.52, s * 0.2, 0, 0, TAU)
  ctx.fill()
  // 箱体
  ctx.fillStyle = '#7c512b'
  ctx.beginPath()
  ctx.roundRect(x - s / 2, y - s / 2, s, s, 3)
  ctx.fill()
  // 顶面亮板
  ctx.fillStyle = '#936234'
  ctx.beginPath()
  ctx.roundRect(x - s / 2 + 2, y - s / 2 + 2, s - 4, s - 4, 2)
  ctx.fill()
  // 板条缝 + 对角加固
  ctx.strokeStyle = 'rgba(70,44,22,0.8)'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.moveTo(x - s / 2, y - s / 2)
  ctx.lineTo(x + s / 2, y + s / 2)
  ctx.moveTo(x + s / 2, y - s / 2)
  ctx.lineTo(x - s / 2, y + s / 2)
  ctx.stroke()
  ctx.strokeStyle = '#5a3a1e'
  ctx.lineWidth = 1
  ctx.strokeRect(x - s / 2 + 1.5, y - s / 2 + 1.5, s - 3, s - 3)
}

/** 草铺（靠墙的铺盖卷：横放圆柱卷 + 两条系带） */
export function drawBedroll(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.08)
  // 阴影
  ctx.fillStyle = 'rgba(30,24,18,0.28)'
  ctx.beginPath()
  ctx.ellipse(0, 9, 34, 8, 0, 0, TAU)
  ctx.fill()
  // 卷身
  ctx.fillStyle = '#6b7256'
  ctx.beginPath()
  ctx.roundRect(-30, -10, 60, 20, 9)
  ctx.fill()
  ctx.fillStyle = '#7d8567'
  ctx.beginPath()
  ctx.roundRect(-28, -9, 56, 11, 6)
  ctx.fill()
  // 两端卷口
  ctx.fillStyle = '#575d47'
  ctx.beginPath()
  ctx.ellipse(-29, 0, 4.5, 9.5, 0, 0, TAU)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(29, 0, 4.5, 9.5, 0, 0, TAU)
  ctx.fill()
  // 系带
  ctx.strokeStyle = '#464c39'
  ctx.lineWidth = 3
  for (const sx of [-12, 12]) {
    ctx.beginPath()
    ctx.moveTo(sx, -9)
    ctx.lineTo(sx, 9)
    ctx.stroke()
  }
  ctx.restore()
}
