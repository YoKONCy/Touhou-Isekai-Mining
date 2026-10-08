import type { DialogueNode, DialogueTree } from '../../game/dialogue/types'
type Speaker='reimu'|'hero'|'narration'
/** 短对白统一生成顺序节点；复杂分支仍可直接提供 DialogueTree。 */
export function sequence(id:string,prefix:string,speakers:readonly Speaker[]):DialogueTree{
  const nodes:Record<string,DialogueNode>={}
  speakers.forEach((speaker,i)=>{
    const key=`s${i+1}`
    nodes[key]={id:key,text:`${prefix}.${key}`,...(speaker==='narration'?{narration:true,os:true}:{speaker:`story.speaker.${speaker}`}),...(i<speakers.length-1?{next:`s${i+2}`}:{})}
  })
  return {id,start:'s1',nodes}
}
