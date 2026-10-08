/**
 * 批次 F · 玩家骨骼动画状态机（本轮：idle / walk）
 *
 * 输入只有"速度 + 移动角 + 瞄准角"，输出一帧 {@link PlayerPose}：
 * - 循环动画（呼吸/步态）用程序周期函数，步频随速度变化（起步停步靠 stride 权重阻尼，不突变）；
 * - 躯干 4 向带 0.08s 迟滞确认（45° 边界不抖），站定保持最后朝向；
 * - 头/脊柱只小幅跟随步态，眼睛与武器臂由瞄准角独立驱动。
 *
 * 翻滚/挥击/死亡等编排类动画在后续轮次作为新状态接入，
 * build 协议保持不变。
 */
import {
  clamp01,
  damp,
  dirAngle,
  quantizeDir4,
  type Dir4,
  type PlayerBoneAngles,
  type PlayerPose
} from './skeleton'
import type { WeaponBodyMotion, WeaponGrip } from '../../../content/items/types'
import { applySupportGrip } from './handGrip'

/** 动画状态机每帧喂入的实况 */
export interface AnimInput {
  /** 实际速度大小 px/s */
  speed: number
  /** 最近移动方向角（静止时保持上一次） */
  moveAngle: number
  /** 鼠标瞄准角 */
  aim: number
  /**
   * 批次 F③：挥击期间持械臂锁定指向角（武器视觉角）。
   * 给出时持械臂完全指向该角（权重拉满）；不给走 idle/walk 持握姿态。
   */
  armAim?: number | null
  /** 专属蓄势的折肘角，缺省为零，保持通用挥击的伸臂姿态。 */
  armBend?: number
  /** 手中是否持有武器/道具：false 时双臂都自然垂落摆动（不做抱武器姿势） */
  armed?: boolean
}

/** 4 向切换迟滞确认时间 s（避免斜 45° 抖动） */
const DIR_HOLD = 0.08
/** 进入/退出步态的速度阈值 px/s */
const MOVE_EPS = 30

export class PlayerAnimator {
  /** 总时钟（呼吸/眨眼/闲置微动） */
  private t = 0
  /** 步态相位（一个完整左右步循环 2π） */
  private cycle = 0
  /** 迈步权重 0=站定 1=全速，指数阻尼平滑起步停步 */
  private stride = 0
  /** 当前躯干朝向 */
  private dir: Dir4 = 'down'
  /** 待确认朝向 + 已持续时间 */
  private candidate: Dir4 = 'down'
  private candidateT = 0

  // —— 翻滚（真人团身前滚翻，俯视表现：长轴对翻滚方向 + 整组旋转一周） ——
  private rolling = false
  private rollT = 0
  private rollDur = 0.14
  private rollAngle = 0
  /** 翻滚进度 0~1（渲染扬尘用） */
  get rollProgress(): number {
    return this.rolling ? Math.min(1, this.rollT / this.rollDur) : -1
  }

  /** 挥击锁臂角（每帧由 update 写入；null=自由持握） */
  private armAim: number | null = null
  private armBend = 0
  private bodyMotion: WeaponBodyMotion | undefined
  private supportGrip: WeaponGrip | undefined
  /** 手中是否持有武器（默认 true 兼容旧调用方） */
  private armed = true

  /** 最近一帧姿态（外部残影环形缓存会直接存它） */
  private out: PlayerPose

  constructor() {
    this.out = this.blankPose('down', Math.PI / 2)
  }

  private blankPose(dir: Dir4, aim: number): PlayerPose {
    return {
      rootX: 0,
      rootY: 0,
      rootRot: 0,
      scaleX: 1,
      scaleY: 1,
      bone: {
        thighFar: Math.PI / 2,
        shinFar: Math.PI / 2,
        thighNear: Math.PI / 2,
        shinNear: Math.PI / 2,
        spine: -Math.PI / 2,
        head: -Math.PI / 2,
        armFarUpper: Math.PI / 2,
        armFarLower: Math.PI / 2,
        armNearUpper: Math.PI / 2,
        armNearLower: Math.PI / 2
      },
      cape: 0,
      hair: 0,
      dir,
      aim,
      weaponInFront: true,
      phase: 0,
      time: 0
    }
  }

  /** 触发一次翻滚：朝 angle 方向团身滚一周（dur 与 Player 短闪时长同源） */
  startRoll(angle: number, dur: number): void {
    this.rolling = true
    this.rollT = 0
    this.rollDur = Math.max(0.001, dur)
    this.rollAngle = angle
  }

  /** 渲染前同步专属动作角，不额外推进动画时钟。 */
  setArmAim(angle: number | null, bend = 0): void { this.armAim = angle; this.armBend = bend }
  setWeaponMotion(body?: WeaponBodyMotion, grip?: WeaponGrip): void { this.bodyMotion = body; this.supportGrip = grip }
  get bodyFacing(): number { return dirAngle(this.dir) }
  get motionTime(): number { return this.t }
  get gaitPhase(): number { return this.cycle }
  get gaitWeight(): number { return this.stride }

  /** 每帧推进动画时钟与朝向状态 */
  update(dt: number, input: AnimInput): void {
    this.t += dt
    this.armAim = input.armAim ?? null
    this.armBend = input.armBend ?? 0
    this.armed = input.armed ?? true

    // —— 翻滚中：只推进翻滚时钟，步态冻结 ——
    if (this.rolling) {
      this.rollT += dt
      if (this.rollT >= this.rollDur) this.rolling = false
      return
    }

    // —— 步态权重 + 相位（全速约 12rad/s，与批次 E 的 walkClock 体感接近） ——
    const moving = input.speed > MOVE_EPS
    const targetStride = moving ? clamp01((input.speed - MOVE_EPS) / 185) : 0
    this.stride = damp(this.stride, targetStride, 11, dt)
    if (this.stride > 0.01) this.cycle += dt * (7.5 + 5 * targetStride)

    // —— 4 向迟滞：新方向必须持续 DIR_HOLD 才切 ——
    if (moving) {
      const q = quantizeDir4(input.moveAngle)
      if (q === this.dir) {
        this.candidate = q
        this.candidateT = 0
      } else if (q === this.candidate) {
        this.candidateT += dt
        if (this.candidateT >= DIR_HOLD) {
          this.dir = q
          this.candidateT = 0
        }
      } else {
        this.candidate = q
        this.candidateT = 0
      }
    }
  }

  /** 产出本帧姿态（纯计算，无副作用） */
  build(aim: number): PlayerPose {
    // —— 翻滚团身：长轴对齐翻滚方向 + 整组旋转一周，四肢抱收（dir 固定 down 不镜像） ——
    if (this.rolling) {
      return this.buildRoll()
    }
    const dir = this.bodyMotion?.facing === undefined ? this.dir : quantizeDir4(this.bodyMotion.facing)
    const da = dirAngle(dir)
    const w = this.stride
    const φ = this.cycle
    const t = this.t
    const b: PlayerBoneAngles = this.out.bone

    // 步态量（腿骨中轴恒为竖直向下 π/2；摆幅=迈腿幅度）
    const sinF = Math.sin(φ)
    const cosF = Math.cos(φ)
    const side = dir === 'left' || dir === 'right'

    if (side) {
      // —— 侧视步态：前后摆幅近对称（前 0.5 / 后 0.42），屈膝只在摆动相 ——
      // 相位（far 腿）：sinF=+1 前顶点（脚在身前刚落地，腿伸直）；
      //   cosF<0 半周＝支撑相（脚在地上，身体越过脚，腿基本直，后顶点 sinF=-1 蹬直）；
      //   cosF>0 半周＝摆动相（脚离地收膝前摆，中点 φ=0 屈膝最大），near 反相。
      // 角的"身前"语义按朝左基底，朝右由渲染层 scale(-1,1) 单重镜像。
      const swing = (s: number): number => (s > 0 ? s * 0.5 : s * 0.42)
      const thighFar = Math.PI / 2 + swing(sinF) * w
      const thighNear = Math.PI / 2 + swing(-sinF) * w
      // 弯曲只给摆动相：cosF>0＝far 摆动相、-cosF>0＝near 摆动相；
      // 平方权重让弯曲集中在中点（高抬收膝），两个顶点都近伸直——
      // 后顶点腿直，脚跟才能真正探到身后（反侧甩动可见，不勾脚＝不滑步）。
      const bendFar = 0.08 + Math.pow(Math.max(0, cosF), 2) * 0.85 * w
      const bendNear = 0.08 + Math.pow(Math.max(0, -cosF), 2) * 0.85 * w
      b.thighFar = thighFar
      b.shinFar = thighFar + bendFar
      b.thighNear = thighNear
      b.shinNear = thighNear + bendNear
    } else {
      // —— 正视/背影视角：腿不能左右甩（屏幕 x 摆动≠走路），改做原地垂直踏步 ——
      // 技巧：大腿抬角 α 与小腿反向角抵消（L1≈L2），脚踝几乎只做上下运动；
      // 裤管在膝处折出抬腿轮廓，远/近腿反相。±0.06 恒定外八给两脚分列。
      const alphaFar = 0.74 * Math.max(0, sinF) * w
      const alphaNear = 0.74 * Math.max(0, -sinF) * w
      b.thighFar = Math.PI / 2 + 0.06 + alphaFar
      b.shinFar = Math.PI / 2 + 0.06 - alphaFar * 0.9
      b.thighNear = Math.PI / 2 - 0.06 + alphaNear
      b.shinNear = Math.PI / 2 - 0.06 - alphaNear * 0.9
      // 站定 idle 左右腿极微换重心
      b.thighNear += 0.03 * (1 - w) * Math.sin(t * 1.3)
    }

    // —— 躯干：行走轻微前倾（积木风身体保持基本正直，0.05 即可），加 idle 呼吸 ——
    const lean = 0.05 * w
    const breathe = 0.012 * Math.sin(t * 2.1)
    // 把"朝上 (0,-1)"朝移动方向旋转 lean
    const sx = Math.cos(da) * Math.sin(lean)
    const sy = -Math.cos(lean) + Math.sin(da) * Math.sin(lean)
    b.spine = Math.atan2(sy, sx) + breathe
    // 头保持基本竖直，只跟三成躯干倾斜
    b.head = -Math.PI / 2 + (b.spine + Math.PI / 2) * 0.3 + 0.02 * Math.sin(t * 1.4)

    // —— 远侧臂：与同侧腿反相自然摆动（侧视大摆，俯视垂身侧小幅） ——
    const armAmp = (side ? 0.5 : 0.13) * w
    // 垂臂时相对肩外侧外展（约 10°）：外展方向必须按 perp 翻转——
    // down 时 perpX=-1、up 时 +1，写死方向会让背面外展变内收（两袖在背后拱手）
    const perpX = Math.cos(da + Math.PI / 2)
    const armHangFar = Math.PI / 2 - perpX * 0.17
    b.armFarUpper = armHangFar - sinF * armAmp
    b.armFarLower = b.armFarUpper + (side ? 0 : 0.04) + Math.max(0, sinF) * (side ? 0.35 : 0.12) * w

    // —— 近侧（持械）臂 ——
    const armHangNear = Math.PI / 2 + perpX * 0.17
    let upper: number
    let lower: number
    // 角语义标记：挥击/持械姿态的臂角跟随 aim/lock＝世界角；徒手足局部摆角。
    // right 朝向渲染根层有 scale(-1,1) 镜像：世界角必须先换成"朝左基底局部角"
    // （π-a 即竖直轴镜像），否则根层再翻一次方向会反（剑挥到鼠标对面）。
    let worldAngled = false
    if (this.armAim !== null) {
      // 挥击锁臂：大臂完全跟向武器角（留 0.06 屈度），小臂直指武器角
      const lock = this.armAim
      upper = armHangNear + this.shortAngle(lock, armHangNear) * 0.97 + this.armBend
      lower = lock
      worldAngled = true
    } else if (!this.armed) {
      // 徒手：与远臂反相自然摆动；站定大臂垂直、小臂轻屈，手垂胯侧不抱腹
      upper = armHangNear + sinF * armAmp
      if (!side) upper -= 0.03 * (1 - w) * Math.sin(t * 1.3)
      lower = upper + (side ? 0 : 0.06) + Math.max(0, -sinF) * (side ? 0.35 : 0.15) * w
    } else {
      // 持械 idle：武器轻持在腰前（raise 0.5，不横抱到胸前）；走起步逐渐回到指向角
      const idleCradle = 0.22 * (1 - w)
      upper = armHangNear + this.shortAngle(aim, armHangNear) * 0.5
      upper -= sinF * 0.1 * w
      lower = aim + 0.08 + idleCradle
      worldAngled = true
    }
    if (worldAngled && dir === 'right') {
      upper = Math.PI - upper
      lower = Math.PI - lower
    }
    b.armNearUpper = upper
    b.armNearLower = lower

    // —— 根部：步态踮脚 bob + idle 呼吸 ——
    const rootY = -Math.abs(sinF) * 1.7 * w + 0.35 * Math.sin(t * 2.1) * (1 - w * 0.5)

    // —— 次级运动：披风反步相翻飞、发梢迟滞 ——
    const cape = sinF * 0.22 * w + 0.05 * Math.sin(t * 1.8)
    const hair = -sinF * 0.1 * w + 0.035 * Math.sin(t * 1.5)

    // —— 持械手前后层判定 ——
    // 局部角 0=角色面朝方向；down 朝前(贴镜头)在 front，up 相反，侧视恒 front
    // 挥击中武器恒在前层（劈砍弧线不钻身体）
    const local = this.shortAngle(aim, da)
    let weaponInFront: boolean
    if (this.armAim !== null) weaponInFront = true
    else if (dir === 'up') weaponInFront = Math.abs(local) > 1.05
    else if (dir === 'down') weaponInFront = Math.abs(local) < 2.1
    else weaponInFront = true

    const pose = this.out
    // 身体不在局部系做前后周期位移：角色在世界中匀速移动，rootX 周期晃只会制造滑步观感；
    // 近对称摆幅下双脚平均偏移只剩恒定小量（被恒速位移吸收），无需补偿。
    pose.rootX = this.bodyMotion?.rootX ?? 0
    pose.rootY = rootY + (this.bodyMotion?.rootY ?? 0)
    pose.rootRot = this.bodyMotion?.tilt ?? 0
    // 待机呼吸围绕脚底轻微伸缩，行走时平滑收弱。
    const idleBreath=Math.sin(t*2.1)*(1-w)
    pose.scaleX = 1-idleBreath*0.003
    pose.scaleY = 1+idleBreath*0.009
    pose.cape = cape
    pose.hair = hair
    pose.dir = dir
    pose.aim = aim
    pose.weaponInFront = weaponInFront
    pose.phase = φ
    pose.time = t
    b.spine += this.bodyMotion?.lean ?? 0
    pose.weaponAngle = undefined; pose.supportWeaponAngle = undefined; pose.supportGripWeight = undefined; pose.gripInFront = undefined
    if (this.supportGrip) applySupportGrip(pose, this.armAim ?? aim, this.supportGrip)
    return pose
  }

  /** [-π,π) 短角差 */
  private shortAngle(b: number, a: number): number {
    let d = (b - a) % (Math.PI * 2)
    if (d > Math.PI) d -= Math.PI * 2
    if (d <= -Math.PI) d += Math.PI * 2
    return d
  }

  /**
   * 翻滚团身姿态：
   * - rootRot 先把身体长轴（屏幕 -y）对齐翻滚方向，再整组旋转一周；
   * - 中段最团（沿长轴压 0.72、横向放 1.12），起末帧略舒展；
   * - 两腿深蹲收、两臂抱紧、头埋下；披风/头发不飘（团在身上）。
   */
  private buildRoll(): PlayerPose {
    this.out.weaponAngle = undefined; this.out.supportWeaponAngle = undefined; this.out.supportGripWeight = undefined; this.out.gripInFront = undefined
    const p = Math.min(1, this.rollT / this.rollDur)
    const curl = Math.sin(p * Math.PI) // 团身度 0→1→0
    // 末段 0.78~1：单膝/单手前撑起身关键帧（近侧手脚朝翻滚方向伸出）
    const kneel = Math.max(0, Math.min(1, (p - 0.78) / 0.22))
    const pose = this.out
    pose.rootX = 0
    pose.rootY = 0
    // 长轴对齐：上方向 (-π/2) 转到 rollAngle = rollAngle + π/2
    pose.rootRot = this.rollAngle + Math.PI / 2 + p * Math.PI * 2
    pose.scaleX = 1 - 0.28 * curl
    pose.scaleY = 1 + 0.12 * curl
    // 团身：两腿随 curl 折向身体前方（抱膝），小腿向后勾；起末帧近直立
    const lift = 0.62 * curl
    pose.bone.thighFar = Math.PI / 2 - lift + 0.12
    pose.bone.shinFar = pose.bone.thighFar + 1.35 * curl + 0.2
    pose.bone.thighNear = Math.PI / 2 - lift - 0.12
    pose.bone.shinNear = pose.bone.thighNear - 1.35 * curl - 0.2
    // 团身时脊柱微弓、头埋下
    pose.bone.spine = -Math.PI / 2 - 0.12 * curl
    pose.bone.head = -Math.PI / 2 - 0.2 * curl
    // 两臂抱紧（弯回胸前，收束度随 curl）；末段近臂改为前伸撑地
    const hug = 1.35 * curl + 0.25
    pose.bone.armFarUpper = Math.PI / 2 - 0.35 * curl + 0.15
    pose.bone.armFarLower = pose.bone.armFarUpper + hug
    const nearUpperBase = Math.PI / 2 - 0.35 * curl - 0.15
    const nearUpperK = Math.PI / 2 - 1.05
    pose.bone.armNearUpper = nearUpperBase + (nearUpperK - nearUpperBase) * kneel
    pose.bone.armNearLower =
      pose.bone.armNearUpper + (-hug + (hug + 0.15) * kneel)
    // 单膝撑：近腿朝翻滚方向前伸、小腿放开
    if (kneel > 0) {
      const tk = Math.PI / 2 - 0.85
      pose.bone.thighNear += (tk - pose.bone.thighNear) * kneel
      pose.bone.shinNear = pose.bone.thighNear - 0.15
    }
    pose.cape = 0
    pose.hair = 0
    pose.dir = 'down'
    pose.aim = this.rollAngle
    pose.weaponInFront = true
    pose.phase = 0
    pose.time = this.t
    return pose
  }
}
