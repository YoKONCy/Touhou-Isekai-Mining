import type { DialoguePortrait } from './types'
import { playerAppearance } from '../../shared/playerAppearance'

export type DialogueActor='hero'|'reimu'|'rumia'|'kedama'|'kedamaBoss'
/** 图库只记录文件，不在启动时把几十张大立绘同时加载进内存。 */
const portraitFiles:Record<string,Record<string,string>>={
  "brother": {
    "base": "hero-base.png",
    "shock": "portraits/hero-shock.png",
    "rant": "portraits/hero-rant.png",
    "question": "portraits/hero-question.png",
    "think": "portraits/hero-think.png",
    "serious": "portraits/hero-serious.png",
    "worry": "portraits/hero-worry.png",
    "smile": "portraits/hero-smile.png",
    "admire": "portraits/hero-admire.png",
    "proud": "portraits/hero-proud.png",
    "dead": "portraits/hero-dead.png",
    "pain": "portraits/hero-pain.png",
    "panic": "portraits/hero-panic.png"
  },
  "sister": {
    "base": "characters/sister/portrait.png",
    "shock": "portraits/heroine-shock.png",
    "rant": "portraits/heroine-rant.png",
    "question": "portraits/heroine-question.png",
    "think": "portraits/heroine-think.png",
    "serious": "portraits/heroine-serious.png",
    "worry": "portraits/heroine-worry.png",
    "smile": "portraits/heroine-smile.png",
    "admire": "portraits/heroine-admire.png",
    "proud": "portraits/heroine-proud.png",
    "dead": "portraits/heroine-dead.png",
    "pain": "portraits/heroine-pain.png",
    "panic": "portraits/heroine-shock.png"
  },
  "reimu": {
    "base": "reimu-base.png",
    "smug": "portraits/reimu-smug.png",
    "annoyed": "portraits/reimu-annoyed.png",
    "stare": "portraits/reimu-stare.png",
    "grin": "portraits/reimu-grin.png",
    "bowl": "portraits/reimu-bowl.png",
    "taste": "portraits/reimu-taste.png",
    "serious": "portraits/reimu-serious.png",
    "think": "portraits/reimu-think.png",
    "surprised": "portraits/reimu-surprised.png",
    "soft": "portraits/reimu-soft.png",
    "tired": "portraits/reimu-tired.png",
    "cast": "portraits/reimu-cast.png"
  },
  "rumia": {
    "base": "characters/rumia/portrait.png",
    "hungry": "portraits/rumia-hungry.png",
    "scared": "portraits/rumia-scared.png",
    "bitter": "portraits/rumia-bitter.png"
  },
  "kedama": {
    "base": "characters/kedama-girl/portrait.png"
  },
  "kedamaBoss": {
    "base": "characters/kedama-girl/portrait-boss.png",
    "arms-crossed": "portraits/kedama-boss-arms-crossed.png",
    "defeat": "portraits/kedama-boss-defeat.png"
  }
}

export function portraitForActor(actor:DialogueActor,emotion='base'):DialoguePortrait {
  const identity=actor==='hero'?playerAppearance.value:actor,files=portraitFiles[identity]
  return {src:import.meta.env.BASE_URL+(files[emotion]??files.base),side:actor==='hero'?'right':'left',rendering:actor==='hero'||actor==='reimu'?'pixel':'smooth'}
}

