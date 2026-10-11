import { bakeSprite,SpriteCache,type RasterSprite } from './SpriteCache'
const glyphs=new SpriteCache(512,4*1024*1024)
let measure:CanvasRenderingContext2D|null=null
let fontEpoch=0
let watchingFonts=false
/** 字体完成加载后换缓存代号，避免永久沿用首次测量时的替代字体。 */
export function fontCacheKey():string {
  if(typeof document==='undefined')return '0'
  const fonts=document.fonts
  if(fonts&&!watchingFonts){watchingFonts=true;const invalidate=()=>{fontEpoch++};fonts.addEventListener('loadingdone',invalidate);fonts.addEventListener('loadingerror',invalidate)}
  return `${fontEpoch}:${fonts?.status}`
}
/** 描边文字按内容、字体和颜色复用贴图，动效仍由原来的位移与旋转驱动。 */
export function textStamp(text:string,font:string,color:string,stroke:string,lineWidth:number):RasterSprite {
  const key=`${text}:${font}:${color}:${stroke}:${lineWidth}:${fontCacheKey()}`
  return glyphs.get(key,()=>{
    if(!measure)measure=document.createElement('canvas').getContext('2d')!
    measure.font=font;const metrics=measure.measureText(text),width=Math.ceil(metrics.width)+8,ascent=Math.ceil(metrics.actualBoundingBoxAscent||16),descent=Math.ceil(metrics.actualBoundingBoxDescent||3)
    return bakeSprite(-width/2,-ascent-4,width,ascent+descent+8,g=>{g.font=font;g.textAlign='center';g.lineJoin='round';g.lineWidth=lineWidth;g.strokeStyle=stroke;g.fillStyle=color;if(lineWidth>0)g.strokeText(text,0,0);g.fillText(text,0,0)})
  })
}
