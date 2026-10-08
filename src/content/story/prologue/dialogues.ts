/**
 * 序章对话树（官方剧情 · TS 模块）
 *
 * 全文案都是 i18n 键（content/story/prologue/lang/zh_cn.json），这里只有结构、
 * 条件与声明式效果。流程编排（火把/战斗/梦想封印演出/转场）由
 * PrologueDirector 按节点组的对话结束回调驱动，树本身不认识引擎。
 */
import type { DialogueTree } from '../../../game/dialogue/types'
import { bindStoryCG, storyCGs } from '../cg'

/** 序章剧情树 id（dialogue.start('prologue', 节点id, 结束回调)） */
export const PROLOGUE_TREE = 'prologue'

/** 节点 id 常量（导演按名开播，防止拼写漂移） */
export const PNODE = {
  // S0 黑屏独白 7 句（压屏；末句点完黑场淡出显影）
  S0A: 's0a',
  S0B: 's0b',
  S0C: 's0c',
  S0D: 's0d',
  S0E: 's0e',
  S0F: 's0f',
  S0G: 's0g',
  // S1 拾破旧囊袋：移动起疑 → 蹲下端详 → 捡起抖出镐与火柴 → 评价（袋子＝TAB 背包本体）
  S1A: 's1a',
  S1B: 's1b',
  S1C: 's1c',
  S1D: 's1d',
  S1E: 's1e',
  // S2 破门：拟声三连（音效由导演对齐）→ 惊呼
  S2A: 's2a',
  S2B: 's2b',
  // S3 战后：喘息 → 找光 → 点亮 → 发现剑
  S3A: 's3a',
  S3B: 's3b',
  S3C: 's3c',
  S3D: 's3d',
  // S4 拾剑：惊喜 → 通道
  S4A: 's4a',
  S4B: 's4b',
  S5: 's5',
  S5B: 's5b',
  S7: 's7',
  S8: 's8',
  DOWN: 'down',
  // S9 灵梦房开场：主角发现 → 陌生巫女求助 → 主角疑惑（随后自由战斗 10 秒）
  S9_NOTICE: 's9_notice',
  S9_R1: 's9_r1',
  S9_R2: 's9_r2',
  S9_WHAT: 's9_what',
  S9_SHOUT: 's9_shout',
  S9_SEAL: 's9_seal',
  // S10 封印后问答（灵梦先以？？？发言，自报家门那句起换"博丽灵梦"名牌）
  S10_R_SIGH: 's10_r_sigh',
  S10_R_WHO: 's10_r_who',
  S10_R_WHERE: 's10_r_where',
  S10_H_HUH: 's10_h_huh',
  S10_R_DOTS: 's10_r_dots',
  S10_R_NAME: 's10_r_name',
  // 肚子叫音效旁白（1.3s 不可快进）→ 灵梦喊饿 → 主角"哈？！"→ 不等吐槽就被拉走
  S10_GROWL: 's10_growl',
  S10_R_HUNGRY_A: 's10_r_hungry_a',
  S10_H_DOTS: 's10_h_dots',
  S10_N_HURRY: 's10_n_hurry',
  S10_R_HUNGRY_B: 's10_r_hungry_b',
  S10_H_WAIT: 's10_h_wait',
  S10_N_PULL: 's10_n_pull',
  S10_H_LEAVE: 's10_h_leave',
  // 黑场行路：火柴照路、边走边拌嘴（STEP_1/2、ROPE 为不可快进的环境静默段）
  WALK_H_A: 'walk_h_a',
  WALK_H_B: 'walk_h_b',
  WALK_R_A: 'walk_r_a',
  WALK_STEP_1: 'walk_step1',
  WALK_R_B: 'walk_r_b',
  WALK_STEP_2: 'walk_step2',
  // 尾段：发现竖井吊绳 → 攀爬（音效，末节点；结束即黑场进基地显影）
  WALK_R_C: 'walk_r_c',
  WALK_ROPE: 'walk_rope',
  // —— 基地长对白（R_PAUSE/N_CHEST＝自动停顿；N_*＝无名牌 OS 心声/旁述） ——
  BASE_H_1: 'base_h_1',
  BASE_H_2: 'base_h_2',
  BASE_R_1: 'base_r_1',
  BASE_H_3A: 'base_h_3a',
  BASE_H_3B: 'base_h_3b',
  BASE_R_2: 'base_r_2',
  BASE_R_3: 'base_r_3',
  BASE_H_4: 'base_h_4',
  BASE_H_5: 'base_h_5',
  BASE_R_4: 'base_r_4',
  BASE_R_PAUSE: 'base_r_pause',
  BASE_R_5: 'base_r_5',
  BASE_H_6: 'base_h_6',
  BASE_R_6: 'base_r_6',
  BASE_R_6B: 'base_r_6b',
  BASE_H_6B: 'base_h_6b',
  BASE_R_FAC_1: 'base_r_fac1',
  BASE_R_FAC_2: 'base_r_fac2',
  BASE_N_CHEST: 'base_n_chest',
  BASE_H_CHEST: 'base_h_chest',
  BASE_R_CHEST: 'base_r_chest',
  BASE_R_STORE: 'base_r_store',
  BASE_R_STORE_2: 'base_r_store2',
  BASE_R_BARRIER: 'base_r_barrier',
  BASE_R_GO: 'base_r_go',
  BASE_N_1: 'base_n_1',
  BASE_N_2: 'base_n_2'
} as const

const HERO = 'story.speaker.hero'
const REIMU = 'story.speaker.reimu'
/** 初见未报姓名的角色统一名牌（？？？），任何角色初登场可复用 */
const UNKNOWN = 'story.speaker.unknown'

/** 旁白节点快捷构造（黑屏 OS / 场景旁述）；os=true＝游戏内底部字幕不压屏 */
function nar(id: string, text: string, next?: string, os = false) {
  return { id, narration: true, os, text, next }
}

export const prologueTree: DialogueTree = {
  id: PROLOGUE_TREE,
  start: PNODE.S0A,
  nodes: {
    // —— S0 黑屏醒来（7 句压屏独白；末句结束由导演做黑场淡出显影） ——
    [PNODE.S0A]: { ...nar(PNODE.S0A, 'story.prologue.s0a', PNODE.S0B) },
    [PNODE.S0B]: { ...nar(PNODE.S0B, 'story.prologue.s0b', PNODE.S0C) },
    [PNODE.S0C]: { ...nar(PNODE.S0C, 'story.prologue.s0c', PNODE.S0D) },
    [PNODE.S0D]: { ...nar(PNODE.S0D, 'story.prologue.s0d', PNODE.S0E) },
    [PNODE.S0E]: { ...nar(PNODE.S0E, 'story.prologue.s0e', PNODE.S0F) },
    [PNODE.S0F]: { ...nar(PNODE.S0F, 'story.prologue.s0f', PNODE.S0G) },
    [PNODE.S0G]: { ...nar(PNODE.S0G, 'story.prologue.s0g') },

    // —— S1 拾破旧囊袋（OS 底部字幕不压屏） ——
    // s1a 移动触发，结束回调里刷出囊袋中的镐+火柴（同一个掉落点 F 捡起）；s1b→e 是捡起后的端详链
    [PNODE.S1A]: { ...nar(PNODE.S1A, 'story.prologue.s1a', undefined, true) },
    [PNODE.S1B]: { ...nar(PNODE.S1B, 'story.prologue.s1b', PNODE.S1C, true) },
    [PNODE.S1C]: { ...nar(PNODE.S1C, 'story.prologue.s1c', PNODE.S1D, true) },
    [PNODE.S1D]: { ...nar(PNODE.S1D, 'story.prologue.s1d', PNODE.S1E, true) },
    [PNODE.S1E]: { ...nar(PNODE.S1E, 'story.prologue.s1e', undefined, true) },

    // —— S2 破门：拟声句（导演对齐敲门三连同帧刷怪）→ 惊呼句 ——
    [PNODE.S2A]: { ...nar(PNODE.S2A, 'story.prologue.s2a', PNODE.S2B, true) },
    [PNODE.S2B]: { ...nar(PNODE.S2B, 'story.prologue.s2b', undefined, true) },

    // —— S3：战后两句（喘息→找光）→ 点火后两句（亮了→发现剑） ——
    [PNODE.S3A]: { ...nar(PNODE.S3A, 'story.prologue.s3a', PNODE.S3B, true) },
    [PNODE.S3B]: { ...nar(PNODE.S3B, 'story.prologue.s3b', undefined, true) },
    [PNODE.S3C]: { ...nar(PNODE.S3C, 'story.prologue.s3c', PNODE.S3D, true) },
    [PNODE.S3D]: { ...nar(PNODE.S3D, 'story.prologue.s3d', undefined, true) },

    // —— S4 拾剑：惊喜 → 通道（结束回调开门） ——
    [PNODE.S4A]: { ...nar(PNODE.S4A, 'story.prologue.s4a', PNODE.S4B, true) },
    [PNODE.S4B]: { ...nar(PNODE.S4B, 'story.prologue.s4b', undefined, true) },

    // —— S5 第二房 / S7 动静 / S8 穿两房（同属游戏内 OS） ——
    [PNODE.S5]: { ...nar(PNODE.S5, 'story.prologue.s5', undefined, true) },
    // s5b 清场后主角感慨，结束回调里导演才 storyClear 亮灯开门
    [PNODE.S5B]: { ...nar(PNODE.S5B, 'story.prologue.s5b', undefined, true) },
    [PNODE.S7]: { ...nar(PNODE.S7, 'story.prologue.s7', PNODE.S8, true) },
    [PNODE.S8]: { ...nar(PNODE.S8, 'story.prologue.s8', undefined, true) },

    // —— 教学期倒下：不甘独白（世界可见，底部字幕；结束后半血复活） ——
    [PNODE.DOWN]: { ...nar(PNODE.DOWN, 'story.prologue.down', undefined, true) },

    // —— S9 灵梦房开场：主角 OS 发现 → 陌生巫女（？？？）木牌对白求助 → 主角 OS 疑惑 ——
    // 整链播完导演才解冻怪群、开启 10 秒锁血缠斗
    [PNODE.S9_NOTICE]: { ...nar(PNODE.S9_NOTICE, 'story.prologue.s9_notice', PNODE.S9_R1, true) },
    [PNODE.S9_R1]: { id: PNODE.S9_R1, speaker: UNKNOWN, text: 'story.prologue.s9_r1', next: PNODE.S9_R2 },
    [PNODE.S9_R2]: { id: PNODE.S9_R2, speaker: UNKNOWN, text: 'story.prologue.s9_r2', next: PNODE.S9_WHAT },
    [PNODE.S9_WHAT]: { ...nar(PNODE.S9_WHAT, 'story.prologue.s9_what', undefined, true) },

    // —— S9 封印：陌生巫女（？？？）接管战场——"久等了" → 念咒（念完导演引爆五连爆） ——
    [PNODE.S9_SHOUT]: { id: PNODE.S9_SHOUT, speaker: UNKNOWN, text: 'story.prologue.s9_shout', next: PNODE.S9_SEAL },
    [PNODE.S9_SEAL]: { id: PNODE.S9_SEAL, speaker: UNKNOWN, text: 'story.prologue.s9_seal' },

    // —— S10 封印后问答（木牌对白；两处 autoNextMs＝灵梦"愣神"2 秒不可跳过） ——
    // 灵梦自报家门那句起名牌由？？？换成博丽灵梦
    [PNODE.S10_R_SIGH]: {
      id: PNODE.S10_R_SIGH,
      speaker: UNKNOWN,
      text: 'story.prologue.s10_r_sigh',
      next: PNODE.S10_R_WHO,
      autoNextMs: 2000
    },
    [PNODE.S10_R_WHO]: { id: PNODE.S10_R_WHO, speaker: UNKNOWN, text: 'story.prologue.s10_r_who', next: PNODE.S10_R_WHERE },
    [PNODE.S10_R_WHERE]: { id: PNODE.S10_R_WHERE, speaker: UNKNOWN, text: 'story.prologue.s10_r_where', next: PNODE.S10_H_HUH },
    [PNODE.S10_H_HUH]: { id: PNODE.S10_H_HUH, speaker: HERO, text: 'story.prologue.s10_h_huh', next: PNODE.S10_R_DOTS },
    [PNODE.S10_R_DOTS]: { id: PNODE.S10_R_DOTS, speaker: UNKNOWN, text: 'story.prologue.s10_r_dots', next: PNODE.S10_R_NAME },
    [PNODE.S10_R_NAME]: {
      id: PNODE.S10_R_NAME,
      speaker: REIMU,
      text: 'story.prologue.s10_r_name',
      next: PNODE.S10_GROWL,
      autoNextMs: 2000
    },
    // 肚子咕噜叫：OS 旁述 1.3s 不可快进，进场即播合成音效
    [PNODE.S10_GROWL]: {
      ...nar(PNODE.S10_GROWL, 'story.prologue.s10_growl', PNODE.S10_R_HUNGRY_A, true),
      autoNextMs: 1300,
      effects: [{ type: 'action', name: 'sfx.stomachGrowl' }]
    },
    [PNODE.S10_R_HUNGRY_A]: { id: PNODE.S10_R_HUNGRY_A, speaker: REIMU, text: 'story.prologue.s10_r_hungry_a', next: PNODE.S10_H_DOTS },
    [PNODE.S10_H_DOTS]: { id: PNODE.S10_H_DOTS, speaker: HERO, text: 'story.prologue.s10_h_dots', next: PNODE.S10_N_HURRY },
    [PNODE.S10_N_HURRY]: { ...nar(PNODE.S10_N_HURRY, 'story.prologue.s10_n_hurry', PNODE.S10_R_HUNGRY_B, true) },
    [PNODE.S10_R_HUNGRY_B]: { id: PNODE.S10_R_HUNGRY_B, speaker: REIMU, text: 'story.prologue.s10_r_hungry_b', next: PNODE.S10_H_WAIT },
    [PNODE.S10_H_WAIT]: { id: PNODE.S10_H_WAIT, speaker: HERO, text: 'story.prologue.s10_h_wait', next: PNODE.S10_N_PULL },
    [PNODE.S10_N_PULL]: { ...nar(PNODE.S10_N_PULL, 'story.prologue.s10_n_pull', PNODE.S10_H_LEAVE, true) },
    // 链尾：结束回调进黑场行路
    [PNODE.S10_H_LEAVE]: { id: PNODE.S10_H_LEAVE, speaker: HERO, text: 'story.prologue.s10_h_leave' },

    // —— 黑场行路（全黑压屏：木牌拌嘴 + 两处环境旁白 2 秒自动停顿，脚步循环不停） ——
    [PNODE.WALK_H_A]: { id: PNODE.WALK_H_A, speaker: HERO, text: 'story.prologue.walk_h_a', next: PNODE.WALK_H_B },
    [PNODE.WALK_H_B]: { id: PNODE.WALK_H_B, speaker: HERO, text: 'story.prologue.walk_h_b', next: PNODE.WALK_R_A },
    [PNODE.WALK_R_A]: { id: PNODE.WALK_R_A, speaker: REIMU, text: 'story.prologue.walk_r_a', next: PNODE.WALK_STEP_1 },
    [PNODE.WALK_STEP_1]: {
      ...nar(PNODE.WALK_STEP_1, 'story.prologue.walk_step1', PNODE.WALK_R_B),
      autoNextMs: 2000
    },
    [PNODE.WALK_R_B]: { id: PNODE.WALK_R_B, speaker: REIMU, text: 'story.prologue.walk_r_b', next: PNODE.WALK_STEP_2 },
    [PNODE.WALK_STEP_2]: {
      ...nar(PNODE.WALK_STEP_2, 'story.prologue.walk_step2', PNODE.WALK_R_C),
      autoNextMs: 2000
    },
    // 尾段：竖井吊绳 → 2s 攀爬（音效，末节点结束回调切独立基地显影）
    [PNODE.WALK_R_C]: { id: PNODE.WALK_R_C, speaker: REIMU, text: 'story.prologue.walk_r_c', next: PNODE.WALK_ROPE },
    [PNODE.WALK_ROPE]: {
      ...nar(PNODE.WALK_ROPE, 'story.prologue.walk_rope'),
      autoNextMs: 2000,
      effects: [{ type: 'action', name: 'sfx.ropeClimb' }]
    },

    // —— 基地长对白（走位期间开演；R_PAUSE/N_CHEST 自动停顿；N_* 为无名牌 OS） ——
    // 尾段含设施介绍 → 工具箱开箱 → 仓库介绍+首次自动入库（action 飞行演出）→ 结界守家
    [PNODE.BASE_H_1]: { id: PNODE.BASE_H_1, speaker: HERO, text: 'story.prologue.base_h_1', next: PNODE.BASE_H_2 },
    [PNODE.BASE_H_2]: { id: PNODE.BASE_H_2, speaker: HERO, text: 'story.prologue.base_h_2', next: PNODE.BASE_R_1 },
    [PNODE.BASE_R_1]: { id: PNODE.BASE_R_1, speaker: REIMU, text: 'story.prologue.base_r_1', next: PNODE.BASE_H_3A },
    // 主角连问两句拆开问，灵梦只答第二个（第一个留到心声里回收）
    [PNODE.BASE_H_3A]: { id: PNODE.BASE_H_3A, speaker: HERO, text: 'story.prologue.base_h_3a', next: PNODE.BASE_H_3B },
    [PNODE.BASE_H_3B]: { id: PNODE.BASE_H_3B, speaker: HERO, text: 'story.prologue.base_h_3b', next: PNODE.BASE_R_2 },
    [PNODE.BASE_R_2]: { id: PNODE.BASE_R_2, speaker: REIMU, text: 'story.prologue.base_r_2', next: PNODE.BASE_R_3 },
    [PNODE.BASE_R_3]: { id: PNODE.BASE_R_3, speaker: REIMU, text: 'story.prologue.base_r_3', next: PNODE.BASE_H_4 },
    [PNODE.BASE_H_4]: { id: PNODE.BASE_H_4, speaker: HERO, text: 'story.prologue.base_h_4', next: PNODE.BASE_H_5 },
    [PNODE.BASE_H_5]: { id: PNODE.BASE_H_5, speaker: HERO, text: 'story.prologue.base_h_5', next: PNODE.BASE_R_4 },
    [PNODE.BASE_R_4]: { id: PNODE.BASE_R_4, speaker: REIMU, text: 'story.prologue.base_r_4', next: PNODE.BASE_R_PAUSE },
    [PNODE.BASE_R_PAUSE]: {
      id: PNODE.BASE_R_PAUSE,
      speaker: REIMU,
      text: 'story.prologue.base_r_pause',
      next: PNODE.BASE_R_5,
      autoNextMs: 2000
    },
    [PNODE.BASE_R_5]: { id: PNODE.BASE_R_5, speaker: REIMU, text: 'story.prologue.base_r_5', next: PNODE.BASE_H_6 },
    [PNODE.BASE_H_6]: { id: PNODE.BASE_H_6, speaker: HERO, text: 'story.prologue.base_h_6', next: PNODE.BASE_R_6 },
    [PNODE.BASE_R_6]: { id: PNODE.BASE_R_6, speaker: REIMU, text: 'story.prologue.base_r_6', next: PNODE.BASE_R_6B },
    // 蘑菇之外还有草药"中和一下"——主角吐槽
    [PNODE.BASE_R_6B]: { id: PNODE.BASE_R_6B, speaker: REIMU, text: 'story.prologue.base_r_6b', next: PNODE.BASE_H_6B },
    [PNODE.BASE_H_6B]: { id: PNODE.BASE_H_6B, speaker: HERO, text: 'story.prologue.base_h_6b', next: PNODE.BASE_R_FAC_1 },
    // 设施介绍：锅裂炉废 → 角落工具箱，先把锅修上
    [PNODE.BASE_R_FAC_1]: { id: PNODE.BASE_R_FAC_1, speaker: REIMU, text: 'story.prologue.base_r_fac1', next: PNODE.BASE_R_FAC_2 },
    [PNODE.BASE_R_FAC_2]: { id: PNODE.BASE_R_FAC_2, speaker: REIMU, text: 'story.prologue.base_r_fac2', next: PNODE.BASE_N_CHEST },
    // 开箱过场：1.1s 不可快进 + 吱呀拍灰音效
    [PNODE.BASE_N_CHEST]: {
      ...nar(PNODE.BASE_N_CHEST, 'story.prologue.base_n_chest', PNODE.BASE_H_CHEST, true),
      autoNextMs: 1100,
      effects: [{ type: 'action', name: 'sfx.chestOpen' }]
    },
    [PNODE.BASE_H_CHEST]: { id: PNODE.BASE_H_CHEST, speaker: HERO, text: 'story.prologue.base_h_chest', next: PNODE.BASE_R_CHEST },
    [PNODE.BASE_R_CHEST]: { id: PNODE.BASE_R_CHEST, speaker: REIMU, text: 'story.prologue.base_r_chest', next: PNODE.BASE_R_STORE },
    // 仓库介绍：进场即把背包/快捷栏里的素材自动入库（飞行演出，动作由基地模块注册）
    [PNODE.BASE_R_STORE]: {
      id: PNODE.BASE_R_STORE,
      speaker: REIMU,
      text: 'story.prologue.base_r_store',
      next: PNODE.BASE_R_STORE_2,
      effects: [{ type: 'action', name: 'base.prologueStore' }]
    },
    [PNODE.BASE_R_STORE_2]: { id: PNODE.BASE_R_STORE_2, speaker: REIMU, text: 'story.prologue.base_r_store2', next: PNODE.BASE_R_BARRIER },
    [PNODE.BASE_R_BARRIER]: { id: PNODE.BASE_R_BARRIER, speaker: REIMU, text: 'story.prologue.base_r_barrier', next: PNODE.BASE_R_GO },
    [PNODE.BASE_R_GO]: { id: PNODE.BASE_R_GO, speaker: REIMU, text: 'story.prologue.base_r_go', next: PNODE.BASE_N_1 },
    [PNODE.BASE_N_1]: { ...nar(PNODE.BASE_N_1, 'story.prologue.base_n_1', PNODE.BASE_N_2, true) },
    [PNODE.BASE_N_2]: { ...nar(PNODE.BASE_N_2, 'story.prologue.base_n_2', undefined, true) }
  }
}

// 拖行 CG 只配合「被她一把拉走」旁白，前后的角色对白不展示 CG。
bindStoryCG(prologueTree, [PNODE.S10_N_PULL], storyCGs.reimuPull)
