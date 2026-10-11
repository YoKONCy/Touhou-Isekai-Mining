import { profiler } from '../performance/Profiler'
import { compactLayout } from '../../browser/display'
/** 保存玩法状态，按最近使用顺序释放可重建的离屏像素。 */
class ResourceBudget {
  private entries=new Map<object,{bytes:number;used:number;release:()=>void}>()
  private clock=0
  private bytes=0
  get limit():number { return (compactLayout.value?64:160)*1024*1024 }
  touch(owner:object,bytes:number,release:()=>void):void {
    const entry=this.entries.get(owner)
    if(entry){this.bytes+=bytes-entry.bytes;entry.bytes=bytes;entry.used=++this.clock}
    else {this.entries.set(owner,{bytes,used:++this.clock,release});this.bytes+=bytes}
    while(this.bytes>this.limit&&this.entries.size>1){
      let oldest:object|undefined,used=Infinity
      for(const [candidate,data] of this.entries)if(candidate!==owner&&data.used<used){oldest=candidate;used=data.used}
      if(!oldest)break
      this.release(oldest);profiler.increment('roomEvictions')
    }
    profiler.count('roomRasterMiB',this.bytes/1024/1024)
  }
  release(owner:object):void {
    const entry=this.entries.get(owner);if(!entry)return
    this.entries.delete(owner);this.bytes-=entry.bytes;entry.release()
  }
}
export const roomResourceBudget=new ResourceBudget()
