/**
 * 官方敌人 id 汇总桶（引擎需要点名引用具体官方怪时从这里取）
 *
 * 注意：敌人 def 只允许单向引用弹幕/矿物 id 桶，禁止反向 import 本桶，
 * 避免重蹈物品↔矿物 id 桶 re-export 成环的运行时 TDZ。
 */
export { SLIME_BLUE_ID } from './slimeBlue'
export { VENOM_GREEN_ID } from './venomGreen'
export { SLIME_RED_ID } from './slimeRed'
export { KEDAMA_ID } from './kedama'
export { GUARDIAN_SLIME_ID } from './guardianSlime'
