import { PlayerAnimator } from './rig/playerAnims'
import { drawPlayerRig } from './rig/playerRig'
import { drawRumiaRig } from './rig/fourthFloorCharacters'

const animator = new PlayerAnimator()
/** 没有对应CG的外观使用原有部件特写，同样右入左出，不压黑游戏场景。 */
export function drawRumiaBiteCutin(g: CanvasRenderingContext2D, width: number, height: number, time: number, age=0): void {
  const enter=.42,hold=2.8,leave=.38
  if(age>=enter+hold+leave)return
  const ease=(p:number)=>1-Math.pow(1-Math.max(0,Math.min(1,p)),3)
  const slide=age<enter?1-ease(age/enter):age>enter+hold?-Math.pow(Math.min(1,(age-enter-hold)/leave),3):0
  g.save()
  const scale = Math.min(width / 210*.65, height / 155*.65, 3.2)
  g.translate(width / 2+width*slide, height * .36); g.scale(scale, scale)
  const glow = g.createRadialGradient(0, -5, 5, 0, -5, 90); glow.addColorStop(0, '#84617845'); glow.addColorStop(1, '#84617800')
  g.fillStyle = glow; g.fillRect(-100, -85, 200, 150)
  const source = animator.build(Math.PI / 2), hero = { ...source, time, dir: 'down' as const, bone: { ...source.bone, armNearUpper: 0, armNearLower: .1 } }
  drawPlayerRig(g, -17, 5, hero, { expression: 'angry' })
  g.save(); g.translate(11, 8); g.rotate(-.65); drawRumiaRig(g, 0, 0, { ...source, time, dir: 'left', bone: { ...source.bone } }, { expression: 'hungry' }); g.restore()
  // 受痛线集中在手臂旁，不在人物上叠一层外观不同的手部图形。
  g.strokeStyle = '#e7bc8f'; g.lineWidth = 1
  for (let i = 0; i < 3; i++) { const x = -4 + i * 4; g.beginPath(); g.moveTo(x, -4); g.lineTo(x + 1, -8 - i % 2 * 3); g.stroke() }
  g.restore()
}
