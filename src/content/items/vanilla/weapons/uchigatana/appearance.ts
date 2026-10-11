/** 单手短柄、微弧刀背与薄亮刃口，沿用现有赛璐璐微像素材质。 */
export function drawUchigatana(g: CanvasRenderingContext2D): void {
  g.save(); g.lineJoin = 'round'; g.strokeStyle = '#2d2936'; g.lineWidth = 1
  g.fillStyle = '#333746'; g.fillRect(-7, -1.8, 10, 3.6); g.strokeRect(-7, -1.8, 10, 3.6)
  g.strokeStyle = '#ab8c74'; g.lineWidth = .8
  g.beginPath()
  for (let x = -6; x < 2; x += 2.5) { g.moveTo(x, -1.5); g.lineTo(x + 1.8, 1.5); g.moveTo(x, 1.5); g.lineTo(x + 1.8, -1.5) }
  g.stroke()
  g.strokeStyle = '#2d2936'; g.fillStyle = '#b49a66'
  g.fillRect(-8, -2, 1.5, 4); g.strokeRect(-8, -2, 1.5, 4)
  g.beginPath(); g.ellipse(3, 0, 1.5, 5, 0, 0, Math.PI * 2); g.fill(); g.stroke()
  g.beginPath(); g.moveTo(4, -1.8); g.quadraticCurveTo(25, -1.5, 41, -6)
  g.lineTo(39, -1.8); g.quadraticCurveTo(23, 2.4, 4, 1.8); g.closePath()
  g.fillStyle = '#a2b1bd'; g.fill(); g.stroke()
  g.beginPath(); g.moveTo(5, -.5); g.quadraticCurveTo(24, -.2, 40, -4.6)
  g.lineTo(39, -1.8); g.quadraticCurveTo(23, 2.4, 5, 1.8); g.closePath(); g.fillStyle = '#e3e5dc'; g.fill()
  g.strokeStyle = '#708096'; g.lineWidth = .65
  g.beginPath(); g.moveTo(7, -1.1); g.quadraticCurveTo(25, -1, 37, -4.3); g.stroke()
  g.strokeStyle = '#f4efdc'; g.beginPath(); g.moveTo(7, 1.3); g.quadraticCurveTo(24, 1.7, 38, -2); g.stroke()
  g.restore()
}
