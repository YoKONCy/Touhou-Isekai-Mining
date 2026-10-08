/**
 * 敌人注册表 + 自然刷怪加权混编入口
 */
import { Registry, weightedPick } from '../core/Registry'
import type { EnemyDef, EnemyId } from './types'

/** 敌人注册表单例（官方包/MOD 包都往这里登记） */
export const enemies = new Registry<EnemyDef>('enemy')

/** 默认允许自然刷怪的房型（战斗房） */
const DEFAULT_ROOMS = ['normal', 'exit']

const floorWeight=(def:EnemyDef,floor:number)=>def.spawn?.floorWeights?.[floor]??def.spawn?.weight??0

/**
 * 按房型/深度在注册表里加权抽一只怪的 id。
 * 引擎刷怪只调它——加新怪只要在 Def 里写 spawn.weight，本函数零改动。
 * @returns 总权为 0（无合格怪）时返回 null
 */
export function rollEnemyId(roomKind: string, depth: number, floor = 1): EnemyId | null {
  const pool = enemies.select((d) => {
    const s = d.spawn
    if (!s || floorWeight(d,floor) <= 0 || s.fixedCount) return false
    const rooms = s.rooms ?? DEFAULT_ROOMS
    if (!rooms.includes(roomKind)) return false
    if (s.minDepth !== undefined && depth < s.minDepth) return false
    if (s.maxDepth !== undefined && depth > s.maxDepth) return false
    if (s.minFloor !== undefined && floor < s.minFloor) return false
    if (s.maxFloor !== undefined && floor > s.maxFloor) return false
    return true
  })
  return weightedPick(pool, (d) => floorWeight(d,floor))?.id ?? null
}

/** 楼层专属固定敌人独立于随机抽取，也不会被挖矿爆怪重复选中。 */
export function fixedEnemyIds(roomKind:string,floor:number):EnemyId[]{
  const ids:EnemyId[]=[]
  for(const def of enemies.all()){
    const s=def.spawn
    if(!s?.fixedCount||!s.rooms?.includes(roomKind))continue
    if(s.minFloor!==undefined&&floor<s.minFloor||s.maxFloor!==undefined&&floor>s.maxFloor)continue
    for(let n=0;n<s.fixedCount;n++)ids.push(def.id)
  }
  return ids
}
