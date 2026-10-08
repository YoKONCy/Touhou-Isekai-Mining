/**
 * 弹幕注册表（全局唯一一份弹种真值）
 */
import { Registry } from '../core/Registry'
import type { ProjectileDef, ProjectileId } from './types'

/** 弹幕注册表单例（官方包/MOD 包都往这里登记） */
export const projectiles = new Registry<ProjectileDef>('projectile')

/** 取弹种定义（id 缺失抛错——发射链路要求 Def 必定存在） */
export function getProjectileDef(id: ProjectileId): ProjectileDef {
  return projectiles.require(id)
}

/** 取弹种定义（缺失返回 undefined，存档容错/外部数据校验用） */
export function findProjectileDef(id: ProjectileId): ProjectileDef | undefined {
  return projectiles.get(id)
}
