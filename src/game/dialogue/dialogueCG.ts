import type { DialogueCG, DialogueNode } from './types'
import { playerAppearance } from '../../shared/playerAppearance'

/** CG 只读取剧情节点的显式配置，不根据台词内容或文件名推断触发位置。 */
export function resolveDialogueCG(node?: DialogueNode): DialogueCG | undefined {
  // 即使 MOD 或旧配置误把 CG 放进角色对白，也不让它覆盖正在说话的立绘。
  const cg = node?.narration && !node.speaker ? node.cg : undefined
  if (!cg || (cg.brotherOnly && playerAppearance.value !== 'brother')) return undefined
  return { ...cg, src: playerAppearance.value === 'sister' ? cg.sisterSrc ?? cg.src : cg.src }
}
