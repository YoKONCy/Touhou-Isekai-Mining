import type { DialogueCG, DialogueTree } from '../../game/dialogue/types'

function illustration(name: string): DialogueCG {
  return {
    src: `${import.meta.env.BASE_URL}cg/${name}.webp`,
    sisterSrc: `${import.meta.env.BASE_URL}cg/sister/${name}.webp`
  }
}

/** 五张 CG 的语义与美术清单一致，触发位置由各剧情树显式声明。 */
export const storyCGs = {
  reimuPull: illustration('reimu-pulls-hero'),
  slimeWater: illustration('slime-pot-water'),
  hotIngot: illustration('hot-ingot'),
  rumiaBite: illustration('rumia-bite'),
  rumiaRoll: illustration('rumia-wants-meat')
} as const

export function bindStoryCG(tree: DialogueTree, nodes: readonly string[], cg: DialogueCG): void {
  for (const id of nodes) {
    if (!tree.nodes[id]) throw new Error(`剧情 CG 绑定节点不存在：${tree.id}/${id}`)
    tree.nodes[id].cg = cg
  }
}
