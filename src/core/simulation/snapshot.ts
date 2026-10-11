import { Registry } from '../../content/core/Registry'
import { randomCombat } from './random'

export type StateValue = null | boolean | number | string | StateValue[] | { [key: string]: StateValue }
export type StateFields = Record<string, StateValue>
export interface Identified { readonly entityId: string }
let indexedReferences:Map<string,unknown>|null=null
let indexedKeys=new Map<unknown,string>()
function referenceKeys(references:Map<string,unknown>):Map<unknown,string>{
  if(indexedReferences!==references){indexedReferences=references;indexedKeys=new Map([...references].map(([key,value])=>[value,key]))}
  return indexedKeys
}

/** 明确保存数据，不 JSON.stringify 类实例；集合、无穷计时与实体引用都有独立编码。 */
export class SnapshotCodec {
  private readonly references = Registry.references()
  private readonly referenceKeys = referenceKeys(this.references)
  private readonly entities = new Map<string, object>()
  private readonly identities = new WeakMap<object, string>()
  constructor(entities: readonly Identified[] = []) { for (const entity of entities) this.entities.set(entity.entityId, entity) }
  add(entity: Identified): void {
    if (this.entities.has(entity.entityId) && this.entities.get(entity.entityId) !== entity) throw new Error(`快照包含重复实体：${entity.entityId}`)
    this.entities.set(entity.entityId, entity)
    this.identities.set(entity, entity.entityId)
  }
  reference(id: string, value: object): void { this.entities.set(id, value); this.identities.set(value, id) }
  capture(object: object, excluded: readonly string[] = []): StateFields {
    const fields: StateFields = {}
    for (const [key, value] of Object.entries(object)) if (!excluded.includes(key)) fields[key] = this.encode(value)
    return fields
  }
  restore(object: object, fields: StateFields): void {
    const target = object as Record<string, unknown>
    for (const [key, value] of Object.entries(fields)) {
      if(['__proto__','prototype','constructor'].includes(key))throw new Error('快照字段无效')
      if (!Object.hasOwn(target, key)) throw new Error(`快照字段不兼容：${key}`)
      target[key] = this.decode(value, target[key])
    }
  }
  encode(value: unknown): StateValue {
    if (value === undefined) return { $type: 'undefined' }
    if (typeof value === 'number' && !Number.isFinite(value)) return { $type: 'number', value: String(value) }
    if (value === null || ['number', 'string', 'boolean'].includes(typeof value)) return value as StateValue
    const reference = this.referenceKeys.get(value)
    if (reference) return { $type: 'content', key: reference }
    if (value === randomCombat) return { $type: 'combat-rng' }
    if (typeof value === 'function') throw new Error('快照遇到未注册的行为函数，不能丢弃后继续恢复')
    if (typeof value !== 'object') throw new Error('快照包含不支持的数据类型')
    const object = value as Record<string, unknown>
    const identity = this.identities.get(value)
    if (identity) return { $type: 'entity', id: identity }
    if (typeof object.entityId === 'string') {
      // 已退出活动列表的命中对象只保留墓碑，不能把死亡目标重新放回房间。
      return this.entities.has(object.entityId) ? { $type: 'entity', id: object.entityId } : { $type: 'object', fields: { entityId: object.entityId } }
    }
    if (Array.isArray(value)) return value.map(entry => this.encode(entry))
    if (value instanceof Map) return { $type: 'map', entries: [...value].map(([key, entry]) => [this.encode(key), this.encode(entry)]) }
    if (value instanceof Set) return { $type: 'set', entries: [...value].map(entry => this.encode(entry)) }
    if (ArrayBuffer.isView(value)) return { $type: 'typed', name: value.constructor.name, entries: Array.from(value as unknown as ArrayLike<number>) }
    // 状态持有者、物理绘制器与骨骼插值历史不属于可持久化的数据。
    const excludes = 'instances' in value && 'owner' in value ? ['owner']
      : 'particles' in value && 'drawRod' in value ? ['drawRod']
      : 'doomsdayMarks' in value && 'room' in value ? ['room'] : []
    return { $type: 'object', fields: this.capture(value, excludes) }
  }
  decode(value: StateValue, existing?: unknown): unknown {
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) return value.map(entry => this.decode(entry))
    switch (value.$type) {
      case 'undefined': return undefined
      case 'number': return Number(value.value)
      case 'combat-rng': return randomCombat
      case 'entity': {
        const entity = this.entities.get(String(value.id))
        if (!entity) throw new Error(`快照引用缺失的实体：${value.id}`)
        return entity
      }
      case 'content': {
        const entry = this.references.get(String(value.key))
        if (entry === undefined) throw new Error(`快照引用缺失的内容：${value.key}`)
        return entry
      }
      case 'map': return new Map((value.entries as StateValue[][]).map(([key, entry]) => [this.decode(key!), this.decode(entry!)]))
      case 'set': return new Set((value.entries as StateValue[]).map(entry => this.decode(entry)))
      case 'typed': {
        const types = { Uint8Array, Int16Array, Float32Array, Float64Array, Int32Array, Uint32Array }
        const factory = Object.hasOwn(types,String(value.name)) ? types[value.name as keyof typeof types] : undefined
        if (!factory) throw new Error('快照数组类型不兼容')
        return new factory(value.entries as number[])
      }
      case 'object': {
        const fields = value.fields as StateFields
        // 运行时副本不能写回注册表的基础定义，否则一次读档会改变所有武器数值。
        const target = existing && typeof existing === 'object' && !Array.isArray(existing) && !this.referenceKeys.has(existing) ? existing : {}
        // 类组件保留构造时的方法和依赖；普通对象恢复完整字段。
        if (target.constructor === Object) {
          for (const key of Object.keys(target)) if (!Object.hasOwn(fields, key)) delete (target as Record<string, unknown>)[key]
          for (const [key, entry] of Object.entries(fields)) {
            if(['__proto__','prototype','constructor'].includes(key))throw new Error('快照字段无效')
            ;(target as Record<string, unknown>)[key] = this.decode(entry, (target as Record<string, unknown>)[key])
          }
        } else this.restore(target, fields)
        return target
      }
      default: throw new Error('快照数据标记无效')
    }
  }
}
