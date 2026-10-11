export type RandomDomain = 'generation' | 'combat' | 'loot' | 'story' | 'visual' | 'audio'
export interface RandomSnapshot { seed: number; states: Record<RandomDomain, number> }
const domains: readonly RandomDomain[] = ['generation', 'combat', 'loot', 'story', 'visual', 'audio']

/** 无平台依赖的独立随机流；表现层消耗随机数不会改变地图、暴击或掉落。 */
export class RandomStreams {
  readonly seed: number
  private states: Record<RandomDomain, number>
  constructor(seed: number) {
    this.seed = seed >>> 0
    this.states = Object.fromEntries(domains.map((key, i) => [key, (this.seed ^ Math.imul(i + 1, 0x9e3779b9)) >>> 0])) as Record<RandomDomain, number>
  }
  next(domain: RandomDomain): number {
    const state = this.states[domain] = (this.states[domain] + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ state >>> 15, state | 1)
    value ^= value + Math.imul(value ^ value >>> 7, value | 61)
    return ((value ^ value >>> 14) >>> 0) / 4294967296
  }
  snapshot(): RandomSnapshot { return { seed: this.seed, states: { ...this.states } } }
  restore(snapshot: RandomSnapshot): void {
    if (snapshot.seed !== this.seed || domains.some(key => !Number.isInteger(snapshot.states[key]))) throw new Error('随机流快照与当前会话不兼容')
    this.states = { ...snapshot.states }
  }
}

export function createSeed(): number {
  const values = new Uint32Array(1)
  if (globalThis.crypto?.getRandomValues) return globalThis.crypto.getRandomValues(values)[0]!
  return Date.now() >>> 0
}
const fallback = new RandomStreams(createSeed())
let active: RandomStreams = fallback
let generationOverride:RandomStreams|null=null
let visualOverride:RandomStreams|null=null
/** 重建贴图使用局部视觉种子，不消耗会话的任何随机流。 */
export function withVisualSeed<T>(seed:number,work:()=>T):T {
  const previous=visualOverride;visualOverride=new RandomStreams(seed)
  try{return work()}finally{visualOverride=previous}
}
/** 房间随机流独立于访问顺序；实际入口留空仍由房间生成参数决定。 */
export function withGenerationSeed<T>(seed:number,work:()=>T):T{
  const previous=generationOverride;generationOverride=new RandomStreams(seed)
  try{return work()}finally{generationOverride=previous}
}
/** 上下文只覆盖同步模拟调用，多个无头会话可以交错推进而不串流。 */
export function withRandomStreams<T>(streams: RandomStreams, work: () => T): T {
  const previous = active; active = streams
  try { return work() } finally { active = previous }
}
export const randomGeneration = (): number => (generationOverride??active).next('generation')
export const randomCombat = (): number => active.next('combat')
export const randomLoot = (): number => active.next('loot')
export const randomStory = (): number => active.next('story')
export const randomVisual = (): number => (visualOverride??active).next('visual')
export const randomAudio = (): number => active.next('audio')
