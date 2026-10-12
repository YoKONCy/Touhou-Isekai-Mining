import { SnapshotCodec, type StateFields } from '../core/simulation/snapshot'
/**
 * 角色档案（账号级持久化状态）
 *
 * 每名玩家独立持有一份档案，跨场景共用；普通存档目前保存键鼠主控档案：
 * - 装备/背包/快捷槽三件套从 CaveModule 上移至此（跨模块、跨刷新、跨死亡保持）
 * - 同时承载仓库、货币、基地状态、NPC 名册、剧情 flag、战斗成长、回合数
 * - 唯一序列化入口：toJSON/fromJSON，SaveService 负责把它写进 IndexedDB
 *
 * 纯数据层：不依赖 Canvas / Vue / Dexie。
 */
import { Equipment } from './equipment'
import { Inventory,type ItemStack } from './inventory'
import { QuickSlots } from './quickSlots'
import type { ItemId } from './itemDefs'
import { CONFIG } from '../game/config'
import { LivingGunReserve, type LivingGunSave } from './livingGun'
import { ItemDiscovery, discoverCarried, type DiscoverySave } from './discovery'
import type { SavedStatus } from './statusEffects'
import { FOOD_COOLDOWN_SECONDS, SATIETY_ID, type FoodState } from './food'
import { SOUP_ID, SALT_SOUP_ID, FOOD_ONIGIRI_ID } from '../content/items/vanilla/ids'
import {
  createCombatStats,
  grantExp,
  type CombatStats
} from './combat'

/** 存档结构版本号（不兼容改动时递增，走迁移分支） */
export const SAVE_VERSION = 1
export const SAVE_NAME_MAX_LENGTH = 24

/** 主档案在 profile 表中的固定主键（未来支持多档案时再扩） */
export const MAIN_PROFILE_KEY = 'main'

/** 剧情/系统 flag 值（布尔门控/计数/字符串状态都支持） */
export type FlagValue = number | boolean | string
export type FlagMap = Record<string, FlagValue>

/** 货币（余烬/火种；B0 只立字段不产出） */
export interface CurrencyState {
  ember: number
  spark: number
}

/** 仓库格（与背包同形；空槽为 null） */
export type StorageSlot = ItemStack | null

/** 炉内批次随档案保存；加热与待领取分开，满背包不会吞成品。 */
export interface SmeltingBatch {
  id: ItemId
  qty: number
  startedRound: number
  state: 'heating' | 'ready'
}

/** 落盘的档案形状（IndexedDB 里存的 JSON） */
export interface SaveProfile {
  version: number
  character: {
    name?: string
    /** 旧档缺省为哥哥；只影响角色外观与对应立绘、CG。 */
    appearance?: 'brother' | 'sister'
    costume?: 'default' | 'old_miner'
    equipment: ReturnType<Equipment['toJSON']>
    equipmentDurability?:ReturnType<Equipment['durabilityJSON']>
    equipmentHidden?: ReturnType<Equipment['visibilityJSON']>
    inventory: ReturnType<Inventory['toJSON']>
    inventoryCapacity?: number
    inventoryStackLimit?: number
    /** 垃圾桶暂存格；旧档缺省为空，点击销毁前仍可取回。 */
    trash?: ReturnType<Inventory['toJSON']>
    quickSlots: ReturnType<QuickSlots['toJSON']>
    /** 当前手持槽序号：0 武器A / 1 武器B / 2 镐 */
    selected: number
  }
  /** 基地仓库（60 格） */
  storage: StorageSlot[]
  smelting?: SmeltingBatch | null
  livingGun?: LivingGunSave
  discovery?: DiscoverySave
  foodCooldown?: number
  foodDuration?: number
  foodEffects?: SavedStatus[]
  pendingSearchUnlocks?: string[]
  currency: CurrencyState
  /** 基地相关状态 */
  base: {
    /** 基地等级（预留，恒 1） */
    level: number
  }
  /** 已入驻 NPC 的全限定 id 名册 */
  npcs: string[]
  /** 剧情/系统 flag（如 prologue.done） */
  flags: FlagMap
  /** 战斗成长（等级/经验/属性点） */
  combat: CombatStats
  /** 下矿回合数（每次进入矿洞 +1） */
  round: number
  /** 历史最深抵达层（只记录，不影响玩法） */
  deepestDepth: number
  /** 开局饭团是否已发（叙事化＝灵梦仅剩的口粮） */
  starterGiven: boolean
  /** 场景切片；普通矿洞中断后安全回营，不伪造楼层恢复。 */
  location?: { scene: 'base' | 'cave'; basePosition: { x: number; y: number } }
  meta: {
    /** 记录名称，与主角姓名独立；空白时显示默认槽名。 */
    label?: string
    createdAt: number
    savedAt: number
  }
}

/** 仓库容量：12 列 × 5 行＝60 格（基地批次两栏拖拽面板用） */
export const STORAGE_COLS = 12
export const STORAGE_ROWS = 5

/**
 * 运行时档案：持有三件套与仓库的活实例，玩法模块直接读写它们；
 * toJSON/fromJSON 负责与存档 JSON 互转。
 */
export class CharacterProfile {
  captureSimulation(codec = new SnapshotCodec()): StateFields { return codec.capture(this) }
  restoreSimulation(state: StateFields, codec = new SnapshotCodec()): void { codec.restore(this, state) }

  readonly equipment = new Equipment()
  readonly inventory = new Inventory(CONFIG.inventory.cols, CONFIG.inventory.rows, 20)
  readonly quickSlots = new QuickSlots()
  readonly trash = new Inventory(1, 1)
  readonly livingGun = new LivingGunReserve()
  readonly discovery = new ItemDiscovery()
  /** 随身食用状态跟随档案跨场景，剩余时间由角色的状态系统同步。 */
  readonly food:FoodState = { remaining: 0, duration: FOOD_COOLDOWN_SECONDS, effects: [] }
  readonly pendingSearchUnlocks = new Set<string>()
  costume: 'default' | 'old_miner' = 'default'
  /** 基地仓库（背包同构容器，存取拖拽面板在基地批次做） */
  readonly storage = new Inventory(STORAGE_COLS, STORAGE_ROWS)

  selected = 2
  playerName = ''
  saveName = ''
  playerAppearance: 'brother' | 'sister' = 'brother'
  smelting: SmeltingBatch | null = null
  currency: CurrencyState = { ember: 0, spark: 0 }
  baseLevel = 1
  npcs: string[] = []
  flags: FlagMap = {}
  combat: CombatStats = createCombatStats()
  round = 0
  deepestDepth = 1
  location: NonNullable<SaveProfile['location']> = { scene: 'cave', basePosition: { x: 690, y: 550 } }
  starterGiven = false
  createdAt: number = Date.now()

  // —— flag 便捷读写（剧情门控用） ——

  flag(key: string): FlagValue | undefined {
    return this.flags[key]
  }
  flagBool(key: string): boolean {
    return this.flags[key] === true
  }
  setFlag(key: string, value: FlagValue): void {
    this.flags[key] = value
  }

  /** 获得经验；返回升级次数（UI 按 >0 播升级提示） */
  gainExp(amount: number): number {
    return grantExp(this.combat, amount)
  }

  /** 序列化为落盘 JSON */
  toJSON(): SaveProfile {
    return {
      version: SAVE_VERSION,
      character: {
        name: this.playerName,
        appearance: this.playerAppearance,
        costume: this.costume,
        equipment: this.equipment.toJSON(),
        equipmentDurability:this.equipment.durabilityJSON(),
        equipmentHidden: this.equipment.visibilityJSON(),
        inventory: this.inventory.toJSON(),
        inventoryCapacity: this.inventory.size,
        inventoryStackLimit: 20,
        trash: this.trash.toJSON(),
        quickSlots: this.quickSlots.toJSON(),
        selected: this.selected
      },
      storage: this.storage.toJSON(),
      smelting: this.smelting ? { ...this.smelting } : null,
      livingGun: this.livingGun.toJSON(),
      discovery: this.discovery.toJSON(),
      foodDuration: this.food.duration,
      foodEffects: this.food.effects.map(effect=>({...effect})),
      pendingSearchUnlocks: [...this.pendingSearchUnlocks],
      currency: { ...this.currency },
      base: { level: this.baseLevel },
      npcs: [...this.npcs],
      flags: { ...this.flags },
      combat: {
        level: this.combat.level,
        exp: this.combat.exp,
        unspentPoints: this.combat.unspentPoints,
        points: { ...this.combat.points }
      },
      round: this.round,
      deepestDepth: this.deepestDepth,
      starterGiven: this.starterGiven,
      location: { scene: this.location.scene, basePosition: { ...this.location.basePosition } },
      meta: {
        label: this.saveName,
        createdAt: this.createdAt,
        savedAt: Date.now()
      }
    }
  }

  /** 从存档 JSON 恢复（字段缺失逐项安全兜底，坏档不崩） */
  fromJSON(data: Partial<SaveProfile>): void {
    this.saveName = typeof data.meta?.label === 'string' ? data.meta.label.trim().slice(0, SAVE_NAME_MAX_LENGTH) : ''
    if (data.location) this.location = { scene: data.location.scene, basePosition: { ...data.location.basePosition } }
    const ch = data.character
    this.playerName = typeof ch?.name === 'string' ? ch.name.trim() : ''
    this.playerAppearance = ch?.appearance === 'sister' ? 'sister' : 'brother'
    this.costume = ch?.costume === 'old_miner' && data.flags?.['unlock.costume.old_miner'] === true ? 'old_miner' : 'default'
    this.pendingSearchUnlocks.clear()
    for(const id of data.pendingSearchUnlocks??[])if(typeof id==='string')this.pendingSearchUnlocks.add(id)
    if (ch?.equipment) this.equipment.fromJSON(ch.equipment)
    this.equipment.restoreDurability(ch?.equipmentDurability)
    this.equipment.restoreVisibility(ch?.equipmentHidden)
    if (Array.isArray(data.storage)) this.storage.fromJSON(data.storage)
    if (ch?.inventory) {
      // 囊袋升级只扩格子；旧档的堆叠加成取消，超限物品由下方迁移到仓库保留。
      this.inventory.materialStack = 20
      const capacity = Number(data.flags?.['base.bag.stage']) > 0 ? 12 : 10
      this.inventory.slots.length=capacity;this.inventory.slots.fill(null);this.inventory.rows=Math.ceil(capacity/this.inventory.cols)
      const preserve = (stack: NonNullable<StorageSlot>): void => {
        const left = stack.qty - this.storage.add(stack.id, stack.qty,stack.durability)
        if (left > 0) {
          // 仓库已满时增加迁移保留格，旧物品不能因新背包规则消失。
          this.storage.expand(this.storage.size + Math.ceil(left / this.storage.stackLimit(stack.id)))
          this.storage.add(stack.id, left,stack.durability)
        }
      }
      this.inventory.fromJSON(ch.inventory.slice(0,capacity), preserve)
      for(const stack of ch.inventory.slice(capacity))if(stack)preserve(stack)
    }
    this.trash.clear()
    if (Array.isArray(ch?.trash)) this.trash.fromJSON(ch.trash)
    if (ch?.quickSlots) this.quickSlots.fromJSON(ch.quickSlots)
    if (typeof ch?.selected === 'number') this.selected = ch.selected
    const batch = data.smelting
    this.livingGun.fromJSON(data.livingGun)
    // 旧档已经投料的最多 20 锭批次完整保留；新批次由制作规则限制为 8 锭。
    this.smelting = batch && typeof batch.id === 'string' && Number.isInteger(batch.qty) && batch.qty >= 1 && batch.qty <= 20
      && Number.isInteger(batch.startedRound) && batch.startedRound >= 0 && (batch.state === 'heating' || batch.state === 'ready')
      ? { ...batch } : null
    if (data.currency) this.currency = { ember: data.currency.ember ?? 0, spark: data.currency.spark ?? 0 }
    if (typeof data.base?.level === 'number') this.baseLevel = data.base.level
    if (Array.isArray(data.npcs)) this.npcs = [...data.npcs]
    if (data.flags && typeof data.flags === 'object') this.flags = { ...data.flags }
    if(Number(this.flags['base.bag.stage'])>1)this.flags['base.bag.stage']=1
    this.discovery.fromJSON(data.discovery)
    if (!data.discovery) {
      discoverCarried(this, true)
      if(this.flagBool('quest.reimu.cooking.done'))this.discovery.unlock(SOUP_ID)
      if(this.flagBool('quest.saltSoup.done'))this.discovery.unlock(SALT_SOUP_ID)
      if(data.starterGiven)this.discovery.unlock(FOOD_ONIGIRI_ID)
    }
    this.food.effects = (Array.isArray(data.foodEffects)?data.foodEffects:[]).filter(effect=>typeof effect.id==='string'&&typeof effect.source==='string'&&effect.source.startsWith('food:')).map(effect=>({...effect}))
    this.food.duration = typeof data.foodDuration==='number'&&Number.isFinite(data.foodDuration)&&data.foodDuration>0?data.foodDuration:FOOD_COOLDOWN_SECONDS
    if(!this.food.effects.some(effect=>effect.id===SATIETY_ID)&&typeof data.foodCooldown==='number'&&Number.isFinite(data.foodCooldown)&&data.foodCooldown>0)
      this.food.effects.push({id:SATIETY_ID,source:'food:satiety',remaining:Math.min(FOOD_COOLDOWN_SECONDS,data.foodCooldown),elapsed:0})
    this.food.remaining = this.food.effects.find(effect=>effect.id===SATIETY_ID)?.remaining??0
    if (data.combat) {
      this.combat = {
        level: data.combat.level ?? 1,
        exp: data.combat.exp ?? 0,
        unspentPoints: data.combat.unspentPoints ?? 0,
        points: { ...createCombatStats().points, ...(data.combat.points ?? {}) }
      }
      // 旧版两项抗性合并，超过单项上限的投入退还；旧字段归零避免重复迁移。
      const resistPoints = this.combat.points.fortitude + this.combat.points.antimagic
      this.combat.points.fortitude = Math.min(CONFIG.statCap, resistPoints)
      this.combat.points.antimagic = 0
      this.combat.unspentPoints += Math.max(0, resistPoints - CONFIG.statCap)
    }
    if (typeof data.round === 'number') this.round = data.round
    if (typeof data.deepestDepth === 'number') this.deepestDepth = data.deepestDepth
    if (typeof data.starterGiven === 'boolean') this.starterGiven = data.starterGiven
    if (typeof data.meta?.createdAt === 'number') this.createdAt = data.meta.createdAt
  }
}
