/**
 * 批次 F · 程序化骨骼动画基建
 *
 * 设计：
 * - 不做位图 Sprite Sheet；角色是一棵"骨骼树"，每根骨由世界角度驱动，
 *   绘制时沿 Canvas 状态栈嵌套 translate/rotate（状态栈即现成 FK 系统）。
 * - 角度约定：世界角 0=+x（右），π/2=+y（下）；骨方向沿局部 +x。
 * - 躯干/腿脚 4 向（right 由 left 镜像得到），头眼与持械臂独立朝任意瞄准角。
 * - 动画层只产出 {@link PlayerPose} 纯数据，绘制层只消费——
 *   未来翻滚/受击/装备换装全部走同一姿态协议，互不耦合。
 */

/** 躯干四向（'right' 由 rig 绘制层整体镜像，姿态只产出 down/up/left/right） */
export type Dir4 = 'down' | 'up' | 'left' | 'right'

/**
 * 全身骨节角度（全部世界角，单位弧度）。
 * far/near = 相对镜头的远侧/近侧肢体（侧视时 near 盖 far）。
 */
export interface PlayerBoneAngles {
  /** 远侧腿：大腿/小腿 */
  thighFar: number
  shinFar: number
  /** 近侧腿 */
  thighNear: number
  shinNear: number
  /** 脊柱（骨盆→头顶方向，站姿为 -π/2） */
  spine: number
  /** 头部（含碎发整体微倾） */
  head: number
  /** 远侧臂：大臂/小臂 */
  armFarUpper: number
  armFarLower: number
  /** 近侧（持械）臂 */
  armNearUpper: number
  armNearLower: number
}

/** 一帧完整姿态：根部位移 + 骨角 + 次级运动参数 */
export interface PlayerPose {
  /** 相对实体原点的根部偏移 */
  rootX: number
  rootY: number
  /** 整体旋转（预留：翻滚/冲击歪斜，本轮恒 0） */
  rootRot: number
  /** 挤压拉伸（预留：落地 squash，本轮恒 1） */
  scaleX: number
  scaleY: number
  bone: PlayerBoneAngles
  /** 披风摆角（正=朝屏幕右飘） */
  cape: number
  /** 发梢摆角 */
  hair: number
  /** 本帧躯干朝向 */
  dir: Dir4
  /** 瞄准角（眼睛瞳孔/武器臂朝向） */
  aim: number
  /** 持械手在贴近镜头一侧（盖躯干），否则在背侧（被躯干遮） */
  weaponInFront: boolean
  /** 双手握持时刀轴独立于前臂，仍使用当前朝向的局部角。 */
  weaponAngle?: number
  supportWeaponAngle?: number
  supportGripWeight?: number
  gripInFront?: boolean
  /** 步态相位（外部扬尘等特效可选读） */
  phase: number
  /** 动画总时钟（眨眼等周期细节用） */
  time: number
}

/** 把任意角度规范到 [-π,π) */
export function wrapPi(a: number): number {
  let r = a % (Math.PI * 2)
  if (r > Math.PI) r -= Math.PI * 2
  if (r <= -Math.PI) r += Math.PI * 2
  return r
}

/** 有符号夹角 b-a ∈ [-π,π) */
export function angleDiff(b: number, a: number): number {
  return wrapPi(b - a)
}

/** 帧率无关指数阻尼（lambda 越大跟得越快） */
export function damp(cur: number, target: number, lambda: number, dt: number): number {
  const k = 1 - Math.exp(-lambda * dt)
  return cur + (target - cur) * k
}

/** 角度版阻尼（走最短弧） */
export function dampAngle(cur: number, target: number, lambda: number, dt: number): number {
  return cur + wrapPi(target - cur) * (1 - Math.exp(-lambda * dt))
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

/** 角度线性插值（最短弧） */
export function lerpAngle(a: number, b: number, t: number): number {
  return a + wrapPi(b - a) * t
}

/**
 * 把移动方向角量化为 4 向。
 * left/right 都可能返回（迟滞判定与镜像分别在外层处理）。
 */
export function quantizeDir4(angle: number): Dir4 {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 'down' : 'up'
  return dx >= 0 ? 'right' : 'left'
}

/** 四向对应的朝向世界角 */
export function dirAngle(dir: Dir4): number {
  switch (dir) {
    case 'down':
      return Math.PI / 2
    case 'up':
      return -Math.PI / 2
    case 'left':
      return Math.PI
    case 'right':
      return 0
  }
}

/**
 * 沿骨节方向嵌套：rotate 到世界角后平移到骨末端。
 * 调用前 ctx 原点在关节点；调用后原点在骨末端、x 轴指向骨方向。
 */
export function along(ctx: CanvasRenderingContext2D, parentWorldAngle: number, worldAngle: number, len: number): void {
  ctx.rotate(wrapPi(worldAngle - parentWorldAngle))
  ctx.translate(len, 0)
}
