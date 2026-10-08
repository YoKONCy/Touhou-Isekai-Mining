import { LEATHER_ARMOR_ID } from '../ids'
import { stats } from './leatherArmorStats'
import { svgIcon, type ItemDef } from '../../types'

const def: ItemDef = {
  ...stats,
  id: LEATHER_ARMOR_ID,
  kind: 'armor',
  color: '#94613d',
  hi: '#cca879',
  text: '#cca879',
  // 叠片皮背心：领口内衬、肩部缝线、腰带黄铜扣与不对称磨痕。
  icon: svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="leatherBody" x2=".8" y2="1"><stop stop-color="#b39770"/><stop offset=".27" stop-color="#896445"/><stop offset=".6" stop-color="#674832"/><stop offset="1" stop-color="#3f3027"/></linearGradient><linearGradient id="leatherPanel"><stop stop-color="#977451"/><stop offset=".5" stop-color="#6e4e36"/><stop offset="1" stop-color="#453227"/></linearGradient><linearGradient id="leatherBrass" x2=".4" y2="1"><stop stop-color="#d2bd83"/><stop offset=".5" stop-color="#907749"/><stop offset="1" stop-color="#51432f"/></linearGradient></defs><path d="m18 7 9-3h10l9 3 11 12-9 9-2 29-14 3-14-3-2-29-9-9Z" fill="url(#leatherBody)" stroke="#2a211b" stroke-width="1.8"/><path d="M25 5Q25 19 32 20Q39 19 39 5L35 4h-6Z" fill="#342922" stroke="#baa17c" stroke-width="1.3"/><path d="m18 8-8 12 6 5 7-13m23-4 8 12-6 5-7-13" fill="#644a35" stroke="#b29970" stroke-width=".8"/><path d="M19 22 29 20V38L19 35ZM35 20 45 22V35L35 38Z" fill="url(#leatherPanel)" stroke="#3d2c22"/><path d="m20 40 10 2v14l-11-2Zm14 2 10-2 1 14-11 2Z" fill="url(#leatherPanel)" stroke="#3d2c22"/><path d="M31 21V58M17 36Q32 42 47 36L47 42Q32 48 17 42Z" fill="#362a22" stroke="#241c17"/><path d="M17 37Q32 43 47 37" fill="none" stroke="#a98c62" stroke-width=".8"/><rect x="28" y="37" width="9" height="8" rx="1" fill="url(#leatherBrass)" stroke="#29231b"/><rect x="30" y="39" width="5" height="4" fill="#423326"/><path d="M32 39v5" stroke="#c5ae75"/><g fill="none" stroke="#c0a780" stroke-width=".7" stroke-dasharray="1.5 2"><path d="m17 10-5 9 4 3m31-12 5 9-4 3M20 24l7-2v13l-7-2m17-11 6 2v9l-6 2M20 45v7l8 2m8 0 7-2v-7"/></g><path d="m21 28 4-1m-3 4 2-1m16 18 3-2m-2-21 2 1m-17 28 3 1" stroke="#b69a74" stroke-width=".8"/><g fill="#ab956a" stroke="#3b2c22" stroke-width=".5"><circle cx="20" cy="18" r="1"/><circle cx="44" cy="18" r="1"/><circle cx="21" cy="49" r=".8"/><circle cx="43" cy="49" r=".8"/></g></svg>`), tags: ['armor']
}
export default def
