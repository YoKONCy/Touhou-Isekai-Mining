import type { DialogueCG, DialogueNode } from './types'
import { playerAppearance } from '../../shared/playerAppearance'

/** CG 只读取剧情节点的显式配置，不根据台词内容或文件名推断触发位置。 */
export function resolveDialogueCG(node?: DialogueNode): DialogueCG | undefined {
  const cg = node?.cg
  if (!cg || (cg.brotherOnly && playerAppearance.value !== 'brother')) return undefined
  return { ...cg, src: playerAppearance.value === 'sister' ? cg.sisterSrc ?? cg.src : cg.src }
}
