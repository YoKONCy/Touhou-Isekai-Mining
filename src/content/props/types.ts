/**
 * 场景摆件内容契约（工程化 L3）
 *
 * 摆件 = 脚底挂"压扁胶囊"碰撞箱的立体场景实体（玩家/怪被挡；默认弹幕穿过，
 * 大型设施可声明 blockBullets 作掩体）。碰撞尺寸/自然摆放规则/外观全部在
 * PropDef 里；布局算法（墙根带/避让）是引擎机制留在 art/props.ts。
 * 加新摆件 = 新建 Def 文件（可复用/自写绘制器）+ pack 加一行，引擎零改动。
 */
import type { ContentId } from '../core/ids'
import type { Prop } from '../../game/art/props'

export type PropId = ContentId

/**
 * 局部碰撞段（相对摆件脚底锚点；摆件单向朝屏幕上方生长）。
 * 大件由多个分离体块组成时声明多段，避免用一根长胶囊制造空气墙。
 */
export interface PropSegment {
  /** 段中心相对锚点的 x/y 偏移（oy≤0，0＝锚点所在正面阻挡线） */
  ox: number
  oy: number
  /** 半长（横向）与半厚（朝上生长量）；运行时再乘实例缩放 s */
  hw: number
  hb: number
}

/** 一组摆件的确定性自然摆放规则（值全部来自原 layoutProps 硬编码） */
export interface PropLayoutEntry {
  /** 本组生成数量区间（逐房按种子随机取整） */
  count: readonly [number, number]
  /** 真的生成这一组的概率（缺省 1=每房必有；如石柱 40%） */
  chance?: number
  /** 本组额外在房间中部带追加一个的概率（大石 40% 中置） */
  midBonus?: number
  /** 选址避让半径（与门/出生点/矿格/其他摆件的净距基准） */
  radius: number
  /**
   * 大型设施标记（3~4 格）：进入"大件组"统一摇号——
   * 每房至多一件，墙边为主、少量中置；chance/midChance 在 CONFIG.art.largeProps。
   */
  large?: boolean
}

export interface PropDef {
  /** 命名空间 id（同时写入运行时 Prop.id；展示名走语言键 prop.<id>.name） */
  id: PropId
  /** 碰撞胶囊基础半长（运行时再乘实例缩放 s；声明 segments 时仅作缺省/兜底） */
  halfWidth: number
  /** 碰撞胶囊基础半厚度（运行时乘 s；实体单向朝屏幕上方生长） */
  halfThick: number
  /** 多段碰撞（缺省＝以 halfWidth/halfThick 构成单段） */
  segments?: readonly PropSegment[]
  /** 弹幕掩体：true 时弹幕命中湮灭（大型设施用；小件缺省 false 穿透） */
  blockBullets?: boolean
  /** 自然摆放规则（缺省=不进房间布局表，只能由事件生成） */
  layout?: PropLayoutEntry
  /** 外观绘制（原点=脚底锚点；官方复用引擎程序化绘制，MOD 可自画） */
  render: (ctx: CanvasRenderingContext2D, p: Prop) => void
  /** 自由标签（筛选/事件条件用，如 ['rock','cover']） */
  tags?: string[]
}
