/**
 * 对话/剧情内核类型（B1）
 *
 * 设计目标（STORY §近程议题拍板）：
 * - 官方剧情用 TS 模块：完整类型 + onEnter 自定义函数，可编排复杂条件/演出；
 * - MOD 剧情用 JSON 数据包：节点/选项/声明式效果的安全白名单子集（无函数）；
 * - 加一段剧情 = 新建一个文件 + 注册一棵树，引擎零改动。
 *
 * 文本不写在节点里：text/speaker 一律是 i18n 键（lang/*.json），
 * 与全项目"TS 内不写文案"的规矩一致。
 */
import type { FlagValue } from '../../shared/profile'
import type { ItemId, EquipSlot } from '../../shared/itemDefs'

/**
 * 声明式效果（JSON 安全白名单：MOD 剧情只能用这些；TS 剧情通用）。
 * 复杂演出走 action——由玩法侧（序章导演等）在启动时 registerAction 注册具名动作。
 */
export type DialogueEffect =
  /** 写剧情/系统 flag */
  | { type: 'flagSet'; key: string; value?: FlagValue }
  /** 物品入背包（放不下的部分丢弃逻辑由动作实现处理） */
  | { type: 'giveItem'; item: ItemId; qty?: number }
  /** 直接写入某槽位（weaponA/pick/quick0..2/spellA；序章发镐/发剑用） */
  | { type: 'equipSlot'; slot: EquipSlot | `quick${number}`; item: ItemId; qty?: number }
  /** 主角回血（教学期站起也走它） */
  | { type: 'heal'; amount: number }
  /** 触发一个具名引擎动作（剧情演出/转场/刷怪等；由导演侧注册） */
  | { type: 'action'; name: string }

/** 选项的显示条件（JSON 可用的简单门控；复杂门控在 TS 节点 onEnter 里处理） */
export interface ChoiceCondition {
  /** 该 flag 为真时可见 */
  flag?: string
  /** 该 flag 不为真时可见 */
  notFlag?: string
}

/** 对话选项 */
export interface DialogueChoice {
  /** 选项文本的 i18n 键 */
  text: string
  /** 选中后跳转节点 */
  next: string
  /** 可见条件（缺省恒可见） */
  show?: ChoiceCondition
  /** 选中瞬间执行（跳转前） */
  effects?: DialogueEffect[]
}

/** 对话立绘：素材使用已抠图的透明图片，配置随节点生效，不跨节点残留。 */
export interface DialoguePortrait {
  /** 图片地址，例如 /portraits/reimu-base.png */
  src: string
  /** 默认靠左；不自动镜像，避免服装与手势翻转。 */
  side?: 'left' | 'right'
  /** 像素素材默认使用硬边缩放，非像素立绘可指定 smooth。 */
  rendering?: 'pixel' | 'smooth'
}

/** 完整背景的剧情插图，不按立绘去底，不伸缩改变原构图。 */
export interface DialogueCG { src:string; sisterSrc?:string; brotherOnly?:boolean }

/** 对话节点 */
export interface DialogueNode {
  id: string
  /** 说话人姓名的 i18n 键（旁白节点省略） */
  speaker?: string
  /** 常规对话的当前说话人立绘；省略不显示，旁白与 OS 忽略。 */
  portrait?: DialoguePortrait
  /** 本人图库中的情绪键；未知键回退本人基准。 */
  portraitEmotion?: string
  /** 节点可显式声明CG，仍沿用原有对话推进与旁白规则。 */
  cg?: DialogueCG
  /** 台词 i18n 键；支持 {name} 形式插值（由 params 提供） */
  text?: string
  /** 插值参数 */
  params?: Record<string, string | number>
  /** 旁白样式：无说话人、居中字幕（黑屏内心 OS 也走它） */
  narration?: boolean
  /**
   * 游戏内 OS 模式（仅 narration 有效）：底部窄字幕条、不压全屏黑底，
   * 世界继续可见——用于战斗/探索中的旁述（破门声、画外音）。
   * 省略或 false ＝ 电影式居中黑底（S0 醒来、营地黑场等）。
   */
  os?: boolean
  /** 进入节点时执行 */
  effects?: DialogueEffect[]
  /** 无选项时推进到的下一节点；省略＝对话结束 */
  next?: string
  /**
   * 自动停顿（毫秒）：进入节点后挂着台词静默等待此时长，
   * 期间点击/按键一律无效，到点自动推进到 next（无 next 则结束）。
   * 用于剧情"愣了两秒""黑场走一段路再开口"等不可手动跳过的节拍。
   */
  autoNextMs?: number
  /** 选项列表（存在时等待玩家选择，不自动推进） */
  choices?: DialogueChoice[]
  /**
   * TS 专属：进入节点时的自定义函数（MOD JSON 不得携带，加载器会拒绝）。
   * 用它编排演出动作、动态决策；拿到的 api 可结束/跳转/执行效果。
   */
  onEnter?: (api: DialogueApi) => void
}

/** 对话树（一段完整剧情） */
export interface DialogueTree {
  /** 树全限定 id（官方 'prologue'；MOD '<modid>:<tree>'） */
  id: string
  /** 入口节点 id */
  start: string
  nodes: Record<string, DialogueNode>
}

/** onEnter 拿到的操作面 */
export interface DialogueApi {
  /** 当前节点 id */
  readonly nodeId: string
  /** 跳转到指定节点（重跑该节点效果/onEnter） */
  goto(nodeId: string): void
  /** 结束整段对话 */
  end(): void
  /** 执行一个声明式效果 */
  run(effect: DialogueEffect): void
}

/** MOD JSON 数据包形状（mods/<id>/dialogue/*.json） */
export interface DialoguePackJson {
  tree: Omit<DialogueTree, 'nodes'> & {
    nodes: Array<Omit<DialogueNode, 'onEnter'>>
  }
}
