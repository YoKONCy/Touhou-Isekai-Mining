/**
 * 预定义 AI 模板注册表（引擎侧）
 * Enemy 构造时按 EnemyDef.ai 取模板；未来 Boss 的 custom AI
 * 作为新的 EnemyBrain 注册进来即可，无需改动 Enemy 类。
 */
import type { EnemyBrain } from './types'
import { chaserBrain } from './chaser'
import { kiteShooterBrain } from './kiteShooter'
import { pouncerBrain } from './pouncer'
import { stationaryShooterBrain } from './stationaryShooter'
import { chargeCycleBrain } from './chargeCycle'
import { guardianBrain } from './guardian'
import { kedamaShooterBrain } from './kedamaShooter'

const brains = new Map<string, EnemyBrain>()

/** 注册一个 AI 模板（内置/脚本 MOD 同路径） */
export function registerBrain(brain: EnemyBrain): void {
  brains.set(brain.id, brain)
}

/** 取 AI 模板（id 缺失直接抛错——Def 写错应当启动即暴露） */
export function getBrain(id: string): EnemyBrain {
  const b = brains.get(id)
  if (!b) throw new Error(`[enemyAi] 未知的敌人 AI 模板：${id}（Def 拼错或模板包未加载？）`)
  return b
}

// 内置模板
registerBrain(chaserBrain)
registerBrain(kiteShooterBrain)
registerBrain(pouncerBrain)
registerBrain(chargeCycleBrain)
registerBrain(stationaryShooterBrain)
registerBrain(guardianBrain)
registerBrain(kedamaShooterBrain)

export type { EnemyBrain, EnemyAiHost, AIState, WindupKind, PounceState, ShotRequest, PlayerLike } from './types'
