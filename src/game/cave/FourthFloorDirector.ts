import type { CharacterProfile } from '../../shared/profile'
import type { EngineContext } from '../../core/types'
import type { ScriptedRoomSpec } from './dungeon/script'
import type { RoomRuntime } from './RoomRuntime'
import type { Player } from '../Player'
import { Enemy } from '../Enemy'
import { KedamaBoss } from '../KedamaBoss'
import { enemies } from '../../content/enemies/registry'
import { FOURTH_FLAGS, joinRescuedNpcs } from '../../content/story/mainline/fourth-rescue/state'
import { FOURTH_TREES } from '../../content/story/mainline/fourth-rescue/dialogues'
import { playStory } from '../story/storyDirector'
import { dialogue } from '../dialogue/dialogueService'
import { registerDialogueAction } from '../dialogue/effects'
import { saveService } from '../../core/save/saveService'
import { PlayerAnimator } from '../art/rig/playerAnims'
import { drawRumiaRig } from '../art/rig/fourthFloorCharacters'
import { drawCraftMarker } from '../art/workshopScene'
import { drawRumiaBiteCutin } from '../art/fourthRescueArt'
import { resolveDialogueCG } from '../dialogue/dialogueCG'
import { drawKedamaFur } from '../art/kedamaFur'
import { t } from '../../i18n'
import { sfx } from '../audio/Sfx'

type Phase = 'waiting' | 'intro' | 'battle' | 'phaseBreak' | 'half' | 'knockdown' | 'defeat' | 'restore' | 'rescueReady' | 'rescue' | 'leaving'
/** 第四层末间导演只负责剧情节拍，BOSS 的战斗与伤害由正式实体负责。 */
export class FourthFloorDirector {
  boss: KedamaBoss | null = null
  guardian: Enemy | null = null
  phase: Phase = 'waiting'
  black = 0
  private activeRoom: RoomRuntime | null = null
  private summoned = false
  private clock = 0
  private restoreTime = 0
  private leavingTime = 0
  private rumiaX = 0
  private rumiaY = 0
  private bound = true
  private biting = false
  private biteCutinAge = 0
  private biteHasCG = false
  private carrying = false
  private knockdownTime = 0
  private phaseBreakTime = 0
  private returnRequested = false
  private readonly animator = new PlayerAnimator()
  constructor(private readonly profile: CharacterProfile, private readonly returnToBase: () => void) {}
  get active(): boolean { return this.activeRoom !== null }
  get blocksInput(): boolean { return this.active && !['battle', 'rescueReady', 'waiting'].includes(this.phase) }
  specForArena(): ScriptedRoomSpec { return { noOre: true, noProps: true, noNature: true, noFissure: true, noChest: true, noMonsterBurst: true, spawns: [], manualClear: true, suppressAutoClear: true, startLocked: true, ambient: { dimCenter: .35, dimEdge: .62, litCenter: .25, litEdge: .45 } } }
  onRoomEnter(room: RoomRuntime, arena: boolean): void {
    if (!arena || this.profile.flagBool(FOURTH_FLAGS.rescued)) { this.activeRoom = null; return }
    if (this.activeRoom === room) return
    this.activeRoom = room
    sfx.setCaveMusic(false)
    const b = room.map.bounds
    this.rumiaX = b.right - 130; this.rumiaY = b.top + 145
    this.boss = new KedamaBoss((b.left + b.right) / 2, (b.top + b.bottom) / 2 - 70)
    if (this.profile.flagBool(FOURTH_FLAGS.won)) { this.boss.alive = false; this.boss.hp = 0; this.boss.mode = 'defeated'; this.boss.restoreProgress = 1; this.phase = 'rescueReady'; this.addRescuePoint() }
    else { this.phase = 'waiting'; this.boss.shown = false; this.boss.entranceProgress = 0 }
    room.addEnemy(this.boss)
    room.addSortable(this.rumiaY, (g, time) => {
      const pose = this.animator.build(Math.PI / 2)
      const x = this.biting && this.player ? this.player.x + 15 : this.rumiaX, y = this.biting && this.player ? this.player.y + 8 : this.rumiaY
      drawRumiaRig(g, x, y, { ...pose, time }, { bound: this.bound, expression: this.bound ? 'scared' : 'hungry' })
      if (this.phase === 'rescueReady') drawCraftMarker(g, this.rumiaX, this.rumiaY, time)
    })
    registerDialogueAction('fourth.restore', () => { this.restoreTime = .01 })
    registerDialogueAction('fourth.appear', () => { if (this.boss) this.boss.shown = true })
    registerDialogueAction('fourth.dropOrnaments', () => { if (this.boss) this.boss.ornamentDropTime = 0 })
    registerDialogueAction('fourth.carry', () => {
      if (!this.player || !this.boss || this.carrying) return
      this.carrying = true; this.boss.shown = false
      room.addSortable(this.player.y, g => {
        if (!this.player) return
        g.save(); g.translate(this.player.x + 6, this.player.y - 5); g.scale(.7, .65); drawKedamaFur(g, 17, { crying: true }); g.restore()
      })
    })
    registerDialogueAction('fourth.free', () => { this.bound = false })
    registerDialogueAction('fourth.bite', () => { this.biting = true; this.biteCutinAge = 0; this.biteHasCG = false })
    registerDialogueAction('fourth.stopBite', () => { this.biting = false })
  }
  private player: Player | null = null
  private addRescuePoint(): void { this.activeRoom!.addSpecialInteractable(this.rumiaX, this.rumiaY, 74, 'fourth:rescue', t('story.fourth.rescue_hint')) }
  private summonGuardian(): void {
    if (this.summoned || !this.boss || !this.activeRoom) return
    this.summoned = true
    const normal = enemies.require('touhou:slime_guardian'), b = this.activeRoom.map.bounds
    const x = Math.max(b.left + 55, Math.min(b.right - 55, this.boss.x + 85)), y = Math.max(b.top + 55, Math.min(b.bottom - 55, this.boss.y + 35))
    this.guardian = new Enemy(x, y, normal.id, { ...normal, hp: normal.hp * 1.5 }); this.guardian.startBurrowSpawn(); this.guardian.alert(); this.activeRoom.addEnemy(this.guardian)
  }
  update(dt: number, engine: EngineContext, room: RoomRuntime, player: Player): void {
    if (this.activeRoom !== room || !this.boss) return
    if (!player.alive) { sfx.setKedamaMusic(false); return }
    this.player = player; this.clock += dt
    if(this.biting)this.biteCutinAge+=dt
    if (this.blocksInput) this.boss.updatePresentation(dt)
    if (this.phase === 'intro' && this.boss.shown) this.boss.entranceProgress = Math.min(1, this.boss.entranceProgress + dt / .65)
    this.animator.update(dt, { speed: 0, moveAngle: Math.PI / 2, aim: Math.PI / 2, armed: false })
    if (this.restoreTime > 0 && this.boss.restoreProgress < 1) { this.restoreTime += dt; this.boss.restoreProgress = Math.min(1, this.restoreTime / 1.1) }
    if (this.phase === 'leaving') {
      this.leavingTime += dt; this.black = Math.min(1, this.leavingTime / .7)
      if (this.leavingTime >= .85 && !this.returnRequested) { this.returnRequested = true; this.returnToBase() }
      return
    }
    if (this.phase === 'knockdown') {
      // 击破当帧只进入动画，不打开对白；完整演出之后才交给战败剧情。
      this.knockdownTime += dt; this.boss.defeatProgress = Math.min(1, this.knockdownTime / 1.15)
      if (this.knockdownTime < 1.15) return
      this.phase = 'defeat'
      playStory(FOURTH_TREES.defeat.id, { profile: this.profile }, { onEnd: () => { this.phase = 'restore'; this.restoreTime = Math.max(.01, this.restoreTime); engine.input.reset() } }); return
    }
    if (this.phase === 'phaseBreak') {
      this.phaseBreakTime += dt; this.boss.phaseBreakProgress = Math.min(1, this.phaseBreakTime / .95)
      if (this.phaseBreakTime < .95) return
      this.phase = 'half'
      playStory(FOURTH_TREES.phase.id, { profile: this.profile }, { onEnd: () => { this.summonGuardian(); this.boss!.beginSecondStage(); this.phase = 'battle'; engine.input.reset() } }); return
    }
    if (dialogue.isActive) return
    if (this.phase === 'waiting') {
      this.phase = 'intro'; player.vx = player.vy = 0; player.cancelCharge(); engine.input.reset()
      playStory(FOURTH_TREES.intro.id, { profile: this.profile }, { onEnd: () => { this.boss!.beginBattle(); this.phase = 'battle'; sfx.setKedamaMusic(true); engine.input.reset() } }); return
    }
    if (this.phase === 'battle' && this.boss.phasePending) {
      this.phase = 'phaseBreak'; this.phaseBreakTime = 0; this.boss.phaseBreakProgress = 0
      room.clearCombatProjectiles(player); engine.shake(.16); engine.input.reset(); return
    }
    if (this.phase === 'battle' && !this.boss.alive) {
      this.phase = 'knockdown'; this.knockdownTime = 0; this.profile.setFlag(FOURTH_FLAGS.won, true); void saveService.persistStoryFlag(FOURTH_FLAGS.won)
      sfx.setKedamaMusic(false); engine.shake(.25)
      room.clearCombatProjectiles(player)
      if (this.guardian) room.removeStoryEnemy(this.guardian)
      engine.input.reset()
      return
    }
    if (this.phase === 'restore' && this.boss.restoreProgress >= 1) {
      playStory(FOURTH_TREES.check.id, { profile: this.profile }, { onEnd: () => { this.phase = 'rescueReady'; this.addRescuePoint(); engine.input.reset() } })
    }
  }
  onInteract(ref?: string): void {
    if (ref !== 'fourth:rescue' || this.phase !== 'rescueReady' || !this.player) return
    this.phase = 'rescue'; this.player.vx = this.player.vy = 0
    playStory(FOURTH_TREES.rescue.id, { profile: this.profile }, { onEnd: () => {
      this.profile.setFlag(FOURTH_FLAGS.rescued, true); joinRescuedNpcs(this.profile)
      // 解救完成即保存回营检查点，刷新直接补播营地过场，不要求重新找末间。
      this.profile.location.scene = 'base'; void saveService.autosave()
      this.phase = 'leaving'; this.leavingTime = 0; this.biting = false
    } })
  }
  renderScreen(g: CanvasRenderingContext2D, width: number, height: number): void {
    if (!this.activeRoom || !this.boss) return
    if (this.biting) {
      if (resolveDialogueCG(dialogue.state.value?.node)) this.biteHasCG = true
      // 完整 CG 退场后不再补播程序小插图，避免窜入设计范围以外的台词。
      if (!this.biteHasCG) drawRumiaBiteCutin(g, width, height, this.clock,this.biteCutinAge)
    }
    if (this.boss.alive && this.phase !== 'waiting' && this.phase !== 'intro') {
      const w = Math.min(460, width * .45), x = (width - w) / 2
      g.save(); g.fillStyle = '#292330ee'; g.strokeStyle = '#b29873'; g.lineWidth = 1; g.fillRect(x - 12, 12, w + 24, 52); g.strokeRect(x - 12, 12, w + 24, 52)
      g.font = '14px zpix'; g.textAlign = 'center'; g.fillStyle = '#e4d5bc'; g.fillText(t('story.fourth.boss'), width / 2, 31)
      g.fillStyle = '#16131d'; g.fillRect(x, 40, w, 8); g.fillStyle = '#bb91c6'; g.fillRect(x, 40, w * this.boss.hp / this.boss.maxHp, 8)
      g.font = '10px zpix'; g.fillStyle = '#dacbb7'; g.fillText(`${Math.ceil(this.boss.hp)} / ${this.boss.maxHp}`, width / 2, 60); g.restore()
    }
    if (this.black > 0) { g.save(); g.fillStyle = `rgba(8,6,13,${this.black})`; g.fillRect(0, 0, width, height); g.restore() }
  }
}
