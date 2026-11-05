import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/content/vanillaPack'
import { CharacterProfile, SAVE_VERSION, type SaveProfile } from '../src/shared/profile'
import { SaveService } from '../src/core/save/saveService'
import type { SaveStore } from '../src/core/save/store'
import { decodeSaveFile, encodeSaveFile, MAX_SAVE_FILE_BYTES, SaveTransferError } from '../src/core/save/saveTransfer'
import { withoutPersistence } from '../src/core/simulation/persistence'
import { WOOD_ID, VENOM_VIAL_ID } from '../src/content/items/vanilla/ids'

class MemoryStore implements SaveStore {
  main: SaveProfile | null = null
  slices = new Map<string, unknown>()
  fail = false
  waitBeforeWrite: Promise<void> | null = null
  async loadProfile() { return structuredClone(this.main) }
  async saveProfile(data: SaveProfile) {
    await this.waitBeforeWrite
    if (this.fail) throw new Error('模拟写入失败')
    this.main = structuredClone(data)
  }
  async hasProfile() { return this.main !== null }
  async clearAll() { this.main = null; this.slices.clear() }
  async loadSlice(id: string) { return structuredClone(this.slices.get(id) ?? null) }
  async saveSlice(id: string, data: unknown) {
    if (this.fail) throw new Error('模拟写入失败')
    this.slices.set(id, structuredClone(data))
  }
}
function fixture(): SaveProfile {
  const profile = new CharacterProfile()
  profile.playerName = '记录主角'; profile.saveName = '迁移备份'; profile.playerAppearance = 'sister'
  profile.round = 7; profile.deepestDepth = 5
  profile.setFlag('prologue.done', true); profile.setFlag('base.bag.stage', 1)
  profile.setFlag('quest.progress', 2); profile.setFlag('story.note', '记录')
  profile.inventory.add(WOOD_ID, 19)
  profile.storage.add(WOOD_ID, 27)
  profile.equipment.set('trinketF', VENOM_VIAL_ID)
  profile.equipment.setDurability('trinketF', 123)
  profile.equipment.setVisualVisible('outfit', false)
  profile.food.effects.push({ id: 'touhou:satiety', source: 'food:satiety', remaining: 17, elapsed: 23 })
  profile.discovery.unlock(WOOD_ID)
  profile.pendingSearchUnlocks.add('unlock.costume.old_miner')
  return profile.toJSON()
}
function hasCode(code: SaveTransferError['code']) {
  return (error: unknown) => error instanceof SaveTransferError && error.code === code
}

test('文件往返保留装备耐久、时装隐藏、物品、图鉴与剧情数据，兼容原始档案', () => {
  const original = fixture()
  assert.deepEqual(decodeSaveFile(encodeSaveFile(original)), original)
  assert.deepEqual(decodeSaveFile('\uFEFF' + JSON.stringify(original)), original)
  const old = structuredClone(original)
  delete old.discovery; delete old.character.appearance; delete old.character.equipmentHidden
  delete old.foodEffects; delete old.location
  assert.deepEqual(decodeSaveFile(encodeSaveFile(old)), old)
})

test('拒绝坏结构、非法数值及超大文件，版本差异保留给兼容预览', () => {
  for (const contents of ['{', '[]', 'null', '{}', JSON.stringify({ version: 1 })]) {
    assert.throws(() => decodeSaveFile(contents), hasCode('invalid'))
  }
  const bad = fixture()
  bad.character.inventory[0]!.qty = -1
  assert.throws(() => encodeSaveFile(bad), hasCode('invalid'))
  bad.character.inventory[0]!.qty = 1
  bad.combat.level = Infinity
  assert.throws(() => encodeSaveFile(bad), hasCode('invalid'))
  bad.combat.level = 1; bad.version = SAVE_VERSION + 1
  assert.equal(decodeSaveFile(encodeSaveFile(bad)).version, SAVE_VERSION + 1)
  assert.equal(decodeSaveFile(JSON.stringify({ format: 'touhou-isekai-mine-save', fileVersion: 2, profile: fixture() })).round, 7)
  assert.throws(() => decodeSaveFile(' '.repeat(MAX_SAVE_FILE_BYTES + 1)), hasCode('too_large'))
})

test('导出取已保存的检查点，导入指定手动槽不改变当前角色或其他槽', async () => {
  const store = new MemoryStore(), service = new SaveService(store)
  const current = await service.newGame('brother', '当前主角')
  const saved = structuredClone(store.main)
  current.round = 99
  assert.deepEqual(decodeSaveFile(await service.exportSave(0)), saved)
  const incoming = fixture(), contents = encodeSaveFile(incoming)
  store.slices.set('manual:2', saved)
  assert.deepEqual(service.inspectImport(contents), { data: incoming, warnings: [] })
  assert.equal(store.slices.has('manual:1'), false)
  await service.importSave(1, contents)
  assert.deepEqual(store.main, saved)
  assert.deepEqual(store.slices.get('manual:2'), saved)
  assert.deepEqual(decodeSaveFile(await service.exportSave(1)), incoming)
  assert.equal(service.current(), current); assert.equal(current.round, 99)
  const loaded = await service.activateSlot(1)
  assert.equal(loaded.playerAppearance, 'sister')
  assert.equal(loaded.inventory.count(WOOD_ID), 19)
  assert.equal(loaded.equipment.getStack('trinketF')?.durability, 123)
  assert.equal(loaded.equipment.visualVisible('outfit'), false)
})

test('损坏文件不会覆盖已有槽，过量展开不会进入恢复循环', async () => {
  const store = new MemoryStore(), service = new SaveService(store), original = fixture()
  store.slices.set('manual:1', original)
  await assert.rejects(service.importSave(1, '{}'), hasCode('invalid'))
  const huge = fixture(); huge.character.inventory[0] = { id: VENOM_VIAL_ID, qty: 1000000 }
  await assert.rejects(service.importSave(1, encodeSaveFile(huge)), hasCode('too_large'))
  assert.deepEqual(store.slices.get('manual:1'), original)
  await assert.rejects(service.exportSave(3), hasCode('empty'))
})

test('高版本及不同备份格式提供提醒，确认后能正常读取且保留已知数据', async () => {
  const store = new MemoryStore(), service = new SaveService(store)
  const incoming = fixture(); incoming.version = SAVE_VERSION + 1
  const contents = JSON.stringify({ format: 'touhou-isekai-mine-save', fileVersion: 2, profile: incoming })
  const preview = service.inspectImport(contents)
  assert.deepEqual(preview.warnings.map(warning => warning.kind), ['save_version', 'file_version'])
  assert.equal(preview.data.version, SAVE_VERSION)
  assert.equal(incoming.version, SAVE_VERSION + 1)
  assert.equal(store.slices.size, 0)
  await service.importSave(1, contents)
  const loaded = await service.activateSlot(1)
  assert.equal(loaded.round, 7)
  assert.equal(loaded.playerName, '记录主角')
  assert.equal(loaded.equipment.getStack('trinketF')?.durability, 123)
})

test('缺失物品仅提醒并跳过，不匹配的已知装备保留到仓库', async () => {
  const store = new MemoryStore(), service = new SaveService(store), incoming = fixture()
  incoming.character.inventory[1] = { id: 'missing:item', qty: 5 }
  incoming.character.equipment.weaponB = 'missing:weapon'
  incoming.character.equipment.trinketF = WOOD_ID
  const contents = encodeSaveFile(incoming), preview = service.inspectImport(contents)
  assert.deepEqual(preview.warnings, [{ kind: 'missing_items', count: 2 }, { kind: 'equipment', count: 1 }])
  assert.equal(store.slices.size, 0)
  assert.equal(incoming.character.inventory[1]!.id, 'missing:item')
  await service.importSave(1, contents)
  const loaded = await service.activateSlot(1)
  assert.equal(loaded.inventory.count(WOOD_ID), 19)
  assert.equal(loaded.storage.count(WOOD_ID), 28)
  assert.equal(loaded.equipment.get('weaponB'), null)
  assert.equal(loaded.equipment.get('trinketF'), null)
})

test('存储失败保留旧档，失败任务不会阻塞下一次导入', async () => {
  const store = new MemoryStore(), service = new SaveService(store)
  const original = fixture(); original.round = 1
  store.slices.set('manual:1', original)
  store.fail = true
  await assert.rejects(service.importSave(1, encodeSaveFile(fixture())))
  assert.deepEqual(store.slices.get('manual:1'), original)
  store.fail = false
  await service.importSave(1, encodeSaveFile(fixture()))
  assert.equal((store.slices.get('manual:1') as SaveProfile).round, 7)
})

test('导入在排队自动保存后写入，不被先前尚未完成的检查点反向覆盖', async () => {
  const store = new MemoryStore(), service = new SaveService(store)
  const current = await service.newGame()
  let release!: () => void
  store.waitBeforeWrite = new Promise<void>(resolve => { release = resolve })
  current.round = 3
  const saving = service.autosave(), importing = service.importSave(0, encodeSaveFile(fixture()))
  assert.equal(store.main!.round, 0)
  release(); await Promise.all([saving, importing])
  assert.equal((await service.readAutosave())!.round, 7)
  assert.equal(service.current(), current); assert.equal(current.round, 3)
})

test('回放期间拒绝导入，不改变真实存档', async () => {
  const store = new MemoryStore(), service = new SaveService(store)
  await assert.rejects(withoutPersistence(() => service.importSave(0, encodeSaveFile(fixture()))))
  assert.equal(store.main, null)
})
