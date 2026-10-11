export type EntityId = string
export type SimulationEvent =
  | { type: 'damage'; target: EntityId; amount: number; kind: string }
  | { type: 'death'; target: EntityId }
  | { type: 'heal'; target: EntityId; amount: number }
  | { type: 'shot'; source: EntityId; weapon: string }
  | { type: 'pickup'; source: EntityId; item: string; quantity: number; collector?: EntityId }
  | { type: 'clear'; room: number }
export interface TimedEvent { tick: number; sequence: number; event: SimulationEvent }
export class SimulationEvents {
  private sequence = 0
  private pending: TimedEvent[] = []
  get serial():number{return this.sequence}
  restoreSerial(sequence:number):void{
    if(!Number.isSafeInteger(sequence)||sequence<0)throw new Error('事件序号快照无效')
    this.sequence=sequence;this.clear()
  }
  emit(tick: number, event: SimulationEvent): void { this.pending.push({ tick, sequence: ++this.sequence, event }) }
  drain(): TimedEvent[] { const events = this.pending; this.pending = []; return events }
  clear(): void { this.pending = [] }
}
export interface SimulationScope { tick: number; nextId(kind: string): EntityId; events: SimulationEvents }
let current: SimulationScope | null = null
let fallbackId = 0
export function withSimulationScope<T>(scope: SimulationScope, work: () => T): T {
  const previous = current; current = scope
  try { return work() } finally { current = previous }
}
export function nextEntityId(kind: string): EntityId { return current?.nextId(kind) ?? `${kind}:local:${++fallbackId}` }
export function emitSimulationEvent(event: SimulationEvent): void { current?.events.emit(current.tick, event) }
