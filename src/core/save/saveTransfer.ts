import type { SaveProfile } from '../../shared/profile'

export const MAX_SAVE_FILE_BYTES = 2 * 1024 * 1024
const FORMAT = 'touhou-isekai-mine-save'
export const SAVE_FILE_VERSION = 1
const MAX_ENTRIES = 4096
type ErrorCode = 'invalid' | 'too_large' | 'empty'

export interface SaveImportWarning {
  kind: 'save_version' | 'file_version' | 'missing_items' | 'equipment'
  count?: number
  found?: number
  current?: number
}
export interface SaveImportPreview { data: SaveProfile; warnings: SaveImportWarning[] }

export class SaveTransferError extends Error {
  constructor(readonly code: ErrorCode) {
    super({ invalid: '存档文件结构无效', too_large: '存档文件过大', empty: '存档槽为空' }[code])
  }
  get messageKey(): string { return `ui.records.transfer_error.${this.code}` }
}

function invalid(): never { throw new SaveTransferError('invalid') }
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid()
  return value as Record<string, unknown>
}
function text(value: unknown, max = 512): asserts value is string {
  if (typeof value !== 'string' || value.length > max) invalid()
}
function finite(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) invalid()
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  finite(value, min, max)
  if (!Number.isSafeInteger(value)) invalid()
}
function boolean(value: unknown): void { if (typeof value !== 'boolean') invalid() }
function array(value: unknown, max = MAX_ENTRIES): unknown[] {
  if (!Array.isArray(value) || value.length > max) return invalid()
  return value
}
function strings(value: unknown, max = MAX_ENTRIES): void { for (const entry of array(value, max)) text(entry) }
function numbers(value: unknown): void {
  const entries = Object.values(record(value))
  if (entries.length > MAX_ENTRIES) invalid()
  for (const entry of entries) integer(entry)
}
function stacks(value: unknown, max = MAX_ENTRIES): void {
  for (const entry of array(value, max)) {
    if (entry === null) continue
    const stack = record(entry)
    text(stack.id); if (!stack.id) invalid()
    integer(stack.qty, 1, 1000000)
    if (stack.durability !== undefined) finite(stack.durability)
  }
}

/** 外部文件先完整校验；可选字段允许旧档缺省，但不接受会污染玩法数值的坏数据。 */
export function validateSaveProfile(value: unknown): asserts value is SaveProfile {
  const data = record(value)
  integer(data.version, 1)
  const ch = record(data.character), equipment = record(ch.equipment)
  for (const [slot, id] of Object.entries(equipment)) {
    text(slot)
    if (id !== null) { text(id); if (!id) invalid() }
  }
  stacks(ch.inventory); stacks(ch.quickSlots, 3); stacks(data.storage)
  integer(ch.selected, 0, 2)
  if (ch.name !== undefined) text(ch.name, 100)
  if (ch.appearance !== undefined && ch.appearance !== 'brother' && ch.appearance !== 'sister') invalid()
  if (ch.costume !== undefined && ch.costume !== 'default' && ch.costume !== 'old_miner') invalid()
  if (ch.inventoryCapacity !== undefined) integer(ch.inventoryCapacity, 1, MAX_ENTRIES)
  if (ch.inventoryStackLimit !== undefined) integer(ch.inventoryStackLimit, 1, 1000000)
  if (ch.trash !== undefined) stacks(ch.trash, 1)
  if (ch.equipmentDurability !== undefined) {
    for (const [slot, durability] of Object.entries(record(ch.equipmentDurability))) {
      text(slot)
      finite(durability)
    }
  }
  if (ch.equipmentHidden !== undefined) strings(ch.equipmentHidden)
  const currency = record(data.currency), base = record(data.base), combat = record(data.combat), meta = record(data.meta)
  finite(currency.ember); finite(currency.spark); integer(base.level, 1)
  integer(combat.level, 1); finite(combat.exp); integer(combat.unspentPoints); numbers(combat.points)
  integer(data.round); integer(data.deepestDepth, 1); boolean(data.starterGiven); strings(data.npcs)
  integer(meta.createdAt, 0, 8640000000000000); integer(meta.savedAt, 0, 8640000000000000)
  if (meta.label !== undefined) text(meta.label, 100)
  const flags = Object.entries(record(data.flags))
  if (flags.length > MAX_ENTRIES) invalid()
  for (const [key, flag] of flags) {
    text(key)
    if (typeof flag === 'number') finite(flag, -Number.MAX_SAFE_INTEGER)
    else if (typeof flag === 'string') text(flag, 4096)
    else boolean(flag)
  }
  if (data.location !== undefined) {
    const location = record(data.location), position = record(location.basePosition)
    if (location.scene !== 'base' && location.scene !== 'cave') invalid()
    finite(position.x, -10000000, 10000000); finite(position.y, -10000000, 10000000)
  }
  if (data.smelting !== undefined && data.smelting !== null) {
    const batch = record(data.smelting)
    text(batch.id); integer(batch.qty, 1, 20); integer(batch.startedRound)
    if (batch.state !== 'heating' && batch.state !== 'ready') invalid()
  }
  if (data.discovery !== undefined) {
    const discovery = record(data.discovery)
    strings(discovery.items); numbers(discovery.cooked)
  }
  if (data.pendingSearchUnlocks !== undefined) strings(data.pendingSearchUnlocks)
  if (data.foodCooldown !== undefined) finite(data.foodCooldown)
  if (data.foodDuration !== undefined) finite(data.foodDuration, Number.MIN_VALUE)
  if (data.foodEffects !== undefined) for (const entry of array(data.foodEffects, 256)) {
    const effect = record(entry)
    text(effect.id); text(effect.source); finite(effect.elapsed)
    if (effect.remaining !== null) finite(effect.remaining)
  }
  if (data.livingGun !== undefined) {
    const gun = record(data.livingGun)
    integer(gun.ammo, 0, 60); finite(gun.untilRegen, 0, 5)
    if (gun.recovering !== undefined) boolean(gun.recovering)
  }
}

/** 支持正式导出文件与原始档案 JSON；解析和预览均不触碰任何存档槽。 */
export function decodeSaveFileDetails(contents: string): { data: SaveProfile; fileVersion?: number } {
  if (new TextEncoder().encode(contents).byteLength > MAX_SAVE_FILE_BYTES) throw new SaveTransferError('too_large')
  let value: unknown
  try { value = JSON.parse(contents.replace(/^\uFEFF/, '')) } catch { return invalid() }
  const root = record(value)
  let fileVersion: number | undefined
  if (root.format !== undefined) {
    if (root.format !== FORMAT) invalid()
    integer(root.fileVersion, 1)
    fileVersion = root.fileVersion
    value = root.profile
  }
  validateSaveProfile(value)
  return { data: value, fileVersion }
}

export function decodeSaveFile(contents: string): SaveProfile { return decodeSaveFileDetails(contents).data }

export function encodeSaveFile(profile: SaveProfile): string {
  validateSaveProfile(profile)
  const contents = JSON.stringify({ format: FORMAT, fileVersion: SAVE_FILE_VERSION, exportedAt: Date.now(), profile }, null, 2)
  if (new TextEncoder().encode(contents).byteLength > MAX_SAVE_FILE_BYTES) throw new SaveTransferError('too_large')
  return contents
}
