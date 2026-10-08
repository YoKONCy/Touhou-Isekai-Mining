import type { DialogueNode } from './types'
import type { DialogueActor } from './portraitCatalog'

/** 按台词键配置表情，不用标点或译文内容猜测，旁白的隐藏规则由展示层保持。 */
const emotions:Record<string,Partial<Record<DialogueActor,string>>>={
  "story.prologue.s10_h_dots": {
    "hero": "shock"
  },
  "story.prologue.s10_h_wait": {
    "hero": "shock"
  },
  "story.prologue.base_h_chest": {
    "hero": "shock"
  },
  "story.prologue.s2b": {
    "hero": "panic"
  },
  "story.prologue.s5": {
    "hero": "panic"
  },
  "story.prologue.s9_what": {
    "hero": "question"
  },
  "story.prologue.s10_h_huh": {
    "hero": "question"
  },
  "story.prologue.base_h_1": {
    "hero": "question"
  },
  "story.prologue.base_h_3a": {
    "hero": "question"
  },
  "story.prologue.base_h_3b": {
    "hero": "question"
  },
  "story.prologue.base_h_4": {
    "hero": "question"
  },
  "story.prologue.base_h_5": {
    "hero": "question"
  },
  "story.prologue.base_h_6": {
    "hero": "rant"
  },
  "story.prologue.base_h_6b": {
    "hero": "rant"
  },
  "story.prologue.s10_h_leave": {
    "hero": "dead"
  },
  "story.prologue.s9_r2": {
    "reimu": "tired"
  },
  "story.prologue.s10_r_sigh": {
    "reimu": "tired"
  },
  "story.prologue.base_r_home": {
    "reimu": "tired"
  },
  "story.prologue.s9_r1": {
    "reimu": "surprised"
  },
  "story.prologue.s9_shout": {
    "reimu": "cast"
  },
  "story.prologue.s9_seal": {
    "reimu": "cast"
  },
  "story.prologue.s10_r_who": {
    "reimu": "think"
  },
  "story.prologue.s10_r_where": {
    "reimu": "think"
  },
  "story.prologue.s10_r_hungry_a": {
    "reimu": "stare"
  },
  "story.prologue.s10_r_hungry_b": {
    "reimu": "stare"
  },
  "story.prologue.base_r_5": {
    "reimu": "stare"
  },
  "story.prologue.base_r_1": {
    "reimu": "annoyed"
  },
  "story.prologue.base_r_6": {
    "reimu": "annoyed"
  },
  "story.prologue.base_r_6b": {
    "reimu": "annoyed"
  },
  "story.prologue.base_r_pause": {
    "reimu": "annoyed"
  },
  "story.prologue.base_r_3": {
    "reimu": "serious"
  },
  "story.prologue.base_r_4": {
    "reimu": "serious"
  },
  "story.prologue.base_r_fac1": {
    "reimu": "serious"
  },
  "story.prologue.base_r_fac2": {
    "reimu": "serious"
  },
  "story.prologue.base_r_store1": {
    "reimu": "serious"
  },
  "story.prologue.base_r_chest": {
    "reimu": "grin"
  },
  "story.prologue.base_r_store2": {
    "reimu": "smug"
  },
  "quest.reimu_cooking.hero.food": {
    "hero": "question"
  },
  "quest.reimu_cooking.ta1": {
    "hero": "question"
  },
  "quest.reimu_cooking.tb2": {
    "hero": "question"
  },
  "quest.reimu_cooking.ta4": {
    "hero": "admire"
  },
  "quest.reimu_cooking.reimu.answer": {
    "reimu": "stare"
  },
  "quest.reimu_cooking.reimu.hello": {
    "reimu": "tired"
  },
  "quest.reimu_cooking.ta3": {
    "reimu": "grin"
  },
  "quest.reimu_cooking.ta7": {
    "reimu": "grin"
  },
  "quest.reimu_cooking.ta5": {
    "reimu": "smug"
  },
  "quest.reimu_cooking.ta6": {
    "reimu": "think"
  },
  "quest.reimu_cooking.tb1": {
    "reimu": "think"
  },
  "quest.radio.rf2": {
    "hero": "question"
  },
  "quest.radio.rf5": {
    "hero": "think"
  },
  "quest.radio.rf6": {
    "hero": "rant"
  },
  "quest.radio.rf9": {
    "hero": "rant"
  },
  "quest.radio.rf11": {
    "hero": "dead"
  },
  "quest.radio.rf1": {
    "reimu": "smug"
  },
  "quest.radio.rf3": {
    "reimu": "smug"
  },
  "quest.radio.rf7": {
    "reimu": "think"
  },
  "quest.radio.rf8": {
    "reimu": "grin"
  },
  "quest.radio.rf10": {
    "reimu": "stare"
  },
  "quest.pot.p2": {
    "hero": "proud"
  },
  "quest.pot.p4": {
    "hero": "proud"
  },
  "quest.pot.p5": {
    "hero": "question"
  },
  "quest.pot.p7": {
    "hero": "question"
  },
  "quest.pot.p11": {
    "hero": "rant"
  },
  "quest.pot.p13": {
    "hero": "dead"
  },
  "quest.pot.p3": {
    "reimu": "smug"
  },
  "quest.pot.p10": {
    "reimu": "smug"
  },
  "quest.pot.p6": {
    "reimu": "think"
  },
  "quest.pot.p8": {
    "reimu": "annoyed"
  },
  "quest.pot.p12": {
    "reimu": "stare"
  },
  "quest.soup_delivery.s2": {
    "hero": "dead"
  },
  "quest.soup_delivery.s12": {
    "hero": "dead"
  },
  "quest.soup_delivery.s16": {
    "hero": "dead"
  },
  "quest.soup_delivery.s4": {
    "hero": "rant"
  },
  "quest.soup_delivery.s6": {
    "hero": "rant"
  },
  "quest.soup_delivery.s10": {
    "hero": "rant"
  },
  "quest.soup_delivery.s14": {
    "hero": "question"
  },
  "quest.soup_delivery.s20": {
    "hero": "serious"
  },
  "quest.soup_delivery.s9": {
    "reimu": "annoyed"
  },
  "quest.soup_delivery.s11": {
    "reimu": "annoyed"
  },
  "quest.soup_delivery.s13": {
    "reimu": "serious"
  },
  "quest.soup_delivery.s15": {
    "reimu": "serious"
  },
  "quest.soup_delivery.s17": {
    "reimu": "stare"
  },
  "quest.soup_delivery.s19": {
    "reimu": "cast"
  },
  "quest.salt_found.s3": {
    "hero": "question"
  },
  "quest.salt_found.s7": {
    "hero": "question"
  },
  "quest.salt_found.s10": {
    "hero": "rant"
  },
  "quest.salt_found.s2": {
    "reimu": "think"
  },
  "quest.salt_found.s4": {
    "reimu": "think"
  },
  "quest.salt_found.s6": {
    "reimu": "serious"
  },
  "quest.salt_found.s8": {
    "reimu": "serious"
  },
  "quest.salt_found.s11": {
    "reimu": "serious"
  },
  "quest.salt_missing.s2": {
    "hero": "dead"
  },
  "quest.salt_missing.s3": {
    "reimu": "soft"
  },
  "quest.salt_delivery.s3": {
    "hero": "question"
  },
  "quest.salt_delivery.s5": {
    "hero": "question"
  },
  "quest.salt_delivery.s13": {
    "hero": "question"
  },
  "quest.salt_delivery.s8": {
    "hero": "smile"
  },
  "quest.salt_delivery.s11": {
    "hero": "think"
  },
  "quest.salt_delivery.s9": {
    "reimu": "smug"
  },
  "quest.salt_delivery.s12": {
    "reimu": "serious"
  },
  "quest.salt_delivery.s14": {
    "reimu": "serious"
  },
  "quest.farewell.s1": {
    "reimu": "soft"
  },
  "quest.farewell.s5": {
    "reimu": "soft",
    "hero": "smile"
  },
  "quest.farewell.s4": {
    "reimu": "soft"
  },
  "quest.farewell.s2": {
    "hero": "question"
  },
  "quest.farewell.s6": {
    "hero": "worry"
  },
  "quest.craft_intro.s2": {
    "hero": "question"
  },
  "quest.craft_intro.s7": {
    "hero": "think"
  },
  "quest.craft_intro.s11": {
    "hero": "rant"
  },
  "quest.craft_intro.s3": {
    "reimu": "smug"
  },
  "quest.craft_intro.s5": {
    "reimu": "serious"
  },
  "quest.craft_intro.s6": {
    "reimu": "serious"
  },
  "quest.craft_intro.s8": {
    "reimu": "serious"
  },
  "quest.craft_intro.s9": {
    "reimu": "serious"
  },
  "quest.craft_intro.s10": {
    "reimu": "serious"
  },
  "quest.tetanus_intro.s1": {
    "hero": "think"
  },
  "quest.tetanus_intro.s3": {
    "hero": "think"
  },
  "quest.tetanus_intro.s6": {
    "hero": "proud"
  },
  "quest.tetanus_intro.s2": {
    "reimu": "think"
  },
  "quest.tetanus_intro.s4": {
    "reimu": "think"
  },
  "quest.tetanus_intro.s7": {
    "reimu": "serious"
  },
  "quest.iron_work.s1": {
    "hero": "question"
  },
  "quest.iron_work.s6": {
    "hero": "think"
  },
  "quest.iron_work.s8": {
    "hero": "smile"
  },
  "quest.iron_work.s2": {
    "reimu": "smug"
  },
  "quest.iron_work.s4": {
    "reimu": "serious"
  },
  "quest.iron_work.s7": {
    "reimu": "think"
  },
  "quest.first_iron_weapon.s1": {
    "reimu": "surprised"
  },
  "quest.first_iron_weapon.s3": {
    "reimu": "think"
  },
  "quest.first_iron_weapon.s5": {
    "reimu": "annoyed"
  },
  "quest.first_iron_weapon.s4": {
    "hero": "rant"
  },
  "quest.first_iron_weapon.s6": {
    "hero": "serious"
  },
  "quest.furnace_inspect.s4": {
    "hero": "dead"
  },
  "quest.furnace_inspect.s6": {
    "hero": "dead"
  },
  "quest.furnace_inspect.s1": {
    "reimu": "serious"
  },
  "quest.furnace_inspect.s3": {
    "reimu": "serious"
  },
  "quest.furnace_inspect.s5": {
    "reimu": "annoyed"
  },
  "quest.furnace_ready.s2": {
    "hero": "smile"
  },
  "quest.furnace_ready.s4": {
    "hero": "rant"
  },
  "quest.furnace_ready.s6": {
    "hero": "question"
  },
  "quest.furnace_ready.s8": {
    "hero": "question"
  },
  "quest.furnace_ready.s3": {
    "reimu": "soft"
  },
  "quest.furnace_ready.s5": {
    "reimu": "serious"
  },
  "quest.furnace_ready.s7": {
    "reimu": "serious"
  },
  "quest.furnace_ready.s9": {
    "reimu": "serious"
  },
  "quest.furnace_key.s2": {
    "hero": "rant"
  },
  "quest.furnace_key.s4": {
    "hero": "question"
  },
  "quest.furnace_key.s7": {
    "hero": "serious"
  },
  "quest.furnace_key.s9": {
    "hero": "serious"
  },
  "quest.furnace_key.s1": {
    "reimu": "serious"
  },
  "quest.furnace_key.s3": {
    "reimu": "serious"
  },
  "quest.furnace_key.s8": {
    "reimu": "serious"
  },
  "quest.furnace_key.s10": {
    "reimu": "soft"
  },
  "quest.furnace_parts.s3": {
    "hero": "question"
  },
  "quest.furnace_parts.s5": {
    "hero": "smile"
  },
  "quest.furnace_parts.s2": {
    "reimu": "think"
  },
  "quest.furnace_parts.s4": {
    "reimu": "serious"
  },
  "story.fourth.intro.s8": {
    "hero": "question"
  },
  "story.fourth.intro.s11": {
    "hero": "serious"
  },
  "story.fourth.intro.s12": {
    "hero": "serious"
  },
  "story.fourth.phase.s1": {
    "kedamaBoss": "arms-crossed"
  },
  "story.fourth.phase.s2": {
    "kedamaBoss": "arms-crossed"
  },
  "story.fourth.phase.s4": {
    "kedamaBoss": "arms-crossed"
  },
  "story.fourth.phase.s3": {
    "hero": "rant"
  },
  "story.fourth.defeat.s1": {
    "kedamaBoss": "defeat"
  },
  "story.fourth.defeat.s3": {
    "kedamaBoss": "defeat"
  },
  "story.fourth.check.s1": {
    "hero": "worry"
  },
  "story.fourth.check.s3": {
    "hero": "worry"
  },
  "story.fourth.rescue.s2": {
    "hero": "worry"
  },
  "story.fourth.rescue.s4": {
    "hero": "pain"
  },
  "story.fourth.rescue.s6": {
    "hero": "pain"
  },
  "story.fourth.rescue.s8": {
    "hero": "pain"
  },
  "story.fourth.rescue.s13": {
    "hero": "pain"
  },
  "story.fourth.rescue.s11": {
    "hero": "rant"
  },
  "story.fourth.rescue.s17": {
    "hero": "rant"
  },
  "story.fourth.rescue.s20": {
    "hero": "rant"
  },
  "story.fourth.rescue.s22": {
    "hero": "serious"
  },
  "story.fourth.rescue.s26": {
    "hero": "serious"
  },
  "story.fourth.rescue.s15": {
    "hero": "smile"
  },
  "story.fourth.rescue.s24": {
    "hero": "smile"
  },
  "story.fourth.rescue.s5": {
    "rumia": "hungry"
  },
  "story.fourth.rescue.s10": {
    "rumia": "hungry"
  },
  "story.fourth.rescue.s12": {
    "rumia": "hungry"
  },
  "story.fourth.rescue.s21": {
    "rumia": "hungry"
  },
  "story.fourth.rescue.s23": {
    "rumia": "hungry"
  },
  "story.fourth.rescue.s25": {
    "rumia": "hungry"
  },
  "story.fourth.rescue.s19": {
    "rumia": "bitter"
  },
  "story.fourth.arrival.s2": {
    "hero": "proud"
  },
  "story.fourth.arrival.s5": {
    "hero": "question"
  },
  "story.fourth.arrival.s14": {
    "hero": "serious"
  },
  "story.fourth.arrival.s17": {
    "hero": "smile"
  },
  "story.fourth.arrival.s4": {
    "reimu": "surprised"
  },
  "story.fourth.arrival.s9": {
    "reimu": "annoyed"
  },
  "story.fourth.arrival.s13": {
    "reimu": "annoyed"
  },
  "story.fourth.arrival.s18": {
    "reimu": "annoyed"
  },
  "story.fourth.arrival.s11": {
    "reimu": "soft"
  },
  "story.fourth.arrival.s15": {
    "reimu": "think"
  },
  "story.fourth.arrival.s7": {
    "rumia": "scared"
  },
  "story.fourth.arrival.s8": {
    "rumia": "scared"
  },
  "story.fourth.arrival.s10": {
    "rumia": "scared"
  },
  "story.fourth.arrival.s12": {
    "rumia": "scared"
  },
  "story.fourth.hungry.s4": {
    "hero": "rant"
  },
  "story.fourth.hungry.s7": {
    "hero": "rant"
  },
  "story.fourth.hungry.s11": {
    "hero": "dead"
  },
  "story.fourth.hungry.s13": {
    "hero": "dead"
  },
  "story.fourth.hungry.s6": {
    "reimu": "annoyed"
  },
  "story.fourth.hungry.s8": {
    "reimu": "annoyed"
  },
  "story.fourth.hungry.s2": {
    "rumia": "hungry"
  },
  "story.fourth.hungry.s3": {
    "rumia": "hungry"
  },
  "story.fourth.hungry.s5": {
    "rumia": "hungry"
  },
  "story.fourth.hungry.s10": {
    "rumia": "hungry"
  },
  "story.fourth.hungry.s12": {
    "rumia": "hungry"
  },
  "story.fourth.hungry.s14": {
    "rumia": "hungry"
  },
  "story.fourth.account.s1": {
    "hero": "question"
  },
  "story.fourth.account.s5": {
    "hero": "question"
  },
  "story.fourth.account.s9": {
    "hero": "question"
  },
  "story.fourth.account.s11": {
    "hero": "question"
  },
  "story.fourth.account.s16": {
    "hero": "question"
  },
  "story.fourth.account.s18": {
    "hero": "question"
  },
  "story.fourth.account.s25": {
    "hero": "question"
  },
  "story.fourth.account.s27": {
    "hero": "question"
  },
  "story.fourth.account.s3": {
    "hero": "rant"
  },
  "story.fourth.account.s7": {
    "hero": "rant"
  },
  "story.fourth.account.s13": {
    "hero": "rant"
  },
  "story.fourth.account.s23": {
    "hero": "rant"
  },
  "story.fourth.account.s20": {
    "hero": "think"
  },
  "story.fourth.account.s29": {
    "hero": "think"
  },
  "story.fourth.account.s32": {
    "hero": "think"
  },
  "story.fourth.account.s2": {
    "rumia": "hungry"
  },
  "story.fourth.account.s10": {
    "rumia": "hungry"
  },
  "story.fourth.account.s12": {
    "rumia": "hungry"
  },
  "story.fourth.account.s28": {
    "rumia": "hungry"
  },
  "story.fourth.account.s31": {
    "rumia": "hungry"
  },
  "story.fourth.account.s15": {
    "rumia": "scared"
  },
  "story.fourth.idle.s1": {
    "rumia": "hungry"
  },
  "story.fourth.idle.s2": {
    "hero": "dead"
  },
  "story.mineRelay.report.s6": {
    "hero": "question"
  },
  "story.mineRelay.report.s10": {
    "hero": "question"
  },
  "story.mineRelay.report.s11": {
    "hero": "question"
  },
  "story.mineRelay.report.s8": {
    "hero": "serious"
  },
  "story.mineRelay.report.s13": {
    "hero": "serious"
  },
  "story.mineRelay.report.s5": {
    "hero": "smile"
  },
  "story.mineRelay.report.s9": {
    "reimu": "serious"
  },
  "story.mineRelay.report.s12": {
    "reimu": "serious"
  }
}

/** 日常三句对白依次为灵梦、主角、灵梦，普通提醒不提前端碗或拿符札。 */
const dailyEmotions:Record<string,readonly [string,string,string]>={
  salt_rocks:['serious','dead','serious'],salt_return:['serious','rant','soft'],
  soup_pinch:['serious','question','smug'],soup_taste:['serious','rant','annoyed'],
  craft_flax:['think','question','annoyed'],idle_ore:['think','smile','grin'],
  idle_smoke:['soft','dead','serious'],heating_wait:['serious','base','soft'],
  heating_safe:['serious','question','soft'],ready_collect:['soft','smile','serious'],
  ready_next:['serious','dead','serious'],parts_found:['think','question','serious'],
  metal_hot:['serious','rant','annoyed']
}

export function emotionForDialogue(node:DialogueNode,actor:DialogueActor,active=true):string {
  if(active&&node.portraitEmotion)return node.portraitEmotion
  const text=node.text??''
  const daily=/^quest\.reimu_daily\.([^.]+)\.([123])$/.exec(text)
  if(daily&&dailyEmotions[daily[1]]){
    const index=Number(daily[2])-1,poses=dailyEmotions[daily[1]]
    if(actor==='hero'&&index===1)return poses[1]
    if(actor==='reimu')return poses[index===1?0:index]
  }
  // 喝汤段听者仍保持同一碗，明确放下后再切回空手，避免说话人切换导致道具消失。
  if(actor==='reimu'){
    const bland=/^quest\.soup_delivery\.s(\d+)$/.exec(text)
    if(bland&&Number(bland[1])<8)return 'taste'
    const salted=/^quest\.salt_delivery\.s(\d+)$/.exec(text)
    if(salted&&Number(salted[1])<7)return 'bowl'
  }
  return emotions[text]?.[actor]??'base'
}

