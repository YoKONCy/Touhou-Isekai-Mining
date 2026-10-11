import { bakeSprite, drawSprite, type RasterSprite } from '../../core/rendering/SpriteCache'
import { drawMinerHelmet, drawMinerLeg, drawMinerSleeve, drawMinerTorso } from './rig/minerWorkwear'

/** 盆栽固定展示在床铺旁，和角色一起按脚底位置排序。 */
export const SHRUB_SPOT={x:980,y:330}
/** 衣架在床左侧的空地，底脚占地与交互锚点共用同一位置。 */
export const WARDROBE_SPOT={x:808,y:315,w:62,d:18}
let wardrobeRack: RasterSprite | undefined
/** 木杆采用不规则切面和旧木纹，衣服与玩家共用工作服绘图；整件家具只烘焙一次。 */
export function drawWardrobeRack(g:CanvasRenderingContext2D):void {
  wardrobeRack ??= bakeSprite(-43, -80, 93, 91, c => {
    c.lineJoin = 'round'; c.lineCap = 'round'
    const fill = (d: string, color: string, outline = false) => {
      const p = new Path2D(d); c.fillStyle = color; c.fill(p)
      if (outline) { c.strokeStyle = '#49404b'; c.lineWidth = .65; c.stroke(p) }
    }
    const stroke = (d: string, color: string, width: number) => {
      c.strokeStyle = color; c.lineWidth = width; c.stroke(new Path2D(d))
    }
    // 投影随基地光向偏右，后脚向里收，避免平面的正视梯子轮廓。
    fill('M-30-3L19-10 45 3 37 8-26 5-36 1Z', '#25243135')
    for (const [x, y] of [[-30, 1], [29, -1], [-15, -10], [17, -13]] as const) {
      c.fillStyle = '#25243148'; c.beginPath(); c.ellipse(x, y, 5, 2, -.12, 0, Math.PI * 2); c.fill()
    }
    fill('M-24-68L-19-68-12-12-17-9Z', '#776554', true)
    fill('M-19-68L-17-67-10-12-12-12Z', '#514854')
    fill('M20-72L24-71 20-14 16-11Z', '#766252', true)
    fill('M22-70L24-70 20-14 18-14Z', '#514854')
    stroke('M-21-60L-17-32M21-60L19-38', '#aa8865', .6)
    // 两个支架之间有轻微高差，横杆和木头端面保留体积。
    fill('M-32-66L-29-71 30-75 35-72 33-68-28-64Z', '#8e6b50', true)
    fill('M-29-71L30-75 33-73-29-68Z', '#bd9870')
    fill('M-28-66L33-70 33-68-28-64Z', '#645055')
    fill('M-32-66L-32-70-29-71-28-67-29-64Z', '#c5a37c', true)
    stroke('M-27-68L-7-69M2-70L18-71M22-72L27-72M-15-67L-3-68', '#6b4e45', .55)
    // 后脚与横杆先画，衣服及前脚随后遮挡，形成真实的前后层次。
    fill('M-25-76L-21-75-27 0-30 2-33 0-29-27Z', '#99795a', true)
    fill('M-25-75L-23-74-29 0-31 0Z', '#c2a078')
    fill('M-22-72L-21-75-27 0-29 1Z', '#695452')
    fill('M22-78L26-77 33-2 30 0 27-1 23-34Z', '#917154', true)
    fill('M22-76L24-75 29-2 27-1Z', '#b89670')
    fill('M25-77L26-77 33-2 31-1Z', '#655151')
    stroke('M-25-58L-27-38-27-32M-28-22L-29-8M26-53L27-45M28-32L29-14', '#72564a', .65)
    stroke('M-26-45L-25-40M27-28L28-24', '#d0aa7b', .5)
    // 旧麻绳有暗面的压痕，避免发亮的装饰金边。
    for (const [x, y] of [[-24, -69], [24, -73]] as const) {
      stroke(`M${x - 3} ${y - 2}l7 2m-7 1l7 2m-7 1l6 2`, '#69564b', 2.2)
      stroke(`M${x - 3} ${y - 2}l7 2m-7 1l7 2m-7 1l6 2`, '#baa17d', 1.1)
      stroke(`M${x + 2} ${y + 5}q2 5-1 8m1-7 3 4`, '#9b805f', .9)
    }
    // 用弯铁丝悬挂，工作服的轮廓、口袋、背带和卷袖与玩家保持一致。
    stroke('M-6-62Q-3-66-6-68Q-10-69-10-65M-6-62L-7-59-19-52 6-54-7-59', '#514750', 1.1)
    stroke('M-8-67Q-6-68-5-66', '#aaa190', .45)
    c.save(); c.translate(-7, -36); c.rotate(-.045); c.scale(2.1, 2.1)
    for (const x of [-2.5, 2.5]) { c.save(); c.translate(x, 7.3); drawMinerLeg(c, false); c.restore() }
    for (const x of [-5.7, 5.7]) {
      c.save(); c.translate(x, -6); c.rotate(x < 0 ? .34 : -.29)
      drawMinerSleeve(c, false); c.translate(0, 5.2); drawMinerSleeve(c, true); c.restore()
    }
    drawMinerTorso(c, 'front'); c.restore()
    // 侧边挂的是同一顶帽子，不再另画没有阴影的黄色半圆。
    stroke('M22-66L25-63 26-59', '#584954', 1.5)
    c.save(); c.translate(24, -61); c.rotate(-.14); c.scale(.21, .21); c.translate(-80, -51)
    drawMinerHelmet(c, 'side'); c.restore()
  }, 3)
  g.save(); g.translate(WARDROBE_SPOT.x, WARDROBE_SPOT.y); g.imageSmoothingEnabled = true
  drawSprite(g, wardrobeRack); g.restore()
}
export function drawShrubPot(g:CanvasRenderingContext2D):void {
  g.save();g.translate(SHRUB_SPOT.x,SHRUB_SPOT.y)
  g.fillStyle='#18151e55';g.beginPath();g.ellipse(0,2,19,6,0,0,Math.PI*2);g.fill()
  g.strokeStyle='#352c37';g.lineWidth=1.5;g.lineJoin='round'
  g.fillStyle='#9f7159';g.beginPath();g.moveTo(-14,-17);g.lineTo(15,-17);g.lineTo(11,1);g.lineTo(-10,1);g.closePath();g.fill();g.stroke()
  g.fillStyle='#cb9a78';g.fillRect(-16,-20,33,6);g.strokeRect(-16,-20,33,6)
  g.strokeStyle='#655441';g.lineWidth=3;g.beginPath();g.moveTo(0,-20);g.lineTo(0,-46);g.moveTo(0,-31);g.lineTo(-13,-43);g.moveTo(0,-36);g.lineTo(12,-49);g.stroke()
  const leaves=[[-14,-44,12,10,'#677d58'],[0,-52,13,11,'#83936b'],[14,-45,12,10,'#71875f'],[-5,-36,13,9,'#758b60'],[9,-33,11,8,'#596e50']] as const
  for(const [x,y,rx,ry,color] of leaves){g.fillStyle=color;g.strokeStyle='#3d493c';g.lineWidth=1;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();g.stroke()}
  g.strokeStyle='#b5c08d';g.lineWidth=1.5;g.beginPath();g.moveTo(-17,-47);g.lineTo(-12,-50);g.moveTo(-4,-56);g.lineTo(2,-58);g.moveTo(12,-48);g.lineTo(17,-46);g.stroke();g.restore()
}
