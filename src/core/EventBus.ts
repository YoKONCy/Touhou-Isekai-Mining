/**
 * 极简类型安全事件总线
 * 跨模块（矿洞 ↔ 未来据点/大世界）与 UI ↔ 玩法之间的唯一通信通道：
 * 模块之间禁止互相 import，一切跨模块调用走事件 + 模块切换（一核多模铁律）。
 */
export type EventHandler<T = unknown> = (payload: T) => void

export class EventBus<EventMap extends object = Record<string, unknown>> {
  private handlers = new Map<keyof EventMap, Set<EventHandler>>()

  /** 订阅事件，返回取消订阅函数 */
  on<K extends keyof EventMap>(type: K, fn: EventHandler<EventMap[K]>): () => void {
    let set = this.handlers.get(type)
    if (!set) {
      set = new Set()
      this.handlers.set(type, set)
    }
    set.add(fn as EventHandler)
    return () => this.off(type, fn)
  }

  off<K extends keyof EventMap>(type: K, fn: EventHandler<EventMap[K]>): void {
    this.handlers.get(type)?.delete(fn as EventHandler)
  }

  emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
    const set = this.handlers.get(type)
    if (!set) return
    // 拷贝一份：回调内允许自行退订，不会炸迭代器
    for (const fn of [...set]) {
      ;(fn as EventHandler<EventMap[K]>)(payload)
    }
  }
}
