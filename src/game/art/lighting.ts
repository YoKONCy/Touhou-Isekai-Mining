/**
 * 批次 E · 矿洞光贴图管线
 *
 * 所有光源（矿工帽 / 火把 / 地缝余烬 / 矿簇 / 裂隙）统一进光源表，
 * 每帧合成一张光贴图：
 *   1. 铺环境冷暗罩（径向暗角，清场前后两档）
 *   2. 逐光源 destination-out 挖暗（多灯重叠自然变亮）
 *   3. 光贴图整图盖到世界
 *   4. 将暖色光合成到独立贴图，再一次性叠到世界
 * 柔光贴图独立于角色分辨率；状态未变化的显示帧直接复用合成结果。
 * UI 是独立 DOM 层，天然不受影响。
 */
import { CONFIG } from '../config'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { drawSprite, type RasterSprite } from '../../core/rendering/SpriteCache'
import { profiler } from '../../core/performance/Profiler'
import { displaySettings, compactLayout } from '../../browser/display'
const LIGHT_STOPS:readonly [number,string][]=[[0,'rgba(0,0,0,1)'],[.5,'rgba(0,0,0,.7)'],[1,'rgba(0,0,0,0)']]
const CONE_STOPS:readonly [number,string][]=[[0,'rgba(0,0,0,1)'],[.55,'rgba(0,0,0,.72)'],[1,'rgba(0,0,0,0)']]
const BACK_STOPS:readonly [number,string][]=[[0,'rgba(0,0,0,1)'],[1,'rgba(0,0,0,0)']]
function stampAt(g:CanvasRenderingContext2D,stamp:RasterSprite,x:number,y:number,r:number,power:number):void {
  g.save();g.imageSmoothingEnabled=true;g.translate(x,y);g.scale(r/128,r/128);g.globalAlpha*=power;drawSprite(g,stamp);g.restore()
}

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
  private tint: HTMLCanvasElement
  private tctx: CanvasRenderingContext2D
  private density = 1
  private frameReady = false
  private lastCamX = NaN
  private lastCamY = NaN
  private lastZoom = NaN
  private lastAmbient = ''
  private lastSources: LightSource[] = []
  private drawnLights = 0
  private ambientKey=''
  private ambientGradient:CanvasGradient|null=null
  private bufferLimit = 960

  constructor(private vw: number, private vh: number) {
    this.mask = document.createElement('canvas')
    this.tint = document.createElement('canvas')
    this.ambientKey=''
    this.mctx = this.mask.getContext('2d')!
    this.tctx = this.tint.getContext('2d')!
    this.resizeBuffers()
  }

  /** 渐变光照无需跟随高分屏超采样，场景与人物仍使用原来的清晰度。 */
  private resizeBuffers(): void {
    this.bufferLimit = displaySettings.quality==='low'?480:compactLayout.value&&displaySettings.quality!=='high'?640:960
    this.density = Math.min(1, this.bufferLimit / Math.max(1, this.vw, this.vh))
    this.mask.width = this.tint.width = Math.max(1, Math.ceil(this.vw * this.density))
    this.mask.height = this.tint.height = Math.max(1, Math.ceil(this.vh * this.density))
    this.ambientGradient = null
    this.frameReady = false
  }

  /** 画布尺寸变化时重建遮罩 */
  resize(vw: number, vh: number): void {
    const limit=displaySettings.quality==='low'?480:compactLayout.value&&displaySettings.quality!=='high'?640:960
    if (vw === this.vw && vh === this.vh && limit===this.bufferLimit) return
    this.vw = vw
    this.vh = vh
    this.resizeBuffers()
  }

  private sameSources(sources: readonly LightSource[]): boolean {
    if (sources.length !== this.lastSources.length) return false
    for (let i = 0; i < sources.length; i++) {
      const a = sources[i]!, b = this.lastSources[i]!
      if (a.x !== b.x || a.y !== b.y || a.r !== b.r || a.power !== b.power || a.color !== b.color || a.tint !== b.tint
        || a.facing !== b.facing || a.cone !== b.cone || a.sx !== b.sx || a.sy !== b.sy || a.back !== b.back || a.backScale !== b.backScale) return false
    }
    return true
  }

  /**
   * 在"已 apply 相机"的世界坐标 ctx 上绘制光照。
   * @param camX/camY 相机左上角世界坐标（取整后传入防 1px 抖）
   * @param zoom 世界→屏幕缩放（相机 cover 自适应）；柔光独立缩放，照明范围不变
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
    const started=profiler.start()
    const m = this.mctx, tint = this.tctx
    const visW = this.vw / zoom
    const visH = this.vh / zoom
    const key=`${zoom}:${this.vw}:${this.vh}:${ambient.cc}:${ambient.ec}:${ambient.center}:${ambient.edge}`
    if (this.frameReady && this.lastCamX === camX && this.lastCamY === camY && this.lastZoom === zoom && this.lastAmbient === key && this.sameSources(sources)) {
      this.drawLayers(ctx, camX, camY, visW, visH)
      profiler.count('lights', this.drawnLights); profiler.increment('lightReuses'); profiler.end('lighting', started)
      return
    }
    this.frameReady = false
    // 离屏 mask 的绘制坐标空间切到世界单位（光源坐标/半径即可直接用世界值）
    const rasterZoom = zoom * this.density
    m.setTransform(1, 0, 0, 1, 0, 0)
    m.globalCompositeOperation = 'source-over'
    m.clearRect(0, 0, this.mask.width, this.mask.height)
    m.setTransform(rasterZoom, 0, 0, rasterZoom, 0, 0)
    tint.setTransform(1, 0, 0, 1, 0, 0)
    tint.clearRect(0, 0, this.tint.width, this.tint.height)
    tint.setTransform(rasterZoom, 0, 0, rasterZoom, 0, 0)
    tint.globalCompositeOperation = 'lighter'

    // 1) 环境暗罩：中心微光、四角更暗（默认冷青蓝给暖光留对比；主题房可换暗红酒黑）
    const cx = visW / 2
    const cy = visH / 2
    if(this.ambientKey!==key||!this.ambientGradient){
      const vg=m.createRadialGradient(cx,cy,visH*.18,cx,cy,visW*.62)
      vg.addColorStop(0,`rgba(${ambient.cc??'7,12,22'},${ambient.center})`)
      vg.addColorStop(1,`rgba(${ambient.ec??'3,7,14'},${ambient.edge})`)
      this.ambientKey=key;this.ambientGradient=vg
    }
    m.fillStyle = this.ambientGradient
    m.fillRect(0, 0, visW, visH)

    // 2) 逐光源挖暗（mctx 已按 zoom 变换，这里 sx/sy/r 全部直接用世界单位）
    m.globalCompositeOperation = 'destination-out'
    const mask=radialStamp('light:round',.08,LIGHT_STOPS),cone=radialStamp('light:cone',.1,CONE_STOPS),back=radialStamp('light:back',.1,BACK_STOPS)
    let drawn=0
    for (const s of sources) {
      const sx = s.x - camX
      const sy = s.y - camY
      const extent=s.r*Math.max(1,s.sx??1,s.sy??1)
      if(sx+extent<0||sy+extent<0||sx-extent>visW||sy-extent>visH)continue
      drawn++
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
        stampAt(m,cone,0,0,s.r,s.power)
        m.restore()
        // 身后余光（弱圆，弹幕不能凭空消失）
        if (s.back) {
          const br = s.r * (s.backScale ?? 0.6)
          stampAt(m,back,sx,sy,br,s.back)
        }
      } else {
        // 全向灯：火把/地缝/矿簇
        stampAt(m,mask,sx,sy,s.r,s.power)
      }
    }

    // 暖光集中在低分辨率光照贴图合成，避免每盏灯重复写入高分屏主画布。
    for (const s of sources) {
      if (s.tint <= 0) continue
      const extent=s.r*Math.max(1,s.sx??1,s.sy??1)
      if(s.x+extent<camX||s.y+extent<camY||s.x-extent>camX+visW||s.y-extent>camY+visH)continue
      tint.save()
      tint.translate(s.x - camX, s.y - camY)
      if (s.facing !== undefined && s.cone) {
        tint.rotate(s.facing)
        tint.scale(s.sx ?? 1, s.sy ?? 1)
        tint.beginPath()
        tint.moveTo(0, 0)
        tint.arc(0, 0, s.r, -s.cone / 2, s.cone / 2)
        tint.closePath()
        tint.clip()
      }
      const stamp=radialStamp(`light:tint:${s.color}`,.08,[[0,this.withAlpha(s.color,1)],[.55,this.withAlpha(s.color,.5)],[1,this.withAlpha(s.color,0)]])
      stampAt(tint,stamp,0,0,s.r,s.tint)
      tint.restore()
    }
    this.lastCamX = camX; this.lastCamY = camY; this.lastZoom = zoom; this.lastAmbient = key
    for (let i = 0; i < sources.length; i++) {
      if (this.lastSources[i]) Object.assign(this.lastSources[i]!, sources[i])
      else this.lastSources[i] = { ...sources[i]! }
      // 可选参数可能由有值变为省略，不能残留上一次的锥形光参数。
      const remembered = this.lastSources[i]!, source = sources[i]!
      remembered.facing = source.facing; remembered.cone = source.cone
      remembered.sx = source.sx; remembered.sy = source.sy; remembered.back = source.back; remembered.backScale = source.backScale
    }
    this.lastSources.length = sources.length
    this.drawnLights = drawn
    this.frameReady = true
    this.drawLayers(ctx, camX, camY, visW, visH)
    profiler.count('lights',drawn);profiler.end('lighting',started)
  }

  private drawLayers(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
    ctx.save()
    ctx.imageSmoothingEnabled = true
    // 末列与末行只取实际视口覆盖的像素，避免 ceil 后出现半像素伸缩。
    const sw = this.vw * this.density, sh = this.vh * this.density
    ctx.drawImage(this.mask, 0, 0, sw, sh, x, y, width, height)
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(this.tint, 0, 0, sw, sh, x, y, width, height)
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
 * 基础半径与挖暗强度来自场景配置；照明饰品只乘本玩家的明亮半径，
 * 不改环境光源与其他玩家的基础参数。
 */
export function makeLampLight(px: number, py: number, radiusMultiplier = 1): LightSource {
  const L = CONFIG.art.lamp
  return {
    x: px,
    y: py - 2, // 光圈中心≈人体中心（不再是"头顶帽灯"）
    r: L.radius * radiusMultiplier,
    power: L.power,
    color: '#cfd8ff', // 中性冷白：还原色，不投暖
    tint: 0.05 // 极弱倾向（L.warm 配置保留给旧管线/饰品口）
  }
}
