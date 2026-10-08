/**
 * Dexie（IndexedDB）存档实现
 *
 * 库 touhou-isk v1 两张表：
 * - profile：主键 key，单行存主档案（key='main'；未来多档案再扩）
 * - slices：主键 moduleId，各玩法模块的局内切片（B0 只建表）
 *
 * 注意：db 用懒单例——import 本模块不触发 IndexedDB 访问，
 * Node SSR/单测环境下加载也不会炸，真正读写时才打开数据库。
 */
import Dexie, { type Table } from 'dexie'
import type { SaveProfile } from '../../shared/profile'
import { MAIN_PROFILE_KEY } from '../../shared/profile'
import type { SaveSlice, SaveStore } from './store'

interface ProfileRow {
  key: string
  data: SaveProfile
}

class TouhouIskDB extends Dexie {
  profile!: Table<ProfileRow, string>
  slices!: Table<SaveSlice, string>

  constructor() {
    super('touhou-isk')
    // 版本锚点：结构不兼容改动时在这里 .version(n).stores(...).upgrade(...)
    this.version(1).stores({
      profile: 'key',
      slices: 'moduleId'
    })
  }
}

let dbInstance: TouhouIskDB | null = null

/** 懒打开数据库（首次读写时才实例化） */
function db(): TouhouIskDB {
  if (!dbInstance) dbInstance = new TouhouIskDB()
  return dbInstance
}

export const dexieSaveStore: SaveStore = {
  async loadProfile(): Promise<SaveProfile | null> {
    try {
      const row = await db().profile.get(MAIN_PROFILE_KEY)
      return (row?.data as SaveProfile) ?? null
    } catch (err) {
      console.error('[存档] 读取主档案失败，按无档处理：', err)
      return null
    }
  },

  async saveProfile(profile: SaveProfile): Promise<void> {
    await db().profile.put({ key: MAIN_PROFILE_KEY, data: profile })
  },

  async hasProfile(): Promise<boolean> {
    try {
      return (await db().profile.get(MAIN_PROFILE_KEY)) != null
    } catch (err) {
      console.error('[存档] 检测存档失败：', err)
      return false
    }
  },

  async clearAll(): Promise<void> {
    await Promise.all([db().profile.clear(), db().slices.clear()])
  },

  async loadSlice(moduleId: string): Promise<unknown | null> {
    const row = await db().slices.get(moduleId)
    return row ? row.data : null
  },

  async saveSlice(moduleId: string, data: unknown): Promise<void> {
    await db().slices.put({ moduleId, data })
  }
}
