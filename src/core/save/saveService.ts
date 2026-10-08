/**
 * 存档服务（应用服务层）
 *
 * 两类存档槽，物理上相互独立（profile 表 main 单行 / slices 表 manual:1~3）：
 * - **autosave 槽（主档 main）**：由游戏在显式检查点自动写入，可独立重命名，
 *   触发时机＝每次从基地东门踏入矿洞前（含撤离回基地整理后再下矿）、安全撤离结算后、
 *   序章关键节点；页面隐藏、矿洞升级与死亡均不得隐式覆盖——死亡后刷新即回到下矿前状态。
 * - **手动三槽（manual:1~3）**：玩家在基地暂停菜单手动存入/读取，矿洞场景禁止存入。
 *
 * - 启动时 loadOrCreate：有档读 autosave 槽、无档建档；版本不匹配走迁移/安全降级
 *
 * 存储介质经构造注入（默认 Dexie/IndexedDB）；测试可换内存假实现。
 */
import {
  CharacterProfile,
  SAVE_VERSION,
  SAVE_NAME_MAX_LENGTH,
  type SaveProfile
} from '../../shared/profile'
import type { SaveStore } from './store'
import { dexieSaveStore } from './dexieStore'

/**
 * 【源码级调试开关】启动即清档（手动切换，非 UI 入口、与 dev/构建模式无关）：
 * - true（手动清档调试）＝ 每次游戏引导都先清空本地存档再建新档，
 *   刷新浏览器即从零开局，序章测试背包不会越堆越多；
 * - false ＝ 正常读档游玩。
 * 存档读写代码本身完全保留；将来正式存档做好后，调试拨 true、正常玩拨 false 即可，无需 build。
 */
export const WIPE_SAVE_ON_BOOT = false

export class SaveService {
  private profile: CharacterProfile | null = null
  private pendingSave: Promise<void> = Promise.resolve()

  constructor(private readonly store: SaveStore = dexieSaveStore) {}

  /**
   * 启动引导：有档则恢复，无档则建新档并立即落盘一次。
   * 返回的档案即本局唯一实例，玩法模块共享同一引用。
   */
  async loadOrCreate(): Promise<CharacterProfile> {
    // 清档调试模式：无条件忽略旧档并清空存储，每次引导都是全新档案
    if (WIPE_SAVE_ON_BOOT) {
      await this.store.clearAll()
      console.info('[存档] 清档模式（WIPE_SAVE_ON_BOOT=true）：已清空本地存档，全新开局')
      return this.freshProfile(false)
    }
    const data = await this.store.loadProfile()
    if (data) {
      try {
        const migrated = migrate(data)
        const profile = new CharacterProfile()
        profile.fromJSON(migrated)
        this.profile = profile
        console.info(
          `[存档] 已读档：Lv.${profile.combat.level} · 第 ${profile.round} 趟 · 入驻 ${profile.npcs.length} 人`
        )
        return profile
      } catch (err) {
        // 版本不兼容/结构损坏：安全降级为新档（不立即覆盖坏档，留待首次正常保存）
        console.error('[存档] 恢复失败，降级为新档：', err)
        return this.freshProfile(false)
      }
    }
    console.info('[存档] 未发现存档，建立新档')
    return this.freshProfile(true)
  }

  /** 是否存在存档（标题屏"继续游戏"用；清档模式恒为无档） */
  hasSave(): Promise<boolean> {
    if (WIPE_SAVE_ON_BOOT) return Promise.resolve(false)
    return this.store.hasProfile()
  }

  /** 当前运行时档案（必须在 loadOrCreate 之后调用） */
  current(): CharacterProfile {
    if (!this.profile) throw new Error('SaveService：档案尚未加载（先 await loadOrCreate）')
    return this.profile
  }

  /**
   * 写入 autosave 槽（主档）：仅在显式检查点调用——
   * 每次下矿前、安全撤离回基地后、营地制作与修缮、主线关键节点；
   * 页面隐藏、矿洞升级和死亡均不允许隐式覆盖存档。
   */
  async autosave(): Promise<void> {
    if (!this.profile) return
    const snapshot = structuredClone(this.profile.toJSON())
    this.pendingSave = this.pendingSave.then(() => this.persistSnapshot(snapshot))
    await this.pendingSave
  }

  /** 剧情已看标志独立落盘，不覆盖死亡后仍需保留的下矿前检查点。 */
  async persistStoryFlag(key: string): Promise<void> {
    const value = this.profile?.flag(key)
    if (value === undefined) return
    this.pendingSave = this.pendingSave.then(async () => {
      const snapshot = await this.store.loadProfile()
      if (!snapshot) return
      snapshot.flags = { ...snapshot.flags, [key]: value }
      await this.persistSnapshot(snapshot)
    })
    await this.pendingSave
  }

  /** 三个手动槽独立于自动主档，覆盖前由界面确认。 */
  async listSlots(): Promise<Array<SaveProfile | null>> {
    return Promise.all([1, 2, 3].map(async slot => await this.store.loadSlice(`manual:${slot}`) as SaveProfile | null))
  }

  /** 标题页只读取摘要，不创建新档或覆盖原有进度。 */
  async readAutosave(): Promise<SaveProfile | null> {
    if (WIPE_SAVE_ON_BOOT) return null
    await this.pendingSave
    return this.store.loadProfile()
  }

  async resumeAutosave(): Promise<CharacterProfile> {
    const raw = await this.readAutosave()
    if (!raw) throw new Error('自动存档为空')
    const restored = new CharacterProfile()
    restored.fromJSON(migrate(raw))
    this.profile = restored
    return restored
  }

  /** 仅补写身份，保留主档的背包、血量与下矿前检查点。 */
  async persistAppearance(appearance: 'brother' | 'sister'): Promise<void> {
    const profile = this.current()
    const task = this.pendingSave.then(async () => {
      const snapshot = await this.store.loadProfile()
      if (!snapshot) throw new Error('没有可更新身份的自动存档')
      snapshot.character.appearance = appearance
      await this.store.saveProfile(snapshot)
      profile.playerAppearance = appearance
    })
    // 身份写入失败可重试，不能阻塞后续检查点保存。
    this.pendingSave = task.catch(() => {})
    await task
  }

  async saveSlot(slot: number): Promise<void> {
    if (![1, 2, 3].includes(slot)) throw new Error('无效存档槽')
    await this.pendingSave
    const snapshot = structuredClone(this.current().toJSON())
    const previous = await this.store.loadSlice(`manual:${slot}`) as SaveProfile | null
    // 槽位的自定义名称在覆盖进度时保留，不从自动档复制名称。
    snapshot.meta.label = previous?.meta?.label ?? ''
    await this.store.saveSlice(`manual:${slot}`, snapshot)
  }

  /** 只更新记录名称，不覆盖检查点内容或改变记录的保存时间。0 为自动档。 */
  async renameSave(slot: number, name: string): Promise<void> {
    if (![0, 1, 2, 3].includes(slot)) throw new Error('无效存档槽')
    const label = name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, SAVE_NAME_MAX_LENGTH)
    const task = this.pendingSave.then(async () => {
      const snapshot = slot === 0 ? await this.store.loadProfile() : await this.store.loadSlice(`manual:${slot}`) as SaveProfile | null
      if (!snapshot) throw new Error('空槽位无法重命名')
      snapshot.meta.label = label
      if (slot === 0) {
        await this.store.saveProfile(snapshot)
        if (this.profile?.createdAt === snapshot.meta.createdAt) this.profile.saveName = label
      } else await this.store.saveSlice(`manual:${slot}`, snapshot)
    })
    this.pendingSave = task.catch(() => {})
    await task
  }

  /** 验证槽位后替换主档；重新引导销毁旧模块、输入与剧情计时器。 */
  async activateSlot(slot: number): Promise<CharacterProfile> {
    if (![1, 2, 3].includes(slot)) throw new Error('无效存档槽')
    const raw = await this.store.loadSlice(`manual:${slot}`) as SaveProfile | null
    if (!raw) throw new Error('存档槽为空')
    const restored = new CharacterProfile()
    restored.fromJSON(migrate(raw))
    await this.pendingSave
    await this.store.saveProfile(restored.toJSON())
    this.profile = restored
    return restored
  }

  /** 清档前停止接收保存，并等待已有写入，避免旧档在清空后回写。 */
  async clearSave(): Promise<void> {
    const previous = this.profile
    this.profile = null
    try {
      await this.pendingSave
      await this.store.clearAll()
    } catch (err) {
      this.profile = previous
      throw err
    }
    console.info('[存档] 已清空')
  }

  /** 新游戏只替换自动主档，保留手动槽；写入失败不切换运行时档案。 */
  async newGame(appearance: 'brother' | 'sister' = 'brother', name = ''): Promise<CharacterProfile> {
    await this.pendingSave
    const fresh = new CharacterProfile()
    fresh.playerAppearance = appearance
    fresh.playerName = name.trim().slice(0, 12)
    await this.store.saveProfile(fresh.toJSON())
    this.profile = fresh
    return fresh
  }

  /**
   * 绑定一份全新档案为本局档案。
   * @param writeNow 是否立即落盘（正常新档立即写；坏档降级时先不覆盖）
   */
  private async freshProfile(writeNow: boolean): Promise<CharacterProfile> {
    const fresh = new CharacterProfile()
    this.profile = fresh
    if (writeNow) await this.persist(fresh)
    return fresh
  }

  /** 写盘的统一出口：失败只记日志，绝不因存档错误打断游戏 */
  private persist(profile: CharacterProfile): Promise<void> {
    return this.persistSnapshot(profile.toJSON())
  }

  private async persistSnapshot(snapshot: SaveProfile): Promise<void> {
    try {
      await this.store.saveProfile(snapshot)
    } catch (err) {
      console.error('[存档] 写入失败（游戏继续，进度可能未保存）：', err)
    }
  }
}

/**
 * 存档版本迁移：未来结构变更时在这里按 version 逐级升。
 * - 高于当前代码版本的存档（未来降级打开）：无法安全迁移，抛出后由上层降级为新档
 * - 低于当前版本：逐级补齐（B0 只有 v1，暂无分支）
 */
function migrate(data: SaveProfile): SaveProfile {
  if (typeof data.version !== 'number') {
    console.warn('[存档] 档案缺少版本号，按新档处理')
    throw new Error('存档无版本号')
  }
  if (data.version > SAVE_VERSION) {
    console.warn(`[存档] 档案版本 ${data.version} 高于当前 ${SAVE_VERSION}，不兼容，按新档处理`)
    throw new Error('存档版本过高')
  }
  // 例：if (data.version < 2) { data = upgradeV1ToV2(data) }
  return data
}

/** 游戏全局单例（组合根 main.ts 使用） */
export const saveService = new SaveService()

/**
 * 角色档案的 Vue 依赖注入键（字符串键，避免 shared/core 纯净层依赖 vue）。
 * 标题完成选档后，App.vue 向玩法子树提供同一档案实例。
 */
export const PROFILE_KEY = 'characterProfile'
