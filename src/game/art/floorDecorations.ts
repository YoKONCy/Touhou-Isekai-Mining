import { drawEmbeddedBones } from './embeddedBones'

export interface BackgroundRock {x:number;y:number;radius?:number}
import type { BiomeFloorStyle } from '../../content/biomes/types'
import type { DoorSlot } from '../tilemap'
import { drawMineSprite } from './mineAssets'

interface Decoration {x:number;y:number;kind:number;radius:number;angle:number;cracked:boolean}
/** 采集依赖的岩块位置先生成数据，贴图是否加载或重绘细节不影响生态。 */
function layoutDecorations(width:number,height:number,wall:number,tile:number,doors:readonly DoorSlot[],seed:number,style:BiomeFloorStyle,boneCount:number):Decoration[]{
  let state=(Math.imul(seed+83,2246822519)^0x37ac912d)>>>0
  const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296}
  const entries:Decoration[]=[]
  for(let i=0;i<58*style.detailDensity;i++){
    const side=Math.floor(rand()*4)
    const x=side<2?wall+22+rand()*(width-wall*2-44):side===2?wall+12+rand()*70:width-wall-12-rand()*70
    const y=side>=2?wall+22+rand()*(height-wall*2-44):side===0?wall+12+rand()*70:height-wall-12-rand()*70
    if(doors.some(d=>Math.hypot(x-(d.col+.5)*tile,y-(d.row+.5)*tile)<88)||entries.some(p=>Math.hypot(p.x-x,p.y-y)<42))continue
    const kind=Math.floor(rand()*6),radius=15+rand()*24,angle=(rand()-.5)*1.4
    entries.push({x,y,kind,radius,angle,cracked:kind===5&&boneCount>0&&rand()<.25})
  }
  return entries
}
export function layoutBackgroundRocks(width:number,height:number,wall:number,tile:number,doors:readonly DoorSlot[],seed:number,style:BiomeFloorStyle,boneCount=0):BackgroundRock[]{
  return layoutDecorations(width,height,wall,tile,doors,seed,style,boneCount).filter(p=>p.kind===5).map(({x,y,radius})=>({x,y,radius}))
}

/** 静态装饰只烘焙一次；边缘丰富、中央稀疏，始终避开门口。 */
export function drawFloorDecorations(ctx: CanvasRenderingContext2D, width: number, height: number, wall: number, tile: number, doors: readonly DoorSlot[], seed: number, style: BiomeFloorStyle,boneCount=0): BackgroundRock[] {
  const entries = layoutDecorations(width,height,wall,tile,doors,seed,style,boneCount)
  const backgroundRocks = entries.filter(p=>p.kind===5).map(({x,y,radius})=>({x,y,radius}))
  let state = (Math.imul(seed + 83, 2246822519) ^ 0x37ac912d) >>> 0
  const rand = (): number => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
  const occupied = entries
  ctx.save(); ctx.beginPath(); ctx.rect(wall, wall, width - wall * 2, height - wall * 2); ctx.clip()
  for (const {x,y,kind,radius,angle,cracked} of entries) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle)
    // 不规则渗色先融合地面，所有细节避免清晰的贴纸外轮廓。
    const stain = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    stain.addColorStop(0, kind < 2 ? '#25333255' : style.dust + '22'); stain.addColorStop(1, style.base + '00')
    ctx.save(); ctx.scale(1, .48); ctx.fillStyle = stain; ctx.fillRect(-radius, -radius, radius * 2, radius * 2); ctx.restore()
    if (kind === 0) {
      drawMineSprite(ctx,'moss-patch',-radius,-7,radius*2,15)
      // 苔痕沿裂面生长，纤细碎叶与暗缝错落，不再是整齐圆团。
      for (let k = 0; k < 42; k++) {
        const px = (rand() - .5) * radius * 2, py = (rand() - .5) * 9 + Math.sin(px * .12) * 3
        ctx.strokeStyle = k % 3 ? '#46544628' : '#8c94711b'; ctx.lineWidth = .5 + rand() * .7
        ctx.beginPath(); ctx.moveTo(px, py + 1); ctx.lineTo(px + 1 + rand() * 3, py - rand() * 2); ctx.stroke()
      }
    } else if (kind === 1) {
      // 薄湿膜断续反光、渗水沟和边缘泥沙，非整块蓝色水洼。
      ctx.strokeStyle = '#27343485'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-radius * .7, -2); ctx.bezierCurveTo(-5, 4, 8, -4, radius * .6, 2); ctx.stroke()
      ctx.strokeStyle = '#a8b5a133'; ctx.lineWidth = .65
      for (let k = 0; k < 5; k++) { const px = (rand() - .5) * radius; ctx.beginPath(); ctx.moveTo(px, k * 1.3 - 3); ctx.lineTo(px + 3 + rand() * 5, k * 1.3 - 3.5); ctx.stroke() }
    } else if (kind === 2) {
      if(drawMineSprite(ctx,'timber-beam',-14,-2,28,5)){ctx.restore();continue}
      // 少量旧木残片：嵌泥暗底、断裂边和纵纹，与可采集木材形态区分。
      ctx.fillStyle = '#201e1e65'; ctx.fillRect(-13, 1, 26, 3)
      ctx.beginPath(); ctx.moveTo(-14, -1); ctx.lineTo(8, -3); ctx.lineTo(14, -1); ctx.lineTo(10, 0); ctx.lineTo(13, 2); ctx.lineTo(-11, 3); ctx.lineTo(-8, 1); ctx.closePath()
      ctx.fillStyle = '#61503f'; ctx.fill(); ctx.strokeStyle = '#aa906448'; ctx.lineWidth = .6
      ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(9, -1); ctx.moveTo(-5, 2); ctx.lineTo(8, 1); ctx.stroke()
    } else if (kind === 3) {
      // 灰白矿物沉积断带：细小分面，无发光宝石或可拾取物的强亮边。
      for (let k = 0; k < 22; k++) {
        const px = (rand() - .5) * radius * 1.7, py = Math.sin(px * .08) * 3 + (rand() - .5) * 5, r = .5 + rand() * 2
        ctx.fillStyle = k % 3 ? '#afa58a35' : '#d0c5a548'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + r, py - r * .5); ctx.lineTo(px + r * 2, py + .5); ctx.lineTo(px + r, py + 1); ctx.closePath(); ctx.fill()
      }
    } else if (kind === 4) {
      // 矿工拖拽留下的断续磨痕，少量平行刮擦不构成网格。
      for (let k = 0; k < 3; k++) {
        const start = -radius + rand() * 9, end = radius - rand() * 10
        ctx.strokeStyle = k % 2 ? style.light + '30' : style.dark + '65'; ctx.lineWidth = .65
        ctx.beginPath(); ctx.moveTo(start, k * 2); ctx.quadraticCurveTo(0, k * 2 - 2, end, k * 2 - 1); ctx.stroke()
      }
    } else {
      // 薄层岩皮剥蚀：上沿凹入、下沿受光，不画完整亮边圈。
      if(drawMineSprite(ctx,'ground-rubble',-radius,-radius*.45,radius*2,radius)){
        if(cracked){ctx.strokeStyle='#302d3b';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-6,-5);ctx.lineTo(-2,-2);ctx.lineTo(-4,1);ctx.lineTo(3,3);ctx.stroke()}
        ctx.restore();continue
      }
      ctx.fillStyle = style.dark + '45'; ctx.beginPath(); ctx.moveTo(-radius, 0); ctx.lineTo(-8, -5); ctx.lineTo(7, -3); ctx.lineTo(radius, 1); ctx.lineTo(5, 5); ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = style.light + '40'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-9, 3); ctx.lineTo(5, 5); ctx.lineTo(radius - 4, 2); ctx.stroke()
      ctx.strokeStyle = style.dark + '70'; ctx.beginPath(); ctx.moveTo(-radius, 0); ctx.lineTo(-8, -5); ctx.lineTo(7, -3); ctx.stroke()
      if(cracked){ctx.strokeStyle='#202824';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(-2,-3);ctx.lineTo(-4,0);ctx.lineTo(3,3);ctx.stroke();ctx.strokeStyle='#9a9c8355';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-6,-4);ctx.lineTo(-1,-2);ctx.stroke()}
    }
    ctx.restore()
  }
  for(let i=0;i<boneCount;i++){
    const x=wall+45+rand()*(width-wall*2-90),y=wall+45+rand()*(height-wall*2-90)
    if(doors.some(d=>Math.hypot(x-(d.col+.5)*tile,y-(d.row+.5)*tile)<90)||occupied.some(p=>Math.hypot(p.x-x,p.y-y)<60))continue
    ctx.save();ctx.translate(x,y);ctx.rotate((rand()-.5)*1.8);drawEmbeddedBones(ctx,i%3,seed+i);ctx.restore()
  }
  ctx.restore()
  return backgroundRocks
}
