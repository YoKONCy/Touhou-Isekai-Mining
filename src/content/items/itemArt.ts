import type { ItemDef } from './types'

/** 官方物品共用的赛璐璐材质色阶；形状、大小、描边宽度与透明度由原资源决定。 */
const tones = {
  neutral: ['#302b3b','#4d475b','#716b7e','#a49bae','#d1c9d5','#eee4df','#fff3e5'],
  steel: ['#30333f','#4c5364','#748397','#a2b1bd','#cbd5d6','#e6e9e2','#f7f2e5'],
  wood: ['#352c38','#56403e','#84614d','#ae8966','#d1b48c','#efdbb7','#f9edd5'],
  gold: ['#37303c','#60513f','#90805b','#b5a16d','#d6c08d','#f2ddb0','#fbedd0'],
  green: ['#2d303b','#465247','#65775e','#8c9d77','#b9c6a0','#e3e8c7','#f3efda'],
  teal: ['#2b303d','#40535b','#657f83','#8ca7a8','#b9cccc','#e4e8da','#f3f1e4'],
  blue: ['#2d2b42','#434960','#65769b','#8da7c3','#bbccd9','#e6e8e4','#f5f0e8'],
  violet: ['#30283f','#51445f','#7a658a','#aa90af','#d0b8d0','#ede0e7','#faf0f3'],
  rose: ['#38283b','#603d51','#975468','#c880ad','#e6adcb','#f3d7e5','#fae9ec'],
  red: ['#382936','#633d43','#9c5758','#c58379','#e2b1a0','#f3d8c2','#fae9de'],
} as const
const stableColors=new Set<string>(Object.values(tones).flat())
const colors=new Map<string,string>()
/** 色彩适配仅混入约三分之一，保留原材质的色相、饱和度与细小明暗差异。 */
export const ITEM_COLOR_STRENGTH=.35

function rgbColor(value:string):{rgb:number[];alpha:string}|undefined{
  const hex=/^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)
  if(hex){const full=hex[1]!.length===3?hex[1]!.split('').map(c=>c+c).join(''):hex[1]!;return{rgb:[0,2,4].map(i=>parseInt(full.slice(i,i+2),16)),alpha:full.slice(6)}}
  const rgb=/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value)
  if(rgb)return{rgb:[Number(rgb[1]),Number(rgb[2]),Number(rgb[3])],alpha:rgb[4]!==undefined?Math.round(Number(rgb[4])*255).toString(16).padStart(2,'0'):''}
}

/** 保留色相身份与原透明度，暗轮廓偏灰紫、金属偏冷、木材与食物偏暖。 */
export function itemArtColor(value:string):string{
  if(stableColors.has(value.toLowerCase()))return value
  const cached=colors.get(value);if(cached)return cached
  const parsed=rgbColor(value);if(!parsed)return value
  const [r,g,b]=parsed.rgb.map(v=>v/255) as [number,number,number]
  const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min,light=(max+min)/2
  let hue=0
  if(delta)hue=((max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4)*60+360)%360
  const saturation=delta/(1-Math.abs(2*light-1)||1)
  let family:keyof typeof tones
  if(delta<.045||saturation<.12)family=b>r+.01?'steel':'neutral'
  else if(hue<18||hue>=350)family='red'
  else if(hue<42)family='wood'
  else if(hue<70)family='gold'
  else if(hue<155)family='green'
  else if(hue<195)family='teal'
  else if(hue<255)family='blue'
  else if(hue<305)family='violet'
  else family='rose'
  // 色阶边界保留深色涂层和高光的对比，避免整把铁器变成同一档灰色。
  const levels=[.16,.29,.44,.61,.80,.94]
  const step=levels.findIndex(v=>light<v),index=step<0?6:step
  const target=tones[family][index]
  const mixed=parsed.rgb.map((v,c)=>Math.round(v+(parseInt(target.slice(1+c*2,3+c*2),16)-v)*ITEM_COLOR_STRENGTH).toString(16).padStart(2,'0')).join('')
  const result='#'+mixed+parsed.alpha
  colors.set(value,result);return result
}

interface Stop {offset:number;color:string}
const gradients=new WeakMap<CanvasGradient,Stop>()
/** 只用于不透明实体材质；雾、辉光、能量及所有透明渐变保留原实现。 */
export function addItemCelStop(gradient:CanvasGradient,offset:number,color:string):void{
  // 握持源文件已从原始素材按当前强度导出，不再叠加第二遍色彩调整。
  const current=color,previous=gradients.get(gradient)
  if(previous&&offset>previous.offset){const boundary=(previous.offset+offset)/2;gradient.addColorStop(boundary,previous.color);gradient.addColorStop(boundary,current)}
  gradient.addColorStop(offset,current);gradients.set(gradient,{offset,color:current})
}

/** 只改 SVG 的绘画属性和材质色阶，所有几何属性与图层顺序保持原样。 */
export function restyleItemSvg(svg:string):string{
  let painted=svg.replace(/\b(fill|stroke|stop-color)=(['"])(#[\da-f]{3,8}|rgba?\([^'"]+\))\2/gi,(_,property,quote,color)=>`${property}=${quote}${itemArtColor(color)}${quote}`)
  painted=painted.replace(/<linearGradient\b([^>]*)>([\s\S]*?)<\/linearGradient>/gi,(original:string,attrs:string,body:string)=>{
    const matches=Array.from(body.matchAll(/<stop\b([^>]*?)\/?\s*>/gi))
    const stops=matches.map((match,index)=>{
      const color=/stop-color=['"]([^'"]+)['"]/.exec(match[1]!)?.[1]
      const raw=/\boffset=['"]([^'"]+)['"]/.exec(match[1]!)?.[1]
      const offset=raw?parseFloat(raw)/(raw.includes('%')?100:1):index?1:0
      return{color,offset,tag:match[0]}
    })
    if(stops.length<2||stops.some(s=>!s.color||rgbColor(s.color)?.alpha||/stop-opacity/.test(s.tag)))return original
    let previous:typeof stops[number]|undefined
    const tags:string[]=[]
    for(const stop of stops){
      if(previous&&stop.offset>previous.offset){const boundary=(previous.offset+stop.offset)/2;tags.push(`<stop offset="${boundary}" stop-color="${previous.color}"/><stop offset="${boundary}" stop-color="${stop.color}"/>`)}
      tags.push(stop.tag);previous=stop
    }
    return `<linearGradient${attrs}>${tags.join('')}</linearGradient>`
  })
  return painted
}

/** 仅由官方清单调用，外部内容包的自定义美术继续使用其原始资源。 */
export function restyleVanillaItem(def:ItemDef):ItemDef{
  return def.icon.type==='svg'?{...def,icon:{type:'svg',svg:restyleItemSvg(def.icon.svg)}}:def
}
