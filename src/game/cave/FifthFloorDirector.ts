import type { CharacterProfile } from '../../shared/profile'
import type { EngineContext } from '../../core/types'
import type { Camera } from '../../core/Camera'
import type { Player } from '../Player'
import type { RoomRuntime } from './RoomRuntime'
import { FIFTH_FLAGS } from '../../content/story/mainline/fifth-entry/state'
import { FIFTH_TREES } from '../../content/story/mainline/fifth-entry/dialogues'
import { playStory } from '../story/storyDirector'
import { dialogue } from '../dialogue/dialogueService'
import { floorTitle } from '../dialogue/floorTitle'
import { saveService } from '../../core/save/saveService'
import { sfx } from '../audio/Sfx'

type Phase = 'approach' | 'crossing' | 'vista' | 'finish' | 'done'

/** 入口演出只控制走位与镜头，敌人、弹幕和房间刷怪计时在交还操作前冻结。 */
export class FifthFloorDirector {
  private phase: Phase = 'approach'
  private age = 0
  private opening = 0
  private rumblePlayed = false
  constructor(private readonly profile: CharacterProfile) {}
  get blocksInput(): boolean { return this.phase !== 'done' }

  update(dt: number, engine: EngineContext, room: RoomRuntime, players: readonly Player[], camera: Camera): void {
    const entrance = room.def.terrain?.storyEntrance, player = players[0]
    if (!entrance || !player) { this.phase = 'done'; return }
    this.age += dt
    room.advanceStoryScenery(dt)
    const tile = room.map.tile, exitX = (entrance.exitCol + .5) * tile
    if (!this.rumblePlayed) { this.rumblePlayed = true; sfx.oldHellEntrance() }
    if (this.phase === 'approach' && !dialogue.isActive) {
      playStory(FIFTH_TREES.approach.id, { profile: this.profile }, { onEnd: () => {
        this.phase = 'crossing'; this.age = 0; engine.input.reset()
      } })
    }
    if (this.phase === 'crossing') {
      let arrived = true
      for (let i = 0; i < players.length; i++) {
        const member = players[i]!, targetX = exitX - i * 28
        if (!member.updateStoryMotion(dt, room.map, targetX, (entrance.exitRow + .5) * tile)) arrived = false
      }
      this.opening = Math.max(0, Math.min(1, (player.x / tile - 11) / 9))
      if (arrived) {
        this.phase = 'vista'; this.age = 0; this.opening = 1
        for (const member of players) member.vx = member.vy = 0
        sfx.stopFootsteps(); sfx.setCaveMusic(true, 'old_hell')
      }
    } else {
      for (const member of players) member.updateStoryMotion(dt, room.map, member.x + 100, member.y, 0)
    }
    if (this.phase === 'vista' && this.age >= 1.2 && !dialogue.isActive) {
      playStory(FIFTH_TREES.vista.id, { profile: this.profile }, { onEnd: () => {
        this.profile.setFlag(FIFTH_FLAGS.introSeen, true)
        void saveService.persistStoryFlag(FIFTH_FLAGS.introSeen)
        floorTitle.show('floor.title.cave_fifth', undefined, { holdMs: 850 })
        this.phase = 'finish'; this.age = 0; engine.input.reset()
      } })
    }
    const panorama = this.phase === 'finish' ? Math.max(0, 1 - this.age / 1.4) : this.opening
    camera.follow({ x: player.x + ((entrance.viewCol + .5) * tile - player.x) * panorama,
      y: player.y + ((entrance.viewRow + .5) * tile - player.y) * panorama }, dt)
    camera.update(dt)
    if (this.phase === 'finish' && this.age >= 1.4) { this.phase = 'done'; engine.input.reset() }
  }

  /** 窄通道用暗角遮住远景，走出时连续打开；不使用全屏模糊或软件滤镜。 */
  renderScreen(g: CanvasRenderingContext2D, width: number, height: number, player: Player, camera: Camera): void {
    if (!this.blocksInput || this.opening >= 1) return
    const position = player.renderPosition, x = (position.x - camera.renderX) * camera.zoom
    const y = (position.y - 24 - camera.renderY) * camera.zoom
    const amount = 1 - this.opening, radius = Math.min(width, height) * (.27 + this.opening * 1.6)
    const shade = g.createRadialGradient(x, y, radius * .25, x, y, radius)
    shade.addColorStop(0, `rgba(12,7,5,${amount * .05})`)
    shade.addColorStop(.65, `rgba(12,7,5,${amount * .6})`)
    shade.addColorStop(1, `rgba(8,5,4,${amount * .98})`)
    g.save(); g.fillStyle = shade; g.fillRect(0, 0, width, height); g.restore()
  }
}
