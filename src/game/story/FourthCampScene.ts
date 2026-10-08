import type { CharacterProfile } from '../../shared/profile'
import type { Player } from '../Player'
import { FOURTH_FLAGS, joinRescuedNpcs, rumiaPending } from '../../content/story/mainline/fourth-rescue/state'
import { FOURTH_TREES } from '../../content/story/mainline/fourth-rescue/dialogues'
import { dialogue } from '../dialogue/dialogueService'
import { registerDialogueAction } from '../dialogue/effects'
import { playStory } from './storyDirector'
import { saveService } from '../../core/save/saveService'
import { drawRumiaRig } from '../art/rig/fourthFloorCharacters'
import { drawKedamaFur } from '../art/kedamaFur'
import { PlayerAnimator } from '../art/rig/playerAnims'
import { drawCraftMarker } from '../art/workshopScene'
import { CAMP_NPC_ANCHOR } from '../art/campScene'
import { t } from '../../i18n'

export const RUMIA_CAMP = { x: CAMP_NPC_ANCHOR.x + 130, y: CAMP_NPC_ANCHOR.y + 65 }
type Phase = 'arrival' | 'fadeOut' | 'later' | 'hungry' | 'free'
/** 回营分两段保存；认人后显示姓名，询问完整结束后才放行所有下矿入口。 */
export class FourthCampScene {
  phase: Phase
  black = 0
  private age = 0
  private started = false
  private clock = 0
  private hugging = false
  private readonly animator = new PlayerAnimator()
  constructor(private readonly profile: CharacterProfile, private readonly player: Player, private readonly reset: () => void) {
    joinRescuedNpcs(profile)
    this.phase = profile.flagBool(FOURTH_FLAGS.campDone) ? 'free' : profile.flagBool(FOURTH_FLAGS.arrived) ? 'fadeOut' : 'arrival'
    if (this.phase !== 'free') { this.player.x = CAMP_NPC_ANCHOR.x + 55; this.player.y = CAMP_NPC_ANCHOR.y + 110; this.player.vx = this.player.vy = 0 }
    registerDialogueAction('fourth.recognize', () => { this.profile.setFlag(FOURTH_FLAGS.known, true); void saveService.persistStoryFlag(FOURTH_FLAGS.known) })
    registerDialogueAction('fourth.hugLeg', () => { this.hugging = true })
  }
  get blocking(): boolean { return this.phase !== 'free' }
  update(dt: number): boolean {
    this.clock += dt; this.age += dt
    this.animator.update(dt, { speed: 0, moveAngle: Math.PI / 2, aim: Math.PI / 2, armed: false })
    if (this.phase === 'free') return false
    this.player.vx = this.player.vy = 0
    if (this.phase === 'arrival' && !this.started && !dialogue.isActive) {
      this.started = true; this.reset()
      playStory(FOURTH_TREES.arrival.id, { profile: this.profile }, { onEnd: () => {
        this.profile.setFlag(FOURTH_FLAGS.arrived, true); void saveService.autosave()
        this.phase = 'fadeOut'; this.age = 0; this.started = false; this.reset()
      } })
    } else if (this.phase === 'fadeOut') {
      this.black = Math.min(1, this.age / .65)
      if (this.age >= .8) { this.phase = 'later'; this.age = 0 }
    } else if (this.phase === 'later' && this.age >= 1.3) { this.phase = 'hungry'; this.age = 0; this.started = false }
    else if (this.phase === 'hungry') {
      this.black = Math.max(0, 1 - this.age / .65)
      if (this.age > .7 && !this.started && !dialogue.isActive) {
        this.started = true
        playStory(FOURTH_TREES.hungry.id, { profile: this.profile }, { onEnd: () => {
          this.profile.setFlag(FOURTH_FLAGS.campDone, true); void saveService.autosave()
          this.phase = 'free'; this.black = 0; this.reset()
        } })
      }
    }
    return true
  }
  blockDeparture(): boolean {
    if (!rumiaPending(this.profile)) return false
    if (!dialogue.isActive && !this.blocking) playStory(FOURTH_TREES.blocked.id, { profile: this.profile }, { onEnd: this.reset })
    return true
  }
  talk(onUnlocked: () => void): void {
    if (this.blocking || dialogue.isActive) return
    if (!this.profile.flagBool(FOURTH_FLAGS.asked)) {
      playStory(FOURTH_TREES.account.id, { profile: this.profile }, { onEnd: () => {
        this.profile.setFlag(FOURTH_FLAGS.asked, true); void saveService.autosave(); this.reset(); onUnlocked()
      } })
    } else playStory(FOURTH_TREES.idle.id, { profile: this.profile }, { onEnd: this.reset })
  }
  render(g: CanvasRenderingContext2D): void {
    const atFeet = this.phase === 'hungry', rolling = atFeet && !this.hugging, pose = this.animator.build(Math.PI / 2)
    const frightened = this.phase === 'arrival' && this.profile.flagBool(FOURTH_FLAGS.known)
    const x = atFeet ? this.player.x + (this.hugging ? 12 : 35 + Math.sin(this.clock * 1.7) * 16) : frightened ? this.player.x + 10 : RUMIA_CAMP.x
    const y = atFeet ? this.player.y + 22 : frightened ? this.player.y + 25 : RUMIA_CAMP.y
    g.save(); g.fillStyle = '#18131e44'; g.beginPath(); g.ellipse(x, y + 16, 14, 5, 0, 0, Math.PI * 2); g.fill()
    if (rolling) { g.translate(x, y); g.rotate(Math.sin(this.clock * 2.6) * .9 + Math.PI / 2); drawRumiaRig(g, 0, 0, pose, { expression: 'hungry' }) }
    else drawRumiaRig(g, x, y, pose, { expression: frightened ? 'scared' : 'hungry' })
    g.restore()
    if (!this.blocking && rumiaPending(this.profile) && !dialogue.isActive) drawCraftMarker(g, RUMIA_CAMP.x, RUMIA_CAMP.y, this.clock)
    g.save()
    // 回营时毛玉由主角抱着，之后安置在灵梦附近；普通人形尚未醒来出场。
    g.translate(this.phase === 'arrival' ? this.player.x + 6 : CAMP_NPC_ANCHOR.x - 42, this.phase === 'arrival' ? this.player.y - 5 : CAMP_NPC_ANCHOR.y + 48)
    g.scale(.7, .65); drawKedamaFur(g, 17, { crying: true }); g.restore()
  }
  renderScreen(g: CanvasRenderingContext2D, width: number, height: number): void {
    if (this.black <= 0) return
    g.save(); g.fillStyle = `rgba(8,6,13,${this.black})`; g.fillRect(0, 0, width, height)
    if (this.phase === 'later') { g.textAlign = 'center'; g.font = '24px zpix'; g.fillStyle = '#dfceb1'; g.fillText(t('story.fourth.later'), width / 2, height / 2) }
    g.restore()
  }
}
