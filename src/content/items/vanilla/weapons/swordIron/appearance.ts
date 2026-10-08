export function drawSword(ctx: CanvasRenderingContext2D): void {
  ctx.save(); ctx.strokeStyle='#2a201f'; ctx.lineWidth=1.1
  ctx.fillStyle='#637388'; ctx.fillRect(-7,-2,3,4); ctx.strokeRect(-7,-2,3,4)
  ctx.fillStyle='#503a30'; ctx.fillRect(-4,-1.8,7,3.6); ctx.strokeRect(-4,-1.8,7,3.6)
  ctx.strokeStyle='#a27f58'; ctx.beginPath(); ctx.moveTo(-3,-1.5); ctx.lineTo(-2,1.5); ctx.moveTo(-1,-1.5); ctx.lineTo(0,1.5); ctx.stroke()
  ctx.fillStyle='#8998a4'; ctx.strokeStyle='#2a201f'; ctx.fillRect(2,-6,2.8,12); ctx.strokeRect(2,-6,2.8,12)
  ctx.beginPath(); ctx.moveTo(5,-2.6); ctx.lineTo(32,-1.8); ctx.lineTo(40,0); ctx.lineTo(32,1.8); ctx.lineTo(5,2.6); ctx.closePath(); ctx.fillStyle='#bccbd5'; ctx.fill(); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(40,0); ctx.lineTo(32,1.8); ctx.lineTo(5,2.6); ctx.closePath(); ctx.fillStyle='#788ea2'; ctx.fill()
  ctx.strokeStyle='#f4f4ec'; ctx.lineWidth=.8; ctx.beginPath(); ctx.moveTo(6,-2); ctx.lineTo(32,-1.3); ctx.lineTo(38,0); ctx.stroke()
  ctx.strokeStyle='#4f667f'; ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(31,0); ctx.stroke(); ctx.restore()
}
