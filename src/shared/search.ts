export type SearchFeedback = 'ordinary' | 'equipment' | 'rare' | 'legendary'
/** 非负编号为拿取整件物品，-1 拿取已揭示内容，-2 关闭，-3 继续翻找。 */
export interface SearchCommand { playerId: string; containerId: string; slot: number }
export interface SearchView {
  id: string
  nameKey: string
  cols:number
  rows:number
  opening:number
  active: number
  progress: number
  complete: boolean
  searching: boolean
  blocked: boolean
  slots: Array<SearchPlacement & { revealed: boolean; item: { id: string; qty: number;durability?:number } | null; age: number; feedback: SearchFeedback;quality:number;prismatic:boolean }>
}
export interface SearchPlacement {x:number;y:number;width:number;height:number;rotated:boolean}
