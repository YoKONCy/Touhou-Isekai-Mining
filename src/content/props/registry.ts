/**
 * 摆件注册表（碰撞/布局/渲染的唯一真值）
 */
import { Registry } from '../core/Registry'
import type { PropDef, PropId } from './types'

/** 摆件注册表单例（官方包/MOD 包都往这里登记） */
export const propDefs = new Registry<PropDef>('prop')

/** 取摆件定义（id 缺失抛错——已生成的摆件必定能查到） */
export function getPropDef(id: PropId): PropDef {
  return propDefs.require(id)
}

/** 取摆件定义（缺失返回 undefined，存档容错用） */
export function findPropDef(id: PropId): PropDef | undefined {
  return propDefs.get(id)
}
