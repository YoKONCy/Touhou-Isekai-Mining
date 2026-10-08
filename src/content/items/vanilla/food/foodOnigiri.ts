/**
 * 官方物品：矿洞饭团（简单内容 = 单文件：数据 + 背包图标 + 地面掉落外观）
 * 地面外观不使用引擎通用碎晶，自带像素阶梯三角饭团绘制器。
 */
import { FOOD_ONIGIRI_ID } from '../ids'
import { svgIcon, type GroundDropView, type ItemDef } from '../../types'

const ICON = svgIcon(`<svg viewBox="0 0 48 48" width="100%" height="100%" shape-rendering="geometricPrecision">
  <!-- 消耗品：像素饭团（阶梯三角米身 + 整像素海苔腰带 + 方块米粒） -->
  <!-- 米身：左右对称的阶梯三角轮廓 -->
  <polygon
    points="24,6 26,6 28,10 31,10 33,14 36,18 36,23 35,23 35,31 32,31 32,35 28,35 28,40 20,40 20,35 16,35 16,31 13,31 13,23 12,23 12,18 15,14 17,14 17,10 20,10 22,6"
    fill="#efe8d6"
    stroke="#4a3f31"
    stroke-width="1.6"
    stroke-linejoin="miter"
  />
  <!-- 左受光米斜面 -->
  <polygon points="24,6 22,6 20,10 17,10 15,14 12,18 12,23 24,23" fill="#f8f2e4" />
  <!-- 右暗米斜面 -->
  <polygon points="24,6 26,6 28,10 31,10 33,14 36,18 36,23 24,23" fill="#ddd4bf" />
  <!-- 海苔腰带（整像素硬边，沿台阶收分） -->
  <polygon points="12,23 36,23 35,31 13,31" fill="#2b2927" />
  <rect x="13.5" y="24.2" width="21" height="1.7" fill="#3d3a36" />
  <rect x="13.5" y="29.2" width="20.5" height="1.8" fill="#1c1b1a" />
  <!-- 腰带下露出的右暗米饭 -->
  <polygon points="24,31 35,31 32,35 28,35 28,40 24,40" fill="#ddd4bf" />
  <!-- 方块米粒（受光面两粒） -->
  <rect x="18.6" y="15" width="2.1" height="2.1" fill="#ffffff" />
  <rect x="27.4" y="11.6" width="1.7" height="1.7" fill="#fbf7ec" />
</svg>`)

/**
 * 地面饭团掉落物：像素阶梯三角米身 + 整像素海苔腰带
 * （与背包图标/矿石碎粒同语言；自 Drop.drawOnigiri 迁入，归属内容层）
 */
function drawGroundOnigiri({ ctx, x, y, r }: GroundDropView): void {
  const s = r + 1
  ctx.save()
  ctx.translate(x, y)
  ctx.lineJoin = 'miter'

  // 右半边台阶点（顶点 → 底中），左半边镜像
  const right: Array<[number, number]> = [
    [0, -s - 1],
    [s * 0.3, -s * 0.62],
    [s * 0.58, -s * 0.22],
    [s * 0.94, s * 0.26],
    [s * 0.82, s * 0.64],
    [s * 0.46, s * 0.92],
    [0, s + 1]
  ]
  const trace = (): void => {
    ctx.beginPath()
    right.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
    for (let i = right.length - 2; i >= 1; i--) ctx.lineTo(-right[i][0], right[i][1])
    ctx.closePath()
  }
  // 米身（ink 厚描边）
  trace()
  ctx.fillStyle = '#efe8d6'
  ctx.strokeStyle = '#241a12'
  ctx.lineWidth = 1.6
  ctx.fill()
  ctx.stroke()
  // 左受光斜面（顶点→左轮廓→中线回顶）
  ctx.fillStyle = '#f8f2e4'
  ctx.beginPath()
  ctx.moveTo(0, -s - 1)
  for (let i = 1; i < right.length; i++) ctx.lineTo(-right[i][0], right[i][1])
  ctx.lineTo(0, s + 1)
  ctx.closePath()
  ctx.fill()
  // 右暗斜面
  ctx.fillStyle = '#ddd4bf'
  ctx.beginPath()
  ctx.moveTo(0, -s - 1)
  for (let i = 1; i < right.length; i++) ctx.lineTo(right[i][0], right[i][1])
  ctx.lineTo(0, s + 1)
  ctx.closePath()
  ctx.fill()
  // 海苔腰带（整像素硬边梯形）
  ctx.fillStyle = '#2b2927'
  ctx.beginPath()
  ctx.moveTo(-s * 0.88, s * 0.16)
  ctx.lineTo(s * 0.88, s * 0.16)
  ctx.lineTo(s * 0.74, s * 0.74)
  ctx.lineTo(-s * 0.74, s * 0.74)
  ctx.closePath()
  ctx.fill()
  // 海苔横纹（亮/暗各一档）
  ctx.fillStyle = '#3d3a36'
  ctx.fillRect(-s * 0.78, s * 0.24, s * 1.56, Math.max(1, s * 0.09))
  ctx.fillStyle = '#1c1b1a'
  ctx.fillRect(-s * 0.72, s * 0.6, s * 1.44, Math.max(1, s * 0.1))
  // 方块米粒（受光面两粒）
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(-s * 0.34, -s * 0.42, Math.max(1.4, s * 0.18), Math.max(1.4, s * 0.18))
  ctx.fillStyle = '#fbf7ec'
  ctx.fillRect(s * 0.12, -s * 0.7, Math.max(1.2, s * 0.15), Math.max(1.2, s * 0.15))
  ctx.restore()
}

const def: ItemDef = {
  id: FOOD_ONIGIRI_ID,
  kind: 'consumable',
  tier: 1,
  color: '#f2ece0',
  hi: '#ffffff',
  text: '#9fe6a8',
  maxStack: 10,
  icon: ICON,
  consume: { heal: 35 }, material: true,
  ground: drawGroundOnigiri,
  tags: ['consumable', 'food']
}

export default def
