/**
 * 批次 F③ · 手持武器绘制器（DRTC 积木像素风，与 playerRig 同形状语言）
 *
 * 调用约定：本绘制器运行在"持械手局部系"中——
 *   原点 = 手心，+x = 小臂指向（= 武器朝向），+y = 角色右侧偏下。
 * 挥砍/突刺的角度与位移全部由持械臂骨骼（armAim）与 thrust 驱动，
 * 本文件只画静止的器型，不做角度计算。
 *
 * 器型：铁剑=皮柄+黄铜十字护手+通直双刃；生锈铁镐=旧木柄+锈铁双尖镐头。
 */
import type { ItemId } from '../../../shared/itemDefs'
import { items } from '../../../content/items/registry'
import type { WeaponMotionView } from '../../../content/items/types'

export interface RigWeaponOpts {
  drawProgress?: number
  bowPull?: number
  bowReleaseProgress?: number
  bowCharged?: boolean
  ammoNocked?: boolean
  ammunitionId?: ItemId
  /** 链式武器的局部动作与当前挥击阶段同步。 */
  motion?: WeaponMotionView
  /** stab 突刺沿 +x 的额外前冲量（windup 可为负=收身后引） */
  thrust?: number
  empowered?: boolean
  time?: number
}

/**
 * 在手部局部系绘制手持武器。
 * @param toolId 当前手持物品 id（挥击中由调用方保证是本次快照）
 */
export function drawRigWeapon(
  ctx: CanvasRenderingContext2D,
  toolId: ItemId,
  opts: RigWeaponOpts = {}
): void {
  const thrust = opts.thrust ?? 0
  ctx.save()
  ctx.translate(thrust, 0)
  items.require(toolId).weapon?.drawHeld?.(ctx, opts)
  ctx.restore()
}


