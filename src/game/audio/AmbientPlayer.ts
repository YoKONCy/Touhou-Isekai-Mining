/** 环境实例统一生命周期：工厂只负责声音配方，组件负责幂等启停和释放。 */
export interface AmbientHandle { stop(): void }
export class AmbientPlayer {
  private factories = new Map<string, () => AmbientHandle | null>()
  private wanted = new Set<string>()
  private active = new Map<string, AmbientHandle>()
  register(id: string, create: () => AmbientHandle | null): void { this.factories.set(id, create) }
  set(id: string, enabled: boolean): void {
    if (enabled) this.wanted.add(id)
    else {
      this.wanted.delete(id)
      this.active.get(id)?.stop(); this.active.delete(id)
    }
    this.sync()
  }
  sync(): void {
    for (const id of this.wanted) {
      if (this.active.has(id)) continue
      const handle = this.factories.get(id)?.()
      if (handle) this.active.set(id, handle)
    }
  }
  dispose(): void {
    this.wanted.clear()
    for (const handle of this.active.values()) handle.stop()
    this.active.clear()
  }
}
