/**
 * 存档存储抽象（端口）
 *
 * 上层 SaveService 只依赖本接口；默认实现走 Dexie(IndexedDB)，
 * 测试可注入内存假实现。介质可整体替换（如未来加云同步）而不动玩法代码。
 */
import type { SaveProfile } from '../../shared/profile'

/** 单个模块的存档切片（IGameModule.save/load 用；B0 只建表不写数据） */
export interface SaveSlice {
  moduleId: string
  data: unknown
}

export interface SaveStore {
  /** 读取主档案；无档返回 null；读失败由实现捕获并返回 null（不得抛） */
  loadProfile(): Promise<SaveProfile | null>
  /** 覆盖写入主档案 */
  saveProfile(profile: SaveProfile): Promise<void>
  /** 是否存在主档案（标题屏"继续游戏"置灰判断） */
  hasProfile(): Promise<boolean>
  /** 清空全部存档（清档入口，含切片表） */
  clearAll(): Promise<void>
  /** 读取模块切片（预留） */
  loadSlice(moduleId: string): Promise<unknown | null>
  /** 写入模块切片（预留） */
  saveSlice(moduleId: string, data: unknown): Promise<void>
}
