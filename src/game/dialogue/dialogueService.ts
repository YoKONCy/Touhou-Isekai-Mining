/**
 * 对话服务（全局单例）
 *
 * - 树注册表：官方 TS 剧情与 MOD JSON 剧情都注册到这里；
 * - 播放状态机：start →（advance/choose）* → end，Vue 的 ref 驱动 Overlay；
 * - 玩法模块每帧查 isActive：对话期间冻结游戏输入；
 * - 节点进入时统一执行 effects + onEnter；选项可见条件在这里求值。
 *
 * 纯服务层：不认识 Canvas/具体模块；演出需求经 effects 的具名 action 解耦。
 */
import { ref, type Ref } from 'vue'
import type { CharacterProfile } from '../../shared/profile'
import { applyEffect } from './effects'
import { setPlayerNameProvider } from '../../i18n'
import { resolveDialogueCG } from './dialogueCG'
import type {
  DialogueApi,
  DialogueChoice,
  DialogueNode,
  DialogueTree,
  DialoguePackJson
} from './types'

/** 对 UI 暴露的当前播放状态 */
export interface DialogueState {
  treeId: string
  node: DialogueNode
  /** 可见选项（已过滤条件；空数组＝点击推进型节点） */
  choices: DialogueChoice[]
}

class DialogueService {
  private readonly trees = new Map<string, DialogueTree>()
  private profile: CharacterProfile | null = null
  /** 当前状态（null＝无对话；Overlay 据此显隐） */
  readonly state: Ref<DialogueState | null> = ref(null)
  /** 每次开始/切节点自增，Overlay 用它重播打字机动画 */
  readonly seq: Ref<number> = ref(0)
  /** 当前这段对话自然结束时的回调（导演按节拍接演出/下一段） */
  private endCallback: (() => void) | null = null
  /** 自动停顿计时器（autoNextMs 节点到点自走） */
  private autoTimer = 0
  /** 自动停顿静默期（响应式：为真时点击/按键不得推进、Overlay 隐藏继续提示） */
  private readonly autoLockedR = ref(false)
  private cgPending = false
  private cgAdvanceQueued = false

  /** 注入角色档案（App 启动时） */
  setProfile(profile: CharacterProfile): void {
    this.profile = profile
    setPlayerNameProvider(()=>profile.playerName)
  }

  /** 保存剧情注册状态；包失败时撤销新树，并恢复被覆盖的旧树。 */
  createRegistrationCheckpoint(): () => void {
    const previous = new Map(this.trees)
    return () => {
      this.trees.clear()
      for (const [id, tree] of previous) this.trees.set(id, tree)
    }
  }

  /** 注册一棵对话树（重复 id 覆盖，等价资源包覆盖语义） */
  registerTree(tree: DialogueTree): void {
    if (!tree.nodes[tree.start]) {
      console.warn(`[对话] 剧情树「${tree.id}」缺少入口节点 ${tree.start}，注册被忽略`)
      return
    }
    this.trees.set(tree.id, tree)
  }

  /** 注册 MOD JSON 数据包（拒绝携带函数的脏数据） */
  registerPack(pack: DialoguePackJson): void {
    const rawNodes = pack.tree.nodes
    const nodes: Record<string, DialogueNode> = {}
    for (const n of rawNodes) {
      if (typeof (n as { onEnter?: unknown }).onEnter === 'function') {
        throw new Error(`MOD 剧情树「${pack.tree.id}」节点 ${n.id} 携带函数`)
      }
      nodes[n.id] = n
    }
    if (!nodes[pack.tree.start]) throw new Error(`MOD 剧情树「${pack.tree.id}」缺少入口节点 ${pack.tree.start}`)
    this.registerTree({ id: pack.tree.id, start: pack.tree.start, nodes })
  }

  hasTree(id: string): boolean {
    return this.trees.has(id)
  }

  get isActive(): boolean {
    return this.state.value !== null
  }

  /** 当前是否处于自动停顿静默期（Overlay 据此隐藏提示并吞掉点击） */
  get isAutoLocked(): boolean {
    return this.autoLockedR.value
  }

  /**
   * 开始播放一棵树（可指定入口节点；树不存在/正在播放时忽略）。
   * @param onEnd 对话自然结束（走到无 next 的节点或 api.end）时回调，供导演接演出
   */
  start(treeId: string, startNodeId?: string, onEnd?: () => void): void {
    // 重入守卫：一段对话未结束时再次 start 一定是调用方状态机漏切状态
    // （曾导致导演每帧重播同节点、打字机永被重置、字幕空白且输入永久冻结）
    if (this.state.value) {
      console.warn(`[对话] 已有对话播放中，忽略重复 start（${treeId}/${startNodeId ?? ''}）`)
      return
    }
    const tree = this.trees.get(treeId)
    if (!tree) {
      console.warn(`[对话] 试图播放不存在的剧情树「${treeId}」`)
      return
    }
    this.endCallback = onEnd ?? null
    const firstId = startNodeId ?? tree.start
    this.enterNode(tree, firstId)
  }

  /** 点击/按键推进：自动停顿静默期/有选项时忽略，否则去 next 或结束 */
  advance(): void {
    const s = this.state.value
    if (!s) return
    if (this.autoLockedR.value) return
    // 先记住玩家的继续请求，等 CG 完整退场再进入下一句，避免角色对白与插图重叠。
    if (this.cgPending) { this.cgAdvanceQueued = true; return }
    if (s.choices.length > 0) return
    const next = s.node.next
    const tree = this.trees.get(s.treeId)!
    if (next && tree.nodes[next]) this.enterNode(tree, next)
    else this.end()
  }

  /** 展示层在 CG 退场（或加载失败）后释放当前节点；旧节点的回调不能推进新剧情。 */
  finishCG(sequence: number): void {
    if (sequence !== this.seq.value || !this.cgPending) return
    this.cgPending = false
    if (this.cgAdvanceQueued) { this.cgAdvanceQueued = false; this.advance() }
  }

  /** 选择一个选项（索引为已过滤后的可见选项序号） */
  choose(index: number): void {
    if (this.cgPending) return
    const s = this.state.value
    if (!s) return
    const choice = s.choices[index]
    if (!choice) return
    if (this.profile) for (const e of choice.effects ?? []) applyEffect(e, this.profile)
    const tree = this.trees.get(s.treeId)!
    if (tree.nodes[choice.next]) this.enterNode(tree, choice.next)
    else this.end()
  }

  /** 强制结束（导演脚本也可在 onEnter 里调 api.end） */
  end(): void {
    if (this.autoTimer) {
      clearTimeout(this.autoTimer)
      this.autoTimer = 0
    }
    this.autoLockedR.value = false
    this.cgPending = false; this.cgAdvanceQueued = false
    this.state.value = null
    const cb = this.endCallback
    this.endCallback = null
    cb?.()
  }

  /** 离场取消不是自然完成，不执行导演的后续回调。可按树限定归属。 */
  cancel(treeId?: string): void {
    if (treeId && this.state.value?.treeId !== treeId) return
    this.endCallback = null
    this.end()
  }

  /** 进入节点：切状态 → 执行声明式效果 → 执行 TS onEnter（onEnter 可能再跳转/结束） */
  private enterNode(tree: DialogueTree, nodeId: string): void {
    // 切节点先撤掉上一节点的自动停顿（onEnter 内 goto/end 也会走到这里或 end）
    if (this.autoTimer) {
      clearTimeout(this.autoTimer)
      this.autoTimer = 0
    }
    this.autoLockedR.value = false
    const node = tree.nodes[nodeId]
    if (!node) {
      console.warn(`[对话] 剧情树「${tree.id}」缺少节点 ${nodeId}，对话终止`)
      this.end()
      return
    }
    this.cgPending = !!resolveDialogueCG(node)
    this.cgAdvanceQueued = false
    if (this.profile) for (const e of node.effects ?? []) applyEffect(e, this.profile)
    this.state.value = {
      treeId: tree.id,
      node,
      choices: (node.choices ?? []).filter((c) => this.choiceVisible(c))
    }
    this.seq.value++
    if (node.onEnter) {
      const api: DialogueApi = {
        nodeId: node.id,
        goto: (id) => {
          // onEnter 同步跳转到别的节点（再跑一轮进入流程）
          if (this.state.value?.treeId === tree.id) this.enterNode(tree, id)
        },
        end: () => this.end(),
        run: (e) => this.profile && applyEffect(e, this.profile)
      }
      node.onEnter(api)
    }
    // onEnter 可能已 goto 到别的节点/结束：仅当当前节点仍是本节点时才启动它的自动停顿
    if (this.state.value?.node.id === node.id && node.autoNextMs && node.autoNextMs > 0) {
      this.autoLockedR.value = true
      this.autoTimer = window.setTimeout(() => {
        this.autoTimer = 0
        this.autoLockedR.value = false
        // 到点自动走与点击完全相同的推进路径
        this.advance()
      }, node.autoNextMs)
    }
  }

  /** 选项显示条件求值（无 profile/无条件恒可见） */
  private choiceVisible(c: DialogueChoice): boolean {
    if (!c.show || !this.profile) return true
    if (c.show.flag !== undefined && !this.profile.flagBool(c.show.flag)) return false
    if (c.show.notFlag !== undefined && this.profile.flagBool(c.show.notFlag)) return false
    return true
  }
}

/** 游戏全局对话服务单例 */
export const dialogue = new DialogueService()
