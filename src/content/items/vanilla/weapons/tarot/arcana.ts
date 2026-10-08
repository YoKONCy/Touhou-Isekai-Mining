/** 二十二张大阿尔卡纳等概率抽取；同一次三向发射共用一张抽牌结果。 */
export const ARCANA = [
  'fool', 'magician', 'priestess', 'empress', 'emperor', 'hierophant', 'lovers', 'chariot',
  'strength', 'hermit', 'wheel', 'justice', 'hanged', 'death', 'temperance', 'devil',
  'tower', 'star', 'moon', 'sun', 'judgement', 'world'
] as const
export type Arcana = typeof ARCANA[number]
export const arcanaNameKey = (card: Arcana): string => `tarot.${card}.name`
export const arcanaDescriptionKey = (card: Arcana): string => `tarot.${card}.desc`
