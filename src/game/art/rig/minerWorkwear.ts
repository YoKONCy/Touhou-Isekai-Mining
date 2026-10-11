type Facing = 'front' | 'side' | 'back'

/** 工作服与衣架共用赛璐璐色板，亮面偏暖、暗面偏紫灰，避免整套衣服染成同一种黄褐色。 */
const colors = {
  ink: '#302b3b', shirt: '#a99c83', shirtLight: '#ccbea1', shirtShade: '#756c63',
  denim: '#586878', denimLight: '#859198', denimShade: '#3d465b', seam: '#b1aba1',
  leather: '#64504c', leatherLight: '#99816b', metal: '#b7b1a0',
} as const

function shape(g: CanvasRenderingContext2D, d: string, fill: string, width = .28): void {
  const p = new Path2D(d)
  g.fillStyle = fill; g.fill(p)
  if (width) { g.strokeStyle = colors.ink; g.lineWidth = width; g.stroke(p) }
}
function line(g: CanvasRenderingContext2D, d: string, color: string, width = .22): void {
  g.strokeStyle = color; g.lineWidth = width; g.stroke(new Path2D(d))
}

/** 与原衣身保持相同的领口和骨骼原点；侧身有独立裁剪，不再套用正面的方块胸片。 */
export function drawMinerTorso(g: CanvasRenderingContext2D, facing: Facing): void {
  g.save(); g.lineJoin = 'round'; g.lineCap = 'round'
  if (facing === 'side') {
    shape(g, 'M-1.4-8L2.8-7.1 4.6-5.2 4.2 1.8 4.8 7.5Q.7 8.9-4.1 7.5L-3.5 1.1-4-4.8Z', colors.shirt)
    shape(g, 'M1-6.8L3.6-5.5 3.2 1.6 4.5 7.5 1.1 8.1.2 1.8Z', colors.shirtShade, 0)
    shape(g, 'M-3.5-.7L1.6-1.1 2.1 7.9-4.1 7.5Z', colors.denim)
    shape(g, 'M-1.5-6.6L.1-6.2-.3.9-1.9.8Z', colors.denimLight)
    shape(g, 'M-3.2 1.8L-.5 1.6-.1 4.2-2.8 4.5Z', colors.denimShade, .18)
    line(g, 'M-2.8 2.2L-.7 2M-3.2 6.6L1.4 7', colors.seam, .16)
    shape(g, 'M-3.4-6.3L-1.6-7.5.4-6.1-1.9-4.8Z', colors.shirtLight)
  } else {
    shape(g, 'M-2.5-8L2.5-8 6.5-5.9 5.6.2 6 7.4Q0 8.5-6 7.4L-5.6.2-6.5-5.9Z', colors.shirt)
    shape(g, 'M3.9-6.5L6.5-5.9 5.6.2 6 7.4 3.6 7.6 3.1-.2Z', colors.shirtShade, 0)
    shape(g, 'M-6.5-5.9L-3.8-6.7-3.3-.4-5.6 1.4Z', colors.shirtLight, 0)
    shape(g, 'M-4.7-.9L4.7-.9 5.7 7.5Q0 8.5-5.7 7.5Z', colors.denim)
    shape(g, 'M2.5-1L4.7-.9 5.7 7.5 2.7 7.9Z', colors.denimShade, 0)
    if (facing === 'back') {
      shape(g, 'M-4.2-6.7L-2.7-7.1 2.8-.7 1.3.1Z', colors.denimLight)
      shape(g, 'M2.7-7.1L4.2-6.7-1.3.1-2.8-.7Z', colors.denimLight)
      line(g, 'M-4 3Q0 4 4 3M0 3.7L0 7.3', colors.denimShade, .35)
      line(g, 'M-4.3-4.4Q0-3.4 4.3-4.4', colors.shirtShade)
    } else {
      shape(g, 'M-4.4-6.7L-2.9-7-2.4-.1-4-.1Z', colors.denimLight)
      shape(g, 'M2.9-7L4.4-6.7 4-.1 2.4-.1Z', colors.denimLight)
      shape(g, 'M-3.7-1.8L3.7-1.8 4.2 3.3Q0 4-4.2 3.3Z', colors.denim)
      shape(g, 'M-2.4-.5L2.4-.5 2.1 2.2Q0 2.8-2.1 2.2Z', colors.denimShade, .18)
      line(g, 'M-2.1-.1L2.1-.1M-3.8 3L-4.3 6.6M3.8 3L4.3 6.6', colors.seam, .16)
      shape(g, 'M-2.5-8L0-6.6-1.8-4.6-3.3-6.9Z', colors.shirtLight)
      shape(g, 'M2.5-8L0-6.6 1.8-4.6 3.3-6.9Z', colors.shirtLight)
      for (const x of [-3.3, 3.3]) { g.fillStyle = colors.metal; g.fillRect(x - .3, -1.9, .6, .6) }
    }
    shape(g, 'M-5.6 5.9Q0 6.6 5.6 5.9L5.7 7Q0 7.6-5.7 7Z', colors.leather, .18)
    if (facing === 'front') shape(g, 'M-.9 6L.9 6 .9 7.3-.9 7.3Z', colors.metal, .16)
  }
  g.restore()
}

/** 窄袖、卷袖口和牛仔裤重新绘制；皮肤与手掌继续取原角色素材。 */
export function drawMinerSleeve(g: CanvasRenderingContext2D, lower: boolean): void {
  g.save(); g.lineJoin = 'round'
  shape(g, lower ? 'M-1.8-.6L1.8-.6 1.6 2.8-1.7 2.8Z' : 'M-2.1-.5Q0-1.2 2.1-.5L2.3 4.9 1.5 5.8-2 5.8-2.4 3.7Z', colors.shirt)
  shape(g, lower ? 'M.5-.5L1.8-.6 1.6 2.8.7 2.8Z' : 'M.7-.6L2.1-.5 2.3 4.9 1.5 5.8.5 5.8Z', colors.shirtShade, 0)
  line(g, lower ? 'M-1.2.4L-1.3 2' : 'M-1.2.6L-1.3 2.9-1.8 3.6M-.9 4.2L.9 4.6', colors.shirtLight)
  if (lower) shape(g, 'M-1.9 2.1L1.9 2.1 1.8 3.1-1.8 3.1Z', colors.shirtLight, .2)
  g.restore()
}

export function drawMinerLeg(g: CanvasRenderingContext2D, shin: boolean): void {
  g.save(); g.lineJoin = 'round'
  shape(g, shin ? 'M-2.1-.6L2-.6 1.8 4.8-1.8 4.8Z' : 'M-2.3-.5Q0-.8 2.3-.5L2 5.1-2.1 5.1Z', colors.denim)
  shape(g, 'M.8-.5L2-.5 1.8 4.8.7 4.8Z', colors.denimShade, 0)
  line(g, 'M-1.4.2L-1.5 3.8', colors.denimLight, .3)
  line(g, shin ? 'M-1.8 3.5L1.7 3.7M-1.7 4.2L1.7 4.4' : 'M-1.6 3.8L.6 4.1M-1.7 4.4L.2 4.6', colors.denimShade, .25)
  g.restore()
}

export function drawMinerBoot(g: CanvasRenderingContext2D, facing: Facing): void {
  g.save(); g.lineJoin = 'round'
  shape(g, facing === 'side' ? 'M-1.8-.8L1.6-.8 1.8 1.5 2.8 2.4 2.6 3.2-3.5 3.2-3.7 2.2-2 1.2Z' : 'M-1.8-.8L1.8-.8 2.2 1.5 2.2 3Q0 3.7-2.2 3L-2.2 1.5Z', colors.leather)
  line(g, 'M-1.5.1L1.3.1M-1.2 1L1.2 1', colors.leatherLight, .3)
  line(g, facing === 'side' ? 'M-3.2 2.8L2.5 2.8' : 'M-1.8 2.8Q0 3.2 1.8 2.8', colors.ink, .45)
  g.restore()
}

/** 帽檐、壳体及灯座分别分面；侧面灯在前端，背面只保留灯带与铆钉。坐标对应头部原图格。 */
export function drawMinerHelmet(g: CanvasRenderingContext2D, facing: Facing): void {
  g.save(); g.translate(80, 0); g.scale(4, 4); g.lineJoin = 'round'; g.lineCap = 'round'
  if (facing === 'side') {
    shape(g, 'M-11.5 14Q-11.5 7-6.5 6L-.8 5.4Q8.5 5.8 10.3 12.8L11 15.3-9.5 16Z', '#9a9072', .45)
    shape(g, 'M.1 5.5Q8.5 5.8 10.3 12.8L11 15.3 4.2 15.4 3.5 9Z', '#655e58', 0)
    shape(g, 'M-9.8 12Q-9.4 8-6.1 7L-.5 6.6 1.2 8-6.4 9.2Z', '#c6b898', 0)
    shape(g, 'M-11.5 13.7L10.6 13.3 11 15.3-11.4 16.2-15 15.6-15 14.8Z', '#514b4c', .4)
    line(g, 'M-14.2 14.8L-5.7 14.9M2 13.5L9.4 13.5', '#aaa28a', .28)
    shape(g, 'M-11.8 10.7L-8.9 10.6-8.4 15.5-11.6 15.8Z', '#575563', .3)
    shape(g, 'M-12 11.5L-10.5 11.4-10.2 14.7-11.8 14.9Z', '#e5d8ac', .25)
    line(g, 'M-6.8 6.8L-6 12.6', '#776f60', .3)
  } else {
    shape(g, 'M-11.5 14Q-11.2 7.5-6 6L-.6 5.4Q8.8 5.2 11.5 13.8L11.6 15.5Q0 17-11.8 15.5Z', '#9a9072', .45)
    shape(g, 'M2.1 5.7Q9.4 6.7 11.5 13.8L11.6 15.5 5 15.8 4.2 9.9Z', '#6e675b', 0)
    shape(g, 'M-9.9 12Q-8.7 8.1-4.3 7L-.7 6.7-2 8.6-7.3 10Z', '#c6b898', 0)
    line(g, 'M-1.1 5.8L-1.8 12.7M.3 5.8L.8 12.7', '#6a625a', .3)
    shape(g, 'M-12.4 13.8Q0 15 12 13.5L12.8 15.3Q0 18-13 15.7Z', '#514b4c', .4)
    shape(g, 'M-13 15.5Q0 17.5 12.8 15.2L13 16.4Q0 19-13.5 16.7Z', '#877c66', .35)
    line(g, 'M-11.6 15.8Q-6.1 16.7-2 16.5', '#c7b99a', .28)
    if (facing === 'front') {
      shape(g, 'M-2.3 11.3L2.2 11.3 2.8 15.8-2.8 15.8Z', '#535160', .35)
      g.fillStyle = '#a9a697'; g.beginPath(); g.ellipse(0, 13.7, 2, 2, 0, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#e8debb'; g.beginPath(); g.ellipse(-.25, 13.4, 1.3, 1.4, 0, 0, Math.PI * 2); g.fill()
      line(g, 'M-.8 12.6L-.2 12.3', '#faf0d5', .35)
    } else {
      shape(g, 'M-1.7 14.6L1.7 14.6 1.7 16.1-1.7 16.1Z', '#a5a092', .22)
      for (const x of [-8, 8]) { g.fillStyle = '#b1a892'; g.fillRect(x, 14.8, .5, .5) }
    }
  }
  line(g, facing === 'side' ? 'M4.4 10.4L5.4 10M5.5 11.2L6.3 10.9' : 'M5.6 11.1L6.8 10.7M7 12L8 11.6', '#bbb091', .22)
  g.restore()
}
