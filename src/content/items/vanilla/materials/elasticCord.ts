import { svgIcon,type ItemDef } from '../../types'
import { ELASTIC_CORD_ID } from '../ids'
export default {
  id:ELASTIC_CORD_ID,kind:'material',tier:1,maxStack:9999,color:'#867459',hi:'#d9c7a5',text:'#d8c3a1',
  icon:svgIcon('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M17 45C4 27 11 11 28 13C49 13 58 35 43 48C30 59 12 50 17 30C21 18 39 19 43 31C47 45 26 53 23 38C20 27 35 25 38 34" fill="none" stroke="#3c3036" stroke-width="6" stroke-linecap="round"/><path d="M17 45C4 27 11 11 28 13C49 13 58 35 43 48C30 59 12 50 17 30C21 18 39 19 43 31C47 45 26 53 23 38C20 27 35 25 38 34" fill="none" stroke="#b7a17b" stroke-width="3.5"/><path d="m14 21 3 2m-5 8 4 1m8-17 1 4m11 1-2 3m14 13-4-1m-8 14-1-4m-16-2 3-2" stroke="#e3d5b2" stroke-width="1.3"/><path d="M17 45Q7 53 8 57" fill="none" stroke="#978164" stroke-width="3"/></svg>'),
  tags:['fiber','crafting','elastic']
} satisfies ItemDef
