import type { PlayerPose } from './skeleton'
import { drawRumiaStudyBodyPose } from './rumiaStyleStudy'

/** 图片锚点取颈根，不能用含蝴蝶结的整体包围盒中心替代人物中心。 */
export interface RumiaApprovedHead {
  image: CanvasImageSource
  width: number
  height: number
  anchorX: number
  anchorY: number
}
export interface RumiaApprovedHeads {
  front: RumiaApprovedHead
  side: RumiaApprovedHead
  back: RumiaApprovedHead
}

/** 背面补绘沿用确认版的发型轮廓，重新分束遮住正面五官。坐标对应原始头图。 */
export function drawRumiaApprovedBackHead(g: CanvasRenderingContext2D, front: CanvasImageSource): void {
  g.save(); g.drawImage(front, 0, 0)
  g.lineJoin = 'round'; g.lineCap = 'round'
  const fill = (d: string, color: string, outline = false): void => {
    const path = new Path2D(d)
    g.fillStyle = color; g.fill(path)
    if (outline) { g.strokeStyle = '#70515a'; g.lineWidth = 5; g.stroke(path) }
  }
  fill('M91 143Q133 99 225 129Q281 146 310 204L323 265L309 294L315 314L285 307L280 337L254 329L243 355L217 345L197 360L174 347L151 358L137 338L115 346L104 322L88 316L92 289L74 271L82 237Z', '#ffdfad')
  fill('M263 147Q305 186 297 249L286 293L280 327L258 319L243 348L225 337Q248 278 245 244Q266 205 263 147Z', '#c99683')
  fill('M137 124Q118 177 127 225L137 266L125 303L128 335L109 319L111 290L96 271Q98 225 108 187Z', '#d6ac8d')
  fill('M196 137Q171 195 182 252L194 282L175 337L153 346L155 318Q171 268 156 222Q148 180 171 138Z', '#e8bf92')
  fill('M112 145Q97 181 94 217L103 211L115 179L128 148Z', '#fff0cd')
  fill('M145 140Q132 188 146 240L156 249L151 210Q141 176 159 137Z', '#fff0cd')
  fill('M211 153Q190 199 205 251L216 259L212 224Q206 188 223 159Z', '#ffe9bf')
  fill('M270 187Q283 218 272 251L261 265L269 227Z', '#e7bd94')
  g.strokeStyle = '#ad7b74'; g.lineWidth = 3
  for (const d of ['M139 154Q126 211 147 266L141 307', 'M185 149Q171 208 193 276L180 332', 'M246 175Q235 236 250 270L238 321', 'M286 227L280 275L269 298']) g.stroke(new Path2D(d))
  g.restore()
}

/** 已选 C 风格的预览组合：采用确认过的头脸，行走使用正式动画器的完整骨角。 */
export function drawRumiaApprovedStudy(g: CanvasRenderingContext2D, x: number, y: number, pose: PlayerPose, heads: RumiaApprovedHeads): void {
  g.save(); g.translate(x + pose.rootX * .9, y + pose.rootY * .9); g.scale(.9, .9)
  drawRumiaStudyBodyPose(g, 0, 0, pose)
  const head = pose.dir === 'up' ? heads.back : pose.dir === 'left' || pose.dir === 'right' ? heads.side : heads.front
  const scale = 25.5 / head.height
  g.save(); if (pose.dir === 'right') g.scale(-1, 1)
  g.translate(0, -11.2)
  g.rotate(Math.max(-.018, Math.min(.018, (pose.bone.head + Math.PI/2)*.3)))
  // 高清参考只在采样时缩小；输出图集按统一的两倍像素网格显示。
  g.imageSmoothingEnabled = true
  g.drawImage(head.image, -head.anchorX*scale, -head.anchorY*scale, head.width*scale, head.height*scale)
  g.restore(); g.restore()
}
