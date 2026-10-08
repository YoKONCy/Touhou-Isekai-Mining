/**
 * 批次 E · 矿洞光贴图管线
 *
 * 所有光源（矿工帽 / 火把 / 地缝余烬 / 矿簇 / 裂隙）统一进光源表，
 * 每帧合成一张光贴图：
 *   1. 铺环境冷暗罩（径向暗角，清场前后两档）
 *   2. 逐光源 destination-out 挖暗（多灯重叠自然变亮）
 *   3. 光贴图整图盖到世界
 *   4. lighter 逐光源叠暖色染色（冷暖交界 = 质感来源）
 * 纯 Canvas2D，光源数量级别为个位~十几，离屏画布合成无性能压力。
 * UI 是独立 DOM 层，天然不受影响。
 */
import { CONFIG } from '../config'

/** 统一光源描述（不传 facing 即全向灯） */
export interface LightSource {
  x: number
  y: number
  /** 照明半径 */
  r: number
  /** 0~1 灯芯挖暗强度（决定"多亮"） */
  power: number
  /** 染色光色（hex/rgb） */
  color: string
  /** 0~1 染色强度（决定光的颜色倾向） */
  tint: number
  /** 朝向弧度：给出后本灯为锥形投光（帽灯） */
  facing?: number
  /** 锥形全角弧度 */
  cone?: number
  /** 锥形横向椭圆缩放 */
  sx?: number
  sy?: number
  /** 锥形灯的身后余光强度（0 表示无余光；火把传 0） */
  back?: number
  /** 余光半径系数（相对 r） */
  backScale?: number
}

export interface AmbientLevel {
  /** 画面中心 / 边缘的压暗 alpha */
  center: number
  edge: number
  /** 环境罩中心色（'r,g,b' 字符串；默认矿洞冷青蓝 7,12,22；猩红圣堂传暗红酒黑） */
  cc?: string
  /** 环境罩边缘色（默认 3,7,14） */
  ec?: string
}

export class CaveLight {
  private mask: HTMLCanvasElement
  private mctx: CanvasRenderingContext2D

  constructor(private vw: number, private vh: number) {
    this.mask = document.createElement('canvas')
    this.mask.width = vw
    this.mask.height = vh
    this.mctx = this.mask.getContext('2d')!
  }

  /** 画布尺寸变化时重建遮罩 */
  resize(vw: number, vh: number): void {
    if (vw === this.vw && vh === this.vh) return
    this.vw = vw
    this.vh = vh
    this.mask.width = vw
    this.mask.height = vh
  }

  /**
   * 在"已 apply 相机"的世界坐标 ctx 上绘制光照。
   * @param camX/camY 相机左上角世界坐标（取整后传入防 1px 抖）
   * @param zoom 世界→屏幕缩放（相机 cover 自适应）；mask 物理像素仍为屏幕分辨率，
   *             内部按 zoom 变换到世界单位绘制，drawImage 时恰好 1:1 映射、零糊
   * @param ambient 环境压暗档位
   * @param sources 本帧全部光源（帽灯 + 房间光源）
   */
  render(
    ctx: CanvasRenderingContext2D,
    camX: number,
    camY: number,
    zoom: number,
    ambient: AmbientLevel,
    sources: LightSource[]
  ): void {
    const m = this.mctx
    // 离屏 mask 的绘制坐标空间切到世界单位（光源坐标/半径即可直接用世界值）
    m.setTransform(zoom, 0, 0, zoom, 0, 0)
    const visW = this.vw / zoom
    const visH = this.vh / zoom
    m.globalCompositeOperation = 'source-over'
    m.clearRect(0, 0, visW, visH)

    // 1) 环境暗罩：中心微光、四角更暗（默认冷青蓝给暖光留对比；主题房可换暗红酒黑）
    const cx = visW / 2
    const cy = visH / 2
    const vg = m.createRadialGradient(cx, cy, visH * 0.18, cx, cy, visW * 0.62)
    vg.addColorStop(0, `rgba(${ambient.cc ?? '7,12,22'},${ambient.center})`)
    vg.addColorStop(1, `rgba(${ambient.ec ?? '3,7,14'},${ambient.edge})`)
    m.fillStyle = vg
    m.fillRect(0, 0, visW, visH)

    // 2) 逐光源挖暗（mctx 已按 zoom 变换，这里 sx/sy/r 全部直接用世界单位）
    m.globalCompositeOperation = 'destination-out'
    for (const s of sources) {
      const sx = s.x - camX
      const sy = s.y - camY
      if (s.facing !== undefined && s.cone) {
        // 锥形主光：扇形裁剪 + 径向衰减
        m.save()
        m.translate(sx, sy)
        m.rotate(s.facing)
        m.scale(s.sx ?? 1, s.sy ?? 1)
        m.beginPath()
        m.moveTo(0, 0)
        m.arc(0, 0, s.r, -s.cone / 2, s.cone / 2)
        m.closePath()
        m.clip()
        const g = m.createRadialGradient(0, 0, s.r * 0.1, 0, 0, s.r)
        g.addColorStop(0, `rgba(0,0,0,${s.power})`)
        g.addColorStop(0.55, `rgba(0,0,0,${s.power * 0.72})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        m.fillStyle = g
        m.fillRect(-s.r, -s.r, s.r * 2, s.r * 2)
        m.restore()
        // 身后余光（弱圆，弹幕不能凭空消失）
        if (s.back) {
          const br = s.r * (s.backScale ?? 0.6)
          const bg = m.createRadialGradient(sx, sy, br * 0.1, sx, sy, br)
          bg.addColorStop(0, `rgba(0,0,0,${s.back})`)
          bg.addColorStop(1, 'rgba(0,0,0,0)')
          m.fillStyle = bg
          m.fillRect(sx - br, sy - br, br * 2, br * 2)
        }
      } else {
        // 全向灯：火把/地缝/矿簇
        const g = m.createRadialGradient(sx, sy, s.r * 0.08, sx, sy, s.r)
        g.addColorStop(0, `rgba(0,0,0,${s.power})`)
        g.addColorStop(0.5, `rgba(0,0,0,${s.power * 0.7})`)
        g.addColorStop(1, 'rgba(0,0,0,0)')
        m.fillStyle = g
        m.fillRect(sx - s.r, sy - s.r, s.r * 2, s.r * 2)
      }
    }

    // 3) 压暗层盖到世界（世界单位矩形；ctx 已带相机 zoom，落屏恰好铺满视口）
    m.globalCompositeOperation = 'source-over'
    m.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.mask, camX, camY, visW, visH)

    // 4) 暖光染色（加色混合：冷岩面转暖，火光过处物体显色）
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    for (const s of sources) {
      if (s.tint <= 0) continue
      ctx.save()
      ctx.translate(s.x, s.y)
      if (s.facing !== undefined && s.cone) {
        ctx.rotate(s.facing)
        ctx.scale(s.sx ?? 1, s.sy ?? 1)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.arc(0, 0, s.r, -s.cone / 2, s.cone / 2)
        ctx.closePath()
        ctx.clip()
      }
      const g = ctx.createRadialGradient(0, 0, s.r * 0.08, 0, 0, s.r)
      g.addColorStop(0, this.withAlpha(s.color, s.tint))
      g.addColorStop(0.55, this.withAlpha(s.color, s.tint * 0.5))
      g.addColorStop(1, this.withAlpha(s.color, 0))
      ctx.fillStyle = g
      ctx.fillRect(-s.r, -s.r, s.r * 2, s.r * 2)
      ctx.restore()
    }
    ctx.restore()
  }

  /** hex(#rrggbb) + alpha → rgba 字符串 */
  private withAlpha(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16)
    const r = (n >> 16) & 255
    const g = (n >> 8) & 255
    const b = n & 255
    return `rgba(${r},${g},${b},${alpha})`
  }
}

/**
 * 便捷构造：穿越者可视域（批次 F⑤ 语义重定）。
 * 它不再是"矿工帽发光实体"——角色身上没有任何发光物——而是穿越者
 * 在黑暗洞窟中能稳定辨识环境的中性还原光圈：冷白微蓝（#cfd8ff）、
 * 几乎不染倾向色，只负责把环境冷罩挖开、还原物体本色；
 * 真正的暖色叙事光仍由火把/地缝等环境光源提供。
 * 半径/挖暗强度是玩法可视范围，保持不动；未来更黑的地图档位或
 * 照明饰品可在半径、功率与附加光源上扩展。
 */
export function makeLampLight(px: number, py: number): LightSource {
  const L = CONFIG.art.lamp
  return {
    x: px,
    y: py - 2, // 光圈中心≈人体中心（不再是"头顶帽灯"）
    r: L.radius,
    power: L.power,
    color: '#cfd8ff', // 中性冷白：还原色，不投暖
    tint: 0.05 // 极弱倾向（L.warm 配置保留给旧管线/饰品口）
  }
}
