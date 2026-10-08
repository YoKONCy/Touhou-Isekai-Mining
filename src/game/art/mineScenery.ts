import type { CaveSceneStyle } from '../../content/biomes/types'
import type { DoorSlot } from '../tilemap'
import { drawMineSprite } from './mineAssets'
import { hash2 } from './artPalette'

/** 共用墙体底板：方向、门缝和种子决定组合，楼层不参与几何绘制。 */
export function drawMineWalls(base: CanvasRenderingContext2D, north: CanvasRenderingContext2D, width: number, height: number, wall: number, tile: number, seed: number, doors: readonly DoorSlot[], style: CaveSceneStyle): void {
  const palette = ['wall-a','wall-b','wall-c'] as const
  const stamp = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, index: number): void => {
    const sprite = palette[Math.floor(hash2(seed + index * 7, 53) * palette.length)]
    g.save()
    if (hash2(index, seed + 6) > .5) { g.translate(x + w, 0); g.scale(-1, 1); x = 0 }
    if (!drawMineSprite(g, sprite, x, y, w, h, style.wallTint, style.tintStrength)) {
      g.fillStyle = '#655f75'; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + w * .3, y); g.lineTo(x + w, y + 7); g.lineTo(x + w - 4, y + h); g.lineTo(x + 7, y + h); g.closePath(); g.fill()
      g.fillStyle = '#898094'; g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x + w * .3, y); g.lineTo(x + w, y + 7); g.lineTo(x + w * .65, y + 20); g.closePath(); g.fill()
    }
    g.restore()
  }
  north.save(); north.beginPath(); north.rect(wall, 0, width-wall*2, wall); north.clip()
  north.fillStyle = '#554f64'; north.fillRect(wall, 0, width-wall*2, wall)
  for (let x = wall-10, index = 0; x < width-wall; index++) {
    const w = 65 + hash2(seed + index, 9) * 33, h = 80 + hash2(index, seed + 3) * 23
    stamp(north, x, wall - h + 8, w + 12, h, index); x += w * .82
  }
  north.restore()
  for (const side of ['w','e','s'] as const) {
    base.save(); base.beginPath()
    if (side === 'w') base.rect(0, 0, wall, height)
    else if (side === 'e') base.rect(width - wall, 0, wall, height)
    else base.rect(wall, height - wall, width-wall*2, wall)
    // 只镂空真实门格，不能为了避开门洞而删掉旁边整块岩壁。
    for(const door of doors){
      if(side==='s'&&door.row*tile>=height-wall)base.rect(door.col*tile,height-wall,tile,wall)
      else if(side==='w'&&door.col*tile<wall)base.rect(0,door.row*tile,wall,tile)
      else if(side==='e'&&door.col*tile>=width-wall)base.rect(width-wall,door.row*tile,wall,tile)
    }
    base.clip('evenodd'); base.fillStyle = '#554f64'; base.fillRect(0,0,width,height)
    if (side === 's') {
      for (let x = wall-10, i = 0; x < width-wall; i++) {
        const w = 70 + hash2(i, seed + 19) * 32, h = wall+14
        stamp(base, x, height - wall-8, w + 8, h, 100 + i)
        x += w * .83
      }
    } else {
      for (let y = 0, i = 0; y < height + 40; i++) {
        const h = 75 + hash2(seed + i, 71) * 30, w = 60 + hash2(i, seed + 10) * 17
        stamp(base, side === 'w' ? wall - w + 6 : width - wall - 6, y - 9, w+12, h, (side === 'w' ? 200 : 300) + i)
        y += h * .7
      }
    }
    base.restore()
  }
}

/** 湿痕、沉积、植被与菌光是同一底板的叠层，密度来自群系配置。 */
export function drawMineVariation(base: CanvasRenderingContext2D, north: CanvasRenderingContext2D, width: number, height: number, wall: number, tile: number, seed: number, doors: readonly DoorSlot[], style: CaveSceneStyle): void {
  const nearDoor = (x: number, y: number): boolean => doors.some(d => Math.hypot(x - (d.col + .5) * tile, y - (d.row + .5) * tile) < tile * 1.7)
  for (let i = 0; i < 36; i++) {
    const edge = i % 3, x = edge === 0 ? wall + 30 + hash2(seed + i, 87) * (width - wall * 2 - 60) : edge === 1 ? wall + 18 : width - wall - 18
    const y = edge === 0 ? wall + 18 : wall + 40 + hash2(i, seed + 23) * (height - wall * 2 - 80)
    if (nearDoor(x, y)) continue
    const q = hash2(seed + i * 13, 99)
    if (q < style.vegetation) {
      base.save();base.globalAlpha=.72;drawMineSprite(base,'moss-patch',x-13,y-4,26,10);base.restore()
    }
    if (q < style.fungi) {
      base.save();base.globalAlpha=.65;drawMineSprite(base,'moss-patch',x-10,y-4,20,8,'#90aaa0',.3);base.restore()
    }
    if (q < style.dampness && edge === 0) {
      north.strokeStyle = '#273d4b77'; north.lineWidth = 2.5; north.beginPath(); north.moveTo(x, wall * .3); north.bezierCurveTo(x - 3, wall * .5, x + 2, wall * .75, x - 1, wall - 3); north.stroke()
      base.fillStyle = '#2b465344'; base.beginPath(); base.ellipse(x, y + 3, 16, 4, 0, 0, Math.PI * 2); base.fill()
    }
    if (q < style.deposits) {
      base.strokeStyle = '#b7b6a83b'; base.lineWidth = .7; base.beginPath(); base.moveTo(x - 8, y + 2); base.lineTo(x - 1, y); base.lineTo(x + 7, y + 3); base.stroke()
    }
  }
}
