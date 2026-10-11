import { RandomStreams } from '../../core/simulation/random'
import { weightedPick } from '../../content/core/Registry'
import { lootTables } from '../../content/loot/registry'
import { resolveSearchRules, searchItemWeight } from '../../content/search/rules'
import type { ResolvedSearchRules } from '../../content/search/types'
import { getItemDef } from '../../shared/itemDefs'
import { itemStack,type Slot } from '../../shared/inventory'
import type { SearchPlacement } from '../../shared/search'

/** 按整块矩形检查占用，只有原方向放不下时才尝试旋转。 */
export function findSearchPlacement(grid:Uint8Array,cols:number,rows:number,width:number,height:number):SearchPlacement|null {
  for(const rotated of width===height?[false]:[false,true]){
    const w=rotated?height:width,h=rotated?width:height
    for(let y=0;y+h<=rows;y++)for(let x=0;x+w<=cols;x++){
      let fits=true
      for(let yy=y;fits&&yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)if(grid[yy*cols+xx]){fits=false;break}
      if(fits)return {x,y,width:w,height:h,rotated}
    }
  }
  return null
}
function footprint(id:string):readonly [number,number] {
  const size=getItemDef(id).searchFootprint??[1,1]
  return [Math.max(1,Math.floor(size[0])),Math.max(1,Math.floor(size[1]))]
}

/** 局部种子只归该容器所有；先搜哪个、搜到一半退出都不改变其他容器的奖励。 */
export function createSearchContents(table:string,cols:number,rows:number,seed:number,resolved?:ResolvedSearchRules):{slots:Slot[];placements:SearchPlacement[]} {
  const streams=new RandomStreams(seed),rng=()=>streams.next('loot'),grid=new Uint8Array(cols*rows)
  const rules=resolved??resolveSearchRules({floor:1},cols===2?'small':cols===3?'large':'chest','',table)
  const slots:Slot[]=[],placements:SearchPlacement[]=[]
  if(!rules.guaranteedTable&&rules.emptyChance>0&&rng()<rules.emptyChance)return {slots,placements}
  // 小数按其概率补一堆，不用向上取整偷偷放大低倍率；所有随机只消费容器自身种子。
  const round=(value:number)=>{const base=Math.floor(Math.max(0,value));return base+(value-base>0&&rng()<value-base?1:0)}
  const baseCount=weightedPick(rules.counts,entry=>entry.weight,rng)?.count??0
  const count=Math.min(grid.length,Math.max(rules.guaranteedTable?1:0,round(Math.max(0,baseCount*rules.abundance+rules.extraRolls))))
  const candidates=(id:string)=>(lootTables.get(id)?.entries??[]).map(entry=>({entry,item:getItemDef(entry.item)}))
    .map(candidate=>({...candidate,weight:searchItemWeight(candidate.entry.weight,candidate.item,rules)}))
    .filter(candidate=>candidate.weight>0)
  const pool=candidates(rules.table),guaranteed=rules.guaranteedTable?candidates(rules.guaranteedTable):[]
  const available=(entries:typeof pool)=>entries.filter(candidate=>{const [w,h]=footprint(candidate.entry.item);return findSearchPlacement(grid,cols,rows,w,h)!==null})
  for(let i=0;i<count;i++){
    // 只抽当前能放下的物品；不会先抽出稀有奖励再因拥挤而把它吞掉。
    const first=i===0?available(guaranteed):[]
    const picked=weightedPick(first.length?first:available(pool),candidate=>candidate.weight,rng)
    if(!picked)break
    // 同一容器内不放回抽取，同名物品只占一堆；其他容器仍可再次抽到。
    for(let index=pool.length-1;index>=0;index--)if(pool[index]!.entry.item===picked.entry.item)pool.splice(index,1)
    const quantity=picked.entry.min+Math.floor(rng()*(picked.entry.max-picked.entry.min+1))
    // 数量倍率只作用于可堆叠物品，武器饰品不会被塞成一堆多件装备。
    const qty=Math.max(first.length?1:0,picked.item.maxStack>1?round(quantity*rules.quantityMultiplier):quantity)
    if(qty<=0)continue
    const [w,h]=footprint(picked.entry.item),position=findSearchPlacement(grid,cols,rows,w,h)!
    for(let y=position.y;y<position.y+position.height;y++)for(let x=position.x;x<position.x+position.width;x++)grid[y*cols+x]=1
    slots.push(itemStack(picked.entry.item,qty));placements.push(position)
  }
  // 搜索顺序按左上角排列，与画面阅读方向一致，不改变抽取结果。
  const order=placements.map((position,index)=>({position,index})).sort((a,b)=>a.position.y-b.position.y||a.position.x-b.position.x)
  return {slots:order.map(entry=>slots[entry.index]!),placements:order.map(entry=>entry.position)}
}
