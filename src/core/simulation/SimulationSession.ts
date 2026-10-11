import { RandomStreams, createSeed, withRandomStreams, type RandomSnapshot } from './random'
import { SimulationEvents, withSimulationScope, type SimulationScope, type TimedEvent } from './events'
import type { InputCommand } from './InputCommand'
import { FixedStep } from './FixedStep'
import { withoutPresentation } from './presentation'
import { withoutPersistence } from './persistence'
let activeSession:SimulationSession|null=null

export const SIMULATION_VERSION = 1
export interface SessionSnapshot { version: number; tick: number; entitySequence: number; eventSequence: number; random: RandomSnapshot }
export interface ReplayCheckpoint<S> { offset: number; state: S; session: SessionSnapshot; checksum: string }
export interface SimulationReplay<S> {
  version: number; contentVersion: string; dt: number
  initial: S; session: SessionSnapshot
  commands: InputCommand[]; checkpoints: ReplayCheckpoint<S>[]
}

/** 浏览器、录像和无头驱动共用会话；不持有画布、音频或真实时间。 */
export class SimulationSession implements SimulationScope {
  tick = 0
  private entitySequence = 0
  readonly random: RandomStreams
  readonly events = new SimulationEvents()
  onEvents: ((events: readonly TimedEvent[]) => void) | null = null
  constructor(seed = createSeed()) { this.random = new RandomStreams(seed) }
  nextId(kind: string): string { return `${this.random.seed.toString(16)}:${kind}:${++this.entitySequence}` }
  run<T>(work: () => T): T {
    const previous=activeSession;activeSession=this
    try{return withSimulationScope(this, () => withRandomStreams(this.random, work))}finally{activeSession=previous}
  }
  step(work: () => void): void {
    this.tick++
    this.run(work)
    const events = this.events.drain()
    if (events.length) this.onEvents?.(events)
  }
  snapshot(): SessionSnapshot { return { version: SIMULATION_VERSION, tick: this.tick, entitySequence: this.entitySequence, eventSequence:this.events.serial, random: this.random.snapshot() } }
  restore(snapshot: SessionSnapshot): void {
    if (snapshot.version !== SIMULATION_VERSION || !Number.isSafeInteger(snapshot.tick) || snapshot.tick < 0 || !Number.isSafeInteger(snapshot.entitySequence) || snapshot.entitySequence < 0) throw new Error('模拟会话版本或计数无效')
    this.random.restore(snapshot.random); this.tick = snapshot.tick; this.entitySequence = snapshot.entitySequence; this.events.restoreSerial(snapshot.eventSequence)
  }
}

/** 重建实例会执行构造器，但恢复快照不能消耗新的随机数或占用实体序号。 */
export function preserveSimulationContext<T>(work:()=>T):T{
  const session=activeSession,snapshot=session?.snapshot()
  try{return work()}finally{if(session&&snapshot)session.restore(snapshot)}
}

/** 字段稳定排序后校验，不能把函数、类对象或表现缓存塞进录像。 */
export function stateChecksum(state: unknown): string {
  const canonical = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
    const object = value as Record<string, unknown>
    return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(',')}}`
  }
  let hash = 2166136261
  for (const c of canonical(state)) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 画面和音频允许独立重绘；确定性校验只比较能改变玩法的随机流。 */
export function sessionChecksum(snapshot: SessionSnapshot): string {
  const { generation, combat, loot, story } = snapshot.random.states
  return stateChecksum({ ...snapshot, random: { seed: snapshot.random.seed, states: { generation, combat, loot, story } } })
}

export class ReplayRecorder<S> {
  private replay: SimulationReplay<S> | null = null
  start(state: S, session: SessionSnapshot, contentVersion: string): void {
    this.replay = { version: SIMULATION_VERSION, contentVersion, dt: FixedStep.DT, initial: structuredClone(state), session: structuredClone(session), commands: [], checkpoints: [] }
  }
  get recording(): boolean { return this.replay !== null }
  record(command: InputCommand): void { this.replay?.commands.push(structuredClone(command)) }
  checkpoint(state: S, session: SessionSnapshot): void {
    if (!this.replay) return
    this.replay.checkpoints.push({ offset: this.replay.commands.length, state: structuredClone(state), session: structuredClone(session), checksum: stateChecksum(state) })
  }
  finish(): SimulationReplay<S> | null { const replay = this.replay; this.replay = null; return replay }
}

export interface HeadlessAdapter<S> {
  restore(state: S): void
  snapshot(): S
  update(dt: number, command: InputCommand): void
}
/** 同一套适配器既可逐帧回放，也可不渲染连续运行；调用者可按批次主动让出线程。 */
export function replayHeadless<S>(replay: SimulationReplay<S>, contentVersion: string, adapter: HeadlessAdapter<S>): { state: S; checksum: string } {
  return withoutPersistence(()=>withoutPresentation(()=>runHeadlessReplay(replay,contentVersion,adapter)))
}
function runHeadlessReplay<S>(replay: SimulationReplay<S>, contentVersion: string, adapter: HeadlessAdapter<S>): { state: S; checksum: string } {
  if (replay.version !== SIMULATION_VERSION || replay.contentVersion !== contentVersion || replay.dt !== FixedStep.DT) throw new Error('录像与当前模拟或内容版本不兼容')
  const session = new SimulationSession(replay.session.random.seed)
  session.run(() => adapter.restore(structuredClone(replay.initial)))
  session.restore(replay.session)
  for (let offset = 0; offset < replay.commands.length; offset++) {
    const command = replay.commands[offset]!
    if (command.tick !== session.tick + 1) throw new Error('录像输入时序不连续')
    session.step(() => adapter.update(replay.dt, command))
    const checkpoint = replay.checkpoints.find(c => c.offset === offset + 1)
    if (checkpoint && (stateChecksum(adapter.snapshot()) !== checkpoint.checksum || sessionChecksum(session.snapshot()) !== sessionChecksum(checkpoint.session))) throw new Error(`录像在第 ${command.tick} 个逻辑帧发生偏离`)
  }
  const state = adapter.snapshot()
  return { state, checksum: stateChecksum(state) }
}
