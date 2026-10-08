import { drawRumiaRig, drawKedamaGirlRig, drawOverloadedKedamaRig } from '../../../game/art/rig/fourthFloorCharacters'

/** 两种形态分别持有用户确认的新立绘；剧情可显式取 BOSS 形态的 portrait。 */
export const kedamaGirlPortraits = {
  normal: { src: `${import.meta.env.BASE_URL}characters/kedama-girl/portrait.png`, side: 'left', rendering: 'smooth' },
  boss: { src: `${import.meta.env.BASE_URL}characters/kedama-girl/portrait-boss.png`, side: 'left', rendering: 'smooth' }
} as const

/** 角色外观资源独立于剧情触发，后续救援导演按角色与形态取用。 */
export const fourthFloorCharacters = {
  rumia: { id: 'touhou:rumia', speaker: 'story.speaker.rumia', render: drawRumiaRig, portrait: { src: `${import.meta.env.BASE_URL}characters/rumia/portrait.png`, side: 'left', rendering: 'smooth' } },
  kedamaGirl: { id: 'touhou:kedama_girl', speaker: 'story.speaker.kedamaGirl',
    portrait: kedamaGirlPortraits.normal,
    forms: {
      normal: { render: drawKedamaGirlRig, portrait: kedamaGirlPortraits.normal },
      boss: { render: drawOverloadedKedamaRig, portrait: kedamaGirlPortraits.boss, facing: 'down' }
    } }
} as const

