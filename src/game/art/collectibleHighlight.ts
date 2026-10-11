import { bakeSprite, drawSprite, SpriteCache } from '../../core/rendering/SpriteCache'
import { mineAssetsReady } from './mineAssets'

const overlays = new SpriteCache(512, 4 * 1024 * 1024)
const identities=new WeakMap<object,number>()
let sequence=0
interface CollectibleBounds {x:number;y:number;width:number;height:number}

/** 采矿、采集和掉落物统一装饰器；内容绘制器只负责形状，无需知道滤色和微光。 */
export function renderCollectible(g:CanvasRenderingContext2D,entity:object,bounds:CollectibleBounds,draw:(ctx:CanvasRenderingContext2D)=>void,maskDraw=draw):void {
  g.save();g.globalCompositeOperation='source-over';draw(g);g.restore()
  let identity=identities.get(entity)
  if(identity===undefined){identity=++sequence;identities.set(entity,identity)}
  const {x,y,width,height}=bounds
  drawCollectibleHighlight(g,`${identity}:${mineAssetsReady()?1:0}`,x,y,width,height,c=>{
    c.save();c.translate(-x,-y);maskDraw(c);c.restore()
  })
}

/** 可采集贴图共享浅暖滤色与轮廓微光；遮罩只烘焙一次，不逐帧使用模糊滤镜。 */
export function drawCollectibleHighlight(g: CanvasRenderingContext2D, key: string, x: number, y: number, width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void): void {
  const w=Math.max(2,Math.round(width/2)*2),h=Math.max(2,Math.round(height/2)*2)
  const identity = `${key}:${w}:${h}`
  const tint = overlays.get(`tint:${identity}`, () => bakeSprite(0, 0, w, h, ctx => {
    ctx.save();ctx.scale(w/width,h/height)
    paint(ctx)
    ctx.restore()
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = '#f2edc8'
    ctx.fillRect(0, 0, w, h)
  },1))
  const glow = overlays.get(`glow:${identity}`, () => bakeSprite(-7, -7, w + 14, h + 14, ctx => {
    ctx.shadowColor = '#efdda0'; ctx.shadowBlur = 9
    drawSprite(ctx, tint)
    // 仅保留轮廓外侧光晕，不能把整件素材再覆盖成一块亮白色。
    ctx.shadowBlur=0;ctx.globalCompositeOperation='destination-out';drawSprite(ctx,tint)
  },1))
  g.save(); g.translate(x, y);g.scale(width/w,height/h)
  const alpha = g.globalAlpha
  g.globalCompositeOperation='screen'
  g.globalAlpha = alpha * .12; drawSprite(g, tint)
  g.globalAlpha = alpha * .45; drawSprite(g, glow)
  g.restore()
}
