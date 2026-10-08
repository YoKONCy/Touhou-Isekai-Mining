/**
 * 官方物品：火柴（剧情道具 = 单文件：数据 + 程序化图标 + 地面掉落外观）
 * 序章随锈镐一起捡到，只进背包承担叙事，当前版本不做点火消耗机制。
 */
import { MATCHES_ID } from '../ids'
import { svgIcon, type GroundDropView, type ItemDef } from '../../types'

const ICON = svgIcon(`<svg viewBox="0 0 48 48" width="100%" height="100%" shape-rendering="geometricPrecision">
  <!-- 火柴盒：米黄纸盒 + 红标签 + 右侧磷面，盒口露出三根红头火柴 -->
  <!-- 火柴杆（从盒口向上错落伸出） -->
  <rect x="15.6" y="12.5" width="1.7" height="11.5" fill="#3a2c1d" />
  <rect x="21.6" y="9" width="1.7" height="15" fill="#4a3726" />
  <rect x="27.6" y="14" width="1.7" height="10" fill="#3a2c1d" />
  <!-- 火柴红头 -->
  <circle cx="16.4" cy="11.6" r="2.5" fill="#c8472f" stroke="#7a2417" stroke-width="0.9" />
  <circle cx="22.4" cy="8.2" r="2.7" fill="#d8543a" stroke="#7a2417" stroke-width="0.9" />
  <circle cx="28.4" cy="13.1" r="2.4" fill="#c8472f" stroke="#7a2417" stroke-width="0.9" />
  <circle cx="21.7" cy="7.4" r="0.8" fill="#f4a089" />
  <!-- 盒身 -->
  <rect x="11.5" y="23" width="25" height="14.5" fill="#e6d6a2" stroke="#4a3f31" stroke-width="1.6" />
  <!-- 盒顶受光面 -->
  <rect x="11.5" y="23" width="25" height="2.6" fill="#f4e9c4" />
  <!-- 红色标签条 -->
  <rect x="11.5" y="28.2" width="21.2" height="4.6" fill="#b7432f" />
  <rect x="13" y="29.2" width="3" height="1.1" fill="#e07a60" />
  <rect x="18" y="29.2" width="3" height="1.1" fill="#e07a60" />
  <rect x="23" y="29.2" width="3" height="1.1" fill="#e07a60" />
  <!-- 右侧磷面擦条 -->
  <rect x="32.7" y="23" width="3.8" height="14.5" fill="#7c5a34" />
  <rect x="33.2" y="24" width="0.9" height="12.5" fill="#96704a" />
  <!-- 盒底暗面 -->
  <rect x="11.5" y="34.4" width="25" height="3.1" fill="#c9b783" />
</svg>`)

/** 地面掉落物：小火柴盒（盒身 + 红标签 + 磷面 + 盒口两根红头火柴） */
function drawGroundMatches({ ctx, x, y, r }: GroundDropView): void {
  const w = r * 1.9 // 盒宽
  const h = r * 1.15 // 盒高
  ctx.save()
  ctx.translate(x, y)
  ctx.lineJoin = 'round'

  // 盒口火柴：杆 + 红头（两根错落）
  ctx.strokeStyle = '#3a2c1d'
  ctx.lineWidth = Math.max(1, r * 0.16)
  ctx.beginPath()
  ctx.moveTo(-w * 0.22, -h * 0.5)
  ctx.lineTo(-w * 0.22, -h * 0.5 - r * 0.62)
  ctx.moveTo(w * 0.12, -h * 0.5)
  ctx.lineTo(w * 0.12, -h * 0.5 - r * 0.82)
  ctx.stroke()
  ctx.fillStyle = '#c8472f'
  ctx.beginPath()
  ctx.arc(-w * 0.22, -h * 0.5 - r * 0.62, r * 0.2, 0, Math.PI * 2)
  ctx.arc(w * 0.12, -h * 0.5 - r * 0.82, r * 0.22, 0, Math.PI * 2)
  ctx.fill()

  // 盒身
  ctx.fillStyle = '#e6d6a2'
  ctx.strokeStyle = '#241a12'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.rect(-w / 2, -h / 2, w, h)
  ctx.fill()
  ctx.stroke()
  // 红标签条
  ctx.fillStyle = '#b7432f'
  const by = -h * 0.08
  ctx.fillRect(-w / 2, by, w * 0.82, h * 0.32)
  // 右侧磷面
  ctx.fillStyle = '#7c5a34'
  ctx.fillRect(w / 2 - w * 0.18, -h / 2, w * 0.18, h)
  // 盒顶受光 + 盒底暗面
  ctx.fillStyle = 'rgba(255,248,214,0.55)'
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.16)
  ctx.fillStyle = 'rgba(90,66,32,0.28)'
  ctx.fillRect(-w / 2, h / 2 - h * 0.2, w, h * 0.2)
  ctx.restore()
}

const def: ItemDef = {
  id: MATCHES_ID,
  kind: 'misc',
  tier: 1,
  color: '#e6d6a2',
  hi: '#d8543a',
  text: '#e8c98a',
  maxStack: 1,
  icon: ICON,
  ground: drawGroundMatches,
  tags: ['quest', 'matches']
}

export default def
