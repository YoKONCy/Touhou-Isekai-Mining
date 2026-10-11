import type { PlayerAppearance } from '../../../shared/playerAppearance'
import { drawMinerBoot, drawMinerHelmet, drawMinerLeg, drawMinerSleeve, drawMinerTorso } from './minerWorkwear'

const cache = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

/** 旧帽的暗色描边与丝带也必须清除；按原图轮廓裁掉，不再按亮度猜测帽子像素。 */
function removeOldHeadwear(g: CanvasRenderingContext2D, row: number, appearance: PlayerAppearance): void {
  g.clearRect(0, 0, 160, 59)
  if (appearance !== 'sister') return
  const boundary = row === 0
    ? 'M108 48L160 48 160 176 112 176 112 126 116 108 110 91 107 76Z'
    : row === 1
      ? 'M98 44L160 44 160 176 103 176 103 125 105 110 100 93 97 76Z'
      : 'M90 43L160 43 160 176 95 176 95 127 96 104 90 83Z'
  g.save(); g.clip(new Path2D(boundary)); g.clearRect(0, 0, 160, 176); g.restore()
  // 原丝带覆盖的后发由独立发束补齐，脸、眼睛及前刘海始终沿用五种表情原素材。
  const hair = new Path2D(row === 0
    ? 'M106 59Q117 67 115 79L121 94 116 91 121 116 115 111 111 130 105 124 99 127 103 110 101 87Z'
    : row === 1
      ? 'M98 59Q115 64 115 78L122 93 116 90 122 115 115 110 110 129 101 124 96 130 97 108 96 85Z'
      : 'M90 59Q112 62 115 79L121 94 116 92 122 116 115 111 110 138 102 130 94 136 94 111 88 87Z')
  g.fillStyle = '#332e43'; g.fill(hair); g.strokeStyle = '#292436'; g.lineWidth = 1.5; g.stroke(hair)
  g.save(); g.clip(hair)
  g.fillStyle = '#484158'
  g.fill(new Path2D('M100 58L108 64 111 83 108 110 104 122 106 92Z'))
  g.fillStyle = '#252335'
  g.fill(new Path2D('M113 69L123 94 117 88 126 121 115 118 109 135 112 106Z'))
  g.strokeStyle = '#5b526c'; g.lineWidth = 1
  g.stroke(new Path2D('M104 66Q110 80 107 96M111 100L109 115'))
  g.restore()
}

/** 在原图集一次性烘焙换装；头脸、五种表情与手掌不变，衣袖、裤腿、靴子全部换成工作服。 */
export function oldMinerAtlas(source: HTMLImageElement, appearance: PlayerAppearance): HTMLCanvasElement {
  const existing = cache.get(source); if (existing) return existing
  const image = document.createElement('canvas')
  image.width = source.naturalWidth; image.height = source.naturalHeight
  const g = image.getContext('2d')!; g.drawImage(source, 0, 0)
  // 小臂只保留原肤色与紧贴皮肤的描边，避免哥哥旧羽织的蓝色袖口混进新卷袖。
  const hand = document.createElement('canvas'); hand.width = 128; hand.height = 160
  const handContext = hand.getContext('2d')!
  handContext.drawImage(source, 512, 528, 128, 160, 0, 0, 128, 160)
  const pixels = handContext.getImageData(0, 0, 128, 160), original = new Uint8ClampedArray(pixels.data)
  const skin = (index: number) => original[index + 3]! > 0 && original[index]! > 100
    && original[index]! > original[index + 1]! * 1.08 && original[index + 1]! > original[index + 2]! * 1.02
  for (let y = 0; y < 160; y++) for (let x = 0; x < 128; x++) {
    const index = (y * 128 + x) * 4
    if (skin(index)) continue
    const edge = original[index]! < 110 && original[index + 1]! < 110 && original[index + 2]! < 110
      && ((x > 0 && skin(index - 4)) || (x < 127 && skin(index + 4))
        || (y > 0 && skin(index - 512)) || (y < 159 && skin(index + 512)))
    if (!edge) pixels.data[index + 3] = 0
  }
  handContext.putImageData(pixels, 0, 0)
  for (let row = 0; row < 3; row++) for (let col = 0; col < 5; col++) {
    g.save(); g.translate(col * 160, row * 176)
    g.beginPath(); g.rect(0, 0, 160, 176); g.clip()
    removeOldHeadwear(g, row, appearance)
    drawMinerHelmet(g, row === 0 ? 'front' : row === 1 ? 'side' : 'back')
    g.restore()
  }
  const piece = (id: number, paint: () => void) => {
    const x = id % 6 * 128, y = 528 + Math.floor(id / 6) * 160
    g.save(); g.translate(x, y); g.clearRect(0, 0, 128, 160)
    g.beginPath(); g.rect(0, 0, 128, 160); g.clip()
    g.translate(64, 64); g.scale(4, 4); paint(); g.restore()
  }
  piece(0, () => drawMinerTorso(g, 'front'))
  piece(1, () => drawMinerTorso(g, 'side'))
  piece(2, () => drawMinerTorso(g, 'back'))
  piece(3, () => drawMinerSleeve(g, false))
  piece(4, () => {
    // 保留原小臂末端与手掌，包括哥哥的小臂袖口下露出的手指。
    g.save(); g.beginPath(); g.rect(-3, 2.7, 6, 4.3); g.clip()
    g.drawImage(hand, -16, -16, 32, 40); g.restore()
    drawMinerSleeve(g, true)
  })
  piece(5, () => drawMinerLeg(g, false))
  piece(6, () => drawMinerLeg(g, true))
  piece(7, () => drawMinerBoot(g, 'front'))
  piece(8, () => drawMinerBoot(g, 'side'))
  piece(9, () => drawMinerBoot(g, 'back'))
  // 工作服下摆已覆盖两条裤腿的连接处，不再叠加哥哥原衣装的裤腰片。
  piece(10, () => {})
  cache.set(source, image); return image
}
