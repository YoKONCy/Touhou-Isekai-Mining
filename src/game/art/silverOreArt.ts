import { svgIcon } from '../../content/items/types'
import { SpriteCache,bakeSprite,drawSprite } from '../../core/rendering/SpriteCache'

interface Layer {d:string;fill?:string;stroke?:string;width?:number}
const OUTLINE='M-20 1L-16-11L-7-18L7-17L18-7L21 6L12 16L-3 19L-16 12Z'
/** 深灰紫母岩中嵌入不规则银白片脉，以冷亮断面区别于铁矿的锈边立片。 */
const layers:readonly Layer[]=[
  {d:OUTLINE,fill:'#585463',stroke:'#2d2936',width:1.4},
  {d:'M-20 1L-16-11L-7-18L7-17L18-7L4-3L-8 3Z',fill:'#827d88'},
  {d:'M4-3L18-7L21 6L12 16L3 10Z',fill:'#3a3b4b'},
  {d:'M-20 1L-8 3L3 10L12 16L-3 19L-16 12Z',fill:'#605869'},
  {d:'M-14-7L-8-13L-1-12L4-16L10-11L5-6L7-2L1 3L-4 1L-8 5L-13 1L-9-4Z',fill:'#a4b0b8',stroke:'#505667',width:.7},
  {d:'M-14-7L-8-13L-1-12L-5-7L-9-4Z',fill:'#e0e7df'},
  {d:'M-1-12L4-16L10-11L5-6L1-7L-3-3L-6-4Z',fill:'#c4d2d5'},
  {d:'M-9-4L-5-7L1-7L5-6L7-2L1 3L-4 1L-8 5L-13 1Z',fill:'#b4c2cb'},
  {d:'M-10-6L-6-10L-1-10M2-11L5-13L7-11M-8 0L-4-2L0 0L3-2',stroke:'#f0f2df',width:1.2},
  {d:'M7 7L12 3L17 6L14 11L8 13L5 10Z',fill:'#9aa9b7',stroke:'#4c4a5b',width:.7},
  {d:'M7 7L12 3L17 6L10 8L5 10Z',fill:'#d3dfdf'},
  {d:'M-14 8L-10 6L-6 9L-9 13L-14 12Z',fill:'#a0aeb9'},
  {d:'M-12 9L-10 8L-8 10M9 6L12 5',stroke:'#edf0dd',width:.9},
  {d:'M-2 5L-4 10L0 13L-2 17M10-5L12-1L10 2',stroke:'#343141',width:1},
  {d:'M-16-10L-8-16L-3-15M-15 5L-11 7',stroke:'#c4bcbf66',width:.7}
]
export const SILVER_ORE_ICON=svgIcon(`<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><g transform="translate(24 24)" stroke-linejoin="round" stroke-linecap="round">${layers.map(layer=>`<path d="${layer.d}" fill="${layer.fill??'none'}"${layer.stroke?` stroke="${layer.stroke}" stroke-width="${layer.width??1}"`:''}/>`).join('')}</g></svg>`)

export function paintSilverOre(g:CanvasRenderingContext2D):Path2D {
  for(const layer of layers){
    const shape=new Path2D(layer.d)
    if(layer.fill){g.fillStyle=layer.fill;g.fill(shape)}
    if(layer.stroke){g.strokeStyle=layer.stroke;g.lineWidth=layer.width??1;g.stroke(shape)}
  }
  return new Path2D(OUTLINE)
}

const cache=new SpriteCache(1,16384)
export function drawSilverOreItem(g:CanvasRenderingContext2D,x:number,y:number):void {
  g.save();g.translate(x,y);g.scale(.5,.5)
  drawSprite(g,cache.get('silver',()=>bakeSprite(-24,-24,48,48,c=>{paintSilverOre(c)})))
  g.restore()
}
