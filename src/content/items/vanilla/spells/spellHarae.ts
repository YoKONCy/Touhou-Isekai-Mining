/**
 * 官方物品：符札·祓（简单内容 = 单文件：数据 + 程序化图标）
 * 以自身为中心连续绽开两波阳光色驱邪光脉（间隔 0.4s）：
 * 每波范围伤害+径向击退+弹幕僵直+消弹。按 E 释放。
 */
import { SPELL_HARAE_ID } from '../ids'
import { stats } from './spellHaraeStats'
import { svgIcon, type ItemDef } from '../../types'

const ICON = svgIcon(`<svg viewBox="0 0 48 48" width="100%" height="100%" shape-rendering="geometricPrecision">
  <!-- 符卡：像素风符札（锯齿纸边 + 朱红方印 + 方块笔画，和矿石同语言） -->
  <!-- 纸身：顶部两枚小折齿的不规则纸边 -->
  <polygon
    points="14,8 16,5 20,5 20,8 28,8 28,5 32,5 34,8 35,8 35,41 33,43 15,43 13,41 13,8"
    fill="#e8d9a8"
    stroke="#5a3f1c"
    stroke-width="1.6"
    stroke-linejoin="miter"
  />
  <!-- 左受光纸棱 / 右暗纸棱 -->
  <polygon points="14,8 16,5 20,5 19.4,8 18,8 18,42 15,43 13,41 13,8" fill="#fbf2d2" />
  <polygon points="32,5 34,8 35,8 35,41 33,43 30,43 30,8 28,8 28,5" fill="#dcc896" />
  <!-- 顶部穿绳小孔 -->
  <rect x="22.6" y="9.4" width="2.8" height="2.8" fill="#6b4f26" />
  <rect x="23.2" y="9.8" width="1" height="1" fill="#a8843f" />
  <!-- 朱红方印：红方块 + 右下暗边厚度 + 纸色十字印纹 + 四角留口 -->
  <rect x="19" y="14" width="10" height="10" fill="#c04438" />
  <rect x="19" y="22.4" width="10" height="1.6" fill="#9c3028" />
  <rect x="27.4" y="14" width="1.6" height="8.4" fill="#9c3028" />
  <rect x="23" y="16.4" width="2" height="5.2" fill="#e8d9a8" />
  <rect x="21.4" y="18" width="5.2" height="2" fill="#e8d9a8" />
  <rect x="19.7" y="14.7" width="1.6" height="1.6" fill="#e8d9a8" />
  <rect x="26.7" y="14.7" width="1.6" height="1.6" fill="#e8d9a8" />
  <rect x="19.7" y="21.7" width="1.6" height="1.6" fill="#e8d9a8" />
  <rect x="26.7" y="21.7" width="1.6" height="1.6" fill="#e8d9a8" />
  <!-- 符文笔划：错落方块横线（墨棕为主，间一朱笔） -->
  <rect x="17.5" y="28.5" width="13" height="1.9" fill="#7a5226" />
  <rect x="19.5" y="31.6" width="9.5" height="1.7" fill="#7a5226" />
  <rect x="17.5" y="34.6" width="11.5" height="1.7" fill="#c04438" />
  <rect x="21" y="37.6" width="6.5" height="1.6" fill="#7a5226" />
  <!-- 右下折角暗块 -->
  <polygon points="30,43 33,43 35,41 35,37" fill="#cbb481" />
</svg>`)

const def: ItemDef = {
  id: SPELL_HARAE_ID,
  kind: 'spellcard',
  ...stats,
  color: '#e8d9a8',
  hi: '#fff7d8',
  text: '#ffe9a8',
  icon: ICON,
  tags: ['spellcard']
}

export default def
