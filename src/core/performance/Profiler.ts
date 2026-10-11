/** 可选诊断只记录提交端耗时，默认关闭，不参与模拟、录像或存档。 */
class Profiler {
  enabled=false
  suspended=false
  private sections=new Map<string,{current:number;history:Float64Array;count:number;cursor:number}>()
  private counters=new Map<string,number>()
  reset():void {this.sections.clear();this.counters.clear()}
  setEnabled(value:boolean):void {if(value&&!this.enabled)this.reset();this.enabled=value}
  beginFrame():void {if(this.enabled&&!this.suspended)this.counters.clear()}
  start():number{return this.enabled&&!this.suspended?performance.now():0}
  end(name:string,start:number):void {
    if(!this.enabled||this.suspended)return
    this.addCurrent(name,performance.now()-start)
  }
  private addCurrent(name:string,value:number):void {
    let section=this.sections.get(name)
    if(!section){section={current:0,history:new Float64Array(240),count:0,cursor:0};this.sections.set(name,section)}
    section.current+=value
  }
  count(name:string,value:number):void {if(this.enabled&&!this.suspended)this.counters.set(name,value)}
  increment(name:string,value=1):void {if(this.enabled&&!this.suspended)this.counters.set(name,(this.counters.get(name)??0)+value)}
  finishFrame(interval:number):void {
    if(!this.enabled||this.suspended)return
    this.count('frameMs',interval*1000)
    this.addCurrent('frame',interval*1000)
    for(const section of this.sections.values()){
      section.history[section.cursor]=section.current;section.current=0
      section.cursor=(section.cursor+1)%section.history.length;section.count=Math.min(section.count+1,section.history.length)
    }
  }
  snapshot():{sections:Array<{name:string;mean:number;p95:number}>;counters:Record<string,number>} {
    const sections=[]
    for(const [name,section] of this.sections){
      const values=Array.from(section.history.subarray(0,section.count)).sort((a,b)=>a-b)
      sections.push({name,mean:values.length?values.reduce((a,b)=>a+b,0)/values.length:0,p95:values[Math.max(0,Math.ceil(values.length*.95)-1)]??0})
    }
    return {sections,counters:Object.fromEntries(this.counters)}
  }
}
export const profiler=new Profiler()
