import type { BulletRenderer, ProjectileDef } from '../types'
import { furryOutline } from '../../enemies/vanilla/fourthFloorAppearance'

export const FURRY_WAVE_ID = 'touhou:bullet_furry_wave'
export const FURRY_SEED_ID = 'touhou:bullet_furry_seed'

const drawFurry: BulletRenderer = ({ ctx: g, x, y, r, angle, phase }) => {
  g.save(); g.translate(x, y); g.rotate(angle); g.scale(1.18, .72)
  const path = furryOutline(r)
  g.fillStyle = '#d9d2bc'; g.strokeStyle = '#655568'; g.lineWidth = .9; g.fill(path); g.stroke(path)
  g.fillStyle = '#f5edd4'; g.beginPath(); g.ellipse(-r * .2, -r * .22, r * .5, r * .35, 0, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#a89aac'; g.lineWidth = .6
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + phase * .12; g.beginPath(); g.moveTo(Math.cos(a) * r * .55, Math.sin(a) * r * .4); g.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * .98); g.stroke() }
  g.restore()
}
export const furryWave: ProjectileDef = { id: FURRY_WAVE_ID, speed: 123.2, radius: 5, damage: 8, render: drawFurry, tags: ['furry', 'wave'] }
export const furrySeed: ProjectileDef = { id: FURRY_SEED_ID, speed: 96.8, radius: 10, damage: 10, render: drawFurry,
  split: { distance: 170, count: 16, projectileId: FURRY_WAVE_ID }, tags: ['furry', 'seed'] }

