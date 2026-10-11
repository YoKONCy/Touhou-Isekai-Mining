/** 预输入只保存短窗口意图，按模拟时间过期，暂停时不会消耗。 */
export class ActionBuffer {
  private readonly pending = new Map<string, number>()
  update(dt: number): void {
    for(const [action,time] of this.pending){const remaining=time-dt;if(remaining<=0)this.pending.delete(action);else this.pending.set(action,remaining)}
  }
  offer(action:string,seconds=.1):void { this.pending.set(action,seconds) }
  consume(action:string):boolean { return this.pending.delete(action) }
  has(action:string):boolean { return this.pending.has(action) }
  clear():void { this.pending.clear() }
}
