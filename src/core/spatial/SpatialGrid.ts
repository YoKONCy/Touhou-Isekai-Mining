/** 网格只缩小候选集，精确碰撞仍由调用方负责；结果按原插入顺序输出。 */
export class SpatialGrid<T extends object> {
  private buckets=new Map<number,Map<number,number[]>>()
  private indices=new WeakMap<T,number>()
  private activeBuckets:number[][]=[]
  private items:T[]=[]
  private seen:number[]=[]
  private stamp=0
  private candidates:number[]=[]
  private lefts:number[]=[];private tops:number[]=[];private rights:number[]=[];private bottoms:number[]=[]
  constructor(readonly cellSize=96){if(!Number.isFinite(cellSize)||cellSize<=0)throw new Error('空间网格单元尺寸无效')}
  clear():void {for(const bucket of this.activeBuckets)bucket.length=0;this.activeBuckets.length=0;this.items.length=0}
  insert(item:T,left:number,top:number,right:number,bottom:number):void {
    if(!Number.isFinite(left)||!Number.isFinite(top)||!Number.isFinite(right)||!Number.isFinite(bottom)||left>right||top>bottom)return
    const index=this.items.length;this.items.push(item)
    this.indices.set(item,index)
    this.lefts[index]=left;this.tops[index]=top;this.rights[index]=right;this.bottoms[index]=bottom
    this.addIndex(index,left,top,right,bottom)
  }
  private addIndex(index:number,left:number,top:number,right:number,bottom:number):void {
    for(let y=Math.floor(top/this.cellSize);y<=Math.floor(bottom/this.cellSize);y++){
      let row=this.buckets.get(y);if(!row){row=new Map();this.buckets.set(y,row)}
      for(let x=Math.floor(left/this.cellSize);x<=Math.floor(right/this.cellSize);x++){
      let bucket=row.get(x)
      if(!bucket){bucket=[];row.set(x,bucket)}
      if(!bucket.length)this.activeBuckets.push(bucket)
      bucket.push(index)
      }
    }
  }
  update(item:T,left:number,top:number,right:number,bottom:number):void {
    if(!Number.isFinite(left)||!Number.isFinite(top)||!Number.isFinite(right)||!Number.isFinite(bottom)||left>right||top>bottom)return
    const index=this.indices.get(item);if(index===undefined||this.items[index]!==item)return
    const cell=this.cellSize,oldL=Math.floor(this.lefts[index]/cell),oldT=Math.floor(this.tops[index]/cell),oldR=Math.floor(this.rights[index]/cell),oldB=Math.floor(this.bottoms[index]/cell)
    this.lefts[index]=left;this.tops[index]=top;this.rights[index]=right;this.bottoms[index]=bottom
    if(oldL===Math.floor(left/cell)&&oldT===Math.floor(top/cell)&&oldR===Math.floor(right/cell)&&oldB===Math.floor(bottom/cell))return
    for(let y=oldT;y<=oldB;y++)for(let x=oldL;x<=oldR;x++){const bucket=this.buckets.get(y)?.get(x);if(!bucket)continue;const position=bucket.indexOf(index);if(position>=0)bucket.splice(position,1)}
    this.addIndex(index,left,top,right,bottom)
  }
  query(left:number,top:number,right:number,bottom:number,out:T[]):readonly T[] {
    out.length=0;this.candidates.length=0
    if(!Number.isFinite(left)||!Number.isFinite(top)||!Number.isFinite(right)||!Number.isFinite(bottom)||left>right||top>bottom)return out
    if(++this.stamp>=Number.MAX_SAFE_INTEGER){this.seen.length=0;this.stamp=1}
    for(let y=Math.floor(top/this.cellSize);y<=Math.floor(bottom/this.cellSize);y++){
      const row=this.buckets.get(y);if(!row)continue
      for(let x=Math.floor(left/this.cellSize);x<=Math.floor(right/this.cellSize);x++){
      const bucket=row.get(x);if(!bucket)continue
      for(const index of bucket)if(this.seen[index]!==this.stamp){this.seen[index]=this.stamp;this.candidates.push(index)}
      }
    }
    if(this.candidates.length>1)this.candidates.sort((a,b)=>a-b)
    for(const index of this.candidates)out.push(this.items[index])
    return out
  }
}
