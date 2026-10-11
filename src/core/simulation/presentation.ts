/** 表现请求在逻辑步完成后播放；无头模拟只丢弃表现，不替换战斗代码。 */
let sink: Array<() => void> | null = null
let headless = false
export const isHeadless = (): boolean => headless
export function presentationRequest(play: () => void): void {
  if (headless) return
  if (sink) sink.push(play)
  else play()
}
export function withoutPresentation<T>(work: () => T): T {
  const previous = headless; headless = true
  try { return work() } finally { headless = previous }
}
export function withPresentationQueue<T>(work: () => T): T {
  if (sink || headless) return work()
  const queued: Array<() => void> = []; sink = queued
  let result: T
  try { result = work() } finally { sink = null }
  for (const play of queued) play()
  return result
}
