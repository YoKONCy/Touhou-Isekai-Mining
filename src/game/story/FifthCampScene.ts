import type { CharacterProfile } from '../../shared/profile'
import type { Player } from '../Player'
import type { TileMap } from '../tilemap'
import { dialogue } from '../dialogue/dialogueService'
import { playNextStory, hasAvailableStory } from './storyDirector'
import { PlayerAnimator } from '../art/rig/playerAnims'
import { drawRumiaRig } from '../art/rig/fourthFloorCharacters'
import { drawPlayerRig, getPlayerHandAnchor } from '../art/rig/playerRig'
import { drawOldHellResource } from '../art/oldHellResourceArt'
import { STRANGE_PORK_ID } from '../../content/items/vanilla/ids'
import { CAMP_NPC_ANCHOR } from '../art/campScene'
import { RUMIA_CAMP } from './FourthCampScene'
import { withSimulationAppearance, withPlayerCostume } from '../../shared/playerAppearance'

/** 回营报告与验肉共用站位；露米娅在验肉时凑近，结束后走回原处。 */
export class FifthCampScene {
  private active = false
  private returning = false
  private close = false
  private meatVisible = false
  private readonly rumia = { ...RUMIA_CAMP }
  private readonly rumiaAnimator = new PlayerAnimator()
  private readonly heroAnimator = new PlayerAnimator()
  constructor(private readonly profile: CharacterProfile, private readonly player: Player,
    private readonly map: TileMap, private readonly reset: () => void) {}

  get blocking(): boolean { return this.active }
  get rumiaPosition(): { x: number; y: number } { return this.rumia }
  get reimuAim(): number { return Math.atan2(this.player.y - CAMP_NPC_ANCHOR.y, this.player.x - CAMP_NPC_ANCHOR.x) }

  /** 回营遮罩尚未褪去时先落位，避免首帧站在入口、下一帧突然闪到营火旁。 */
  prepare(): void {
    if (!hasAvailableStory('camp.fifth', { profile: this.profile })) return
    this.player.x = CAMP_NPC_ANCHOR.x + 55; this.player.y = CAMP_NPC_ANCHOR.y + 110
    this.player.vx = this.player.vy = 0
  }

  tryStart(): boolean {
    if (this.active || dialogue.isActive || !playNextStory('camp.fifth', { profile: this.profile })) return false
    this.active = true; this.returning = false; this.close = false; this.meatVisible = false
    this.player.x = CAMP_NPC_ANCHOR.x + 55; this.player.y = CAMP_NPC_ANCHOR.y + 110
    this.player.vx = this.player.vy = 0
    this.player.cancelCharge(); this.reset()
    return true
  }

  update(dt: number): boolean {
    if (!this.active) return false
    const state = dialogue.state.value
    if (!state?.treeId.startsWith('touhou:fifth_')) { this.returning = true; this.meatVisible = false }
    const meat = state?.treeId === 'touhou:fifth_meat' || state?.treeId === 'touhou:fifth_meat_later'
    const line = Number(state?.node.id.replace(/^s/, ''))
    if (meat && line >= 2) { this.close = true; this.meatVisible = true }
    const target = this.returning ? RUMIA_CAMP : { x: this.player.x + (this.close ? 42 : 92), y: this.player.y + 10 }
    const dx = target.x - this.rumia.x, dy = target.y - this.rumia.y, distance = Math.hypot(dx, dy)
    const step = Math.min(distance, dt * 105), moving = distance > 1
    if (moving) { this.rumia.x += dx / distance * step; this.rumia.y += dy / distance * step }
    const aim = Math.atan2(this.player.y - this.rumia.y, this.player.x - this.rumia.x)
    this.rumiaAnimator.update(dt, { speed: moving ? 105 : 0, moveAngle: Math.atan2(dy, dx), aim, armed: false })
    this.player.update(0, { moveX: 0, moveY: 0, pointerX: this.close ? this.rumia.x : CAMP_NPC_ANCHOR.x,
      pointerY: this.close ? this.rumia.y : CAMP_NPC_ANCHOR.y, attackPressed: false, attackHeld: false,
      dodgePressed: false, dodgeHeld: false, dodgeReleased: false }, this.map)
    this.player.vx = this.player.vy = 0
    this.heroAnimator.update(dt, { speed: 0, moveAngle: Math.PI / 2, aim: this.player.facing, armed: false,
      armAim: this.meatVisible ? .15 : null, armBend: this.meatVisible ? -.5 : 0 })
    if (this.returning && distance <= 1) { this.active = false; this.reset() }
    return true
  }

  renderRumia(g: CanvasRenderingContext2D): void {
    const { x, y } = this.rumia
    g.save(); g.fillStyle = '#18131e44'; g.beginPath(); g.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2); g.fill()
    const aim = Math.atan2(this.player.y - y, this.player.x - x)
    drawRumiaRig(g, x, y, this.rumiaAnimator.build(aim), { expression: 'hungry' }); g.restore()
  }

  renderPlayer(g: CanvasRenderingContext2D): void {
    withSimulationAppearance(this.profile.playerAppearance, () => withPlayerCostume(this.profile.equipment.visibleCostume(this.profile.costume), () => {
      const pose = this.heroAnimator.build(this.player.facing)
      g.save(); g.fillStyle = '#18131e44'; g.beginPath(); g.ellipse(this.player.x, this.player.y + 16, 14, 5, 0, 0, Math.PI * 2); g.fill()
      drawPlayerRig(g, this.player.x, this.player.y, pose)
      if (this.meatVisible) {
        const hand = getPlayerHandAnchor(this.player.x, this.player.y, pose)
        drawOldHellResource(g, STRANGE_PORK_ID, hand.x, hand.y, 18)
      }
      g.restore()
    }))
  }
}
