/**
 * 序章导演（固定脚本楼层 S0~S10 的显式状态机）
 *
 * 铁律：
 * - 每个阶段是一个显式 step，推进条件唯一且可查（对话结束回调 / 拾取回调 /
 *   击杀计数 / 点火 / 进房 / F 交互），绝不靠 if 链猜状态；
 * - 唯一收尾点是 ENDING 节点（flag prologue.done + action prologue.finished），
 *   flag 落盘、符卡/名册写入、黑场解锁、转正常随机下矿全在收尾闭环内完成；
 * - 玩家死亡在序章全程被双层拦截（RoomHost.onPlayerDowned + 半血复活），flag 落档即失效。
 */
import type { CharacterProfile } from '../../shared/profile'
import type { Camera } from '../../core/Camera'
import { t } from '../../i18n'
import type { EquipSlot } from '../../shared/itemDefs'
import { PICK_RUSTY_ID, SWORD_RUSTY_ID, MATCHES_ID } from '../../content/items/vanilla/ids'
import { SLIME_BLUE_ID } from '../../content/enemies/vanilla/ids'
import { dialogue } from '../dialogue/dialogueService'
import { tutorial } from '../dialogue/tutorial'
import { floorTitle } from '../dialogue/floorTitle'
import { PROLOGUE_TREE, PNODE } from '../../content/story/prologue/dialogues'
import type { RoomRuntime } from './RoomRuntime'
import type { Interactable } from './interactables'
import type { ScriptedRoomSpec } from './dungeon/script'
import type { Player } from '../Player'
import { CONFIG } from '../config'
import { sfx } from '../audio/Sfx'
import type { UIPanelKind } from '../gameEvents'
import {
  PROOT,
  BREAK_IN,
  REIMU_POS,
  prologueRoomSpecs
} from './prologue/prologueFloor'
import { createReimuNpc, type ReimuNpc } from './prologue/reimuNpc'

/** 导演驱动矿洞模块所需的最小接口（CaveModule 实现，避免双向硬依赖） */
export interface PrologueHost {
  readonly profile: CharacterProfile
  readonly roomId: number
  readonly room: RoomRuntime
  readonly player: Player
  /** 剧情演出锁（玩家输入冻结，世界继续渲染/演出） */
  setStoryLock(v: boolean): void
  /** 切换手持序号（0 武器A / 1 武器B / 2 镐）并同步近战招式 */
  setHand(i: number): void
  /** 装备变化后同步近战（开局清槽用） */
  syncMeleeNow(): void
  /** 黑场演出中静默切房（无淡入淡出；导演 veil 已全黑，切完自行显影） */
  warpToRoom(roomId: number, fromDoorId: number): void
  /** 唯一收尾：落盘并入正常随机下矿循环 */
  onPrologueFinished(prologue?: boolean): void
}

/** 序章阶段（显式状态机；BOOT=尚未 start，DONE=已收尾） */
type Step =
  | 'BOOT'
  | 'S0_MOVE'
  | 'S1_TALK'
  | 'S1_PICK'
  | 'S1_LOOK'
  | 'S1_MINE'
  | 'S2_TALK'
  | 'S2_FIGHT'
  | 'S3A_TALK'
  | 'S3_TORCH'
  | 'S3_LIT_TALK'
  | 'S4_PICK'
  | 'S4_EXIT'
  | 'S5_FIGHT'
  | 'S5_CLEAR_TALK'
  | 'S6_PASS'
  | 'S8_PASS'
  | 'S9_INTRO_TALK'
  | 'S9_FIGHT'
  | 'S9_SHOUT_TALK'
  | 'S9_SEAL_WAIT'
  | 'S10_TALK'
  | 'CAMP_BLACKOUT'
  | 'CAMP_WALK'
  | 'DOWN'
  | 'DONE'

/** 教程气泡常驻时长（步骤不完成不消失；模态气泡不受此限） */
const PERSIST_MS = 99999999

/** 敲门三连同帧：两声闷敲后撞破刷怪的时刻（与 sfx 排队 delay 对齐，秒） */
const DOOR_BUST_AT = 1.12

export class PrologueDirector {
  /**
   * 黑场罩不透明度 0~1（CaveModule 每帧指数趋近）：
   * S0 醒来与营地段全黑，独白后由显影时间线渐隐到 0。
   */
  veil = 1
  /** 世界层模糊像素（显影序列专用：黑→模糊→清晰；平时 0） */
  blurPx = 0
  /**
   * 闪避是否解锁：醒来房（R0）全程禁用翻滚/长闪——黑灯瞎火先学会走、挖、打；
   * 进 R1 战斗教学房后才解锁并弹出闪避教学。CaveModule 据此掐断三种闪避输入。
   */
  dodgeUnlocked = false
  /** 剧情黑场是否生效（营地段/醒来独白；输入冻结与提示隐藏读这个） */
  get black(): boolean {
    return this.veil >= 0.999
  }

  private step: Step = 'BOOT'
  private readonly specs = prologueRoomSpecs()
  private readonly entered = new Set<number>()
  private t = 0
  private startX = 0
  private startY = 0
  private rocksHit = 0
  private bagOpened = false
  private miningHintShown = false
  private miningHintWait = 0
  /** 显影计时（-1＝未启动；启动后 veil/blurPx 随时间渐变） */
  private revealT = -1
  /** S2 破门计时与刷怪闸门 */
  private breakT = 0
  private breakSpawned = false
  private reimu: ReimuNpc | null = null
  private downed = false

  private torchGuideId: number | null = null

  constructor(private readonly host: PrologueHost) {}

  // ———————————————— 对外入口（由 CaveModule 转发） ————————————————

  specForRoom(roomId: number): ScriptedRoomSpec | undefined {
    return this.specs.get(roomId)
  }

  /** 点火教学的屏幕指引在光照层之上，漆黑房间里仍能看清真实火把位置。 */
  renderTorchGuide(g: CanvasRenderingContext2D, camera: Camera, width: number, height: number): void {
    if (this.step !== 'S3_TORCH' || this.host.roomId !== PROOT.WAKE) return
    const torches = this.host.room.interactableList.filter(item => item.kind === 'torch' && !item.done)
    let target = torches.find(item => item.id === this.torchGuideId)
    if (!target) {
      target = torches.reduce<Interactable | undefined>((nearest, item) => !nearest || Math.hypot(item.x - this.host.player.x, item.y - this.host.player.y) < Math.hypot(nearest.x - this.host.player.x, nearest.y - this.host.player.y) ? item : nearest, undefined)
      this.torchGuideId = target?.id ?? null
    }
    if (!target) return
    this.drawTargetGuide(g, camera, width, height, target.x, target.y, 'story.tut.torch_location')
  }

  /** 第一次挖矿指向最近的可破坏岩石，屏外目标仍显示方向。 */
  renderMiningGuide(g: CanvasRenderingContext2D, camera: Camera, width: number, height: number): void {
    if (this.step !== 'S1_MINE' || !this.miningHintShown) return
    let nearest: { x: number; y: number; distance: number } | undefined
    this.host.room.map.forEachOre(ore => {
      if (ore.vein !== 'rock') return
      const x = (ore.col + .5) * CONFIG.tile + ore.offsetX, y = (ore.row + .5) * CONFIG.tile + ore.offsetY
      const distance = (x - this.host.player.x) ** 2 + (y - this.host.player.y) ** 2
      if (!nearest || distance < nearest.distance) nearest = { x, y, distance }
    })
    if (nearest) this.drawTargetGuide(g, camera, width, height, nearest.x, nearest.y, 'story.tut.mine_location')
  }

  private drawTargetGuide(g: CanvasRenderingContext2D, camera: Camera, width: number, height: number, worldX: number, worldY: number, labelKey: string): void {
    const sx = (worldX - Math.round(camera.x)) * camera.zoom, sy = (worldY - Math.round(camera.y)) * camera.zoom
    const x = Math.max(40, Math.min(width - 40, sx)), y = Math.max(88, Math.min(height - 140, sy))
    const offscreen = sx !== x || sy !== y
    const pulse = Math.sin(performance.now() / 210)
    g.save()
    g.lineWidth = 2; g.strokeStyle = '#f9d79c'; g.fillStyle = '#ffecbd'
    g.shadowColor = '#f0bd6a'; g.shadowBlur = 10
    g.beginPath(); g.arc(x, y, 15 + pulse * 2, 0, Math.PI * 2); g.stroke()
    g.save(); g.translate(x, y)
    if (offscreen) g.rotate(Math.atan2(sy - y, sx - x))
    else { g.translate(0, -30 - pulse * 3); g.rotate(Math.PI / 2) }
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-5, -6); g.lineTo(-2, 0); g.lineTo(-5, 6); g.closePath(); g.fill(); g.restore()
    g.shadowBlur = 0; g.font = '13px zpix, monospace'
    const label = t(labelKey), labelWidth = g.measureText(label).width + 20
    const labelX = Math.max(12, Math.min(width - labelWidth - 12, x - labelWidth / 2))
    g.fillStyle = '#151016ee'; g.fillRect(labelX, y + 24, labelWidth, 26)
    g.strokeStyle = '#c5a57977'; g.lineWidth = 1; g.strokeRect(labelX, y + 24, labelWidth, 26)
    g.fillStyle = '#ffe7b4'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, labelX + labelWidth / 2, y + 37)
    g.restore()
  }

  /** 新档首房创建完成后启动：清空初始装备 → 标题卡 → S0 黑屏独白 → 显影 */
  start(): void {
    const p = this.host.profile
    // 序章开局赤裸：镐/剑/符卡都从剧情里获得（正常新档默认装备暂时清空）
    p.equipment.set('weaponA', null)
    p.equipment.set('weaponB', null)
    p.equipment.set('pick', null)
    p.equipment.set('spellA', null)
    for (let i = 0; i < p.quickSlots.slots.length; i++) p.quickSlots.set(i, null)
    this.host.syncMeleeNow()
    this.host.setHand(2)

    this.startX = this.host.player.x
    this.startY = this.host.player.y
    // 开场全黑：标题卡淡入淡出 → 七句独白（全程黑场）→ 末句点完黑→模糊→清晰显影
    this.veil = 1
    this.blurPx = 0
    // 标题卡期间还没有对话，靠 storyLock 兜住输入；独白结束随显影一起解锁
    this.host.setStoryLock(true)
    floorTitle.show('floor.title.prologue', () => {
      dialogue.start(PROLOGUE_TREE, PNODE.S0A, () => {
        // 显影与移动教学同时开始：世界从黑里浮出来，玩家已经可以试着走
        this.host.setStoryLock(false)
        this.revealT = 0
        tutorial.show('story.tut.move', { durationMs: PERSIST_MS })
        this.step = 'S0_MOVE'
      })
    })
  }

  /** 每次进入房间（含首次；BOOT 阶段忽略首房） */
  onRoomEnter(roomId: number): void {
    if (this.step === 'BOOT' || this.step === 'DONE') return
    if (this.entered.has(roomId)) return
    this.entered.add(roomId)
    const room = this.host.room

    if (roomId === PROOT.BATTLE) {
      // S5：进门冻怪 + 敌情警报，对白结束才解冻开打；同时解锁闪避并给教学
      room.freezeEnemies(true)
      dialogue.start(PROLOGUE_TREE, PNODE.S5, () => {
        room.freezeEnemies(false)
        this.dodgeUnlocked = true
        tutorial.dismiss()
        tutorial.show('story.tut.dodge', { durationMs: PERSIST_MS })
        this.step = 'S5_FIGHT'
      })
    } else if (roomId === PROOT.HINT_1) {
      // S7/S8：隔壁动静（s7 链到 s8 一次播完）；本房现在有怪，对白期间冻住防白挨打
      room.freezeEnemies(true)
      dialogue.start(PROLOGUE_TREE, PNODE.S7, () => {
        room.freezeEnemies(false)
        this.step = 'S8_PASS'
      })
    } else if (roomId === PROOT.REIMU) {
      this.beginReimuEncounter()
    } else if (roomId === PROOT.BASE) {
      // 兼容旧序章房间编号；所有基地演出统一交给正式基地，不再绘制旧摆件房。
      this.beginBase()
    }
  }

  /** 交互物成功触发（拾取/点火由房间结算完后回调） */
  onInteract(it: Interactable): void {
    if (this.step === 'S1_PICK' && it.ref === 'pick') {
      // 先切到镐手持（对白期间手里就拿着镐）；端详链播完先提示看囊袋，
      // 看过囊袋后直接接挖矿教学，不要求玩家先猜出挖矿操作。
      this.host.setHand(2)
      tutorial.dismiss()
      this.step = 'S1_LOOK'
      dialogue.start(PROLOGUE_TREE, PNODE.S1B, () => {
        tutorial.show('story.tut.bag', { durationMs: PERSIST_MS })
        this.rocksHit = 0
        this.bagOpened = false; this.miningHintShown = false; this.miningHintWait = 0
        this.step = 'S1_MINE'
      })
    } else if (this.step === 'S3_TORCH' && it.kind === 'torch') {
      // 火已点（RoomRuntime 先落点火表）：亮起来→发现剑，s3d 播完在身边刷生锈短剑
      tutorial.dismiss()
      this.torchGuideId = null
      this.step = 'S3_LIT_TALK'
      dialogue.start(PROLOGUE_TREE, PNODE.S3C, () => {
        // 火光照出附近地上的生锈短剑（动态采样：玩家身边可行走点）
        const spot = this.sampleDropSpot(85, 130)
        this.host.room.addItemInteractable(spot.x, spot.y, SWORD_RUSTY_ID, {
          slot: 'weaponA' as EquipSlot,
          ref: 'sword'
        })
        tutorial.show('story.tut.pick_pick', { durationMs: PERSIST_MS })
        this.step = 'S4_PICK'
      })
    } else if (this.step === 'S4_PICK' && it.ref === 'sword') {
      this.host.setHand(0)
      dialogue.start(PROLOGUE_TREE, PNODE.S4A, () => {
        // 拿到剑：解封东门（门内自带开门音），去第二房
        this.host.room.setDoorsOpen(true)
        tutorial.dismiss()
        tutorial.show('story.tut.sword', { durationMs: PERSIST_MS })
        this.step = 'S4_EXIT'
      })
    }
  }

  /** 面板实际打开/关闭后推进教学，键盘、关闭按钮与其他关闭方式共用这个入口。 */
  onPanelChanged(kind: UIPanelKind | null): void {
    if (this.step !== 'S1_MINE') return
    if (kind === 'inventory' && !this.miningHintShown) {
      this.bagOpened = true
      tutorial.show('story.tut.bag_close', { durationMs: PERSIST_MS })
    } else if (kind === null && this.bagOpened) this.showMiningHint()
  }

  private showMiningHint(): void {
    if (this.miningHintShown && tutorial.current.value?.key === 'story.tut.mine' && tutorial.current.value.params?.count === this.rocksHit) return
    this.miningHintShown = true
    tutorial.show('story.tut.mine', { durationMs: PERSIST_MS, params: { count: this.rocksHit } })
  }

  /** 敲矿回调（CaveModule host.onMine 转发） */
  notifyMine(kind: 'rock' | 'ore'): void {
    if (this.step !== 'S1_MINE') return
    if (kind === 'rock') this.rocksHit++
    if (this.rocksHit >= 2) this.beginBreakIn()
    else this.showMiningHint()
  }

  /**
   * 玩家倒下：序章全程为教学段，任何步骤倒下都由导演接管
   * （不甘独白 + 半血复活 + 战场重置），绝不放行正常死亡结算；
   * 序章收尾后导演被销毁，死亡才回到正常流程。
   */
  handlePlayerDowned(): boolean {
    // downed＝复活演出中防重入；black＝黑场演出（无伤害来源，理论上不会走到）
    if (this.downed || this.black) return false
    this.downed = true
    const prevStep = this.step
    this.step = 'DOWN'
    this.host.setStoryLock(true)
    dialogue.start(PROLOGUE_TREE, PNODE.DOWN, () => {
      const p = this.host.player
      p.revive(p.maxHp / 2)
      this.host.room.reviveReset()
      this.host.setStoryLock(false)
      this.step = prevStep
      this.downed = false
    })
    return true
  }

  /**
   * 兼容旧基地出口；序章完成标记与基地对白统一由正式基地模块结算。
   */
  onStoryExit(ref: string): void {
    if (this.step === 'DONE' || (ref !== 'base_east' && ref !== 'base')) return
    this.beginBase()
  }

  /** 每帧驱动（CaveModule 在各玩法分支中统一调用） */
  update(dt: number): void {
    if (this.step === 'BOOT' || this.step === 'DONE') return
    this.t += dt
    this.tickReveal(dt)
    const { room, player } = this.host

    switch (this.step) {
      case 'S0_MOVE':
        // 移动 240px（约 5 个瓦片）才触发发现镐子——给足苏醒后走动探索的时间
        if (Math.hypot(player.x - this.startX, player.y - this.startY) > 240) this.beginS1()
        break
      case 'S1_MINE':
        this.miningHintWait += dt
        // 背包不是推进条件；犹豫太久或关掉提示时仍给出下一步，避免卡住教学。
        if ((!this.miningHintShown && this.miningHintWait >= 8) || (this.miningHintShown && !tutorial.current.value)) this.showMiningHint()
        break
      case 'S2_TALK':
        // 拟声句期间：到点撞破东门，刷出史莱姆并冻住（惊呼句读完才解冻开打）
        this.breakT += dt
        if (!this.breakSpawned && this.breakT >= DOOR_BUST_AT) {
          this.breakSpawned = true
          room.spawnEnemyAt(SLIME_BLUE_ID, BREAK_IN.x, BREAK_IN.y, false, true)
          room.fxBurstDoor(BREAK_IN.x, BREAK_IN.y)
          room.freezeEnemies(true)
        }
        break
      case 'S2_FIGHT':
        if (room.aliveCount === 0) this.beginS3()
        break
      case 'S5_FIGHT':
        // 清场先念一句"继续向前探探吧"，念完才 storyClear 亮灯开门（R1 为 manualClear 房）
        if (room.aliveCount === 0) this.beginS5Clear()
        break
      case 'S5_CLEAR_TALK':
        // 清场对白播放中：只等结束回调推进，update 不做别的
        break
      case 'S9_FIGHT':
        // 灵梦房：主角锁血与围怪缠斗 10 秒后，灵梦接管战场进入符卡剧情
        if (this.t > 10) this.beginShout()
        break
      case 'S9_SHOUT_TALK':
        // 喊咒期间让灵梦的结界环持续充能（封在 0.9，念完咒回调里充满引爆）
        if (this.reimu) this.reimu.charge = Math.min(0.9, this.reimu.charge + dt / 0.7)
        break
      case 'S9_SEAL_WAIT':
        if (this.reimu) this.reimu.charge = 1
        // 等五连爆（1.2s）+ 光团尾光（1s）演完，再进 S10 问答
        if (this.t > 2.2) this.beginS10()
        break
      case 'CAMP_BLACKOUT':
        // 等黑罩指数渐变到全黑（约 0.65s），才划火柴、起脚步循环、播行路对白
        if (this.t > 0.65) {
          sfx.matchStrike()
          sfx.startFootsteps()
          this.step = 'CAMP_WALK'
          dialogue.start(PROLOGUE_TREE, PNODE.WALK_H_A, () => {
            // 行路链（含两处 2 秒脚步静默段）播完：停脚步，黑场保持进基地
            sfx.stopFootsteps()
            this.beginBase()
          })
        }
        break
      case 'CAMP_WALK':
        // 对白推进与静默计时全在对话系统，这里空转等结束回调
        break
      default:
        break
    }
  }

  // ———————————————— 阶段编排（私有） ————————————————

  /** S1：发现锈镐与火柴（先切 TALK 步：对白期间玩家停在触发线外，
   *  不切步的话 update 每帧都会再次触发本方法，把对白从头重播→永久卡死） */
  private beginS1(): void {
    this.step = 'S1_TALK'
    tutorial.dismiss()
    dialogue.start(PROLOGUE_TREE, PNODE.S1A, () => {
      // 掉落点在玩家帽灯光圈边缘内侧、朝房间中心方向动态采样（不再用固定坐标）
      const spot = this.sampleDropSpot()
      this.host.room.addItemInteractable(spot.x, spot.y, PICK_RUSTY_ID, {
        slot: 'pick',
        ref: 'pick',
        // 镐旁的火柴盒：同一次 F 一并捡起，安静入背包
        extras: [{ item: MATCHES_ID }]
      })
      tutorial.show('story.tut.pick_pick', { durationMs: PERSIST_MS })
      this.step = 'S1_PICK'
    })
  }

  /**
   * 在玩家可视光圈内采一个可行走掉落点：
   * 距离 100~145px（帽灯半径 196，保证落在光圈亮区而非黑边上），
   * 方向以"玩家→房间中心"为基准 ±0.95rad 抖动（东西总刷在往屋里那侧），
   * 中心点加四向 14px 余量查碰撞，避免半个物件嵌进墙。
   */
  private sampleDropSpot(minD = 100, maxD = 145): { x: number; y: number } {
    const { room, player } = this.host
    const cx = (CONFIG.roomCols * CONFIG.tile) / 2
    const cy = (CONFIG.roomRows * CONFIG.tile) / 2
    const base = Math.atan2(cy - player.y, cx - player.x)
    const probes: Array<[number, number]> = [
      [0, 0],
      [14, 0],
      [-14, 0],
      [0, 14],
      [0, -14]
    ]
    for (let i = 0; i < 30; i++) {
      const ang = base + (Math.random() * 2 - 1) * 0.95
      const d = minD + Math.random() * (maxD - minD)
      const x = player.x + Math.cos(ang) * d
      const y = player.y + Math.sin(ang) * d
      if (probes.every(([ox, oy]) => !room.map.solidAtWorld(x + ox, y + oy))) return { x, y }
    }
    // 兜底：朝房间中心 90px（即便采样全失败也不刷墙里）
    return { x: player.x + Math.cos(base) * 90, y: player.y + Math.sin(base) * 90 }
  }

  /** S2：蓝史莱姆破门（先切 TALK 步，防挖矿回调在对白期间重复触发）
   *  拟声句开播即排敲门三连：闷敲 0s / 0.55s，1.12s 撞破——
   *  update 里同帧刷怪炸门；整链（惊呼句）读完解冻开打。 */
  private beginBreakIn(): void {
    this.step = 'S2_TALK'
    this.breakT = 0
    this.breakSpawned = false
    // 声像＝东门相对玩家方位（与 RoomRuntime 爆怪预警同一约定）
    const pan = Math.max(-1, Math.min(1, (BREAK_IN.x - this.host.player.x) / 300)) * 0.7
    sfx.doorKnock(pan, false, 0)
    sfx.doorKnock(pan, true, 0.55)
    sfx.doorBust(pan, DOOR_BUST_AT)
    dialogue.start(PROLOGUE_TREE, PNODE.S2A, () => {
      const room = this.host.room
      // 兜底：玩家秒点跳过拟声句、撞破时刻还没到——立刻补刷，不留死局
      if (!this.breakSpawned) {
        this.breakSpawned = true
        room.spawnEnemyAt(SLIME_BLUE_ID, BREAK_IN.x, BREAK_IN.y, false, true)
        room.fxBurstDoor(BREAK_IN.x, BREAK_IN.y)
      }
      room.freezeEnemies(false)
      tutorial.dismiss()
      tutorial.show('story.tut.attack', { durationMs: PERSIST_MS })
      this.step = 'S2_FIGHT'
    })
  }

  /**
   * 显影时间线：黑罩 1.7s 渐隐，模糊 1.15s 先退散——
   * 画面先从全黑里浮出模糊轮廓，再迅速对上焦，最后黑罩散尽。
   */
  private tickReveal(dt: number): void {
    if (this.revealT < 0) return
    this.revealT += dt
    const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3)
    this.veil = 1 - easeOut(Math.min(1, this.revealT / 1.7))
    this.blurPx = 14 * (1 - easeOut(Math.min(1, this.revealT / 1.15)))
    if (this.revealT >= 1.7) {
      this.veil = 0
      this.blurPx = 0
      this.revealT = -1
    }
  }

  /** S3：怪清了，但太黑 → 此时才开放火把交互并给点火教学
   *  （先切 TALK 步：怪数恒为 0，不切步 update 会每帧重新开播本对白） */
  private beginS3(): void {
    this.step = 'S3A_TALK'
    tutorial.dismiss()
    dialogue.start(PROLOGUE_TREE, PNODE.S3A, () => {
      // 史莱姆已击杀：火把此刻起才允许 F 点燃（此前靠近也无提示/无响应）
      this.host.room.setTorchesEnabled(true)
      this.torchGuideId = null
      tutorial.show('story.tut.torch', { durationMs: PERSIST_MS })
      this.step = 'S3_TORCH'
    })
  }

  /** S5 清场：主角"继续向前探探吧" → 念完才亮灯+解封东门（manualClear 房延迟亮灯节拍） */
  private beginS5Clear(): void {
    this.step = 'S5_CLEAR_TALK'
    tutorial.dismiss()
    dialogue.start(PROLOGUE_TREE, PNODE.S5B, () => {
      this.host.room.storyClear()
      this.step = 'S6_PASS'
    })
  }

  /**
   * S9：进入灵梦房——锁门、立 NPC，怪群冻住播开场对白（主角发现 → ？？？求助 → 主角疑惑）；
   * 对白播完解冻开打：主角锁血 1 滴自由缠斗 10 秒，到点灵梦出手接管。
   */
  private beginReimuEncounter(): void {
    const room = this.host.room
    room.setDoorsOpen(false, true)
    const reimu = createReimuNpc(REIMU_POS.x, REIMU_POS.y)
    this.reimu = reimu
    room.addSortable(reimu.y, (ctx, time) => reimu.draw(ctx, time))
    room.freezeEnemies(true)
    this.step = 'S9_INTRO_TALK'
    dialogue.start(PROLOGUE_TREE, PNODE.S9_NOTICE, () => {
      room.freezeEnemies(false)
      // 锁血缠斗：15 只怪围攻 10 秒，血量钳在 1 滴但不死
      this.host.player.storyGuard = true
      this.t = 0
      this.step = 'S9_FIGHT'
    })
  }

  /**
   * S9：缠斗 10 秒到点——灵梦（？？？）接管战场：
   * 怪群冻住，播"——久等了！""灵符，「梦想封印」！"两句喊咒（树内链接），
   * 念完当帧请求棱镜五连爆，播 2.2 秒演出后进问答。
   */
  private beginShout(): void {
    // 先切 TALK 步：防止计时边界重复进入本方法重播对白
    this.step = 'S9_SHOUT_TALK'
    tutorial.dismiss()
    // 灵梦出手，锁血保护解除；怪群被咒力钉住，保证对白阅读安全
    this.host.player.storyGuard = false
    this.host.room.freezeEnemies(true)
    if (this.reimu) this.reimu.charge = 0.15
    dialogue.start(PROLOGUE_TREE, PNODE.S9_SHOUT, () => {
      // 「梦想封印！」念完：结界充满，五连爆首爆当帧引爆
      this.host.setStoryLock(true)
      if (this.reimu) this.reimu.charge = 1
      this.host.room.requestPrismaticSeal()
      this.t = 0
      this.step = 'S9_SEAL_WAIT'
    })
  }

  /**
   * S10：封印后问答（sigh→who→where→hero 回怼→dots→自报家门→hungry→dots→ok）。
   * 怪群已灭，东门保持封锁——问答结束直接黑场行路转场，不给玩家提前过门。
   */
  private beginS10(): void {
    dialogue.start(PROLOGUE_TREE, PNODE.S10_R_SIGH, () => {
      this.beginCamp()
    })
    this.step = 'S10_TALK'
  }

  /**
   * 黑场行路：S10 问答结束即渐黑（CaveModule 黑罩向 veil 指数趋近），
   * 黑透后火柴声＋双人脚步循环＋行路拌嘴链，链末停脚步交棒基地。
   */
  private beginCamp(): void {
    this.host.setStoryLock(true)
    this.veil = 1
    this.blurPx = 0
    this.revealT = -1
    this.t = 0
    this.step = 'CAMP_BLACKOUT'
  }

  /**
   * 黑场行路结束后直接交给正式基地；显影、站位、对白与新基地资源共用同一入口。
   */
  private beginBase(): void {
    this.step = 'DONE'
    this.host.onPrologueFinished(true)
  }

}
