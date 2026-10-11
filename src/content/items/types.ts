/**
 * 物品内容契约（工程化 L1，从 shared/itemDefs.ts 迁入内容层）
 *
 * 局内（矿洞掉落/拾取/背包）与未来局外（基地库存、锻造、商店）共用同一份
 * 物品真值——任何模块不得私自定义物品，一律查 items 注册表。
 *
 * 加新物品 = 在 content/items/vanilla（或 MOD 包）里新建一个内容文件并在
 * pack 清单登记，引擎文件零改动。
 */
import type { ContentId } from '../core/ids'

/** 物品 id：命名空间字符串（MOD 内容 TS 无法穷举，联合类型时代结束） */
export type ItemId = ContentId

/** 物品大类（决定背包行为/图标/可装备槽） */
export type ItemKind = 'material' | 'misc' | 'collectible' | 'ammunition' | 'pick' | 'weapon' | 'armor' | 'consumable' | 'spellcard'

/** 装备槽位（纸娃娃）：装束槽为头/身/腿合并后的全身槽；饰品 4 槽同型 */
export type EquipSlot =
  | 'pick'
  | 'weaponA'
  | 'weaponB'
  | 'spellA'
  | 'spellB'
  | 'outfit'
  | 'trinketA'
  | 'trinketB'
  | 'trinketC'
  | 'trinketD'

/**
 * 物品定义可声明的归槽类型：
 * 比 {@link EquipSlot} 多一个虚拟值 `'trinket'`——表示"饰品类"物品，
 * 可被 trinketA~D 任一实槽接受（具体门控见 equipment.slotAccepts）。
 */
export type ItemEquipSlot = EquipSlot | 'trinket'

/**
 * 近战招式定义（镐与武器共用同一张表）
 * 未来扩展（剑气/附带 Debuff/连段）只在此接口加可选字段，判定层不动骨架。
 */
export interface MeleeMove {
  /** 判定形态：挥砍=扇形扫掠；戳刺=沿朝向的窄矩形长刺 */
  shape: 'slash' | 'stab'
  /** 单段扫掠方向；缺省沿用已有武器的正反手规则。 */
  sweepDirection?: 1 | -1
  /** 伤害类型与攻击强度系数；缺省物理，系数按完整攻击周期计算。 */
  damageKind?: 'physical' | 'magic'
  powerCoefficient?: number
  /** 单次伤害 */
  damage: number
  /** 攻击长度（从玩家中心到判定远端，px） */
  reach: number
  /** 前摇 / 判定窗口 / 后摇（秒） */
  windup: number
  active: number
  recover: number
  /** 仅 slash：扇形半角（弧度） */
  arc?: number
  /** 仅 stab：窄矩形全宽（px） */
  stabWidth?: number
  /** 命中击退初速度（0 = 无击退，如纯采集镐） */
  knockback?: number
  /** 命中给予的弹幕僵直秒数（实际僵直 = stun - 敌人抗性） */
  stun?: number
  /** 同一次攻击的多目标伤害组件；首目标全额。 */
  aoe?: import('./combatComponents').AoeFalloff
  /** 内圈按目标中心距离划分，命中集合仍由整次攻击共享。 */
  innerZone?: { reach: number; damage: number; penetration: number }
  /** 判定窗口内分成独立命中，每段重置命中集合和多目标衰减。 */
  repeatHits?: number
  /** 触地前不结算伤害，0~1 表示判定阶段的接触进度。 */
  contactProgress?: number
  /** 判定期间的真实位移，沿起手轴推进，仍经过地形碰撞。 */
  movement?: { distance: number; direction: 1 | -1 }
}

/** 远程攻击契约；攻击间隔由武器行为决定起算时机。 */
export interface RangedAttack {
  type: 'boomerang' | 'tarot' | 'bow' | 'livingGun'
  damage: number
  damageKind?: 'physical' | 'magic'
  /** 飞行速度，像素每秒。 */
  speed: number
  /** 负精度修正的大小，单位为度。 */
  accuracyPenalty: number
  /** 远程伤害统一不受攻击强度加成；不声明近战强度系数。 */
  knockback?: number
  stun?: number
  /** 通用远程攻击间隔，单位秒。 */
  attackInterval: number
  aoe?: import('./combatComponents').AoeFalloff
  ammoFamily?: 'arrow'
  /** 弓可独立编排拉弦与收势；完整周期模式把蓄力也计入攻击间隔。 */
  bowTiming?: { drawDuration: number; recoverDuration: number; intervalIncludesCharge?: boolean }
  /** 远程蓄力默认松手释放，可声明蓄满自动释放；倍率作用于武器与弹药合计值。 */
  charge?: { duration: number; damageMultiplier: number; speedMultiplier: number; accuracyCorrection?: number; autoRelease?: boolean; nameKey: string; descriptionKey: string }
  /** 连续满蓄力的终结箭；倍率以未蓄力的武器与弹药合计值为基准。 */
  chargedFinisher?: { count: number; damageMultiplier: number; speedMultiplier: number; damageKind: 'physical' | 'magic'; pierceObstacles: boolean; pierceEnemies: boolean; nameKey: string; descriptionKey: string }
}

/** 弹药仅从背包消费，所有加成为与武器原值合并的增量。 */
export interface Ammunition {
  family: 'arrow'
  damage: number
  critChance: number
  penetration: number
  accuracyCorrection: number
  /** 射速比例加成；间隔除以 1 + 此值。 */
  attackSpeed: number
  projectileSpeed: number
  knockback: number
  stun: number
}

/** 符卡光波演出配色（阳光色多层光波；缺省回退旧单色金环） */
export interface SpellFxColors {
  /** 中心爆闪核（近白） */
  core: string
  /** 主光波环（明亮主色） */
  ring: string
  /** 外缘辉光与光芒（暖色远端） */
  rim: string
}

/** 符卡效果定义（数据驱动；释放结算在引擎侧通用执行） */
export interface SpellCardDef {
  channelTime?:number
  scope?:'room'
  control?:{duration:number;bulletSpeedMultiplier:number;enemyEffects:readonly import('../../shared/statusEffects').StatusDefinition[]}
  targetFx?:{duration:number;render:(g:CanvasRenderingContext2D,v:{x:number;y:number;age:number;duration:number;seed:number})=>void}
  channelDraw?:(g:CanvasRenderingContext2D,v:{x:number;y:number;progress:number;time:number})=>void
  sound?:()=>void
  /** 缺省为魔法伤害，显示与抗性结算使用同一个类型。 */
  damageKind?: 'physical' | 'magic'
  /** 释放所需灵力 */
  manaCost: number
  /** 释放后冷却秒数 */
  cooldown: number
  /** 作用半径（以自身为中心） */
  radius: number
  /** 范围内敌人受到的伤害（每一波各结算一次） */
  damage: number
  /** 范围内敌人受到的径向击退初速度 */
  knockback: number
  /** 范围内敌人的弹幕僵直秒数 */
  stun: number
  /** 是否清除范围内敌方弹幕（东方符卡的"消弹"本体；每一波各净化一次） */
  clearBullets: boolean
  /** 演出主色（光环/粒子；旧字段，fxColors 缺省时兜底） */
  color: string
  /** 连续冲击波数（缺省 1；如祓除=2，释放点连续绽开两波） */
  waves?: number
  /** 多波次之间的间隔秒数（缺省 0.4） */
  waveInterval?: number
  /** 多层光波演出配色（不填=旧单色金环样式） */
  fxColors?: SpellFxColors
}

/** 食用效果，所有使用入口统一处理回复与附加状态。 */
export interface ConsumableEffect {
  /** 本次进食施加的饱腹秒数，缺省使用通用时长。 */
  satiety?: number
  /** 食用回复生命 */
  heal?: number
  status?: import('../../shared/statusEffects').StatusDefinition
  /** 复用同一状态时可调整本次食用持续时间。 */
  statusDuration?: number
}

/* ---------- 图标（双轨：程序化 SVG / 外部图片） ---------- */

/**
 * 物品图标：
 * - svg：完整的一段 <svg>...</svg> 标记（官方程序化绘制，自包含、随字体风格统一）
 * - image：外部图片地址（MOD 用，指向 public 或 ./mods 目录里的 png/svg）
 * 由 ItemIcon.vue 统一渲染，内容方二选一。
 */
export type ItemIcon =
  | { readonly type: 'svg'; readonly svg: string }
  | { readonly type: 'image'; readonly src: string }

/** 程序化 SVG 图标的快捷构造器 */
export function svgIcon(svg: string): ItemIcon {
  return { type: 'svg', svg }
}

/* ---------- 地面掉落物外观 ---------- */

/** 地面渲染视图（Drop 实体传给物品自带渲染器的全部信息） */
export interface GroundDropView {
  ctx: CanvasRenderingContext2D
  /** 已含浮动偏移的绘制中心 */
  x: number
  y: number
  /** 掉落物碰撞半径（绘制基准尺寸） */
  r: number
  phase: 'burst' | 'rest' | 'magnet'
  /** 浮动/闪烁时钟（每个掉落物错峰） */
  bob: number
}

/** 自定义地面掉落物绘制（不填则用引擎通用原石碎晶外观） */
export type GroundRenderer = (view: GroundDropView) => void

/** 持械手局部系的资源绘制参数。 */
export interface HeldWeaponView {
  /** 角色朝右时骨骼整体镜像；非对称枪械据此保持弹匣朝下。 */
  mirrored?: boolean
  /** 非对称器型按实际枪口方向保持竖直朝下，独立于人物镜像。 */
  flipVertical?: boolean
  /** 连射武器的短促机械后坐位移。 */
  recoil?: number
  /** 普射与蓄力共用的拉弦进度，未拉弦时省略。 */
  drawProgress?: number
  bowPull?: number
  bowReleaseProgress?: number
  bowCharged?: boolean
  ammoNocked?: boolean
  ammunitionId?: ItemId
  motion?: WeaponMotionView
  thrust?: number
  empowered?: boolean
  time?: number
}

export interface WeaponMotionView {
  /** 使用动画逻辑时间驱动握持微动，暂停时不继续摆动。 */
  time?: number
  gaitPhase?: number
  gaitWeight?: number
  /** 人物行走朝向，收刀待机姿态按此安排腰侧握点。 */
  bodyFacing?: number
  comboQueued?: boolean
  charging?: boolean
  chargeProgress?: number
  chargePower?: number
  /** 定时连斩期间的动作标记。 */
  burst?: boolean
  chargeFull?: boolean
  strikeIndex?: number
  move: MeleeMove
  phase: 'none' | 'windup' | 'active' | 'recover'
  timer: number
  aim: number
  facing: number
  segment: number
  liftStart: number
  empowered: boolean
}

/** 专属行为通过资源入口关联，不持有玩家或房间实体。 */
export interface WeaponCurveView {
  x: number
  y: number
  hand: { x: number; y: number; angle: number }
  move: MeleeMove
  phase: string
  timer: number
  aim: number
}

/** 每位持有者独享的物理实例；曲线只含参与伤害的自由棍，绘制不得推进模拟。 */
export interface WeaponPhysics {
  reset(view: WeaponCurveView): void
  update(view: WeaponCurveView, dt: number): void
  readonly curve: Array<{ x: number; y: number }>
  readonly freeRod: readonly [{ x: number; y: number }, { x: number; y: number }]
  readonly sweepPoints: Array<Array<{ x: number; y: number }>>
  render(ctx: CanvasRenderingContext2D): void
}

export interface WeaponSweep {
  reset(): void
  sample(points: Array<{ x: number; y: number }>): (x: number, y: number, radius: number) => boolean
}

export interface WeaponBladeView extends WeaponCurveView { motion: WeaponMotionView }
/** 一条带宽度的枪刃轨迹，渲染和擦弹共用实际握点。 */
export interface WeaponBladeSegment { from: { x: number; y: number }; to: { x: number; y: number }; radius: number }

export interface WeaponTrailView {
  x: number
  y: number
  angle: number
  segment: number
  age: number
  /** 本次判定窗口的实际秒数，剑影随攻速同步展开。 */
  activeDuration?: number
  empowered?: boolean
  chargePower?: number
  /** 起手的实际武器角，整圈旋斩与残影共用同一基准。 */
  startAngle?: number
  burst?: boolean
  chargeFull?: boolean
  strikeIndex?: number
}

/** 矩形范围的 range 沿 angle 向前延伸，width 沿垂直方向向左右各分一半。 */
export interface WeaponImpactView { x: number; y: number; angle: number; age: number; move: MeleeMove; area?:{range:number;width:number;count:number;duration:number;seed:number} }
/** 地面演出归所属房间计时和绘制，切房不会搬到下一间。 */
export interface WeaponImpactInstance extends WeaponImpactView { duration: number; shake?: number; render: (ctx: CanvasRenderingContext2D, view: WeaponImpactView) => void }

export interface WeaponChargeView {
  x: number
  y: number
  /** 玩家瞄准朝向；聚气位置与前方技能范围共用此方向。 */
  angle: number
  charging: boolean
  progress: number
  readyAge: number
  cooldown?: number
  maxCooldown?: number
  burstProgress?: number
  time: number
  layer: 'behind' | 'front'
}

/** 副手握点相对主手的柄轴偏移，权重负责平滑接握与松手。 */
export interface WeaponGrip {
  /** 主武器可交给远侧手；四向双手持枪时按实际可达握点选择。 */
  weaponHand?: 'near' | 'far'
  /** 图集手心相对小臂末端的偏移；只调整武器握点，不拉长衣袖。 */
  palmOffset?: number
  offset: number
  weight: number
  /** 可指定朝左基底中的握点，用于主手握柄、副手握鞘等独立姿态。 */
  main?: { x: number; y: number }
  support?: { x: number; y: number }
  mainWeight?: number
  /** 副手接握权重；为零时仅反解主手，副手保留自由动作。 */
  supportWeight?: number
  /** 独立的武器轴世界角度，支持反手握持而不把整条手臂翻转。 */
  weaponAngle?: number
  /** 副手独立武器轴，用于双持，世界角度。 */
  supportWeaponAngle?: number
  onlySupport?: boolean
  nearBend?: 1 | -1
  farBend?: 1 | -1
  /** 背身待机时把双手与腰侧附件放在衣身后层。 */
  inFront?: boolean
  /** 独立安排副手前后层，可实现一手在身前、一手越肩背后的蓄势。 */
  supportInFront?: boolean
  /** 链条等附件可独立置于身后，避免跨肩连接线遮住面部。 */
  accessoryInFront?: boolean
}
/** 动作只改变姿态，不移动实体碰撞中心。 */
export interface WeaponBodyMotion {
  facing?: number; lean?: number; rootX?: number; rootY?: number; tilt?: number
  /** 招式可覆盖近、远腿的骨角，用于抬膝与踢击；角度沿用角色的朝左镜像基底。 */
  legs?: { near?: { thigh: number; shin: number; scale?: number }; far?: { thigh: number; shin: number; scale?: number } }
}

export interface WeaponResource {
  /** 护甲结算前把同一次物理攻击按比例转成魔法，两部分共用暴击结果。 */
  physicalToMagic?:number
  /** 每次命中附加固定魔法伤害，独立扣魔抗与法术破甲，不吃力量、暴击或多目标衰减。 */
  fixedMagicDamage?:number
  /** 每刀判定开始时召唤独立残影；固定伤害不吃力量、暴击或多目标衰减。 */
  echoAttack?:{damage:number;offset:number;fadeDuration:number;delay?:number;speedMultiplier?:number}
  /** 每个被刀身命中的目标分别播放，残影不会再次触发。 */
  hitFx?:{duration:number;render:(ctx:CanvasRenderingContext2D,view:WeaponImpactView)=>void}
  /** 不显示待机握持物；射击手势由远程行为单独驱动。 */
  hiddenHeld?: boolean
  /** 物品卡展示的技能摘要与逐项效果，文案仍走语言键。 */
  skillDescriptions?: { summaryKey: string; effects: readonly { nameKey: string; descriptionKey: string }[] }
  /** 暴击被动由正式命中入口执行；省略倍率沿用普攻，attacker 来源记录实际施加者。 */
  criticalPassive?: { multiplier?: number; effects: readonly import('../../shared/statusEffects').StatusDefinition[]; nameKey: string; descriptionKey: string; source?: 'attacker' }
  /** 仅由此武器完成击杀时乘到各物品原始掉落概率，数量和经验保持原值。 */
  killDropPassive?: { chanceMultiplier: number; nameKey: string; descriptionKey: string }
  /** 按住蓄力、松手攻击；倍率独立于力量、暴击和多目标衰减。 */
  chargeAttack?: {
    /** 缺省使用普攻键；特殊键蓄力可与普通连击共存。 */
    trigger?: 'attack' | 'special'
    /** 单次蓄力攻击也可拥有冷却；定时连击优先读取 burst.cooldown。 */
    cooldown?: number
    releaseEffects?: readonly import('../../shared/statusEffects').StatusDefinition[]
    readyEffects?: { definitions: readonly import('../../shared/statusEffects').StatusDefinition[]; releaseDuration: number }
    duration: number
    minimumMoveMultiplier: number
    /** 指定时整个蓄力阶段使用固定移速比例，而非渐变减速。 */
    moveMultiplier?: number
    /** 蓄力期间原地站定并屏蔽闪避；松手取消或释放后立即解除。 */
    immobilize?:boolean
    cooldownBar?:{fill:string;background:string;glow:string}
    /** 未满蓄力的短闪打断，并阻止同一次持续按键立即重启蓄力。 */
    cancelOnShortDodgeBeforeReady?: boolean
    tiers: readonly { progress: number; multiplier: number }[]
    fullHitEffects?: readonly import('../../shared/statusEffects').StatusDefinition[]
    nameKey: string
    conditionKey: string
    readySound?: () => void
    /** 满蓄力释放定时连斩；各刀独立结算，期间允许移动与逐刀重新瞄准。 */
    burst?: { count: number; duration: number; cooldown: number; segments?: readonly number[]; move?: MeleeMove }
    /** 固定矩形多轮空斩，不推进普攻动作；每轮物理、魔法分别扣抗性，无多目标衰减。 */
    areaBurst?:{count:number;duration:number;range:number;width:number;physicalDamage:number;magicDamage:number;sound?:(index:number)=>void;render:(ctx:CanvasRenderingContext2D,view:WeaponImpactView)=>void}
    /** 蓄力档位可替换本次招式，普通攻击定义保持原值。 */
    move?: (move: MeleeMove, progress: number) => MeleeMove
    draw?: (ctx: CanvasRenderingContext2D, view: WeaponChargeView) => void
  }
  /** 接触进度统一地面演出、声音和震动，渲染实例交给所在房间保存。 */
  impactFx?: { duration: number; delay?: number; contactProgress?: number; sound?: () => void; shake?: number; skillOnly?: boolean; segments?: readonly number[]; render: (ctx: CanvasRenderingContext2D, view: WeaponImpactView) => void }
  /** 在当前攻击前摇内成功发起短翻滚，仅为这一击增加伤害，不跨连段继承。 */
  windupRollBonus?: { damageBonus: number; nameKey: string; conditionKey: string }
  heldEffects?: readonly import('../../shared/statusEffects').StatusDefinition[]
  /** 发起闪避时快照，整段闪避结束后施加；切换手持不会改变本次快照。 */
  afterDodgeEffects?: readonly import('../../shared/statusEffects').StatusDefinition[]
  autoRepeat?: boolean
  preserveOvershoot?: boolean
  empoweredMove?: (move: MeleeMove) => MeleeMove
  legacyHeld?: boolean
  trail?: { duration: number; render: (ctx: CanvasRenderingContext2D, view: WeaponTrailView) => void }
  buffer?: boolean
  combo?: boolean
  /** 连击动作数量；不填写沿用三段，单动作武器可关闭 combo。 */
  comboLength?: number
  /** 每完成指定次数的挥击，收招后强制休息；次数按判定开始计数，切换装备不重置。 */
  comboRecovery?: { attacks: number; duration: number }
  /** 收招后继续保留连段的时间；零表示回到待机后重新从首段起手。 */
  comboWindow?: number
  drawHeld?: (ctx: CanvasRenderingContext2D, view: HeldWeaponView) => void
  /** 在副手手心局部系绘制第二把武器。 */
  drawOffhand?: (ctx: CanvasRenderingContext2D, view: HeldWeaponView) => void
  armAim?: (view: WeaponMotionView) => number
  idleAim?: (view: WeaponMotionView) => number
  /** 持械上臂相对锁定姿态的折肘角；前臂仍朝向武器轴线。 */
  armBend?: (view: WeaponMotionView) => number
  /** 手心局部系的纵向持握位移，用于突刺后引、送杆与收回。 */
  thrust?: (view: WeaponMotionView) => number
  supportGrip?: (view: WeaponMotionView) => WeaponGrip | undefined
  /** 双手接握时复绘原有手掌并将副手置于武器上方，避免杆身遮住握持动作。 */
  gripHandsOverWeapon?: boolean
  bodyMotion?: (view: WeaponMotionView) => WeaponBodyMotion | undefined
  /** 腰侧刀鞘等随人物姿态绘制的附件。 */
  drawAccessory?: (ctx: CanvasRenderingContext2D, view: WeaponMotionView & { x: number; y: number; bodyFacing: number; hand: { x: number; y: number; angle: number }; supportHand: { x: number; y: number; angle?: number } }) => void
  eraseProjectiles?: { radius: number; blade: (view: WeaponBladeView) => readonly [{ x: number; y: number }, { x: number; y: number }] | undefined; descriptionKey?: string }
  customSwingFx?: boolean
  lockAim?: boolean
  curve?: (view: WeaponCurveView) => Array<{ x: number; y: number }>
  createSweep?: () => WeaponSweep
  createPhysics?: () => WeaponPhysics
  drawCurve?: (ctx: CanvasRenderingContext2D, view: WeaponCurveView & { facing: number; points: Array<{ x: number; y: number }> }) => void
  sound?: (phase: 'windup' | 'active' | 'recover', segment: number, empowered: boolean) => void
  /** 命中材质音可由武器覆盖；只在本次攻击实际命中的首个敌人上触发。 */
  hitSound?: (material: import('../enemies/types').HitMaterial) => void
}

/* ---------- 物品定义本体 ---------- */

export interface ItemDef {
  /** 命名空间 id（touhou:xxx / mod:xxx；展示名走语言键 item.<id>.name） */
  id: ItemId
  /** 物品大类 */
  kind: ItemKind
  /** 装备品阶，掉落表现与搜索权重也读取此字段。 */
  grade?: 1 | 2 | 3 | 4 | 5 | 6
  /** 非装备稀有度：白、绿、蓝、紫、金、红、彩，只显示数字与颜色。 */
  rarity?: 1 | 2 | 3 | 4 | 5 | 6 | 7
  /** 仅在搜索容器内的占格尺寸，背包仍为单格。 */
  searchFootprint?:readonly [number,number]
  /** 成功带出一次后永久解锁，不作为普通背包物品保存。 */
  unlockReward?: { kind: 'outfit' | 'decoration' | 'recipe'; flag: string }
  /** 可选风味文案语言键；只在背包详细说明中展示。 */
  flavorKey?: string
  /** 图标/碎块主体色 */
  color: string
  /** 高光色 */
  hi: string
  /** 飘字/UI 文字色 */
  text: string
  /** 单格堆叠上限（装备/工具为 1） */
  maxStack: number
  /** UI 图标（必带；双轨） */
  icon: ItemIcon
  /** 可装备到哪个槽（pick/weapon/spellcard/outfit/trinket 类携带；'trinket'=饰品类通配） */
  equipSlot?: ItemEquipSlot
  /** 装备战斗属性；暴击率为0~1，穿透为抗性数值。 */
  combat?: { critChance?: number; meleeCritChance?:number; meleeWeaponDamageBonus?:number; penetration?: number; magicPenetration?:number; physicalResist?: number; magicResist?: number; projectileReduction?: number;projectileReductionRange?:readonly [number,number];spellCooldownReduction?:number;dodgeCooldownReduction?:number;dodgeDistanceBonus?:number;moveSpeedMultiplier?:number;dodgeCooldownMultiplier?:number;lightRadiusMultiplier?:number }
  /** 每趟下矿只抽一次的装备祝福，换房与换装不重抽。 */
  mineRunBuffs?:readonly import('../../shared/statusEffects').StatusDefinition[]
  /** 最大耐久；当前值保存在每一件物品上，耗尽后保留物品但停用消耗型被动。 */
  durability?:number
  meleeHitEffect?:{effect:import('../../shared/statusEffects').StatusDefinition;durabilityCost:number;nameKey:string;descriptionKey:string}
  /** 被动装备赋予远程蓄力短闪保护；暴击只加给此次保留下来的满蓄力射击。 */
  rangedChargeRoll?: { critChance: number; nameKey: string; descriptionKey: string }
  /** 镐/武器的近战招式（数据驱动挥击） */
  melee?: MeleeMove
  /** 连段逐段快照招式，可混合判定或保持同类攻击；单段武器使用 melee 定义。 */
  meleePattern?: { mode: 'mixed' | 'sequence'; moves: readonly MeleeMove[] }
  ranged?: RangedAttack
  ammunition?: Ammunition
  /** 资源专属动作及绘制。 */
  weapon?: WeaponResource
  /** 符卡效果（kind==='spellcard' 时携带） */
  spell?: SpellCardDef
  /** 镐级采集力 1~5（5 档矿门控用） */
  miningPower?: 1 | 2 | 3 | 4 | 5
  /** 每次有效采集扣除的HP，不参与战斗伤害。 */
  miningEfficiency?: number
  /** 消耗品效果 */
  consume?: ConsumableEffect
  /** 同时属于素材的物品，沿用素材的自动入仓与死亡掉落规则。 */
  material?: boolean
  /**
   * 材料专用：对应的矿脉矿物 id（MineralDef.id，如 touhou:mineral_copper）。
   * 碎矿掉落按矿物 Def.dropItemId 反查到本物品，引擎不认识具体物品。
   */
  mineral?: ContentId
  /** 地面掉落物自定义外观（缺省走通用碎晶） */
  ground?: GroundRenderer
  /** 自由标签（筛选/配方/事件条件用，如 ['material','metal']） */
  tags?: string[]
}
