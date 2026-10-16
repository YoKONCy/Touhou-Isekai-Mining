/** 搜索调节只保存纯数据；特殊字段可随房间、容器和续战快照一起保存。 */
export type SearchFields = Readonly<Record<string, string | number | boolean | null>>
export type SearchContainerKind = 'small' | 'large' | 'chest'
export interface SearchMultipliers {
  /** 搜索点生成数量倍率，不影响不可搜索的普通布景。 */
  density?: number
  /** 箱内目标物品堆数倍率，与物品堆叠数量分开。 */
  abundance?: number
  /** 每高一级品质额外乘一次的权重倍率，一级物品保持基础权重。 */
  rarity?: number
}
export interface SearchCount { count: number; weight: number }
export interface SearchProfile extends SearchMultipliers {
  counts?: readonly SearchCount[]
  table?: string
  /** 从此表优先抽一件保底，计入总堆数并预留格位；仍应用解锁过滤与幸运修正。 */
  guaranteedTable?: string
  /** 整箱为空的概率，缺省为零；不逐格抽空。 */
  emptyChance?: number
}
export interface SearchRoomContext {
  floor: number
  biomeId?: string
  regionId?: string
  roomKind?: string
  fields?: SearchFields
  profile?: SearchProfile
}
export interface SearchLootModifier extends SearchMultipliers {
  id: string
  extraRolls?: number
  quantityMultiplier?: number
  emptyChance?: number
  itemWeights?: Readonly<Record<string, number>>
  tagWeights?: Readonly<Record<string, number>>
  qualityWeights?: Readonly<Record<number, number>>
}
/** 未来幸运、事件标记、词条等从此传入，不在搜索算法中绑定具体装备或角色。 */
export interface SearchEffectContext {
  actorId?: string
  stats?: Readonly<Record<string, number>>
  flags?: Readonly<Record<string, boolean>>
  fields?: SearchFields
  modifiers?: readonly SearchLootModifier[]
}
export interface SearchGenerationContext {
  phase: 'layout' | 'contents'
  room: SearchRoomContext
  kind: SearchContainerKind
  sourceId?: string
  containerId?: string
  containerFields?: SearchFields
  seed?: number
  effects: SearchEffectContext
}
export interface SearchEffectDefinition {
  id: string
  priority?: number
  /** 纯计算入口：可读取 stats.luck 或自定义字段，返回本次生成的修正。 */
  resolve: (context: SearchGenerationContext) => SearchLootModifier | undefined
}
export interface ResolvedSearchRules {
  /** 实际房间楼层；旧快照未记录时由生成上下文补齐。 */
  floor?: number
  density: number
  abundance: number
  rarity: number
  table: string
  guaranteedTable?: string
  counts: SearchCount[]
  emptyChance: number
  extraRolls: number
  quantityMultiplier: number
  itemWeights: Record<string, number>
  tagWeights: Record<string, number>
  qualityWeights: Record<number, number>
  appliedEffects: string[]
}
