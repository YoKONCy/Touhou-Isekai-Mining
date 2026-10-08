import { CONFIG } from './config'
import type { Collider, TileMap } from './tilemap'
import { sfx } from './audio/Sfx'
import { circleHitsProp, resolveCircleProps, type Prop } from './art/props'
import { enemies } from '../content/enemies/registry'
import type { EnemyDef } from '../content/enemies/types'
import { SLIME_BLUE_ID } from '../content/enemies/vanilla/ids'
import { StatusEffects, type StatusDefinition } from '../shared/statusEffects'
import {
  getBrain,
  type AIState,
  type EnemyAiHost,
  type EnemyBrain,
  type PlayerLike,
  type PounceState,
  type ShotRequest,
  type WindupKind
} from './enemyAi'

/**
 * 敌人实体（工程化 L2 后：实体是壳，内容在注册表）。
 * 种类差异全部来自 EnemyDef——数值/配色读 def，行为由 def.ai 选定的
 * 预定义 AI 模板（chaser 追脸近战 / kite_shooter 风筝射手）驱动；
 * 未来 Boss 的 custom 脚本 AI 走同一模板注册口。
 * 现有官方两怪：
 * - touhou:slime_blue 蓝史莱姆：idle/wander/chase，接触伤害，咬人后后撤
 * - touhou:venom_green 毒液绿史莱姆：idle/wander/kite，
 *   每 1 秒 1 发瞄准直线弹、每 4 秒 1 次 16 向环弹；开火请求只入队
 *   pendingShots，弹幕实体由 RoomRuntime 生成（AI 不持有房间引用）。
 */

/** 开火请求类型经本模块转出，房间层从此处 import（保持旧路径） */
export type { ShotRequest } from './enemyAi'
export type { PlayerLike } from './enemyAi'

export class Enemy implements Collider, EnemyAiHost {
  readonly effects = new StatusEffects(this)
  heal(amount: number): number {
    if (!this.alive) return 0
    const before = this.hp; this.hp = Math.min(this.maxHp, this.hp + Math.max(0, amount)); return this.hp - before
  }
  addStatus(definition: StatusDefinition, source: string): void {
    if (!this.alive) return
    this.effects.add(definition, source)
    if (definition.incapacitated || definition.skillsDisabled) {
      this.pendingShots.length = 0; this.volleyLeft = 0; this.burstPending = false
      this.windup = 'none'
      if (this.pounceState === 'windup' || this.pounceState === 'lunge') this.pounceState = 'none'
      if (definition.skillsDisabled) this.surgeT = 0
    }
  }
  /** 本怪的内容定义（数值/配色/模板 id 的唯一真值） */
  readonly def: EnemyDef
  /** 本怪选用的 AI 模板（构造时按 def.ai 取定） */
  private readonly brain: EnemyBrain
  allies: readonly Enemy[] = []
  x: number
  y: number
  vx = 0
  vy = 0
  readonly r: number
  get hitX():number { return this.x+(this.def.hurtbox?.offsetX??0) }
  get hitY():number { return this.y+(this.def.hurtbox?.offsetY??0) }
  get hitRadius():number { return this.def.hurtbox?.radius??this.r }
  containsHit(x:number,y:number,padding=0):boolean { return Math.hypot(this.hitX-x,this.hitY-y)<=this.hitRadius+padding }
  hp: number
  /** 最大生命值（调试刷怪可覆盖，正常内容构造时按 Def 定死） */
  maxHp: number
  alive = true
  /** 死亡压扁动画计时（>0 表示尸体还在播动画） */
  dying = 0

  /**
   * 挖矿爆怪出土流程剩余秒数（>0=尚未完全钻出）：
   * 前 burstWarn 秒只有地面裂土预警（埋在地下、不可受击、不参与一切交互），
   * 随后 burstEmerge 秒实体从坑中升起（可被先手攻击，但仍无接触伤害/不行动）。
   * 杜绝"爆到脚下零帧起手"。
   */
  private emergeT = 0
  private emergeDuration:number = CONFIG.mine.burstEmerge
  private arrivalMode:'burrow'|'ceiling'='burrow'

  // 以下 AI 节拍字段对 AI 模板公开（EnemyAiHost 接口）
  ai: AIState = 'idle'
  aiTimer = 0.5 + Math.random()
  wanderX = 0
  wanderY = 0
  /** 房间进场或剧情刷怪后的强制警戒，无视视野距离。 */
  private forceAlerted = false
  get alerted(): boolean {
    return this.forceAlerted
  }

  /**
   * 房间或剧情广播警戒：无视视野距离，立即锁定玩家。
   * 交战态按 AI 模板映射（chaser→chase；风筝/猛扑系→kite）。
   */
  alert(): void {
    this.forceAlerted = true
    this.ai = this.def.ai === 'chaser' || this.def.chargeCycle ? 'chase' : 'kite'
  }

  /**
   * 接触攻击冷却（对 AI 模板公开）：
   * chaser/kite 命中后由 tryHitPlayer 置满；pouncer 读它决定起扑时机，
   * 扑空由 pouncer 模板手动重置。僵直中冻结递减（被打懵不能咬人/起扑）。
   */
  contactCd = 0
  /** 猛扑与护卫的普通接触冷却独立计时，避免碰撞改变突刺与回弹节拍。 */
  private bodyContactCd = 0
  private flash = 0
  /** 受击独立击退冲量（不被目标速度立刻拉回） */
  private kickX = 0
  private kickY = 0
  private phase = Math.random() * Math.PI * 2
  private spriteFacing:'left'|'right'|'down'='down'

  // —— kite_shooter 模板专属：放风筝横移方向 + 两种开火节拍 ——
  strafeDir = 1
  strafeTimer = 1 + Math.random() * 1.5
  straightCd: number
  ringCd: number
  /** 本帧产生的开火请求（RoomRuntime 每帧 drain） */
  pendingShots: ShotRequest[] = []
  /** 当前吐弹前摇类型与剩余时间（到点才真正入队开火请求） */
  windup: WindupKind = 'none'
  windupT = 0

  // —— pouncer 模板专属：猛扑三段节拍 + 锁定扑向（渲染读招也读这组） ——
  pounceState: PounceState = 'none'
  pounceT = 0
  pounceAng = 0
  chargeStage:'chase'|'windup'|'dash'|'retreat'='chase'
  chargeT=0
  chaseT=0
  chargeEndX=0
  chargeEndY=0
  chargeHit=false
  guardianReboundProgress = -1
  guardianDashCd = 0
  burstT=0
  burstPending=false
  volleyLeft=0

  // —— 弹幕僵直（批次 D：武器给予的压制时间 - 抗性） ——
  /** 剩余僵直秒数：>0 时站住、不推进开火节拍、前摇被打断（AI 模板读） */
  stunT = 0
  get canUseSkills(): boolean { return this.stunT <= 0 && !this.effects.skillsDisabled && !this.effects.incapacitated }

  // —— chaser 周期升速节拍（AI 模板写；渲染读 surgeT 决定拖尾） ——
  surgeT = 0
  surgeCd = 0
  /** 升速拖尾：最近若干采样点（身体位置），加速中每帧推入、平时快速清空 */
  private trail: Array<{ x: number; y: number }> = []

  // —— 通用地形导航：前瞻避障 + 卡死脱困（两种怪共用） ——
  /** 绕障偏转偏好（与横移换向同步，绕出来的弧线更自然；AI 模板写） */
  avoidBias = 1
  /** 本帧 AI 期望移动速度（卡死判定用；每帧开头归零） */
  private wantSpeed = 0
  /** "想走却走不动"的连续时长 */
  private stuckT = 0
  /** 脱困行为剩余时间 / 强制脱身方向 */
  private unstuckT = 0
  private unstuckAng = 0
  /** 上一帧位置（实测位移，卡死判定用） */
  private prevX: number
  private prevY: number
  /** 本房立体摆件表（每帧 update 开头刷新；供导航采样与移动推挤，J 批次） */
  private nearProps: readonly Prop[] = []

  // —— 批次 F④：hop 视觉状态机（压→弹→滞→砸，纯表现层） ——
  // AI/vx/vy/moveEntity/碰撞完全不读写本组字段；由 moveEntity 后的实测速度驱动。
  private hopState: 'rest' | 'squash' | 'air' | 'land' = 'rest'
  private hopT = 0.2 + Math.random() * 0.3
  /** 当前身体离地高度（render 读） */
  private hopH = 0
  /** 当前横向/纵向挤压系数（1=不变形） */
  private hopSx = 1
  private hopSy = 1
  /** 触角弹簧滞后（起跳下沉、落地反弹），update 积分 / render 读取 */
  private antLag = 0
  private antLagV = 0

  constructor(x: number, y: number, id: string = SLIME_BLUE_ID, definition?: EnemyDef) {
    this.x = x
    this.y = y
    // 种类真值全部来自内容注册表（id 缺失/包未加载会在此显式抛错）
    this.def = definition ?? enemies.require(id)
    this.brain = getBrain(this.def.ai)
    this.r = this.def.radius
    this.hp = this.def.hp
    this.maxHp = this.def.hp
    this.prevX = x
    this.prevY = y
    // 远程怪首次开火错峰，避免一屋子毒液史莱姆同帧齐射
    const kite = this.def.kite
    this.straightCd = kite ? 0.4 + Math.random() * kite.firstFireJitter : 0
    if(this.def.turret)this.straightCd=.4+Math.random()*.4
    this.ringCd = kite ? 2.6 + Math.random() * 2 : 0
    // 猛扑怪首次攻击错峰，避免进房零反应时间就吃扑
    if (this.def.ai === 'pouncer' || this.def.guardian) {
      this.contactCd = 1.2 + Math.random() * 1.4
      if (this.def.guardian) this.guardianDashCd = this.contactCd
    }
    // 升速怪首次爆发错峰（间隔随机化在配置区间内）
    const surge = this.def.chaser?.surge
    if (surge) {
      this.surgeCd = surge.minInterval + Math.random() * (surge.maxInterval - surge.minInterval)
    }
  }

  /** 调试专用：覆盖血量上限并回满（仅调试刷怪调用，不进入任何正常刷怪/掉落流程） */
  debugSetMaxHp(hp: number): void {
    this.maxHp = hp
    this.hp = hp
  }

  /** 以"挖矿破土"形态诞生：先走地面预警、再钻出，全程不能零帧伤到玩家 */
  startBurrowSpawn(): void {
    this.emergeT = CONFIG.mine.burstWarn + CONFIG.mine.burstEmerge
  }

  /** 怪物房登场：落下或钻出后都保留零点八秒过渡，不造成贴脸伤害。 */
  startEncounterSpawn(kind:'burrow'|'ceiling'):void{
    this.arrivalMode=kind;this.emergeDuration=.8
    this.emergeT=(kind==='ceiling'?.26:CONFIG.mine.burstWarn)+this.emergeDuration
  }

  /** 还埋在地下（纯预警期）：不可受击、不造成接触伤害、不被物理推开 */
  get buried(): boolean {
    return this.arrivalMode==='burrow'&&this.emergeT > this.emergeDuration
  }

  /** 所有伤害来源共用受击门控，Boss 可覆盖隐身等不可命中状态。 */
  get canBeHit(): boolean { return this.alive && !this.buried && !(this.arrivalMode==='ceiling'&&this.emergeT>this.emergeDuration) }

  /** 出土流程中（预警 + 钻出）：不行动、不造成接触伤害、不被物理推开 */
  get emerging(): boolean {
    return this.emergeT > 0
  }

  /** 身体调色板（身体/描边/死亡粒子/血条） */
  private get palette() {
    return this.def.palette
  }

  /** 命中/死亡音效材质（房间层播 sfx 用） */
  get hitMaterial() {
    return this.def.hitMaterial
  }

  /** 接触伤害值（房间层结算用） */
  get contactDamage(): number {
    if (this.def.guardian && this.pounceState !== 'lunge') return this.def.guardian.bodyContactDamage ?? 0
    if(this.def.chargeCycle&&this.pounceState==='lunge')return this.def.chargeCycle.dashDamage
    if (this.def.ai === 'pouncer' && this.pounceState !== 'lunge') {
      return this.def.pouncer?.bodyContactDamage ?? 0
    }
    return this.def.combat.contactDamage
  }

  /** 环弹数量（房间层按开火请求生成弹幕用；非远程怪返回 0） */
  get ringCount(): number {
    return this.def.kite?.ringCount ?? 0
  }

  /** 取出本帧产生的开火请求（RoomRuntime 每帧清空） */
  /** 房间清弹时一并取消尚未执行的攻击；专属敌人可扩展清理独立发射点。 */
  clearPendingAttacks():void {this.pendingShots.length=0}
  drainShots(): ShotRequest[] {
    if (this.pendingShots.length === 0) return this.pendingShots
    const out = this.pendingShots
    this.pendingShots = []
    return out
  }

  update(dt: number, map: TileMap, player: PlayerLike, props: readonly Prop[] = [], allies: readonly Enemy[] = []): void {
    this.allies = allies
    this.effects.update(dt)
    // J 批次：本房立体摆件（横线碰撞箱）——导航采样与移动推挤都要认识它
    this.nearProps = this.def.movement==='flying'?[]:props
    this.phase += dt * 2.6
    this.flash = Math.max(0, this.flash - dt)
    // 护卫从突刺发出的时刻开始独立计时，僵直或控制期间也不会暂停。
    if (this.def.guardian) this.guardianDashCd = Math.max(0, this.guardianDashCd - dt)
    // 接触攻击节拍：僵直中冻结（被打懵的怪咬不了人；与"僵直封出招"语义一致）
    if (this.stunT <= 0) {
      this.contactCd = Math.max(0, this.contactCd - dt)
      this.bodyContactCd = Math.max(0, this.bodyContactCd - dt)
    }
    this.stunT = Math.max(0, this.stunT - dt)

    // 死亡压扁动画播完后彻底消失
    if (!this.alive) {
      this.dying -= dt
      return
    }

    // 挖矿爆怪出土中：钉在出生点（AI/击退/位移/hop 全冻结），只推进预警动画时钟
    if (this.emergeT > 0) {
      const wasBuried = this.emergeT > this.emergeDuration
      this.emergeT = Math.max(0, this.emergeT - dt)
      // 预警结束 → 钻出开始这一瞬播破土音（声像跟随怪相对玩家的方位）
      if (wasBuried && this.emergeT <= this.emergeDuration) {
        const pan = Math.max(-1, Math.min(1, (this.x - player.x) / 300)) * 0.7
        if(this.arrivalMode==='ceiling')sfx.ceilingImpact(pan)
        else sfx.burrowEmerge(pan)
      }
      this.phase += dt * 7
      this.vx = 0
      this.vy = 0
      this.kickX = 0
      this.kickY = 0
      this.prevX = this.x
      this.prevY = this.y
      return
    }

    this.unstuckT = Math.max(0, this.unstuckT - dt)
    // 期望速度每帧归零，由 AI 分支重新申报（idle 不申报=0，卡死检测不误判）
    this.wantSpeed = 0

    const dist = Math.hypot(player.x - this.x, player.y - this.y)

    // 晕眩冻结主动移动和攻击，击退仍由同一套碰撞处理自然衰减。
    if (this.effects.incapacitated) {
      this.vx = this.vy = 0; this.pendingShots.length = 0
      this.kickX *= Math.exp(-9 * dt); this.kickY *= Math.exp(-9 * dt)
      const moved: Collider = { x: this.x, y: this.y, vx: this.kickX, vy: this.kickY, r: this.r }
      if (this.def.movement !== 'stationary') {
        map.moveEntity(moved, dt, this.def.movement === 'flying')
        if (this.nearProps.length) resolveCircleProps(moved, this.prevX, this.prevY, this.nearProps)
        this.x = moved.x; this.y = moved.y
      }
      this.prevX = this.x; this.prevY = this.y; this.stuckT = 0
      return
    }

    // AI 行为全部由注册的模板驱动（种类差异只在 Def 里）
    this.brain.think(this, dt, map, player, dist)
    // 远程怪贴到直角墙或障碍夹角时边移动边完成射击，不清除攻击前摇。
    this.escapeRangedCorner(map, player, dt)
    if(this.def.movement==='stationary'){this.vx=this.vy=this.kickX=this.kickY=0;return}
    if(this.def.movement==='flying'){
      const vx=this.pounceState==='windup'?Math.cos(this.pounceAng)*20:this.vx
      const vy=this.pounceState==='windup'?Math.sin(this.pounceAng)*20:this.vy
      // 方向切换留出缓冲区，避免斜飞或贴墙时在两套帧间抖动。
      if(Math.hypot(vx,vy)>8){
        if(Math.abs(vy)>Math.abs(vx)*1.25)this.spriteFacing='down'
        else if(Math.abs(vx)>Math.abs(vy)*.85)this.spriteFacing=vx<0?'left':'right'
      }
    }

    // 击退冲量叠加到本帧位移（碰撞修正只吃合成速度）
    this.kickX *= Math.exp(-9 * dt)
    this.kickY *= Math.exp(-9 * dt)
    const moved: Collider = {
      x: this.x,
      y: this.y,
      vx: this.vx * this.effects.modify('moveSpeed', 1) + this.kickX,
      vy: this.vy * this.effects.modify('moveSpeed', 1) + this.kickY,
      r: this.r
    }
    map.moveEntity(moved, dt,this.def.movement==='flying')
    // J 批次：摆件薄横线推挤（瓦片网格修正之后；prev 仍为上一帧位置供扫掠防隧穿）
    if (this.nearProps.length > 0) resolveCircleProps(moved, this.prevX, this.prevY, this.nearProps)
    this.x = moved.x
    this.y = moved.y

    // —— 卡死检测与脱困：AI 想走却被墙/矿顶住（实测速度远低于期望）时，
    //    主动选一个通畅方向脱身，杜绝"一直后撤直到贴墙卡死" ——
    const actualSpeed = Math.hypot(this.x - this.prevX, this.y - this.prevY) / Math.max(dt, 1e-4)
    this.prevX = this.x
    this.prevY = this.y
    const beingKnocked = Math.hypot(this.kickX, this.kickY) > 90
    if (this.wantSpeed > (this.rangedMoveSpeed > 0 ? 15 : 60) && !beingKnocked) {
      if (actualSpeed < this.wantSpeed * this.effects.modify('moveSpeed', 1) * 0.35) {
        this.stuckT += dt
        if (this.stuckT > (this.rangedMoveSpeed > 0 ? .12 : .3) && this.unstuckT <= 0) {
          this.startUnstuck(map, Math.atan2(player.y - this.y, player.x - this.x))
        }
      } else {
        this.stuckT = Math.max(0, this.stuckT - dt * 2)
      }
    } else {
      this.stuckT = 0
    }

    // 批次 F④：hop 视觉时钟（moveEntity 后的实测速度驱动，绝不回写 AI/速度）
    if (this.def.guardian && (this.pounceState !== 'none' || this.guardianReboundProgress >= 0)) {
      this.hopH = 0; this.hopSx = this.hopSy = 1; this.hopState = 'rest'; this.hopT = .2
    } else if(this.def.movement!=='flying')this.updateHop(dt, actualSpeed)

    // —— 升速拖尾采样（纯表现）：加速档且在移动时记录身体位置；
    //    退出加速/停下后逐点丢弃，残影自然淡出而不是瞬间消失 ——
    if (this.surgeT > 0 && actualSpeed > 55) {
      this.trail.push({ x: this.x, y: this.y })
      if (this.trail.length > 7) this.trail.shift()
    } else if (this.trail.length > 0) {
      this.trail.shift()
    }
  }

  /**
   * hop 视觉四段状态机（纯表现）：
   * rest 停/落点停顿 → squash 压簧蓄力 → air 抛物线腾空 → land 砸地回弹 → rest。
   * 蓝史莱姆快蹦（短周期、高弧线）；毒液绿史莱姆慢黏（长停顿、低弧线、压砸更久）。
   * 仅实测速度 >55px/s 时起跳，停下自动落回 rest。
   */
  private updateHop(dt: number, speed: number): void {
    const fast = this.def.visual.fastHop
    const hMax = fast ? 11 : 6
    const squashDur = fast ? 0.1 : 0.16
    const airDur = fast ? 0.3 : 0.42
    const landDur = 0.1

    // —— 触角弹簧：朝 0 点回归 + 阻尼；起跳/落地瞬间由状态切换注入冲量 ——
    this.antLagV += -this.antLag * 90 * dt
    this.antLagV *= Math.exp(-7 * dt)
    this.antLag += this.antLagV * dt

    this.hopT -= dt
    switch (this.hopState) {
      case 'rest':
        this.hopH = 0
        this.hopSx = 1
        this.hopSy = 1
        if (speed > 55 && this.hopT <= 0) {
          this.hopState = 'squash'
          this.hopT = squashDur
        }
        break
      case 'squash': {
        if (this.hopT <= 0) {
          this.hopState = 'air'
          this.hopT = airDur
          this.antLagV += 9 // 身体突向上，触角惯性相对下沉
          break
        }
        // 压缩度 0→1：横拉竖压
        const k = 1 - this.hopT / squashDur
        const c = Math.sin((k * Math.PI) / 2)
        this.hopSx = 1 + 0.18 * c
        this.hopSy = 1 - 0.22 * c
        this.hopH = 0
        break
      }
      case 'air': {
        if (this.hopT <= 0) {
          this.hopState = 'land'
          this.hopT = landDur
          this.antLagV -= 13 // 落地骤停，触角向上甩出
          break
        }
        const t = 1 - this.hopT / airDur
        this.hopH = 4 * hMax * t * (1 - t) // 抛物线
        this.hopSx = 0.92
        this.hopSy = 1.08 // 滞空纵向拉长
        break
      }
      case 'land': {
        if (this.hopT <= 0) {
          this.hopState = 'rest'
          this.hopT = fast ? 0.12 + Math.random() * 0.22 : 0.35 + Math.random() * 0.4
          break
        }
        const k = 1 - this.hopT / landDur
        const c = Math.sin((k * Math.PI) / 2)
        this.hopSx = 1 + 0.22 * c
        this.hopSy = 1 - 0.26 * c
        this.hopH = 0
        break
      }
    }
  }

  /**
   * 三点采样：鼻尖 + 左右肩，全部不撞实心格、也不撞摆件横线才认为该方向可通行。
   * 单点探测会漏掉圆身体两侧擦墙，双肩采样保证整只怪转得过去。
   */
  canMoveTo(map:TileMap,x:number,y:number):boolean{
    if(x<this.r+map.bounds.left||x>map.bounds.right-this.r||y<map.bounds.top+this.r||y>map.bounds.bottom-this.r)return false
    for(const [dx,dy] of [[0,0],[this.r,0],[-this.r,0],[0,this.r],[0,-this.r],[this.r,this.r],[this.r,-this.r],[-this.r,this.r],[-this.r,-this.r]]){
      if(map.solidAtWorld(x+dx!,y+dy!,this.def.movement==='flying'))return false
    }
    return !this.nearProps.some(p=>circleHitsProp(x,y,this.r,p))
  }

  private canPass(map: TileMap, ang: number): boolean {
    const nose = this.r + 9
    const shoulder = this.r * 0.75 + 4
    const pts: Array<[number, number]> = [
      [this.x + Math.cos(ang) * nose, this.y + Math.sin(ang) * nose],
      [this.x + Math.cos(ang + 0.95) * shoulder, this.y + Math.sin(ang + 0.95) * shoulder],
      [this.x + Math.cos(ang - 0.95) * shoulder, this.y + Math.sin(ang - 0.95) * shoulder]
    ]
    return pts.every(([px, py]) => {
      if (map.solidAtWorld(px, py,this.def.movement==='flying')) return false
      // J 批次：怪与摆件用同一套圆 vs 横线（采样点按怪半径，整身过得去才算通）
      return !this.nearProps.some((p) => circleHitsProp(px, py, this.r * 0.72, p))
    })
  }

  /**
   * 期望角的避障修正：前方堵则由近到远左右扫描，返回第一个可通行角；
   * 同侧优先（avoidBias 跟随横移方向），绕障走位与放风筝方向一致；
   * 扫到 ±93° 仍全堵则返回 null（交给卡死脱困逻辑）。
   */
  private steer(map: TileMap, ang: number): number | null {
    if (this.canPass(map, ang)) return ang
    for (const step of [0.32, 0.6, 0.9, 1.25, 1.62]) {
      const favored = ang + step * this.avoidBias
      const other = ang - step * this.avoidBias
      if (this.canPass(map, favored)) return favored
      if (this.canPass(map, other)) return other
    }
    return null
  }

  /**
   * 把 AI 的"想去角度 + 速度"转成避障后的目标速度。
   * 脱困计时中强制走脱身方向；彻底堵死时本帧目标速度为 0（马上会被卡死检测接管）。
   */
  wantVelocity(map: TileMap, ang: number, speed: number): { x: number; y: number } {
    // 即便所有方向暂时堵住，也要保留移动意图，让卡死检测启动脱困。
    this.wantSpeed = speed
    const useAng = this.unstuckT > 0 ? this.unstuckAng : ang
    const fixed = this.steer(map, useAng)
    if (fixed === null) return { x: 0, y: 0 }
    return { x: Math.cos(fixed) * speed, y: Math.sin(fixed) * speed }
  }

  private get rangedMoveSpeed(): number {
    return this.def.kedama?.speed ?? this.def.kite?.kiteSpeed ?? (this.def.chargeCycle?.volley ? this.def.chargeCycle.retreatSpeed : 0)
  }

  /** 允许短暂接近玩家，优先离开双轴受阻的位置；脱身方向保持一段时间，避免反复横跳。 */
  private escapeRangedCorner(map: TileMap, player: PlayerLike, dt: number): void {
    const speed = this.rangedMoveSpeed
    if (!speed || !player.alive || player.untargetable || (this.ai !== 'kite' && this.ai !== 'chase') || this.pounceState !== 'none') return
    const probe = Math.max(12, this.r * .8)
    const blockedX = !this.canMoveTo(map, this.x - probe, this.y) || !this.canMoveTo(map, this.x + probe, this.y)
    const blockedY = !this.canMoveTo(map, this.x, this.y - probe) || !this.canMoveTo(map, this.x, this.y + probe)
    if (this.unstuckT <= 0) {
      if (!blockedX || !blockedY) return
      this.startUnstuck(map, Math.atan2(player.y - this.y, player.x - this.x))
    }
    if (this.unstuckT <= 0) return
    const v = this.wantVelocity(map, this.unstuckAng, speed * 1.45)
    this.approachVelocity(v.x, v.y, 22, dt)
  }

  /**
   * 脱困：候选方向依次为"横移侧绕墙 → 反斜向脱身 → 随机方向"，
   * 取第一个三点采样全通的；极端死角兜底朝玩家方向硬挤
   * （房间对玩家可达，该方向最终必然通向开阔处）。
   */
  private startUnstuck(map: TileMap, angToPlayer: number): void {
    if (this.rangedMoveSpeed > 0) {
      let best = -Infinity, heading = 0
      // 扫描完整一圈，比较实际可走距离和落点周围的开阔程度，不把朝玩家方向排除。
      for (let i = 0; i < 32; i++) {
        const a = i * Math.PI * 2 / 32, dx = Math.cos(a), dy = Math.sin(a)
        let clearance = 0
        for (let d = 8; d <= 96; d += 8) {
          if (!this.canMoveTo(map, this.x + dx * d, this.y + dy * d)) break
          clearance = d
        }
        if (clearance < 16) continue
        const x = this.x + dx * Math.min(clearance, 64), y = this.y + dy * Math.min(clearance, 64)
        let open = 0
        for (let j = 0; j < 8; j++) if (this.canMoveTo(map, x + Math.cos(j * Math.PI / 4) * 22, y + Math.sin(j * Math.PI / 4) * 22)) open++
        const score = clearance + open * 10 - Math.cos(a - angToPlayer) * 5
        if (score > best) { best = score; heading = a }
      }
      if (Number.isFinite(best)) {
        this.unstuckAng = heading; this.unstuckT = .7; this.stuckT = 0
      }
      return
    }
    const cands: number[] = [
      angToPlayer + (Math.PI / 2) * this.strafeDir,
      angToPlayer - (Math.PI / 2) * this.strafeDir,
      angToPlayer + 2.35 * this.strafeDir,
      angToPlayer - 2.35 * this.strafeDir,
      Math.random() * Math.PI * 2,
      Math.random() * Math.PI * 2
    ]
    for (const a of cands) {
      if (this.canPass(map, a)) {
        this.unstuckAng = a
        this.unstuckT = 0.75
        this.stuckT = 0
        return
      }
    }
    this.unstuckAng = angToPlayer
    this.unstuckT = 0.75
    this.stuckT = 0
  }

  /** 指数趋近目标速度（AI 模板宿主方法） */
  approachVelocity(tvx: number, tvy: number, accel: number, dt: number): void {
    const k = 1 - Math.exp(-accel * dt)
    this.vx += (tvx - this.vx) * k
    this.vy += (tvy - this.vy) * k
  }

  /**
   * 尝试接触攻击玩家
   * @returns 是否成功造成伤害（由场景结算扣血/特效）
   */
  tryHitPlayer(player: PlayerLike, invincible: boolean): boolean {
    if (this.effects.incapacitated) return false
    if (!this.alive || player.alive === false || player.untargetable) return false
    // 出土流程中绝不造成接触伤害（保证不是"零帧起手"）
    if (this.emerging) return false
    if((this.def.chargeCycle||this.def.guardian)&&this.pounceState==='lunge'&&this.chargeHit)return false
    // 猛扑期间只结算技能命中；其他阶段按内容配置结算普通身体接触。
    const bodyContact = (this.def.ai === 'pouncer' || !!this.def.guardian) && this.pounceState !== 'lunge'
    if (bodyContact && this.contactDamage <= 0) return false
    // 护卫突刺只受本次冲刺的单次命中标记约束，旧接触冷却不能让新突刺失效。
    const cooldown = bodyContact ? this.bodyContactCd : this.def.guardian && this.pounceState === 'lunge' ? 0 : this.contactCd
    if (cooldown > 0 || invincible) return false
    const pad = this.def.combat.contactPad
    // 受击距离按玩家精瘦碰撞圆（视觉半径 half 仅作旧形状兜底）
    const hitR = player.hitR ?? player.half
    // fail-closed：半径/坐标出现任何非有限数（如缺字段算出 NaN）一律判定未命中
    const reach = this.r + hitR + pad
    if (!Number.isFinite(reach) || !Number.isFinite(player.x) || !Number.isFinite(this.x)) {
      return false
    }
    const dist = Math.hypot(player.x - this.x, player.y - this.y)
    // 圆分离把怪维持在半径和边缘，加容差容忍一帧抖动
    if (dist > reach) return false
    if (bodyContact) this.bodyContactCd = this.def.combat.attackCd
    else this.contactCd = this.def.combat.attackCd
    // 自身后撤，防止黏在玩家身上等 CD
    const away = Math.atan2(this.y - player.y, this.x - player.x)
    if((this.def.chargeCycle||this.def.guardian)&&this.pounceState==='lunge')this.chargeHit=true
    else{this.kickX += Math.cos(away) * this.def.combat.recoil;this.kickY += Math.sin(away) * this.def.combat.recoil}
    return true
  }

  /**
   * 受击统一入口（所有伤害来源只走这里）。
   * @param knockback 命中来源自带的击退力（武器 MeleeMove.knockback / 符卡 knockback；缺省走全局兜底）
   * @param stun 武器/符卡给予的弹幕僵直秒数；与击退完全解耦——
   *             生锈铁镐击退为 0 也能打出僵直，所以绝不能把打断挂进击退分支
   */
  takeDamage(amount: number, dirAngle: number, knockback?: number, stun?: number): void {
    if (!this.alive) return
    // 还埋在地下预警期：刀剑穿土而过，不可被攻击（钻出后才吃伤害）
    if (!this.canBeHit) return
    this.hp -= amount
    this.flash = 0.12
    // 击退减法抗性：max(0, 来源击退力 - 抗性)；抗性高于击退力时原地硬扛
    const kb = this.def.tags?.includes('boss') || this.def.movement==='stationary' ? 0 : Math.max(0, (knockback ?? this.def.combat.knockback) - (this.def.combat.knockbackResist ?? 0))
    this.kickX += Math.cos(dirAngle) * kb
    this.kickY += Math.sin(dirAngle) * kb

    // 弹幕僵直：武器僵直 - 敌人抗性（抗性 0 吃满）；连续命中取较长值不缩短
    const realStun = Math.max(0, (stun ?? 0) - this.def.combat.stunResist)
    if (realStun > 0) {
      this.stunT = Math.max(this.stunT, realStun)
      if(this.def.chargeCycle)this.burstPending=false
      if(this.def.turret){this.volleyLeft=0;this.straightCd=this.def.turret.interval}
      // 正在蓄力吐弹被打断：本次开火作废，对应节拍从头再等
      if (this.windup !== 'none') {
        if (this.windup === 'ring') this.ringCd = this.def.kite?.ringInterval ?? 0
        else this.straightCd = this.def.turret?.interval ?? this.def.chargeCycle?.volley?.interval ?? this.def.kite?.straightInterval ?? 0
        this.windup = 'none'
      }
      // 猛扑蓄力被打断：本次猛扑作废，重新等满攻击 CD（扑出后的 lunge 不打断）
      if (this.pounceState === 'windup') {
        this.pounceState = 'none'
        if (!this.def.guardian) this.contactCd = this.def.pouncer?.attackInterval ?? this.def.combat.attackCd
      }
    }

    if (this.hp <= 0) {
      this.hp = 0
      this.alive = false
      this.effects.clear('death')
      this.dying = 0.35
      this.vx = this.vy = 0
      this.windup = 'none'
      this.pounceState = 'none'
    }
  }

  /** 尸体动画是否播完（场景据此移除） */
  get removed(): boolean {
    return !this.alive && this.dying <= 0
  }

  /** 死亡时的粒子颜色 */
  get deathColor(): string {
    return this.palette.death
  }

  /** 吐弹前摇进度 0~1（渲染蓄力告警用；无蓄力时为 0） */
  private get windupK(): number {
    if (this.windup === 'none') return 0
    const dur = this.windup === 'ring' ? (this.def.kite?.ringWindup ?? 0.6) : (this.def.turret?.windup ?? this.def.kite?.straightWindup ?? 0.32)
    return Math.min(1, Math.max(0, 1 - this.windupT / dur))
  }

  /** 猛扑蓄力进度 0~1（渲染告警/后坐形变用；非蓄力态为 0） */
  private get pounceK(): number {
    if (this.pounceState !== 'windup') return 0
    const dur = this.def.guardian?.windup ?? this.def.chargeCycle?.windup ?? this.def.pouncer?.pounceWindup ?? 0.5
    return Math.min(1, Math.max(0, 1 - this.pounceT / dur))
  }

  render(ctx: CanvasRenderingContext2D): void {
    // 还埋在地下：只画地面裂土预警，不画身体
    if (this.alive && this.buried) {
      this.renderBurrowWarning(ctx)
      return
    }
    if(this.alive&&this.arrivalMode==='ceiling'&&this.emergeT>this.emergeDuration){
      ctx.save();ctx.strokeStyle='#c8b28199';ctx.lineWidth=1.3;ctx.setLineDash([3,4]);ctx.beginPath();ctx.ellipse(this.x,this.y+8,this.r+5,this.r*.45+3,0,0,Math.PI*2);ctx.stroke();ctx.restore()
    }
    const pal = this.palette
    // 阴影（尸体也保留，逐渐淡出；hop 腾空时缩小变淡，稳在地面）
    const deathAlpha = this.alive ? 1 : Math.max(0, this.dying / 0.35)
    const hopHAlive = this.alive ? this.hopH : 0 // 尸体不保留腾空高度
    const shadowK = 1 - Math.min(0.34, hopHAlive * 0.022)
    ctx.globalAlpha = deathAlpha * (1 - Math.min(0.45, hopHAlive * 0.03))
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.ellipse(
      this.x,
      this.y + this.r - 2,
      this.r * shadowK,
      this.r * 0.4 * shadowK,
      0,
      0,
      Math.PI * 2
    )
    ctx.fill()
    ctx.globalAlpha = deathAlpha

    // 升速拖尾：加速中沿身后采样点画一串渐淡、渐小的同色果冻残影（世界坐标，先于身体）
    if (this.alive && this.trail.length > 1) {
      const n = this.trail.length
      for (let i = 0; i < n; i++) {
        const p = this.trail[i]
        const k = (i + 1) / n // 越新（越靠近当前身体）越大越实
        const rr = 0.55 + 0.4 * k
        ctx.globalAlpha = deathAlpha * 0.26 * k
        ctx.fillStyle = pal.body
        ctx.beginPath()
        ctx.ellipse(p.x, p.y, this.r * rr, this.r * 0.72 * rr, 0, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = deathAlpha
    }

    // 僵直颤抖：小幅高频横抖（阴影不抖，稳在地面）
    const jx = this.alive && this.stunT > 0 ? Math.sin(this.phase * 9) * 1.3 : 0
    ctx.save()
    ctx.translate(jx, 0)

    // 死亡压扁：横向摊开
    const deadSquish = this.alive ? 0 : 1 - this.dying / 0.35
    const breathe = Math.sin(this.phase) * 0.05
    // 吐弹蓄力形变：直线弹微蹲（横宽竖压），环弹鼓胀（为喷一圈做势）
    const wk = this.windupK
    const windSquishX = this.windup === 'ring' ? 0.2 * wk : 0.08 * wk
    const windSquishY = this.windup === 'ring' ? 0.08 * wk : -0.05 * wk
    // 猛扑蓄力形变：弹簧后蹲（横张竖压，像压紧的弹簧）
    const pk = this.pounceK
    const pounceSquishX = 0.1 * pk
    const pounceSquishY = -0.14 * pk
    const rx = this.r * (1 + breathe + deadSquish * 0.5 + windSquishX + pounceSquishX)
    const ry =
      this.r * 0.86 * (1 - breathe) * (1 - deadSquish * 0.6 + windSquishY + pounceSquishY)

    this.def.visual.warning?.({ ctx, x: this.x, y: this.y, r: this.r, rx, ry, vx: this.vx, vy: this.vy, alive: this.alive, engaged: this.ai === 'chase' || this.ai === 'kite', phase: this.phase, windup: this.windup, windupProgress: wk, pounceProgress: pk, pounceState: this.pounceState, pounceAngle: this.pounceAng, dashDistance: this.def.guardian ? this.def.guardian.lungeSpeed * this.def.guardian.lungeDuration : undefined, ringCount: this.ringCount, antennaLag: this.antLag, alpha: deathAlpha, flash: this.flash, palette: pal, visual: this.def.visual })

    // 批次 F④：hop 整体变换——抬高 + 挤压，锚点钉在脚底（尸体不参与）
    // 挖矿爆怪钻出期：复用同一变换位，改为"从土坑中挤出升起"（横宽竖矮→正常）
    ctx.save()
    if (this.alive) {
      if (this.emergeT > 0) {
        const riseK = Math.max(0,1 - this.emergeT / this.emergeDuration)
        if(this.arrivalMode==='ceiling'&&this.emergeT>this.emergeDuration){
          const fall=(this.emergeT-this.emergeDuration)/.26
          ctx.translate(0,-150*fall*fall)
        }else{
        const footY = this.y + this.r - 2
        ctx.translate(this.x, footY)
        ctx.scale(1.16 - 0.16 * riseK, 0.4 + 0.6 * riseK)
        ctx.translate(-this.x, -footY)
        ctx.translate(0, (1 - riseK) * 7)
        }
      } else if (this.def.guardian && this.guardianReboundProgress >= 0) {
        const k = this.guardianReboundProgress, lift = Math.sin(Math.PI * k) * 28
        const facing = Math.abs(Math.cos(this.pounceAng)) > .2 ? Math.sign(Math.cos(this.pounceAng)) : Math.sign(Math.sin(this.pounceAng))
        ctx.translate(this.x, this.y - lift)
        ctx.rotate(-facing * Math.PI * 2 * (k * k * (3 - 2 * k)))
        ctx.translate(-this.x, -this.y)
      } else {
        ctx.translate(this.x, this.y - this.hopH)
        ctx.scale(this.hopSx, this.hopSy)
        ctx.translate(-this.x, -this.y)
      }
      // 猛扑蓄力：沿扑向反方向后坐位移（压紧弹簧感）；
      // 猛扑中：沿扑向水平拉长、纵向收窄（爆发速度感）
      if (this.def.movement!=='flying' && this.emergeT <= 0 && this.pounceState === 'windup') {
        ctx.translate(-Math.cos(this.pounceAng) * 5 * pk, -Math.sin(this.pounceAng) * 5 * pk)
      } else if (this.def.movement!=='flying' && this.emergeT <= 0 && this.pounceState === 'lunge') {
        ctx.translate(this.x, this.y)
        ctx.rotate(this.pounceAng)
        ctx.scale(this.def.guardian ? 1.42 : 1.2, this.def.guardian ? .72 : .86)
        ctx.rotate(-this.pounceAng)
        ctx.translate(-this.x, -this.y)
      }
    }

    if (this.def.visual.render) this.def.visual.render({
      ctx, x: this.x, y: this.y, r: this.r, rx, ry, facing:this.spriteFacing,
      vx: this.vx, vy: this.vy, alive: this.alive,
      engaged: this.ai === 'chase' || this.ai === 'kite',
      phase: this.phase, windup: this.windup, windupProgress: wk,
      pounceProgress: pk, pounceState: this.pounceState, pounceAngle: this.pounceAng, reboundProgress: this.guardianReboundProgress, ringCount: this.ringCount, antennaLag: this.antLag, alpha: deathAlpha,
      flash: this.flash, palette: pal, visual: this.def.visual
    })
    else {
      ctx.beginPath(); ctx.ellipse(this.x, this.y, rx, ry, 0, 0, Math.PI * 2)
      ctx.fillStyle = this.flash > 0 ? '#ffffff' : pal.body; ctx.fill()
      ctx.strokeStyle = pal.edge; ctx.lineWidth = 1.6; ctx.stroke()
    }

    if (this.alive) {

      // —— 退出 hop 挤压变换：血条/眩晕星是 UI 层不参与形变，只随身体抬高 ——
      ctx.restore()
      const hopLift = this.def.movement==='flying' ? -8 : this.def.guardian && this.guardianReboundProgress >= 0 ? -Math.sin(Math.PI * this.guardianReboundProgress) * 28 : -this.hopH

      this.def.visual.motion?.({ ctx, x: this.x, y: this.y, r: this.r, rx, ry, vx: this.vx, vy: this.vy, alive: this.alive, engaged: this.ai === 'chase' || this.ai === 'kite', phase: this.phase, windup: this.windup, windupProgress: wk, pounceProgress: pk, pounceState: this.pounceState, pounceAngle: this.pounceAng, ringCount: this.ringCount, antennaLag: this.antLag, alpha: deathAlpha, flash: this.flash, palette: pal, visual: this.def.visual })

      // 钻出期：坑沿两侧扬尘（密度随升起衰减，提示"有东西破土"）
      if (this.emergeT > 0) {
        const dustK = Math.max(0,1 - this.emergeT / this.emergeDuration)
        ctx.fillStyle = `rgba(154,138,118,${0.55 * (1 - dustK) + 0.12})`
        for (let i = 0; i < 6; i++) {
          const side = i % 2 === 0 ? -1 : 1
          const dx = side * (this.r * 0.7 + (i >> 1) * 4 + Math.sin(this.phase + i) * 2)
          const dy = -Math.abs(Math.sin(this.phase * 1.8 + i * 1.7)) * (4 + dustK * 5) + 2
          ctx.fillRect(this.x + dx, this.y + this.r - 3 + dy, 1.8, 1.8)
        }
      }

      // 血条（钻出中随身体藏在土里，不悬浮剧透）
      const elite=this.def.tags?.includes('elite')===true
      const w = elite?44:34
      const ratio = this.hp / this.maxHp
      if (this.emergeT <= 0) {
        if(elite){ctx.fillStyle='#dbc383';ctx.beginPath();ctx.moveTo(this.x,this.y-this.r-22+hopLift);ctx.lineTo(this.x+3,this.y-this.r-18+hopLift);ctx.lineTo(this.x,this.y-this.r-14+hopLift);ctx.lineTo(this.x-3,this.y-this.r-18+hopLift);ctx.closePath();ctx.fill()}
        ctx.fillStyle = 'rgba(0,0,0,0.55)'
        ctx.fillRect(this.x - w / 2, this.y - this.r - 12 + hopLift, w, 5)
        // 血条常规段取 Def 调色板（蓝怪天蓝/绿怪嫩绿），危险段统一红告警
        ctx.fillStyle = ratio > 0.35 ? pal.hpBar : '#ff6b5e'
        ctx.fillRect(this.x - w / 2 + 1, this.y - this.r - 11 + hopLift, (w - 2) * ratio, 3)
      }

      // 弹幕僵直：头顶三颗绕转小金星（"被打懵、吐不出弹"的通用眩晕语言）
      if (this.stunT > 0 || this.effects.incapacitated) {
        for (let i = 0; i < 3; i++) {
          const a = this.phase * 2.2 + (i * Math.PI * 2) / 3
          const sx = this.x + Math.cos(a) * 9
          const sy = this.y - this.r - 16 + Math.sin(a) * 3 + hopLift
          this.drawStar(ctx, sx, sy, 2.6)
        }
      }
    }
    // 尸体路径走不到 alive 块内的 restore，在这里与 hop 变换 save 配对
    if (!this.alive) ctx.restore()
    ctx.restore()
    ctx.globalAlpha = 1
  }

  /** 画一颗填充小五角星（僵直眩晕标志） */
  private drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
    ctx.fillStyle = '#ffd84d'
    ctx.strokeStyle = 'rgba(120,80,10,0.8)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const px = cx + Math.cos(a) * rad
      const py = cy + Math.sin(a) * rad
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }

  /**
   * 挖矿爆怪 · 纯地面预警（实体还在地下）：
   * 扩张的黑褐凹坑 + 翻土坑沿 + 5 条放射裂纹 + 坑边跳动扬尘，
   * 末期地面高频轻抖——持续 burstWarn 秒，给足"这里要出怪"的读招时间。
   */
  private renderBurrowWarning(ctx: CanvasRenderingContext2D): void {
    const warnDur = CONFIG.mine.burstWarn
    const warnK = Math.min(1, Math.max(0, 1 - (this.emergeT - this.emergeDuration) / warnDur))
    const cx = this.x
    const cy = this.y + this.r * 0.35
    ctx.save()
    ctx.translate(Math.sin(this.phase * 2.1) * 1.4 * warnK, 0)

    // 凹坑（随预警扩大、加深）
    const rx = this.r * (0.45 + 0.5 * warnK)
    const ry = rx * 0.42
    ctx.fillStyle = `rgba(28,20,14,${0.5 + 0.28 * warnK})`
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    // 坑沿翻土环
    ctx.strokeStyle = `rgba(122,104,84,${0.5 + 0.4 * warnK})`
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.ellipse(cx, cy, rx + 1.5, ry + 1, 0, 0, Math.PI * 2)
    ctx.stroke()

    // 5 条放射折裂（随预警延长）
    ctx.strokeStyle = 'rgba(30,22,16,0.85)'
    ctx.lineWidth = 1.2
    ctx.lineCap = 'round'
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.5
      const len = 4 + warnK * this.r * 0.9
      ctx.beginPath()
      ctx.moveTo(cx + Math.cos(a) * rx * 0.6, cy + Math.sin(a) * ry * 0.6)
      ctx.lineTo(cx + Math.cos(a + 0.15) * len, cy + Math.sin(a + 0.15) * len * 0.5)
      ctx.lineTo(cx + Math.cos(a - 0.1) * len * 1.12, cy + Math.sin(a - 0.1) * len * 0.5)
      ctx.stroke()
    }

    // 扬尘 8 颗（坑边错相起跳）
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.phase * 0.05
      const rr = rx * 0.7 + (i % 3) * 3
      const hop2 = Math.abs(Math.sin(this.phase * 2.4 + i * 1.3))
      const px = cx + Math.cos(a) * rr
      const py = cy + Math.sin(a) * ry - hop2 * (3 + warnK * 6)
      ctx.fillStyle = `rgba(154,138,118,${0.3 + 0.45 * hop2})`
      ctx.fillRect(px, py, 1.8, 1.8)
    }
    ctx.restore()
  }
}
