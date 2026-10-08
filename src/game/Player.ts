import { CONFIG, type DodgeKind, type DodgePhase, type SwingPhase } from './config'
import type { Collider, TileMap } from './tilemap'
import { getItemDef, type ItemId, type MeleeMove, type SpellCardDef } from '../shared/itemDefs'
import { PICK_RUSTY_ID, DOOMSDAY_ID } from '../content/items/vanilla/ids'
import { sfx } from './audio/Sfx'
import { drawDoomCrescents, drawDoomTransition } from '../content/items/vanilla/weapons/doomsday/effects'
import { DoomsdayState } from '../content/items/vanilla/weapons/doomsday/state'
import { PlayerAnimator } from './art/rig/playerAnims'
import { dirAngle, type PlayerPose } from './art/rig/skeleton'
import { drawPlayerRig, getPlayerHandAnchor, getPlayerSupportHandAnchor } from './art/rig/playerRig'
import { drawRigWeapon } from './art/rig/weaponRig'
import type { WeaponTrailView, WeaponImpactInstance, WeaponBladeSegment, WeaponMotionView } from '../content/items/types'
import type { WeaponSweep, WeaponPhysics, WeaponCurveView } from '../content/items/types'
import { resolveCircleProps, type Prop } from './art/props'
import { calculateDamage, type DamageKind, type DerivedCombat } from '../shared/combat'
import { rarityColor, COSMIC_RARITY, RARITY_DEFAULT_COLOR } from '../shared/rarity'
import { itemName } from '../i18n'
import { StatusEffects, SLAUGHTER_STANCE, type StatusDefinition } from '../shared/statusEffects'
import { meleeForSegment, chargeMultiplier } from '../content/items/combatComponents'
import { TarotState } from '../content/items/vanilla/weapons/tarot/state'
import { BowState } from './ranged/BowState'
import type { Inventory } from '../shared/inventory'

/** 批次 E：统一深描边色（与场景 artPalette.ink 同源） */
const ART_INK = '#241a12'

/** 玩家：移动 / 闪避 / 挥镐 三态状态机 + 受伤/死亡结算 */
export class Player {
  readonly effects = new StatusEffects(this)
  x: number
  y: number
  vx = 0
  vy = 0
  /** 视觉/交互半径（阴影、角色绘制、掉落吸附等；物理碰撞见 collisionR） */
  readonly half = CONFIG.player.half
  /** 物理/受击碰撞圆半径（独立于视觉半径，约一半大小） */
  readonly collisionR = CONFIG.player.collisionR
  /** PlayerLike 契约别名：AI/敌人接触判定按精瘦碰撞圆结算 */
  get hitR(): number {
    return this.collisionR
  }
  hp: number = CONFIG.player.maxHp
  /** 生命上限（成长派生；默认＝CONFIG 基础值，体魄加点可抬高） */
  maxHp: number = CONFIG.player.maxHp
  alive = true
  /**
   * 剧情锁血（序章灵梦房"拖住怪群 10 秒"用）：
   * 开启期间受击照常扣血/击退/闪红，但血量钳在最低 1 滴、绝不死亡，
   * 也不触发倒地独白与死亡结算。导演在战斗结束时关闭。
   */
  storyGuard = false
  /**
   * 调试无敌（仅调试控制台可置位）：受击直接无效，不扣血不击退不闪红。
   * 与剧情锁血 storyGuard 不同——那个是剧本玩法的一部分，这个纯粹是开发外挂。
   */
  debugGod = false

  // —— 灵力与符卡冷却（批次 D） ——
  mana: number = CONFIG.player.spell.maxMana
  /** 灵力上限（成长派生；灵力加点可抬高） */
  maxMana: number = CONFIG.player.spell.maxMana
  manaRegen: number = CONFIG.player.spell.manaRegen
  knockbackBonus = 0
  /** 状态演出的逻辑时钟，暂停时不会继续乱晃。 */
  effectTime = 0
  spellCooldown = 0
  /** 上一张符卡的 CD 总长（HUD 遮罩比例用） */
  private lastSpellCdTotal = 1

  // —— 成长派生乘区（属性点全 0 时恒等 1，行为与旧版本一致） ——
  /** 行走移速乘数（敏捷；闪避速度不吃此加成） */
  private speedMul = 1
  /** 近战伤害乘数（力量；命中伤害在 RoomRuntime 结算时乘上） */
  shootingDeviation = 5
  rangedCritChance = 0
  rangedCooldown = 0
  readonly tarot = new TarotState()
  readonly bow = new BowState()
  ammoInventory: Inventory | null = null
  rangedFlight: { item: ItemId; x: number; y: number; angle: number; remaining: number; returning: boolean; rotation: number; hits: Set<unknown>; attackPower: number; critChance: number; penetration: number; damageBonus?:number } | null = null
  attackPower = 0
  physicalResist = 0
  magicResist = 0
  attackSpeedMul = 1
  equipmentCombat = { critChance: 0, penetration: 0, physicalResist: 0, magicResist: 0, projectileReduction: 0 }
  private levelNoticeStart = -1
  showLevelUp(): void { this.levelNoticeStart = performance.now() }

  /** 切换手持时头顶弹名（只对真实物品生效；首次同步上膛，不弹） */
  private toolNoticeArmed = false
  private toolNotice: { name: string; color: string; cosmic: boolean; start: number } | null = null

  /** 面朝角度（弧度，跟随鼠标指针） */
  facing = 0
  /** 批次 E：行走进度时钟（移动时累积，驱动 bob/脚步；旧回退管线用） */
  private walkClock = 0
  /** 批次 E：最近移动方向（脚步交替的轴） */
  private moveAngle = 0
  /** 批次 F：骨骼动画状态机（idle/walk，翻滚/挥击后续轮次接入） */
  private animator = new PlayerAnimator()

  // —— 闪避状态（点按翻滚 / 长按长闪） ——
  dodgePhase: DodgePhase = 'none'
  dodgeTimer = 0
  dodgeCooldown = 0
  /** 最近一次闪避的 CD 总长（HUD 冷却条比例用） */
  private lastDodgeCdTotal = 1
  private afterDodgeEffects:readonly StatusDefinition[]=[]
  /** J 批次：闪避 CD 转好脉冲计时（>0 表示正在播"就绪"冲击动画） */
  private dodgeReadyPulse = 0
  iFrameTimer = 0
  /** 受伤无敌帧计时（受伤红闪期间） */
  hurtTimer = 0
  /** 受伤演出使用真实时间，打开暂停面板后也会及时淡出。 */
  hurtFlashAt = -Infinity
  hurtFlashSeverity = 0
  /** 受击击退冲量（独立于主控速度，指数衰减） */
  private knockX = 0
  private knockY = 0
  /** 长闪内部段：高速冲刺 / 慢速后撤滑行 */
  private longPhase: 'burst' | 'coast' = 'burst'
  /** 长闪后撤滑行段计时 */
  private coastTimer = 0
  /** 残影生成节拍 */
  private trailTick = 0
  /** 闪避冲出去的方向 */
  private dodgeAngle = 0
  /** 按压判定挂起中（已按下 Shift，等待长短按分流） */
  pendingDodge = false
  private pendingTimer = 0
  /** 闪避残影点（仅长闪产生；后撤滑行段会沿闪避方向"追上"主角） */
  private trail: Array<{ x: number; y: number; life: number; max: number }> = []
  /** 批次 F②：长闪人形虚影缓存（最近若干帧的完整骨骼姿态，重放半透明人偶） */
  private poseTrail: Array<{ pose: PlayerPose; x: number; y: number; life: number; max: number }> = []
  /** 人形虚影生成节拍（比圆点稀疏，保证同时只飘 3~4 个） */
  private poseTick = 0
  /** 状态产生的轻量拖影独立于闪避残影，最多保留三帧姿态。 */
  private statusTrail: Array<{ pose: PlayerPose; x: number; y: number; life: number; max: number; opacity: number }> = []
  private statusTrailTick = 0
  private statusTrailAnchor: { x: number; y: number } | null = null

  // —— 挥镐状态 ——
  swingPhase: SwingPhase = 'none'
  swingTimer = 0
  /** 本次挥击已命中的目标集合（敌人实体 + 'ore:col:row' 键，防重复判定） */
  hitSet = new Set<unknown>()
  /** 本次挥击已命中的敌人数（AOE 衰减排序用：决定下一只吃系数的几次方） */
  swingHitCount = 0
  /** 本次挥击是否已触发过命中顿帧（每刀最多顿一次，避免怪群跨帧连环冻结） */
  swingHitStopFired = false
  /** 挥击起始基准角度（=挥出瞬间的 facing） */
  private swingBaseAngle = 0
  /** 当前手持武器/镐的招式（数据驱动；换武器只换这一个对象）；null = 空手，不能攻击 */
  private melee: MeleeMove | null = getItemDef(PICK_RUSTY_ID).melee as MeleeMove
  /** 当前手持物品 id（渲染分派剑/镐外形用；null = 空手） */
  private toolId: ItemId | null = PICK_RUSTY_ID
  /** 本次挥击的招式快照（挥击中途换手持不影响当前动作，判定/渲染都读它） */
  private swingMelee: MeleeMove | null = null
  /** 本次挥击的手持物快照（与 swingMelee 同步，防止挥剑中途切镐导致外形跳变） */
  private swingToolId: ItemId | null = null
  private swingRollBonus = 0
  private charging = false
  private chargeElapsed = 0
  private chargeSegment = 0
  private chargeReadyPlayed = false
  private chargeReadyAge = -1
  private chargeLiftStart: number | null = null
  private swingChargePower = 1
  private swingChargeFull = false
  private swingStrikeIndex = 0
  private swingMoveProgress = 0
  private swingImpactIssued = false
  private chargeEffectSource: string | null = null
  private chargeEffects: { definitions: readonly StatusDefinition[]; releaseDuration: number } | null = null
  private weaponImpacts: WeaponImpactInstance[] = []
  private projectileErasure: WeaponBladeSegment[] = []
  getProjectileErasure(): readonly WeaponBladeSegment[] { return this.projectileErasure }
  drainWeaponImpacts(): WeaponImpactInstance[] { const effects = this.weaponImpacts; this.weaponImpacts = []; return effects }
  /** 冷却按物品保存，切手持不能重置技能。 */
  private chargeCooldowns = new Map<ItemId, number>()
  private weaponBurst: { tool: ItemId; elapsed: number; index: number; count: number; duration: number; segments?: readonly number[]; move?: MeleeMove } | null = null
  get weaponSkillCooldown(): number { return this.toolId ? this.chargeCooldowns.get(this.toolId) ?? 0 : 0 }
  get chargeProgress(): number { return this.charging ? Math.min(1, this.chargeElapsed / (this.weaponResource?.chargeAttack?.duration ?? 1)) : 0 }
  get swingChargeMultiplier(): number { return this.swingPhase === 'none' ? 1 : this.swingChargePower }
  get swingHitEffects(): readonly StatusDefinition[] { return this.swingChargeFull && this.swingPhase !== 'none' ? this.weaponResource?.chargeAttack?.fullHitEffects ?? [] : [] }
  /** 切场景、打开面板、失焦或长闪取消蓄力，不替玩家挥出。 */
  cancelCharge(keepReadyFx = false): void {
    if (!keepReadyFx && this.weaponBurst) { this.weaponBurst = null; this.finishSwing() }
    const wasCharging = this.charging
    if (this.chargeEffectSource && this.chargeEffects) {
      if (keepReadyFx && this.chargeProgress >= 1 - 1e-8) {
        for (const effect of this.chargeEffects.definitions) this.effects.add(effect, this.chargeEffectSource, this.chargeEffects.releaseDuration)
      } else this.effects.removeSource(this.chargeEffectSource)
      this.chargeEffectSource = null; this.chargeEffects = null
    }
    this.charging = false; this.chargeElapsed = 0; this.chargeReadyPlayed = false; this.chargeLiftStart = null
    if (!keepReadyFx) this.chargeReadyAge = -1
    if (wasCharging) {
      this.animator.setArmAim(this.swingArmAim(), this.swingArmBend())
      const motion = this.heldMotion()
      this.animator.setWeaponMotion(motion ? this.weaponResource?.bodyMotion?.(motion) : undefined, motion ? this.weaponResource?.supportGrip?.(motion) : undefined)
    }
  }
  get swingDamageBonus(): number { return this.swingPhase === 'none' ? 0 : this.swingRollBonus }
  private get swingEmpowered(): boolean { return this.doom.swingEmpowered || this.swingDamageBonus > 0 || this.swingChargePower > 1 || this.swingChargeFull }
  /** 武器连段当前段，具体招式与动作数量由资源声明。 */
  private weaponTrails: Array<WeaponTrailView & { duration: number; render: (ctx: CanvasRenderingContext2D, view: WeaponTrailView) => void }> = []
  private comboIndex = 0
  /** 连段输入缓冲（active 后半 / recover 内出现 held 即排队下一段） */
  private comboBuffer = false
  /** 收招后连段保留计时：0.25s 内再攻击=接续下一段，超时 comboIndex 归零 */
  private comboResetT = 0
  private readonly doom = new DoomsdayState()
  get doomHitIndex(): number { return this.doom.hitIndex }
  get doomSwingSerial(): number { return this.doom.swingSerial }
  get doomSwingEmpowered(): boolean { return this.doom.swingEmpowered }
  set doomSwingEmpowered(value: boolean) { this.doom.swingEmpowered = value }

  get isDoomsday(): boolean { return this.toolId === DOOMSDAY_ID }
  get doomsdayMode(): boolean { return this.doom.mode }
  get doomsdayStrikes(): number { return this.doom.strikes }
  get doomsdayCooldown(): number { return this.doom.cooldown }
  get doomsdayCooldownRatio(): number { return Math.max(0, Math.min(1, this.doom.cooldown / 15)) }
  get doomsdayModeFx(): number { return this.doom.modeFx }
  get doomsdayDurationRatio(): number { return Math.max(0, Math.min(1, this.doom.duration / 8)) }
  get doomsdaySwingHit(): boolean { return this.doom.swingHit }
  get doomsdayCanActivate(): boolean { return this.isDoomsday && !this.doom.mode && this.doom.cooldown <= 0 }
  /** 充能条脉冲强度 1→0（0.5s 衰减窗） */
  get doomsdayCdPulse(): number {
    const age = (performance.now() - this.doom.cdPulseAt) / 1000
    return age >= 0 && age < 0.5 ? 1 - age / 0.5 : 0
  }
  /**
   * 光刺插满奖励：削减杀戮冷却。冷却就绪/杀戮进行中无可削减秒数时返回 false。
   * @returns 本次是否真正减免了冷却（调用端据此播放飘字与脉冲）
   */
  reduceDoomCooldown(seconds: number): boolean {
    return this.doom.reduceCooldown(seconds)
  }
  startDoomsday(strikes: number): void {
    if (!this.doomsdayCanActivate || strikes <= 0) return
    this.doom.start(strikes)
    this.effects.add(SLAUGHTER_STANCE, 'skill:doomsday')
    this.swingPhase = 'none'
    this.comboBuffer = false
    this.doom.swingHit = false
  }
  finishDoomsday(): void {
    if (!this.doom.mode) return
    this.doom.finish()
    this.effects.removeSource('skill:doomsday')
    this.swingPhase = 'none'
    this.swingTimer = 0
  }
  cancelDoomsdayAction(): void {
    this.finishDoomsday()
    this.swingPhase = 'none'
    this.swingMelee = null
    this.swingToolId = null
    this.doom.swingEmpowered = false
    this.doom.crescents = []
    this.comboBuffer = false
  }
  consumeDoomsdayStrike(): void {
    if (!this.doom.mode || this.doom.swingHit) return
    this.doom.swingHit = true
    this.doom.strikes = Math.max(0, this.doom.strikes - 1)
    this.doom.hitIndex++
    if (this.doom.strikes === 0) this.finishDoomsday()
  }

  /** 当前动作资源；挥击中读取本次快照。 */
  private get weaponResource() {
    return this.activeToolId ? getItemDef(this.activeToolId).weapon : undefined
  }

  private get holdingSword(): boolean {
    return this.toolId !== null && (getItemDef(this.toolId).weapon?.combo ?? getItemDef(this.toolId).kind === 'weapon')
  }

  /** 连击段数由资源声明，已有武器默认保持三段。 */
  private get comboLength(): number {
    if (!this.holdingSword) return 1
    const count = this.toolId ? getItemDef(this.toolId).meleePattern?.moves.length || (getItemDef(this.toolId).weapon?.comboLength ?? 3) : 3
    return Math.max(1, Math.floor(count))
  }

  /**
   * 当前手持是否为镐类工具。
   * 镐是独立物品种类（kind='pick'）：所有镐都支持【长按自动挥舞】（采矿刚需手感）；
   * 武器是否长按连挥由各自资源的 autoRepeat 声明。
   */
  private get holdingPick(): boolean {
    return this.toolId !== null && getItemDef(this.toolId).kind === 'pick'
  }

  /** 当前段是否为大力下劈（第三段，挥击中） */
  private get isHeavySeg(): boolean {
    return this.comboIndex === 2 && this.swingPhase !== 'none'
  }

  constructor(x: number, y: number) {
    this.x = x
    this.y = y
  }

  /** 更换手持近战招式与手持物（切换武器A/B/镐时由 CaveModule 同步）；null = 空手 */
  setMelee(move: MeleeMove | null, tool: ItemId | null): void {
    if (this.toolId === DOOMSDAY_ID && tool !== DOOMSDAY_ID) this.cancelDoomsdayAction()
    const prev = this.toolId
    this.melee = move
    this.toolId = tool
    if (tool !== prev) { this.bow.cancelGesture(); this.projectileErasure.length = 0; this.cancelCharge(); this.resetWeaponPhysics(); this.comboResetT = 0 }
    this.syncHeldEffects()
    // 首次 setMelee 是进房/初始化同步，只上膛避免开局自弹；之后手持真正变化才弹名。
    // 切到空手（tool=null）静默；重复同步同一 id 也不弹。
    if (!this.toolNoticeArmed) { this.toolNoticeArmed = true; return }
    if (tool && tool !== prev) {
      const rarity = getItemDef(tool).rarity
      this.toolNotice = {
        name: itemName(tool),
        color: rarityColor(rarity) ?? RARITY_DEFAULT_COLOR,
        cosmic: rarity === COSMIC_RARITY,
        start: performance.now()
      }
    }
  }

  private syncHeldEffects(): void {
    const source = 'resource:held'
    const definitions = this.alive && this.toolId ? getItemDef(this.toolId).weapon?.heldEffects ?? [] : []
    this.effects.syncHeld(definitions, source)
  }

  /** 攻击增伤统一进入伤害乘区，近战实时读取，投射与连续符术在释放时快照。 */
  get outgoingDamageBonus():number{return this.effects.modify('damageDealt',1)-1}

  /** 当前动作手持物 id（挥击中读快照；矿脉门控/渲染分派共用） */
  get activeToolId(): ItemId | null {
    return this.swingPhase === 'none' ? this.toolId : this.swingToolId
  }

  /**
   * 应用角色成长派生（下矿开新局时由 CaveModule 按 Profile 注入一次）。
   * 开局满血满灵力；属性点全 0 时各值等于旧写死数值，行为零变化。
   */
  applyGrowth(g: DerivedCombat, refill = true): void {
    this.maxHp = Math.round(g.maxHp)
    this.maxMana = Math.round(g.maxMana)
    this.manaRegen = g.manaRegen
    this.knockbackBonus = g.knockbackBonus
    this.speedMul = g.moveSpeedMul
    this.attackPower = g.attackPower
    this.shootingDeviation = g.shootingDeviation
    this.rangedCritChance = g.rangedCritChance
    this.physicalResist = g.physicalResist
    this.magicResist = g.magicResist
    this.attackSpeedMul = g.attackSpeedMul
    this.hp = refill ? this.maxHp : Math.min(this.hp, this.maxHp)
    this.mana = refill ? this.maxMana : Math.min(this.mana, this.maxMana)
  }

  /** 治疗（消耗品）；返回实际回复量 */
  /** 食用成功后才添加状态，满血时保留食物。 */
  consumeItem(id: ItemId): boolean {
    if (!this.alive) return false
    const effect = getItemDef(id).consume
    if (!effect) return false
    if (effect.heal && this.heal(effect.heal) <= 0) return false
    if (!effect.heal && !effect.status) return false
    if (effect.status) this.effects.add(effect.status, `food:${effect.status.id}`)
    return true
  }

  heal(amount: number): number {
    if (!this.alive || amount <= 0) return 0
    const before = this.hp
    const event = { amount }
    this.effects.dispatch('beforeHeal', event)
    this.hp = Math.min(this.maxHp, this.hp + this.effects.modify('healing', event.amount))
    const real = this.hp - before
    this.effects.dispatch('healed', { amount: real })
    if (real > 0) sfx.heal()
    return real
  }

  /**
   * 剧情复活（序章教学期"不能倒在这里"独白后调用）：
   * 清除死亡/动作残留状态，原地以指定血量站起，并给 2 秒受创无敌防止围殴再死。
   */
  revive(hp: number): void {
    this.cancelCharge()
    this.swingRollBonus = 0
    this.clearStatusTrail()
    this.alive = true
    this.hp = Math.max(1, Math.min(this.maxHp, Math.round(hp)))
    this.vx = 0
    this.vy = 0
    this.dodgePhase = 'none'
    this.dodgeTimer = 0
    this.afterDodgeEffects=[]
    this.swingPhase = 'none'
    this.swingTimer = 0
    this.hurtTimer = 0
    this.hurtFlashAt = -Infinity
    this.hurtFlashSeverity = 0
    this.iFrameTimer = 2
  }

  /** 无敌 = 闪避无敌帧或受伤无敌帧任一生效 */
  get untargetable(): boolean { return this.alive && this.effects.untargetable }

  get isInvincible(): boolean {
    return this.untargetable || this.iFrameTimer > 0 || this.hurtTimer > 0
  }

  /** 生命比例 0~1（HUD 血条用） */
  get hpRatio(): number {
    return Math.max(0, this.hp / this.maxHp)
  }

  /** 灵力比例 0~1（HUD 灵条用） */
  get manaRatio(): number {
    return Math.max(0, this.mana / this.maxMana)
  }

  /** 当前符卡 CD 剩余比例 0~1（快捷栏冷却遮罩用） */
  get spellCdRatio(): number {
    return this.spellCooldown / this.lastSpellCdTotal
  }

  /** 符卡此刻能否释放（CD 已好且灵力够） */
  canCast(def: SpellCardDef): boolean {
    return this.alive && this.spellCooldown <= 0 && this.mana >= this.effects.modify('manaCost', def.manaCost)
  }

  /**
   * 尝试释放符卡：灵力 + CD 双门控，成功才扣资源并返回 true。
   * 具体伤害/消弹/演出由 RoomRuntime.resolveSpell 结算。
   */
  castSpell(def: SpellCardDef): boolean {
    if (!this.canCast(def)) return false
    const manaCost = this.effects.modify('manaCost', def.manaCost)
    this.mana -= manaCost
    this.spellCooldown = this.effects.modify('spellCooldown', def.cooldown)
    this.lastSpellCdTotal = this.spellCooldown
    this.effects.dispatch('spell', { manaCost, cooldown: this.spellCooldown })
    return true
  }

  /** 受伤：扣血 + 受伤无敌帧 + 击退；已死亡或无敌中无效；剧情锁血时最多打到 1 滴 */
  takeHit(amount: number, dirAngle: number, kind: DamageKind = 'physical', projectile = false): void {
    if (!this.alive || this.isInvincible || this.debugGod) return
    const event = { amount, kind, cancelled: false }
    this.effects.dispatch('beforeDamage', event)
    if (event.cancelled) return
    const resisted = calculateDamage({base:Math.max(0, event.amount),resistance:kind === 'magic' ? this.magicResist + this.equipmentCombat.magicResist : this.physicalResist + this.equipmentCombat.physicalResist}).damage
    const modified = this.effects.modify('damageTaken', kind === 'physical' ? this.effects.modify('physicalDamageTaken', resisted) : resisted)
    // 木盾在最终弹幕伤害上固定扣除，不降低接触、近战或地面范围伤害。
    const damage = Math.max(0, modified - (projectile ? this.equipmentCombat.projectileReduction : 0))
    const beforeHp = this.hp
    this.hp = Math.max(this.storyGuard ? 1 : 0, this.hp - damage)
    this.effects.dispatch('damaged', { amount: beforeHp - this.hp, kind })
    this.hurtTimer = CONFIG.hurt.iFrame
    if (this.hp < beforeHp) {
      this.hurtFlashAt = performance.now()
      this.hurtFlashSeverity = Math.pow(1 - Math.max(0, Math.min(1, this.hp / this.maxHp)), 2)
      sfx.hurt()
    }
    this.knockX = Math.cos(dirAngle) * CONFIG.hurt.knockback
    this.knockY = Math.sin(dirAngle) * CONFIG.hurt.knockback
    if (this.hp <= 0 && !this.storyGuard) {
      this.cancelCharge()
      this.swingRollBonus = 0
      this.alive = false
      this.clearStatusTrail()
      this.resetWeaponPhysics()
      this.effects.dispatch('death', {})
      this.effects.clear('death')
      this.rangedFlight = null
      this.bow.clear()
      this.tarot.clear()
      this.dodgePhase = 'none'
      this.afterDodgeEffects=[]
      this.swingPhase = 'none'
      this.vx = this.vy = 0
      this.knockX = this.knockY = 0
      sfx.playerDie()
    }
  }

  /** 闪避冷却剩余比例 0~1（HUD 用） */
  get dodgeCdRatio(): number {
    return this.dodgeCooldown / this.lastDodgeCdTotal
  }

  /** 长闪是否处于慢速后撤滑行段（动画锁定中，但不是站定硬直） */
  get isCoasting(): boolean {
    return this.dodgePhase === 'long' && this.longPhase === 'coast'
  }

  /** 斗篷当前色：i 帧闪白，受伤期间红，常态蓝 */
  private cloakColor(flashing: boolean): string {
    if (flashing) return '#dcecff'
    return this.hurtTimer > 0 ? '#e05a5a' : '#4f7cff'
  }

  /**
   * 批次 E：身体动态偏移（本地渲染与手持武器共用同一锚点）。
   * - 行走踮脚 bob（两步一抬）
   * - 挥击顿挫：蓄力逆朝向收身、判定帧顺朝向探身、收招回中
   */
  private bodyPose(): { ox: number; oy: number } {
    const moving = Math.hypot(this.vx, this.vy) > 30
    const bob = moving ? -Math.abs(Math.sin(this.walkClock)) * 1.4 : 0
    let lean = 0
    if (this.swingPhase === 'windup') lean = -1.8
    else if (this.swingPhase === 'active') lean = 2.6
    else if (this.swingPhase === 'recover') lean = 0.9
    const a = this.swingPhase !== 'none' ? this.swingBaseAngle : this.facing
    return { ox: Math.cos(a) * lean, oy: Math.sin(a) * lean + bob }
  }

  /**
   * 矿工帽（本地坐标，头心 (0,-5)）：黄色盔体 + 中央加强筋 + 随朝向伸出
   * 的帽檐 + 前缘帽灯（暖白点呼应光贴图里的帽灯光源）。
   */
  private renderHelmet(ctx: CanvasRenderingContext2D): void {
    // 帽檐（椭圆盘，长轴垂直于朝向，整体朝脸方向探出）
    const brx = Math.cos(this.facing) * 2.4
    const bry = -5 + Math.sin(this.facing) * 1.8
    ctx.save()
    ctx.translate(brx, bry)
    ctx.rotate(this.facing + Math.PI / 2)
    ctx.fillStyle = ART_INK
    ctx.beginPath()
    ctx.ellipse(0, 0.8, 10, 3.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#b9852a'
    ctx.beginPath()
    ctx.ellipse(0, 0, 9.4, 3.1, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#d9a846'
    ctx.beginPath()
    ctx.ellipse(0, -0.7, 8.4, 1.7, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 盔体（半圆盔）
    ctx.fillStyle = ART_INK
    ctx.beginPath()
    ctx.moveTo(-9.6, -5.5)
    ctx.quadraticCurveTo(-9.6, -16.4, 0, -16.4)
    ctx.quadraticCurveTo(9.6, -16.4, 9.6, -5.5)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#e8b237'
    ctx.beginPath()
    ctx.moveTo(-8.6, -6)
    ctx.quadraticCurveTo(-8.6, -15.2, 0, -15.2)
    ctx.quadraticCurveTo(8.6, -15.2, 8.6, -6)
    ctx.closePath()
    ctx.fill()
    // 盔顶受光
    ctx.fillStyle = '#f6cf6a'
    ctx.beginPath()
    ctx.ellipse(-2.4, -12.6, 4.6, 2.1, -0.5, 0, Math.PI * 2)
    ctx.fill()
    // 中央加强筋
    ctx.strokeStyle = '#b9852a'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(0, -15)
    ctx.lineTo(0, -7)
    ctx.stroke()

    // 帽灯（盔前缘的小银筒 + 暖白灯面 + 微光晕）
    const lx = Math.cos(this.facing) * 9.4
    const ly = -7.5 + Math.sin(this.facing) * 5
    ctx.save()
    ctx.translate(lx, ly)
    ctx.rotate(this.facing)
    ctx.fillStyle = ART_INK
    ctx.beginPath()
    ctx.ellipse(0, 0, 3.2, 2.6, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c8ccd4'
    ctx.beginPath()
    ctx.ellipse(0, 0, 2.5, 2, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // 灯面暖光（小光晕，真实照明走光贴图）
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 6)
    g.addColorStop(0, 'rgba(255,242,204,0.85)')
    g.addColorStop(0.5, 'rgba(255,216,144,0.3)')
    g.addColorStop(1, 'rgba(255,216,144,0)')
    ctx.fillStyle = g
    ctx.fillRect(lx - 6, ly - 6, 12, 12)
    ctx.restore()
    ctx.fillStyle = '#fff6dc'
    ctx.beginPath()
    ctx.arc(lx, ly, 1.3, 0, Math.PI * 2)
    ctx.fill()
  }

  /**
   * 每帧逻辑
   * @param pointerX 指针世界坐标
   */
  update(
    dt: number,
    input: {
      moveX: number
      moveY: number
      /** Shift 本帧刚按下 */
      dodgePressed: boolean
      /** Shift 当前按住 */
      dodgeHeld: boolean
      /** Shift 本帧刚松开 */
      dodgeReleased: boolean
      /** 攻击键本帧刚按下（边沿信号；武器点一下挥一下） */
      attackPressed: boolean
      /** 攻击键当前按住（电平信号；镐类工具长按自动连挥） */
      attackHeld: boolean
      attackReleased?: boolean
      specialPressed?: boolean
      specialHeld?: boolean
      specialReleased?: boolean
      pointerX: number
      pointerY: number
    },
    map: TileMap,
    /** J 批次：本房立体摆件（薄横线碰撞箱；玩家被挡、会沿线滑动） */
    props: readonly Prop[] = []
  ): void {
    const c = CONFIG.player
    this.projectileErasure.length = 0
    const previousBladeMotion = this.weaponResource?.eraseProjectiles ? this.heldMotion() : undefined
    const previousBladeTool = this.activeToolId
    if (this.alive) {
      this.effectTime += dt
      for (const [id, cooldown] of this.chargeCooldowns) {
        const remaining = Math.max(0, cooldown - dt)
        if (remaining === 0) this.chargeCooldowns.delete(id)
        else this.chargeCooldowns.set(id, remaining)
      }
    }
    if (this.chargeReadyAge >= 0) {
      this.chargeReadyAge += dt
      if (this.chargeReadyAge > .6) this.chargeReadyAge = -1
    }
    for (const trail of this.weaponTrails) trail.age += dt
    this.weaponTrails = this.weaponTrails.filter(trail => trail.age < trail.duration)
    for (const trail of this.doom.crescents) trail.life -= dt
    this.doom.crescents = this.doom.crescents.filter(trail => trail.life > 0)

    // —— 死亡：只保留朝向与惯性滑行，不再响应任何输入 ——
    if (!this.alive) {
      if (this.isDoomsday) this.cancelDoomsdayAction()
      this.iFrameTimer = Math.max(0, this.iFrameTimer - dt)
      this.hurtTimer = Math.max(0, this.hurtTimer - dt)
      this.vx *= Math.exp(-6 * dt)
      this.vy *= Math.exp(-6 * dt)
      const prevX = this.x
      const prevY = this.y
      const deadMove: Collider = { x: this.x, y: this.y, vx: this.vx, vy: this.vy, r: c.collisionR }
      map.moveEntity(deadMove, dt)
      // 遗体贴地滑行同样不穿摆件
      if (props.length > 0) resolveCircleProps(deadMove, prevX, prevY, props)
      this.x = deadMove.x
      this.y = deadMove.y
      return
    }

    // 面朝鼠标（闪避动画中也允许朝向指针观察）
    this.facing = Math.atan2(input.pointerY - this.y, input.pointerX - this.x)
    // 批次 E：记录移动朝向 + 行走时钟
    if (input.moveX !== 0 || input.moveY !== 0) {
      this.moveAngle = Math.atan2(input.moveY, input.moveX)
    }
    if (Math.hypot(this.vx, this.vy) > 30) this.walkClock += dt * 11
    // 批次 F：骨骼动画时钟（速度/移动向/瞄准）
    this.animator.update(dt, {
      speed: Math.hypot(this.vx, this.vy),
      moveAngle: this.moveAngle,
      aim: this.facing,
      armAim: this.swingArmAim(),
      armBend: this.swingArmBend(),
      armed: this.activeToolId !== null && !getItemDef(this.activeToolId).weapon?.hiddenHeld
    })

    // —— 状态与计时器按同一逻辑时间推进 ——
    this.syncHeldEffects()
    this.effects.update(dt)
    this.tarot.tick(dt)
    if(this.bow.tick(dt,input.attackHeld,input.attackReleased,this.facing))sfx.bowReady()
    if(this.dodgePhase!=='none')this.bow.cancelGesture()
    const cdBefore = this.dodgeCooldown
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt)
    // CD 刚好归零的边沿 → 触发"闪避就绪"轻冲击
    if (cdBefore > 0 && this.dodgeCooldown === 0) this.dodgeReadyPulse = 0.4
    this.dodgeReadyPulse = Math.max(0, this.dodgeReadyPulse - dt)
    this.iFrameTimer = Math.max(0, this.iFrameTimer - dt)
    this.hurtTimer = Math.max(0, this.hurtTimer - dt)
    this.spellCooldown = Math.max(0, this.spellCooldown - dt)
    if (this.doom.update(dt)) this.finishDoomsday()
    this.doom.updateTransition(dt)
    // 灵力自然回复（封顶）
    if (this.alive) this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * dt)
    this.swingTimer -= dt * this.effects.modify('attackSpeed', this.activeToolId === DOOMSDAY_ID ? (this.doom.mode ? 1.2 : 1) : this.attackSpeedMul)

    // —— 闪避按压分流判定（仅自由态接收新输入） ——
    const dodgeReady = this.dodgePhase === 'none'
    if (this.pendingDodge) {
      this.pendingTimer += dt
      if (input.dodgeReleased) {
        // 在阈值内松开 = 点按 → 翻滚；超过阈值才松开说明长闪早已触发，丢弃即可
        if (this.pendingTimer < c.dodge.holdThreshold && dodgeReady && this.dodgeCooldown <= 0) {
          this.startDodge('short', input.moveX, input.moveY)
        }
        this.pendingDodge = false
      } else if (input.dodgeHeld && this.pendingTimer >= c.dodge.holdThreshold) {
        // 按住超过阈值 = 长按 → 长闪（松手前立即触发）
        if (dodgeReady && this.dodgeCooldown <= 0) this.startDodge('long', input.moveX, input.moveY)
        this.pendingDodge = false
      } else if (!input.dodgeHeld) {
        // 失焦等兜底：没有 held 也没有 release 边沿
        this.pendingDodge = false
      }
    } else if (input.dodgePressed && dodgeReady) {
      if (input.dodgeReleased) {
        // 极端快按：按下与松开在同一帧，直接判定为点按 → 翻滚
        if (this.dodgeCooldown <= 0) this.startDodge('short', input.moveX, input.moveY)
      } else {
        this.pendingDodge = true
        this.pendingTimer = 0
      }
    }

    const chargeRelease = this.updateCharge(dt, input)
    // —— 位移计算 ——
    let targetVx: number
    let targetVy: number
    if (this.dodgePhase === 'short') {
      // 翻滚：高速定向团身前滚，移动输入无效，结束立刻恢复自由
      const d = c.dodge.short
      targetVx = Math.cos(this.dodgeAngle) * d.speed
      targetVy = Math.sin(this.dodgeAngle) * d.speed
      this.dodgeTimer -= dt
      if (this.dodgeTimer <= 0) this.finishDodge()
    } else if (this.dodgePhase === 'long') {
      // 长闪两段式：高速冲刺 → 慢速后撤滑行（整段动画锁移动输入）
      const d = c.dodge.long
      this.trailTick -= dt
      if (this.longPhase === 'burst') {
        targetVx = Math.cos(this.dodgeAngle) * d.speed
        targetVy = Math.sin(this.dodgeAngle) * d.speed
        this.dodgeTimer -= dt
        // 冲刺沿途留下稀疏残影（"些许"即可）
        if (this.trailTick <= 0) {
          this.trail.push({ x: this.x, y: this.y, life: 0.4, max: 0.4 })
          this.trailTick = 0.04
        }
        // 批次 F②：人形虚影（节拍更稀，同屏保持 3~4 个）
        this.poseTick -= dt
        if (this.poseTick <= 0) {
          this.poseTrail.push({ pose: this.snapshotPose(), x: this.x, y: this.y, life: 0.38, max: 0.38 })
          this.poseTick = 0.09
        }
        if (this.dodgeTimer <= 0) {
          // 冲刺结束 → 进入慢速后撤滑行（视觉拉长，非站定硬直）
          this.longPhase = 'coast'
          this.coastTimer = d.coast
          this.trailTick = 0
        }
      } else {
        // 后撤滑行：目标速度骤降，由指数减速曲线形成自然减速滑步
        targetVx = Math.cos(this.dodgeAngle) * d.coastSpeed
        targetVy = Math.sin(this.dodgeAngle) * d.coastSpeed
        this.coastTimer -= dt
        // 滑行中偶发贴身残影
        if (this.trailTick <= 0) {
          this.trail.push({ x: this.x, y: this.y, life: 0.22, max: 0.22 })
          this.trailTick = 0.05
        }
        // 批次 F②：滑行段人偶更淡更稀
        this.poseTick -= dt
        if (this.poseTick <= 0) {
          this.poseTrail.push({ pose: this.snapshotPose(), x: this.x, y: this.y, life: 0.24, max: 0.24 })
          this.poseTick = 0.08
        }
        // 滑行动画结束 = 落地，瞬间恢复自由（无额外站定时间）
        if (this.coastTimer <= 0) this.finishDodge()
      }
    } else {
      const len = Math.hypot(input.moveX, input.moveY)
      if (len > 0) {
        const charge = this.weaponResource?.chargeAttack
        const chargeSpeed = this.charging ? charge?.moveMultiplier ?? 1 - (1 - (charge?.minimumMoveMultiplier ?? 1)) * this.chargeProgress : 1
        const moveSpeed = this.effects.modify('moveSpeed', c.speed * this.speedMul) * chargeSpeed
        targetVx = (input.moveX / len) * moveSpeed
        targetVy = (input.moveY / len) * moveSpeed
      } else {
        targetVx = 0
        targetVy = 0
      }
    }

    // 帧率独立的加减速（指数趋近）
    const k = 1 - Math.exp(-c.accel * dt)
    this.vx += (targetVx - this.vx) * k
    this.vy += (targetVy - this.vy) * k

    // 受击击退冲量衰减，并合入本帧候选位移，统一交给瓦片地图做分轴碰撞修正
    this.knockX *= Math.exp(-7 * dt)
    this.knockY *= Math.exp(-7 * dt)
    const attackStep = this.attackMovementStep(dt)
    const moved: Collider = {
      x: this.x,
      y: this.y,
      vx: this.vx + this.knockX + attackStep.x,
      vy: this.vy + this.knockY + attackStep.y,
      r: c.collisionR
    }
    // 移动前位置：摆件推挤的扫掠防隧穿基准（闪避高速冲线也不穿石头）
    const prevX = this.x
    const prevY = this.y
    map.moveEntity(moved, dt)
    if (props.length > 0) resolveCircleProps(moved, prevX, prevY, props)
    this.x = moved.x
    this.y = moved.y

    // 残影更新：后撤滑行段沿闪避方向加速"追上"主角，同时缩小淡出
    const catchSpeed = this.isCoasting ? c.dodge.long.trailCatch : 0
    for (const t of this.trail) {
      t.life -= dt
      if (catchSpeed > 0) {
        t.x += Math.cos(this.dodgeAngle) * catchSpeed * dt
        t.y += Math.sin(this.dodgeAngle) * catchSpeed * dt
      }
    }
    this.trail = this.trail.filter((t) => t.life > 0)
    // 批次 F②：人形虚影同步衰减 + 滑行段追赶
    for (const t of this.poseTrail) {
      t.life -= dt
      if (catchSpeed > 0) {
        t.x += Math.cos(this.dodgeAngle) * catchSpeed * dt
        t.y += Math.sin(this.dodgeAngle) * catchSpeed * dt
      }
    }
    this.poseTrail = this.poseTrail.filter((t) => t.life > 0)

    // —— 挥击状态机：短闪对攻击完全透明（短闪中可起手、挥击不中断，形成滑步挥击）；
    //    仅长闪冲刺/后撤动画期间锁新攻击。批次 F③：剑类三段连击 + 输入缓冲 ——
    //    镐与声明 autoRepeat 的武器吃长按信号，其余武器吃单次点击信号。
    // 收招后的连段保留窗口（0.25s 内点按接续=下一段，超时 comboIndex 归零）
    if (this.swingPhase === 'none' && this.comboResetT > 0) {
      this.comboResetT -= dt
      if (this.comboResetT <= 0) this.comboIndex = 0
    }
    const canStartSwing = this.dodgePhase === 'none' || this.dodgePhase === 'short'
    this.rangedCooldown = Math.max(0, this.rangedCooldown - dt)
    const ranged = this.toolId ? getItemDef(this.toolId).ranged : undefined
    const rangedSignal = this.weaponResource?.autoRepeat ? input.attackPressed || input.attackHeld : input.attackPressed
    if (ranged && rangedSignal && canStartSwing && this.swingPhase === 'none' && (ranged.type !== 'boomerang' || !this.rangedFlight) && this.rangedCooldown === 0) {
      const deviation = Math.max(0, this.shootingDeviation + ranged.accuracyPenalty) * Math.PI / 180
      const item = getItemDef(this.toolId!)
      const angle = this.facing + (Math.random() * 2 - 1) * deviation
      if (ranged.type === 'bow') {
        if(this.dodgePhase==='none'){
          const interval=this.bow.start(this,this.toolId!,this.ammoInventory)
          if(interval!==null){this.rangedCooldown=interval;sfx.bowDraw()}
        }
      } else if (ranged.type === 'tarot') {
        if (this.tarot.fire(this, angle, this.x + Math.cos(angle) * 12, this.y - 5 + Math.sin(angle) * 12)) {
          this.rangedCooldown = ranged.attackInterval
          sfx.swing('slash')
        }
      } else {
      this.rangedFlight = { item: this.toolId!, x: this.x, y: this.y,
        angle,
        remaining: Math.hypot(input.pointerX - this.x, input.pointerY - this.y), returning: false, rotation: 0, hits: new Set(),
        attackPower: 0, critChance: this.rangedCritChance + (item.combat?.critChance ?? 0) + this.equipmentCombat.critChance,
        penetration: (item.combat?.penetration ?? 0) + this.equipmentCombat.penetration,damageBonus:this.outgoingDamageBonus }
      sfx.swing('slash')
      }
    }
    const attackSignal = this.holdingPick || (this.toolId && getItemDef(this.toolId).weapon?.autoRepeat) ? input.attackHeld : input.attackPressed
    const chargeComponent = this.weaponResource?.chargeAttack
    const chargedWeapon = !!chargeComponent && chargeComponent.trigger !== 'special'
    const reservingCharge = chargeComponent?.trigger === 'special' && !!input.specialHeld && this.weaponSkillCooldown === 0
    const chargeSkillReleased = chargeRelease !== null && chargeRelease >= 1 - 1e-8
    if (reservingCharge || this.charging) this.comboBuffer = false
    let burstStarted = false
    if (!this.weaponBurst && this.swingPhase === 'none' && (chargedWeapon ? chargeRelease !== null : chargeSkillReleased || attackSignal && !this.charging && !reservingCharge) && canStartSwing && this.melee) {
      // 按资源段数接续动作；镐和单动作武器始终使用第 0 段。
      const seg = chargedWeapon ? this.chargeSegment : this.holdingSword && this.comboResetT > 0 ? (this.comboIndex + 1) % this.comboLength : 0
      const burst = this.weaponResource?.chargeAttack?.burst
      if (burst && chargeRelease !== null && chargeRelease >= 1 - 1e-8 && this.weaponSkillCooldown === 0 && this.toolId) {
        this.weaponBurst = { tool: this.toolId, elapsed: 0, index: -1, ...burst }
        this.chargeCooldowns.set(this.toolId, burst.cooldown)
        burstStarted = true
      } else {
        this.startSwing(seg, chargeRelease ?? 0)
        if (chargeSkillReleased && chargeComponent?.cooldown !== undefined && this.toolId) this.chargeCooldowns.set(this.toolId, chargeComponent.cooldown)
      }
      if (chargeSkillReleased) for (const effect of chargeComponent?.releaseEffects ?? []) this.effects.add(effect, 'weapon:release:' + this.toolId)
      if ((this.swingMelee?.windup ?? 0) > 0) {
        if (this.weaponResource?.sound) this.weaponResource.sound('windup', this.comboIndex, this.swingEmpowered)
        else sfx.swing(this.melee.shape)
      }
    }
    const bursting = !!this.weaponBurst
    if (bursting) this.updateWeaponBurst(burstStarted ? 0 : dt)
    const sm = this.swingMelee
    if (!bursting) {
      // 自动挥舞只续接仍按住的输入；松手后完成当前段，取消由长按排队的下一段。
      if (this.weaponResource?.autoRepeat && !input.attackHeld) this.comboBuffer = false
      // 输入缓冲：active 后半 + recover 窗口内给出攻击信号即排队下一段
      // （剑=点按记忆，镐=按住自然续挥，连点/长按都不断招）
      if (
        sm &&
        !chargedWeapon && !reservingCharge && !this.charging && this.weaponResource?.buffer !== false &&
        this.comboBuffer === false &&
        attackSignal &&
        ((this.swingPhase === 'active' && this.swingTimer <= sm.active * 0.5) ||
          this.swingPhase === 'recover')
      ) {
        this.comboBuffer = true
      }
      if (this.swingPhase === 'windup' && this.swingTimer <= 0) {
        this.activateSwing()
      } else if (this.swingPhase === 'active' && this.swingTimer <= 0) {
        this.weaponResource?.sound?.('recover', this.comboIndex, this.swingEmpowered)
        this.swingPhase = 'recover'
        this.swingTimer = (this.weaponResource?.preserveOvershoot ? this.swingTimer : 0) + (sm?.recover ?? 0)
      } else if (this.swingPhase === 'recover' && this.swingTimer <= 0) {
        if ((this.comboBuffer || (this.isDoomsday && input.attackHeld)) && this.melee && canStartSwing) {
          // 缓冲命中：收招帧立刻接资源声明的下一段，单动作武器仍用第 0 段。
          const seg = this.holdingSword && this.toolId === this.swingToolId ? (this.comboIndex + 1) % this.comboLength : 0
          const overshoot = this.swingTimer
          this.startSwing(seg)
          if (this.isDoomsday || this.weaponResource?.preserveOvershoot) this.swingTimer += overshoot
          if (this.weaponResource?.sound) this.weaponResource.sound('windup', this.comboIndex, this.swingEmpowered)
          else sfx.swing(this.melee.shape)
        } else {
          this.finishSwing()
        }
      }
    }
    this.updateRepeatedHits()
    this.emitWeaponImpact()
    // 动作状态和位移完成后同步主手，再推进每实例物理；绘制不再改动画角。
    this.animator.setArmAim(this.swingArmAim(), this.swingArmBend())
    const motion = this.heldMotion()
    const rangedType=this.activeToolId?getItemDef(this.activeToolId).ranged?.type:undefined
    this.animator.setWeaponMotion(rangedType==='bow'?this.bow.bodyMotion:rangedType==='tarot'?this.tarot.bodyMotion:motion?this.weaponResource?.bodyMotion?.(motion):undefined,
      rangedType==='bow'?this.bow.grip(this.facing):motion?this.weaponResource?.supportGrip?.(motion):undefined)
    if(rangedType==='bow'&&this.bow.release(this,this.ammoInventory,getPlayerHandAnchor(this.x,this.y,this.animator.build(this.facing)))){
      this.rangedCooldown=Math.max(this.rangedCooldown,this.bow.cooldownAfterRelease)
      sfx.bowRelease(this.bow.lastShotCharged)
    }
    this.updateProjectileErasure(dt, previousBladeMotion, previousBladeTool, prevX, prevY)
    this.updateWeaponPhysics(dt, map)
    this.updateStatusTrail(dt, prevX, prevY)
  }

  /** 在真实骨骼握点上取样枪刃，并连接相邻刃段；只在拥有此组件的武器判定期执行。 */
  private updateProjectileErasure(dt: number, previous: WeaponMotionView | undefined, previousTool: ItemId | null, prevX: number, prevY: number): void {
    const resource = this.weaponResource, component = resource?.eraseProjectiles, current = this.heldMotion()
    if (!component || !current || !this.alive || this.dodgePhase !== 'none' || previousTool !== this.activeToolId) return
    const base = current.phase === 'active' ? current : previous?.phase === 'active' ? previous : undefined
    if (!base) return
    const clamp = (p: number) => Math.max(0, Math.min(1, p))
    const end = current.phase === 'active' ? clamp(1 - current.timer / base.move.active) : 1
    const start = previous?.phase === 'active' && previous.segment === base.segment
      ? clamp(1 - previous.timer / base.move.active) : Math.max(0, end - dt * this.effects.modify('attackSpeed', this.attackSpeedMul) / base.move.active)
    const samples = Math.max(1, Math.min(16, Math.ceil(Math.max(0, end - start) * base.move.active / .008)))
    let last: readonly [{ x: number; y: number }, { x: number; y: number }] | undefined
    for (let i = 0; i <= samples; i++) {
      const t = i / samples, progress = start + (end - start) * t
      const motion: WeaponMotionView = { ...base, phase: 'active', timer: base.move.active * (1 - progress),
        strikeIndex: Math.min((base.move.repeatHits ?? 1) - 1, Math.floor(progress * (base.move.repeatHits ?? 1))) }
      this.animator.setArmAim(resource.armAim?.(motion) ?? motion.aim, resource.armBend?.(motion) ?? 0)
      this.animator.setWeaponMotion(resource.bodyMotion?.(motion), resource.supportGrip?.(motion))
      const x = prevX + (this.x - prevX) * t, y = prevY + (this.y - prevY) * t, pose = this.animator.build(motion.facing)
      const hand = getPlayerHandAnchor(x, y, pose), blade = component.blade({ x, y, hand, move: motion.move, phase: 'active', timer: motion.timer, aim: motion.aim, motion })
      if (!blade) { last = undefined; continue }
      this.projectileErasure.push({ from: blade[0], to: blade[1], radius: component.radius })
      if (last) {
        const links = Math.max(1, Math.min(8, Math.ceil(Math.hypot(blade[1].x - blade[0].x, blade[1].y - blade[0].y) / Math.max(1, component.radius * 2))))
        for (let j = 0; j <= links; j++) {
          const u = j / links
          this.projectileErasure.push({ from: { x: last[0].x + (last[1].x - last[0].x) * u, y: last[0].y + (last[1].y - last[0].y) * u },
            to: { x: blade[0].x + (blade[1].x - blade[0].x) * u, y: blade[0].y + (blade[1].y - blade[0].y) * u }, radius: component.radius })
        }
      }
      last = blade
    }
    // 取样只复算姿态，结束后恢复本帧真正的动作，不推进任何动画时钟。
    this.animator.setArmAim(this.swingArmAim(), this.swingArmBend())
    this.animator.setWeaponMotion(resource.bodyMotion?.(current), resource.supportGrip?.(current))
    this.animator.build(this.facing)
  }

  /** 连斩按逻辑时间排程，各刀分别清空命中集合，攻速加点不改变刀数或总时长。 */
  private updateWeaponBurst(dt: number): void {
    const burst = this.weaponBurst
    if (!burst) return
    burst.elapsed += dt
    if (burst.elapsed + 1e-8 >= burst.duration || burst.tool !== this.toolId) {
      this.weaponBurst = null; this.finishSwing(); return
    }
    const interval = burst.duration / burst.count
    const index = Math.min(burst.count - 1, Math.floor((burst.elapsed + 1e-8) / interval))
    if (index !== burst.index) {
      burst.index = index
      this.startSwing(burst.segments?.[index % burst.segments.length] ?? index % this.comboLength)
      this.activateSwing()
    }
    const elapsed = burst.elapsed - index * interval, move = this.swingMelee!
    this.swingPhase = elapsed < move.active ? 'active' : 'recover'
    this.swingTimer = this.swingPhase === 'active' ? move.active - elapsed : interval - elapsed
  }

  /** 每刀只在判定窗口开启时生成一次刀影和破风声。 */
  private activateSwing(): void {
    const sm = this.swingMelee
    this.swingPhase = 'active'
    this.swingStrikeIndex = 0
    this.weaponResource?.sound?.('active', this.comboIndex, this.swingEmpowered)
    this.emitWeaponImpact(0)
    const trail = this.weaponResource?.trail
    if (trail) this.weaponTrails.push({ x: this.x, y: this.y, angle: this.swingBaseAngle, startAngle: this.doom.liftStart, chargePower: this.swingChargePower, chargeFull: this.swingChargeFull, strikeIndex: this.swingStrikeIndex, segment: this.comboIndex, age: 0, empowered: this.swingEmpowered, burst: !!this.weaponBurst, activeDuration: this.weaponBurst ? sm!.active : (sm?.active ?? 0) / Math.max(1, sm?.repeatHits ?? 1) / this.effects.modify('attackSpeed', this.attackSpeedMul), ...trail })
    this.swingTimer = (this.weaponResource?.preserveOvershoot ? this.swingTimer : 0) + (sm?.active ?? 0)
    if (this.swingToolId === DOOMSDAY_ID && sm) this.doom.crescents.push({ x: this.x, y: this.y, angle: this.swingBaseAngle, reach: sm.reach, direction: this.comboIndex === 0 ? 1 : -1, life: 0.38, empowered: this.doom.swingEmpowered })
  }

  /** 用逻辑触地时刻统一地面演出、重砸声与震动，避免空中就冒出凹坑。 */
  private emitWeaponImpact(progress?: number): void {
    const impact = this.weaponResource?.impactFx, move = this.swingMelee
    if (!impact || !move || this.swingImpactIssued || impact.skillOnly && !this.swingChargeFull) return
    if (this.swingPhase !== 'active' && this.swingPhase !== 'recover') return
    const p = progress ?? (this.swingPhase === 'recover' ? 1 : Math.max(0, 1 - this.swingTimer / move.active))
    if (p + 1e-8 < (impact.contactProgress ?? 0)) return
    this.swingImpactIssued = true; impact.sound?.()
    this.weaponImpacts.push({ x: this.x, y: this.y, angle: this.swingBaseAngle, move, age: -(impact.delay ?? 0),
      duration: impact.duration, shake: impact.shake, render: impact.render })
  }

  /** 分段戳击在自己的判定窗口重置命中，不能让同一个目标整段只挨一次。 */
  private updateRepeatedHits(): void {
    const move = this.swingMelee, count = Math.max(1, move?.repeatHits ?? 1)
    if (!move || this.swingPhase !== 'active' || count <= 1) return
    const progress = Math.max(0, Math.min(.999999, 1 - this.swingTimer / move.active))
    const index = Math.min(count - 1, Math.floor((progress + 1e-8) * count))
    if (index === this.swingStrikeIndex) return
    this.swingStrikeIndex = index; this.hitSet.clear(); this.swingHitCount = 0; this.swingHitStopFired = false
    this.weaponResource?.sound?.('active', this.comboIndex, this.swingEmpowered)
    const trail = this.weaponResource?.trail
    if (trail) this.weaponTrails.push({ x: this.x, y: this.y, angle: this.swingBaseAngle, segment: this.comboIndex, strikeIndex: index, age: 0,
      chargeFull: this.swingChargeFull, activeDuration: move.active / count / this.effects.modify('attackSpeed', this.attackSpeedMul), ...trail })
  }

  private attackMovementStep(dt: number): { x: number; y: number } {
    const move = this.swingMelee
    if (dt <= 0 || this.swingPhase !== 'active' || !move?.movement) return { x: 0, y: 0 }
    const progress = Math.max(0, Math.min(1, 1 - this.swingTimer / move.active)), eased = 1 - (1 - progress) ** 2
    const step = Math.max(0, eased - this.swingMoveProgress) * move.movement.distance * move.movement.direction / dt
    this.swingMoveProgress = eased
    return this.dodgePhase === 'none' ? { x: Math.cos(this.swingBaseAngle) * step, y: Math.sin(this.swingBaseAngle) * step } : { x: 0, y: 0 }
  }

  private finishSwing(): void {
    const comboWindow = this.weaponResource?.comboWindow ?? .25
    this.swingPhase = 'none'; this.swingMelee = null; this.swingToolId = null
    this.swingChargePower = 1; this.swingChargeFull = false; this.comboBuffer = false
    this.comboResetT = comboWindow
    if (comboWindow === 0) this.comboIndex = 0
  }

  private updateCharge(dt: number, input: { attackPressed: boolean; attackHeld: boolean; attackReleased?: boolean; specialPressed?: boolean; specialHeld?: boolean; specialReleased?: boolean }): number | null {
    const component = this.weaponResource?.chargeAttack
    if (!component || !this.alive || this.dodgePhase === 'long') { this.cancelCharge(); return null }
    if (component.cancelOnShortDodgeBeforeReady && this.dodgePhase === 'short' && !this.charging) return null
    if (this.swingPhase !== 'none') {
      if (this.charging) this.cancelCharge()
      return null
    }
    if (this.weaponBurst) return null
    const special = component.trigger === 'special'
    const pressed = special ? !!input.specialPressed : input.attackPressed
    const held = special ? !!input.specialHeld : input.attackHeld
    const released = special ? input.specialReleased : input.attackReleased
    if (!this.charging && (component.burst || component.cooldown !== undefined) && this.weaponSkillCooldown > 0) {
      if (special || !pressed) return null
      this.chargeSegment = this.holdingSword && this.comboResetT > 0 ? (this.comboIndex + 1) % this.comboLength : 0
      return 0
    }
    if (!this.charging && (pressed || special && held)) {
      this.charging = true; this.chargeElapsed = 0; this.chargeReadyPlayed = false; this.chargeReadyAge = -1
      this.chargeSegment = this.holdingSword && this.comboResetT > 0 ? (this.comboIndex + 1) % this.comboLength : 0
    }
    if (!this.charging) return null
    if (!held) {
      const progress = this.chargeProgress
      const liftStart = this.swingArmAim()
      this.cancelCharge(released !== false)
      if (released !== false) this.chargeLiftStart = liftStart
      return released === false || special && progress < 1 - 1e-8 ? null : progress
    }
    this.chargeElapsed = Math.min(component.duration, this.chargeElapsed + dt)
    if (this.chargeProgress >= 1 - 1e-8 && !this.chargeReadyPlayed) { this.chargeReadyPlayed = true; this.chargeReadyAge = 0; component.readySound?.()
      if (component.readyEffects && this.toolId) {
        this.chargeEffects = component.readyEffects; this.chargeEffectSource = 'weapon:charge:' + this.toolId
        for (const effect of component.readyEffects.definitions) this.effects.add(effect, this.chargeEffectSource, null)
      }
    }
    return null
  }

  private clearStatusTrail(): void {
    this.statusTrail.length = 0
    this.statusTrailTick = 0
    this.statusTrailAnchor = null
  }

  /** 只在实际发生位移时取样；站定后淡出，长闪期间由原有残影接管。 */
  private updateStatusTrail(dt: number, prevX: number, prevY: number): void {
    if (this.statusTrail.length > 0) {
      for (const trail of this.statusTrail) trail.life -= dt
      this.statusTrail = this.statusTrail.filter(trail => trail.life > 0)
    }
    const visual = this.effects.afterimage()
    if (!visual || !CONFIG.art.rig || this.dodgePhase !== 'none') {
      this.statusTrailTick = 0
      this.statusTrailAnchor = null
      return
    }
    this.statusTrailTick = Math.max(0, this.statusTrailTick - dt)
    if (Math.hypot(this.x - prevX, this.y - prevY) < .05) return
    const anchor = this.statusTrailAnchor ?? { x: prevX, y: prevY }
    if (this.statusTrailTick > 0 || Math.hypot(this.x - anchor.x, this.y - anchor.y) < visual.minDistance) {
      if (!this.statusTrailAnchor) this.statusTrailAnchor = anchor
      return
    }
    const duration = Math.max(.01, visual.duration)
    this.statusTrail.push({ pose: this.snapshotPose(), x: prevX, y: prevY, life: duration, max: duration, opacity: Math.max(0, Math.min(.25, visual.opacity)) })
    if (this.statusTrail.length > 3) this.statusTrail.shift()
    this.statusTrailTick = Math.max(.04, visual.interval)
    this.statusTrailAnchor = { x: this.x, y: this.y }
  }

  /** 起手一段挥击：快照招式/手持物、锁基准角、记录段号 */
  private startSwing(seg: number, chargeProgress = 0): void {
    this.swingRollBonus = 0
    this.swingMoveProgress = 0; this.swingStrikeIndex = 0; this.swingImpactIssued = false
    this.swingChargePower = chargeMultiplier(this.weaponResource?.chargeAttack, chargeProgress)
    this.swingChargeFull = chargeProgress >= 1 - 1e-8
    this.weaponSweep = this.toolId ? getItemDef(this.toolId).weapon?.createSweep?.() ?? null : null
    const baseMove = this.weaponBurst?.move ?? (this.toolId ? meleeForSegment(getItemDef(this.toolId), seg) ?? this.melee : this.melee)
    if (!baseMove) return
    let m = this.weaponResource?.chargeAttack?.move?.(baseMove, chargeProgress) ?? baseMove
    if (this.weaponBurst) {
      const interval = this.weaponBurst.duration / this.weaponBurst.count
      m = { ...m, windup: 0, active: interval * .78, recover: interval * .22,
        powerCoefficient: baseMove.powerCoefficient ?? baseMove.windup + baseMove.active + baseMove.recover }
    }
    this.doom.liftStart = this.chargeLiftStart ?? this.swingArmAim() ?? this.facing + 0.3
    this.chargeLiftStart = null
    this.doom.swingEmpowered = this.isDoomsday && this.doom.mode
    if (this.isDoomsday) { seg = this.doom.alternation++ % 2; this.doom.swingSerial++ }
    this.doom.swingHit = false
    this.swingMelee = this.doom.swingEmpowered ? getItemDef(this.toolId!).weapon?.empoweredMove?.(m) ?? m : m
    this.swingToolId = this.toolId
    this.swingPhase = 'windup'
    this.swingTimer = this.swingMelee.windup
    this.swingBaseAngle = this.facing
    this.comboIndex = seg
    this.comboBuffer = false
    this.comboResetT = 0
    this.hitSet.clear()
    this.swingHitCount = 0
    this.swingHitStopFired = false
  }

  /** 触发一次闪避 */
  private startDodge(kind: DodgeKind, moveX: number, moveY: number): void {
    this.bow.cancelGesture()
    // 战斧未蓄满时短闪打断；蓄满保留，其余武器继续读取各自规则。
    if (kind === 'long' || kind === 'short' && this.weaponResource?.chargeAttack?.cancelOnShortDodgeBeforeReady && this.chargeProgress < 1 - 1e-8) this.cancelCharge()
    const c = CONFIG.player
    const d = kind === 'short' ? c.dodge.short : c.dodge.long
    if (kind === 'short' && this.swingPhase === 'windup' && this.swingTimer > 0 && this.swingToolId) {
      // 读取当前攻击的武器快照，换手持不改变这一击的技能，重复触发不叠加。
      this.swingRollBonus = Math.max(0, getItemDef(this.swingToolId).weapon?.windupRollBonus?.damageBonus ?? 0)
    }
    this.afterDodgeEffects=this.toolId?[...(getItemDef(this.toolId).weapon?.afterDodgeEffects??[])]:[]
    this.dodgePhase = kind
    sfx.dodge()
    this.dodgeTimer = d.duration
    this.dodgeCooldown = this.effects.modify('dodgeCooldown', d.cooldown)
    this.lastDodgeCdTotal = this.dodgeCooldown
    this.effects.dispatch('dodge', { kind, cooldown: this.dodgeCooldown })
    this.iFrameTimer = d.iFrame
    // 长闪从冲刺段起步；清空上一次闪避的残影与节拍
    this.longPhase = 'burst'
    this.coastTimer = 0
    this.trailTick = 0
    this.trail.length = 0
    this.poseTick = 0
    this.poseTrail.length = 0
    // 闪避摆脱受击击退硬直
    this.knockX = 0
    this.knockY = 0
    // 朝移动方向闪；没有移动输入则朝面朝方向闪
    this.dodgeAngle =
      moveX !== 0 || moveY !== 0 ? Math.atan2(moveY, moveX) : this.facing
    // 批次 F②：短闪触发骨骼团身翻滚（时长与判定短闪同源同步）
    if (kind === 'short') this.animator.startRoll(this.dodgeAngle, d.duration)
    // 长闪打断当前挥击（重位移的代价）；短闪完全不影响武器前后摇，可与攻击丝滑连按
    if (kind === 'long') { this.swingPhase = 'none'; this.swingRollBonus = 0 }
  }

  /** 翻滚或长闪滑行结束后再启动奖励计时，死亡和复活均取消待发奖励。 */
  private finishDodge():void{
    this.dodgePhase='none'
    const definitions=this.afterDodgeEffects;this.afterDodgeEffects=[]
    if(this.alive)for(const definition of definitions)this.effects.add(definition,'resource:dodge')
  }

  /** 深拷贝一帧骨骼姿态（animator.build 复用同一对象，存残影必须拷贝） */
  private snapshotPose(): PlayerPose {
    const src = this.animator.build(this.facing)
    return { ...src, bone: { ...src.bone } }
  }

  /** 当前生效招式（挥击中=本次快照，待机=手持；空手返回 null） */
  get meleeMove(): MeleeMove | null {
    return this.swingPhase === 'none' ? this.melee : this.swingMelee
  }

  /** 挥击当前的实际扫过角度（用于判定与绘制），非 active 返回 null */
  getSwing(): {
    angle: number
    progress: number
    shape: 'slash' | 'stab'
    reach: number
    arc: number
    stabWidth: number
    baseAngle: number
  } | null {
    if (this.swingPhase !== 'active' && this.swingPhase !== 'windup') return null
    const m = this.swingMelee
    if (!m) return null
    const arc = m.arc ?? 0
    // slash：段 0 从 -arc 扫到 +arc（右横扫）；段 1/2 反向扫（左反扫；第三段判定同域、
    // 视觉另走大力下劈）。三段扫过的判定扇形始终是以基准角为中心的 ±arc，命中域不缩水。
    // stab：角度恒为基准角（progress 只驱动视觉伸出量）
    let progress = 0
    if (this.swingPhase === 'active') {
      progress = 1 - this.swingTimer / m.active
    }
    if (this.swingPhase === 'active' && m.contactProgress !== undefined && progress + 1e-8 < m.contactProgress) return null
    let angle = this.swingBaseAngle
    if (m.shape === 'slash') {
      const dir = m.sweepDirection ?? (this.comboIndex === 0 ? 1 : -1)
      angle =
        dir > 0
          ? this.swingBaseAngle - arc + arc * 2 * progress
          : this.swingBaseAngle + arc - arc * 2 * progress
    }
    return {
      angle,
      progress,
      shape: m.shape,
      reach: m.reach,
      arc,
      stabWidth: m.stabWidth ?? 14,
      baseAngle: this.swingBaseAngle
    }
  }

  /**
   * 批次 F③：持械臂锁定角（武器视觉角）。null=走 idle/walk 自由持握。
   * 段 0 右横扫（过顶左引→匀速扫落）；段 1 左反扫（镜像反向扫）；
   * 段 2 大力下劈：引到过顶 1.35arc，active 用 p² 缓入——前慢后快，
   * 经过指向前（base）时速度最高，读起来是"高举→重劈"；判定角仍走 getSwing 完整扇形。
   */
  private heldMotion() {
    const move = this.swingMelee ?? this.melee
    return move ? { move, phase: this.swingPhase, timer: this.swingTimer, aim: this.charging ? this.facing : this.swingBaseAngle, facing: this.facing, bodyFacing: this.animator.bodyFacing, time: this.animator.motionTime, gaitPhase: this.animator.gaitPhase, gaitWeight: this.animator.gaitWeight, comboQueued: this.comboBuffer, charging: this.charging, chargeProgress: this.chargeProgress, chargePower: this.swingChargeMultiplier, burst: !!this.weaponBurst, chargeFull: this.swingChargeFull, strikeIndex: this.swingStrikeIndex, segment: this.charging ? this.chargeSegment : this.comboIndex, liftStart: this.doom.liftStart, empowered: this.swingEmpowered } : undefined
  }

  private swingArmAim(): number | null {
    if (this.activeToolId && getItemDef(this.activeToolId).ranged?.type === 'tarot' && this.tarot.gestureAim !== null) return this.tarot.gestureAim
    if (this.swingPhase === 'none') {
      const motion = this.heldMotion()
      return motion ? this.weaponResource?.idleAim?.(motion) ?? null : null
    }
    const m = this.swingMelee
    if (!m) return null
    const base = this.swingBaseAngle
    const resourceAim = this.weaponResource?.armAim
    const motion = this.heldMotion()
    if (resourceAim && motion) return resourceAim(motion)
    if (m.shape === 'stab') return base
    const arc = m.arc ?? 0
    const seg = this.comboIndex
    if (this.swingPhase === 'windup') {
      if (seg === 0) return base - arc * 1.15
      if (seg === 1) return base + arc * 1.15
      return base - arc * 1.35 // 第三段过顶高举
    }
    if (this.swingPhase === 'active') {
      const p = 1 - this.swingTimer / m.active
      if (seg === 0) return base - arc + arc * 2 * p
      if (seg === 1) return base + arc - arc * 2 * p
      // 重劈：-1.2arc 过顶 → +1.2arc 劈落，p² 缓入（落劈瞬间最快）
      return base - arc * 1.2 + arc * 2.4 * p * p
    }
    // recover：段 0/2 沉在劈落侧，段 1 收在反撩侧
    return seg === 1 ? base - arc * 0.6 : base + arc * 0.8
  }

  /** 专属蓄势可收肘后拉，动作结束后自动恢复通用持握。 */
  private swingArmBend(): number {
    if (this.activeToolId && getItemDef(this.activeToolId).ranged?.type === 'tarot') return this.tarot.gestureBend
    if (this.swingPhase === 'none' || !this.weaponResource?.armBend) return 0
    const motion = this.heldMotion()
    return motion ? this.weaponResource.armBend(motion) : 0
  }

  /** 资源可编排纵向握持位移；未配置时沿用通用突刺前冲，挥砍保持零偏移。 */
  private swingThrust(): number {
    if (this.swingPhase === 'none') return 0
    const m = this.swingMelee
    const motion = this.heldMotion()
    if (motion && this.weaponResource?.thrust) return this.weaponResource.thrust(motion)
    if (!m || m.shape !== 'stab') return 0
    if (this.swingPhase === 'windup') return -3
    if (this.swingPhase === 'active') return 7 * (1 - this.swingTimer / m.active)
    return 0
  }

  /** 调试信息（HUD 用） */
  get speedNow(): number {
    return Math.hypot(this.vx, this.vy)
  }

  /** 切换手持的头顶弹名：1.2s 寿命、上浮 12px、品质色深描边；寰宇档走缓慢流转虹彩 */
  private renderToolNotice(ctx: CanvasRenderingContext2D): void {
    const n = this.toolNotice
    if (!n) return
    const DUR = 1.2
    const age = (performance.now() - n.start) / 1000
    if (age >= DUR) { this.toolNotice = null; return }
    const ease = 1 - Math.pow(1 - Math.min(1, age / DUR), 3)
    ctx.save()
    ctx.globalAlpha = Math.min(1, age / 0.12, (DUR - age) / 0.35)
    ctx.font = '12px zpix, sans-serif'
    ctx.textAlign = 'center'
    ctx.strokeStyle = '#171924bb'
    ctx.lineWidth = 2.5
    // 寰宇档：白金底上缓慢流转虹彩，其余档直接用品质主色
    ctx.fillStyle = n.cosmic ? `hsl(${(performance.now() / 28) % 360}, 75%, 72%)` : n.color
    const y = this.y - 40 - ease * 12
    ctx.strokeText(n.name, this.x, y)
    ctx.fillText(n.name, this.x, y)
    ctx.restore()
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderCharge(ctx, 'behind')
    const notice=(performance.now()-this.levelNoticeStart)/1000
    const levelUpActive=this.levelNoticeStart>=0&&notice<1.8
    if(levelUpActive){
      const ease=1-Math.pow(1-Math.min(1,notice/1.8),3)
      ctx.save();ctx.globalAlpha=Math.min(1,notice/.15,(1.8-notice)/.4);ctx.font='12px zpix, sans-serif';ctx.textAlign='center';ctx.strokeStyle='#171924bb';ctx.lineWidth=2.5;ctx.fillStyle='#f1df9c'
      ctx.strokeText('Level UP！',this.x,this.y-65-ease*15);ctx.fillText('Level UP！',this.x,this.y-65-ease*15);ctx.restore()
    }
    // 升级提示播放期间让位，避免头顶文字重叠
    if(!levelUpActive) this.renderToolNotice(ctx)
    const c = CONFIG.player

    if (CONFIG.art.rig) {
      // 状态拖影沿真实路线轻柔淡出，保持原色，不额外描边或叠加武器剑影。
      for (const trail of this.statusTrail) {
        ctx.save()
        ctx.globalAlpha = trail.opacity * Math.pow(trail.life / trail.max, 1.5)
        drawPlayerRig(ctx, trail.x, trail.y, trail.pose, {})
        ctx.restore()
      }
      // —— 批次 F②：长闪人形虚影（最近若干帧 pose 的半透明人偶重放，武器不入残影） ——
      for (const t of this.poseTrail) {
        const r01 = t.life / t.max
        ctx.save()
        ctx.globalAlpha = r01 * 0.32
        drawPlayerRig(ctx, t.x, t.y, t.pose, {})
        ctx.restore()
      }
    } else {
      // —— 长闪残影（青色圆点；滑行段会从背后追上主角，边追边缩小淡出） ——
      for (const t of this.trail) {
        const r01 = t.life / t.max
        ctx.fillStyle = `rgba(105,225,255,${r01 * 0.3})`
        ctx.beginPath()
        ctx.arc(t.x, t.y, c.half * (0.45 + 0.45 * r01), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    // —— 阴影 ——
    ctx.fillStyle = 'rgba(0,0,0,0.35)'
    ctx.beginPath()
    ctx.ellipse(this.x, this.y + c.half - 1, c.half, c.half * 0.42, 0, 0, Math.PI * 2)
    ctx.fill()

    // —— 死亡：横躺姿态，画完即结束（不画镐/判定） ——
    if (!this.alive) {
      ctx.save()
      ctx.translate(this.x, this.y)
      ctx.rotate(Math.PI / 2)
      ctx.globalAlpha = 0.7
      ctx.fillStyle = '#6b5a66'
      ctx.strokeStyle = '#3d333b'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(0, 2, c.half, c.half * 0.92, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#c9b29a'
      ctx.beginPath()
      ctx.arc(0, -5, 8.5, 0, Math.PI * 2)
      ctx.fill()
      // 叉眼
      ctx.strokeStyle = '#3a2733'
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(-4, -8)
      ctx.lineTo(0, -4)
      ctx.moveTo(0, -8)
      ctx.lineTo(-4, -4)
      ctx.moveTo(2, -8)
      ctx.lineTo(6, -4)
      ctx.moveTo(6, -8)
      ctx.lineTo(2, -4)
      ctx.stroke()
      ctx.restore()
      return
    }

    let whipHand: { x: number; y: number; angle: number } | undefined
    // —— 身体（闪避/受伤 i 帧闪烁：受伤偏红、闪避偏白） ——
    const blinkT = Math.max(this.iFrameTimer, this.hurtTimer)
    const flashing = blinkT > 0 && Math.floor(blinkT * 20) % 2 === 0
    if (this.dodgePhase === 'short' && !CONFIG.art.rig) {
      // 翻滚中（旧管线）：团身前滚翻专用姿态（镐子一并收入旋转组）
      this.renderRoll(ctx, flashing)
    } else if (CONFIG.art.rig) {
      // —— 批次 F：程序化骨骼小帅穿越者（②短闪=骨骼团身翻滚；③武器层内挂点） ——
      const rolling = this.dodgePhase === 'short'
      if (rolling) {
        // 翻滚扬尘（世界坐标，与旧管线同源）
        const p = Math.min(1, Math.max(0, 1 - this.dodgeTimer / c.dodge.short.duration))
        this.renderRollDust(ctx, p)
      }
      // 武器在持械手局部系层内绘制（自动跟手臂挥砍、分前后层；团身时收起）
      const rigTool = rolling || this.rangedFlight?.item === this.activeToolId || (this.activeToolId && getItemDef(this.activeToolId).weapon?.hiddenHeld) ? null : this.activeToolId
      const thrust = this.swingThrust()
      ctx.save()
      ctx.globalAlpha = flashing ? 0.45 : 1
      const pose = this.animator.build(this.facing), motion = this.heldMotion()
      const accessory = rigTool ? getItemDef(rigTool).weapon?.drawAccessory : undefined
      const hand = drawPlayerRig(ctx, this.x, this.y, pose, {
        hurt: this.hurtTimer > 0,
        drawAccessory: accessory && motion ? (g) => accessory(g, { ...motion, x: this.x + pose.rootX, y: this.y + pose.rootY, bodyFacing: dirAngle(pose.dir), hand: getPlayerHandAnchor(this.x, this.y, pose), supportHand: getPlayerSupportHandAnchor(this.x, this.y, pose) }) : undefined,
        drawSupportWeapon: rigTool && motion && getItemDef(rigTool).weapon?.drawOffhand
          ? g => getItemDef(rigTool).weapon!.drawOffhand!(g, { motion }) : undefined,
        drawWeapon:
          rigTool !== null
            ? (wctx) => drawRigWeapon(wctx, rigTool, { thrust, motion: this.heldMotion(),drawProgress:getItemDef(rigTool).ranged?.type==='bow'?this.bow.drawProgress:undefined,bowPull:this.bow.pullDistance,bowReleaseProgress:this.bow.releaseProgress,bowCharged:this.bow.charged,ammoNocked:this.bow.nocked,ammunitionId:this.bow.ammunitionId, empowered: rigTool === DOOMSDAY_ID && (this.doom.mode || (this.swingPhase !== 'none' && this.doom.swingEmpowered)), time: performance.now() / 1000 })
            : undefined
      })
      if (rigTool && getItemDef(rigTool).weapon?.curve) whipHand = hand
      ctx.restore()
    } else {
      const pose = this.bodyPose()
      ctx.save()
      ctx.globalAlpha = flashing ? 0.45 : 1
      ctx.translate(this.x + pose.ox, this.y + pose.oy)

      // —— 靴子（沿移动方向前后交替；静止收在斗篷下） ——
      const moving = Math.hypot(this.vx, this.vy) > 30
      const step = moving ? Math.sin(this.walkClock) * 3.4 : 0
      const mfx = Math.cos(this.moveAngle)
      const mfy = Math.sin(this.moveAngle)
      const mpx = -mfy
      const mpy = mfx
      ctx.fillStyle = '#241a12'
      for (const sign of [-1, 1]) {
        const fx = mpx * 4 * sign + mfx * step * sign
        const fy = 8.5 + mpy * 4 * sign + mfy * step * sign
        ctx.beginPath()
        ctx.ellipse(fx, fy, 3.4, 2.5, this.moveAngle, 0, Math.PI * 2)
        ctx.fill()
      }

      // —— 斗篷（ink 厚描边 + 硬边色阶：主色/下摆暗弧/两肩受光） ——
      ctx.fillStyle = this.cloakColor(flashing)
      ctx.strokeStyle = ART_INK
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.ellipse(0, 2, c.half, c.half * 0.92, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.save()
      ctx.beginPath()
      ctx.ellipse(0, 2, c.half, c.half * 0.92, 0, 0, Math.PI * 2)
      ctx.clip()
      // 下摆暗带
      ctx.fillStyle = flashing ? 'rgba(120,150,200,0.35)' : 'rgba(28,52,128,0.55)'
      ctx.fillRect(-c.half, 5, c.half * 2, 10)
      // 两肩受光
      ctx.fillStyle = 'rgba(190,216,255,0.32)'
      ctx.beginPath()
      ctx.ellipse(-5, -5.5, 5, 2.6, -0.4, 0, Math.PI * 2)
      ctx.ellipse(5, -5.5, 5, 2.6, 0.4, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()

      // —— 红领巾结（颈下小菱形） ——
      ctx.fillStyle = '#c8483a'
      ctx.strokeStyle = ART_INK
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(0, -9.5)
      ctx.lineTo(3, -7)
      ctx.lineTo(0, -4.6)
      ctx.lineTo(-3, -7)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()

      // —— 头（圆脸 + ink 描边） ——
      ctx.fillStyle = '#ffd9b8'
      ctx.strokeStyle = ART_INK
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(0, -5, 8.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      // 帽檐投在脸上的阴影（上半脸压暗一档）
      ctx.fillStyle = 'rgba(60,40,20,0.22)'
      ctx.beginPath()
      ctx.arc(0, -6.5, 8.2, Math.PI * 1.05, Math.PI * 1.95)
      ctx.closePath()
      ctx.fill()

      // 面朝方向的眼睛（黑瞳 + 一点白高光）
      const ex = Math.cos(this.facing) * 5.6
      const ey = -5 + Math.sin(this.facing) * 5.6
      ctx.fillStyle = '#1c2333'
      ctx.beginPath()
      ctx.arc(ex, ey, 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.arc(ex - 0.6, ey - 0.6, 0.6, 0, Math.PI * 2)
      ctx.fill()

      // —— 矿工帽 ——
      this.renderHelmet(ctx)
      ctx.restore()

      // —— 镐子/剑（锚点跟随身体顿挫，随挥击阶段扫动） ——
      this.renderPick(ctx, pose.ox, pose.oy)
    }

    if (this.weaponPhysics && this.activeToolId) {
      if (this.dodgePhase === 'short') {
        const hand = this.weaponHand()
        ctx.save(); ctx.translate(hand.x, hand.y); ctx.rotate(hand.angle)
        drawRigWeapon(ctx, this.activeToolId, { motion: this.heldMotion() }); ctx.restore()
      }
      this.weaponPhysics.render(ctx)
    }
    if (this.weaponResource?.drawCurve && this.meleeMove && this.dodgePhase !== 'short') this.weaponResource.drawCurve(ctx, { x: this.x, y: this.y, facing: this.facing, aim: this.swingBaseAngle, phase: this.swingPhase, timer: this.swingTimer, move: this.meleeMove, points: this.weaponCurve(whipHand), hand: whipHand ?? { x: this.x, y: this.y, angle: this.facing } })
    // —— 挥击轨迹（slash 扇形拖尾 / stab 窄矩形突进，仅判定窗口） ——
    const swing = this.getSwing()
    if (!CONFIG.art.slice) this.renderDoomCrescents(ctx, 'all')
    for (const trail of this.weaponTrails) trail.render(ctx, trail)
    if (swing && this.swingPhase === 'active' && !this.weaponResource?.customSwingFx) {
      if (swing.shape === 'slash') {
        // 第三段大力下劈：弧光跟随武器视觉角（判定扫向与此无关），拖尾更厚更亮
        const heavy = this.isHeavySeg
        const trail = heavy ? 0.95 : 0.5
        const arcAngle = heavy ? (this.swingArmAim() ?? swing.angle) : swing.angle
        ctx.fillStyle = heavy ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.22)'
        ctx.beginPath()
        ctx.moveTo(this.x, this.y)
        ctx.arc(this.x, this.y, swing.reach, arcAngle - trail, arcAngle)
        ctx.closePath()
        ctx.fill()
      } else {
        // 戳刺：沿朝向的半透明白色窄矩形
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(swing.baseAngle)
        ctx.fillStyle = 'rgba(255,255,255,0.24)'
        const near = 6
        const halfW = swing.stabWidth / 2
        ctx.fillRect(near, -halfW, swing.reach - near, swing.stabWidth)
        ctx.restore()
      }
    } else if (this.swingPhase === 'windup' && this.swingMelee && !this.weaponResource?.customSwingFx) {
      // 起手提示：薄薄一圈判定外缘
      ctx.strokeStyle = 'rgba(255,255,255,0.15)'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(this.x, this.y, this.swingMelee.reach, 0, Math.PI * 2)
      ctx.stroke()
    }

    // —— J 批次：脚底左下闪避冷却圆环（世界内绘制，满帧平滑跟随） ——
    this.renderDodgeRing(ctx)
    drawDoomTransition(ctx, this.x, this.y, this.doom.modeFx, this.isDoomsday)
    this.renderCharge(ctx, 'front')
  }

  private renderCharge(ctx: CanvasRenderingContext2D, layer: 'behind' | 'front'): void {
    if (!this.alive || (!this.charging && this.chargeReadyAge < 0 && this.weaponSkillCooldown <= 0)) return
    this.weaponResource?.chargeAttack?.draw?.(ctx, { x: this.x, y: this.y, charging: this.charging,
      progress: this.chargeProgress, readyAge: this.chargeReadyAge, cooldown: this.weaponSkillCooldown, maxCooldown: this.weaponResource?.chargeAttack?.burst?.cooldown ?? this.weaponResource?.chargeAttack?.cooldown,
      burstProgress: this.weaponBurst ? this.weaponBurst.elapsed / this.weaponBurst.duration : undefined, time: this.effectTime, layer })
  }

  renderDoomCrescents(ctx: CanvasRenderingContext2D, filter: 'normal' | 'empowered' | 'all' = 'all'): void {
    drawDoomCrescents(ctx, this.doom.crescents, filter)
  }

  /**
   * 闪避 CD 圆环：挂在主角脚底阴影左下、稍微偏离身子的位置。
   * - CD 中：暗底环 + 铜金弧顺时针充能
   * - 就绪：低饱和整圈常显 + 中心铜点
   * - 转好瞬间：圆环 pop 回弹 + 外扩白闪一圈（轻冲击，提示"闪避让好了"）
   */
  private renderDodgeRing(ctx: CanvasRenderingContext2D): void {
    const c = CONFIG.player
    // 脚底阴影左下外侧（阴影椭圆下沿在 y+half-1）
    const cx = this.x - c.half - 4
    const cy = this.y + c.half + 4
    const baseR = 6

    ctx.save()
    // 转好脉冲：0→1 进度，sin 曲线做 1→1.45→1 的 pop
    const pk = this.dodgeReadyPulse > 0 ? 1 - this.dodgeReadyPulse / 0.4 : 1
    const pop = this.dodgeReadyPulse > 0 ? 1 + 0.45 * Math.sin(pk * Math.PI) : 1
    ctx.translate(cx, cy)
    ctx.scale(pop, pop)

    const cooling = this.dodgeCooldown > 0
    const ready = !cooling && this.dodgePhase === 'none'

    // 底环（墨褐凹槽）
    ctx.strokeStyle = 'rgba(18,12,7,0.6)'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.arc(0, 0, baseR, 0, Math.PI * 2)
    ctx.stroke()

    if (cooling) {
      // 充能弧（1-剩余比例），从正上方顺时针
      const fill = 1 - this.dodgeCdRatio
      ctx.strokeStyle = '#d9a94f'
      ctx.lineWidth = 2.1
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(0, 0, baseR, -Math.PI / 2, -Math.PI / 2 + Math.max(0.001, fill) * Math.PI * 2)
      ctx.stroke()
      // 弧头亮芯
      if (fill > 0.02) {
        const a = -Math.PI / 2 + fill * Math.PI * 2
        ctx.fillStyle = '#ffe9b0'
        ctx.beginPath()
        ctx.arc(Math.cos(a) * baseR, Math.sin(a) * baseR, 1.1, 0, Math.PI * 2)
        ctx.fill()
      }
    } else {
      // 就绪：整圈铜环（脉冲前段提亮到近白）
      const pulseGlow = this.dodgeReadyPulse > 0 ? (1 - pk) * 0.8 : 0
      ctx.strokeStyle =
        this.dodgeReadyPulse > 0
          ? `rgba(255,240,200,${0.55 + pulseGlow * 0.45})`
          : 'rgba(232,196,122,0.55)'
      ctx.lineWidth = this.dodgeReadyPulse > 0 ? 2.6 : 1.8
      ctx.beginPath()
      ctx.arc(0, 0, baseR, 0, Math.PI * 2)
      ctx.stroke()
      // 中心铜点
      ctx.fillStyle = ready ? '#e8c47a' : 'rgba(232,196,122,0.5)'
      ctx.beginPath()
      ctx.arc(0, 0, 1.5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()

    // 外扩白闪圈（不受 pop 缩放影响，独立外扩衰减）
    if (this.dodgeReadyPulse > 0) {
      const a = 1 - pk
      ctx.strokeStyle = `rgba(255,240,200,${a * 0.7})`
      ctx.lineWidth = 1.6 * a + 0.3
      ctx.beginPath()
      ctx.arc(cx, cy, baseR + pk * 6, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  /** 翻滚身后扬尘（世界坐标，前大半段出现并淡出；新旧两条管线共用） */
  private renderRollDust(ctx: CanvasRenderingContext2D, p: number): void {
    if (p >= 0.75) return
    const fade = 1 - p / 0.75
    for (let i = 0; i < 3; i++) {
      const back = 12 + i * 6 + p * 20
      const side = (i - 1) * 6
      const dx = -Math.cos(this.dodgeAngle) * back - Math.sin(this.dodgeAngle) * side
      const dy = -Math.sin(this.dodgeAngle) * back + Math.cos(this.dodgeAngle) * side
      ctx.fillStyle = `rgba(190,180,160,${fade * 0.22 * (1 - i * 0.22)})`
      ctx.beginPath()
      ctx.arc(this.x + dx, this.y + dy, 2.5 + i * 0.9, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /**
   * 翻滚姿态（旧 rig=false 管线）：团身前滚翻（俯视表现为整个人团起绕中心旋转一周）
   * 进度由 dodgeTimer 时间驱动；镐子收入旋转组，避免"人转镐不转"的割裂
   */
  private renderRoll(ctx: CanvasRenderingContext2D, flashing: boolean): void {
    const c = CONFIG.player
    const d = c.dodge.short
    const p = Math.min(1, Math.max(0, 1 - this.dodgeTimer / d.duration))

    // —— 身后扬尘 ——
    this.renderRollDust(ctx, p)

    // —— 团身旋转组 ——
    ctx.save()
    ctx.globalAlpha = flashing ? 0.45 : 1
    ctx.translate(this.x, this.y)
    ctx.rotate(p * Math.PI * 2)

    // 翻滚中段抱膝缩身
    const curl = 1 - 0.16 * Math.sin(p * Math.PI)

    // 斗篷团成球
    ctx.fillStyle = this.cloakColor(flashing)
    ctx.strokeStyle = '#2b4aab'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 2 * curl, c.half * curl, c.half * 0.92 * curl, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()

    // 头收向身体前缘（随整组翻转）
    ctx.fillStyle = '#ffd9b8'
    ctx.beginPath()
    ctx.arc(0, -6 * curl, 7.4, 0, Math.PI * 2)
    ctx.fill()

    // 物理武器在世界手锚点单独绘制，旧管线不再额外画假镐柄。
    if (!this.weaponResource?.createPhysics) {
      ctx.strokeStyle = '#8a5a2b'
      ctx.lineWidth = 3
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(3, 7)
      ctx.lineTo(15, 15)
      ctx.stroke()
      ctx.lineCap = 'butt'
    }

    ctx.restore()
  }

  /**
   * 绘制手持武器（按物品 kind 分派外形：weapon=直刃铁剑、pick=弧头镐）。
   * slash：角度随挥击进度扫过；stab：角度锁定朝向，伸出距离随进度突进。
   */
  private weaponSweep: WeaponSweep | null = null
  private weaponPhysics: WeaponPhysics | null = null
  private physicsTool: ItemId | null = null
  private physicsMap: TileMap | null = null
  private physicsPosition = { x: 0, y: 0 }
  private physicsHitTest: ((x: number, y: number, radius: number) => boolean) | null = null

  private resetWeaponPhysics(): void {
    this.weaponPhysics = null
    this.physicsTool = null
    this.physicsMap = null
    this.physicsHitTest = null
    this.weaponSweep?.reset()
  }

  private weaponHand(): { x: number; y: number; angle: number } {
    if (CONFIG.art.rig) return getPlayerHandAnchor(this.x, this.y, this.animator.build(this.facing))
    const pose = this.bodyPose()
    return { x: this.x + pose.ox, y: this.y + pose.oy, angle: this.swingArmAim() ?? this.facing - .5 }
  }

  private weaponView(hand = this.weaponHand()): WeaponCurveView | null {
    const move = this.meleeMove
    return move ? { x: this.x, y: this.y, hand, move, phase: this.swingPhase,
      timer: this.swingTimer, aim: this.swingBaseAngle } : null
  }

  private updateWeaponPhysics(dt: number, map: TileMap): void {
    const factory = this.weaponResource?.createPhysics
    const view = this.weaponView()
    this.physicsHitTest = null
    if (!factory || !view) {
      if (this.weaponPhysics) this.resetWeaponPhysics()
      return
    }
    if (!this.weaponPhysics || this.physicsTool !== this.activeToolId) {
      this.weaponPhysics = factory()
      this.physicsTool = this.activeToolId
      this.weaponPhysics.reset(view)
    } else if (this.physicsMap !== map || Math.hypot(this.x - this.physicsPosition.x, this.y - this.physicsPosition.y) > 96) {
      this.weaponPhysics.reset(view)
      this.weaponSweep?.reset()
    }
    this.physicsMap = map
    this.physicsPosition = { x: this.x, y: this.y }
    this.weaponPhysics.update(view, dt)
    if (this.swingPhase !== 'active' || !this.weaponSweep) { this.weaponSweep?.reset(); return }
    const samples = this.weaponPhysics.sweepPoints.map(points => this.weaponSweep!.sample(points))
    const { x: ox, y: oy, aim, move } = view
    // 自由棍真实扫掠与前方招式区域取交集，链和近棍从不参与伤害。
    this.physicsHitTest = (x, y, radius) => {
      const dx = x - ox, dy = y - oy
      const difference = Math.atan2(Math.sin(Math.atan2(dy, dx) - aim), Math.cos(Math.atan2(dy, dx) - aim))
      return Math.hypot(dx, dy) <= move.reach && Math.abs(difference) <= (move.arc ?? 0)
        && samples.some(hit => hit(x, y, radius))
    }
  }

  /** 绘制和命中共用世界坐标曲线，手心锚点不依赖渲染调用。 */
  private weaponCurve(hand?: { x: number; y: number; angle: number }): Array<{ x: number; y: number }> {
    if (this.weaponPhysics) return this.weaponPhysics.curve
    const view = this.weaponView(hand)
    return view ? this.weaponResource?.curve?.(view) ?? [] : []
  }

  /** 物理武器只读取更新阶段产生的扫掠；其他曲线武器保留原契约。 */
  getWeaponHitTest(): ((x: number, y: number, radius: number) => boolean) | null {
    if (this.weaponResource?.createPhysics) return this.physicsHitTest ?? (() => false)
    return this.weaponSweep?.sample(this.weaponCurve()) ?? null
  }

  private renderPick(ctx: CanvasRenderingContext2D, ox = 0, oy = 0): void {
    // 待机画手持武器，挥击中画本次快照；空手什么都不画
    const m = this.swingPhase === 'none' ? this.melee : this.swingMelee
    if (!m) {
      const id = this.activeToolId
      if (id && getItemDef(id).ranged && this.rangedFlight?.item !== id) {
        ctx.save(); ctx.translate(this.x + ox, this.y + oy); ctx.rotate(this.facing); drawRigWeapon(ctx, id, {}); ctx.restore()
      }
      return
    }
    // 武器锚点跟随身体顿挫（批次 E）
    const ax = this.x + ox
    const ay = this.y + oy
    // 铁剑 vs 生锈铁镐的外形分派（挥击中读快照，中途切换不跳形）
    const toolId = this.activeToolId
    if (this.weaponResource?.curve) return
    if (toolId && this.weaponResource?.legacyHeld) {
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(this.swingArmAim() ?? this.facing - 0.5)
      drawRigWeapon(ctx, toolId, { thrust: this.swingThrust(), motion: this.heldMotion(), empowered: this.doom.mode || (this.swingPhase !== 'none' && this.doom.swingEmpowered), time: performance.now() / 1000 })
      ctx.restore()
      return
    }
    const isSword = toolId !== null && getItemDef(toolId).kind === 'weapon'
    let angle: number
    let len: number

    if (m.shape === 'stab') {
      angle = this.swingBaseAngle
      if (this.swingPhase === 'windup') {
        len = 16 // 收在近身蓄力
      } else if (this.swingPhase === 'active') {
        const progress = 1 - this.swingTimer / m.active
        len = 18 + 20 * progress // 直线突刺
      } else if (this.swingPhase === 'recover') {
        len = 30
      } else {
        angle = this.facing - 0.4
        len = 26
      }
    } else {
      const arc = m.arc ?? 0
      if (this.swingPhase === 'windup') {
        angle = this.swingBaseAngle - arc * 1.15 // 蓄力往身后引
      } else if (this.swingPhase === 'active') {
        const progress = 1 - this.swingTimer / m.active
        angle = this.swingBaseAngle - arc + arc * 2 * progress
      } else if (this.swingPhase === 'recover') {
        angle = this.swingBaseAngle + arc * 0.6
      } else {
        angle = this.facing - 0.5 // 平时扛在身侧
      }
      len = 30
    }

    const hx = ax + Math.cos(angle) * len
    const hy = ay + Math.sin(angle) * len
    ctx.lineCap = 'round'

    if (isSword && m.shape === 'slash') {
      // —— 铁剑：皮柄只到护手，护手前是通直剑刃（与锈铁镐的弧头明确区分） ——
      const gx = ax + Math.cos(angle) * 13
      const gy = ay + Math.sin(angle) * 13
      // 垂直刃身方向（护手方向）
      const px = -Math.sin(angle)
      const py = Math.cos(angle)

      // 皮柄
      ctx.strokeStyle = '#6e4420'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(gx, gy)
      ctx.stroke()
      // 黄铜十字护手
      ctx.strokeStyle = '#c79a3f'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(gx - px * 5.5, gy - py * 5.5)
      ctx.lineTo(gx + px * 5.5, gy + py * 5.5)
      ctx.stroke()
      // 铁刃
      ctx.strokeStyle = '#dfe7f5'
      ctx.lineWidth = 3.2
      ctx.beginPath()
      ctx.moveTo(gx, gy)
      ctx.lineTo(hx, hy)
      ctx.stroke()
      // 刃面中脊高光
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(gx + px * 0.9, gy + py * 0.9)
      ctx.lineTo(hx + px * 0.9, hy + py * 0.9)
      ctx.stroke()
      ctx.lineCap = 'butt'
      return
    }

    // 木柄（生锈铁镐 / 通用武器）
    ctx.strokeStyle = '#8a5a2b'
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(hx, hy)
    ctx.stroke()

    // 生锈铁端头（slash = 与柄垂直的短弧；stab = 短尖刺）：暗锈铁底 + 磨亮细刃
    const traceRustyHead = (): void => {
      if (m.shape === 'stab') {
        ctx.moveTo(hx - Math.cos(angle) * 7, hy - Math.sin(angle) * 7)
        ctx.lineTo(hx + Math.cos(angle) * 5, hy + Math.sin(angle) * 5)
      } else {
        ctx.arc(ax, ay, len + 2, angle - 0.32, angle + 0.32)
      }
    }
    ctx.strokeStyle = '#7d6b58'
    ctx.lineWidth = 4
    ctx.beginPath()
    traceRustyHead()
    ctx.stroke()
    // 锈红斑（中段偏一点的位置，静态但镐小，点到即可）
    ctx.strokeStyle = '#9a5a34'
    ctx.lineWidth = 4
    ctx.beginPath()
    if (m.shape === 'slash') ctx.arc(ax, ay, len + 2, angle - 0.12, angle + 0.1)
    else traceRustyHead()
    ctx.stroke()
    // 磨亮的刃口细线
    ctx.strokeStyle = '#b6b2a6'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    traceRustyHead()
    ctx.stroke()
    ctx.lineCap = 'butt'
  }
}
