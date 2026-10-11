let readOnlyDepth = 0
const reasons=new Set<string>()
export const simulationReadOnly = (): boolean => readOnlyDepth > 0 || reasons.size > 0
export function setSimulationReadOnly(reason:string,enabled:boolean):void{
  if(enabled)reasons.add(reason);else reasons.delete(reason)
}
/** 回放或无头演练不覆盖玩家真实的检查点存档。 */
export function withoutPersistence<T>(work: () => T): T {
  readOnlyDepth++
  try { return work() } finally { readOnlyDepth-- }
}
