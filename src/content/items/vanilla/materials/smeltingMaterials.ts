import { svgIcon,type ItemDef } from '../../types'
import { SILICA_SAND_ID,GLASS_ID,GOLD_INGOT_ID } from '../ids'

const sand:ItemDef={
  id:SILICA_SAND_ID,kind:'material',maxStack:9999,color:'#bca688',hi:'#eee0bd',text:'#d8c5a1',tags:['mineral','sand'],
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M5 36L12 31L15 22L22 19L28 24L35 25L42 36L36 41L13 42Z" fill="#9f8a6d" stroke="#3a3339" stroke-width="1.3"/><path d="M5 36L15 32L18 24L22 21L28 28L34 27L40 36L26 38L14 37Z" fill="#d9c5a0"/><path d="M8 36L19 34L24 37L36 35" fill="none" stroke="#f0e1bb" stroke-width="1.1"/><path d="M17 27L20 25L22 28L19 30ZM28 32L31 30L33 33L29 34ZM11 33L13 31L15 34Z" fill="#eee2c5"/><path d="M22 32H24M33 37H35M13 39H15M25 40H27" stroke="#796d60" stroke-width="1"/></svg>')
}
const glass:ItemDef={
  id:GLASS_ID,kind:'material',maxStack:9999,color:'#92b5be',hi:'#e4f0e4',text:'#c5dbd8',tags:['glass','smelted'],
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M11 8L35 6L40 35L15 43L8 27Z" fill="#60818e88" stroke="#354251" stroke-width="1.4"/><path d="M11 8L35 6L36 11L15 14L12 33L8 27Z" fill="#b9d9dc"/><path d="M15 14L36 11L39 34L16 40Z" fill="#b4d4cf99"/><path d="M17 17L29 13L19 31ZM27 33L35 18L36 26Z" fill="#edf3dfb3"/><path d="M15 14L16 40L39 34M13 9L33 8" fill="none" stroke="#e4f2e7" stroke-width="1"/></svg>')
}
const gold:ItemDef={
  id:GOLD_INGOT_ID,kind:'material',maxStack:9999,color:'#b39350',hi:'#f0d69a',text:'#dfc58b',tags:['metal','smelted'],
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M7 28L13 18L31 12L42 22L38 34L20 40Z" fill="#9a7741" stroke="#37303a" stroke-width="1.3"/><path d="M13 18L31 12L42 22L23 29L7 28Z" fill="#e4c783"/><path d="M23 29L42 22L38 34L20 40Z" fill="#b99451"/><path d="M8 28L23 29L20 40L10 35Z" fill="#866637"/><path d="M16 19L30 15L36 21M25 32L35 28" fill="none" stroke="#fae8b5" stroke-width="1.3"/><path d="M19 23L27 20L31 23L24 26Z" fill="#ba9858" stroke="#a08149" stroke-width=".7"/></svg>')
}
export const smeltingMaterials=[sand,glass,gold]
