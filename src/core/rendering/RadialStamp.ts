import { bakeSprite, SpriteCache, type RasterSprite } from './SpriteCache'
const stamps=new SpriteCache(64,4*1024*1024)
/** 渐变形状与动态强度分离，移动和呼吸只改变变换及透明度。 */
export function radialStamp(key:string,inner:number,stops:readonly [number,string][]):RasterSprite {
  return stamps.get(key,()=>bakeSprite(-128,-128,256,256,g=>{
    const gradient=g.createRadialGradient(0,0,128*inner,0,0,128)
    for(const [position,color] of stops)gradient.addColorStop(position,color)
    g.fillStyle=gradient;g.fillRect(-128,-128,256,256)
  },1))
}
