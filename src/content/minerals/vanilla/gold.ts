/**
 * 官方矿种：金矿（稀有矿种，暖金光与晶顶星点，碎矿掉落 touhou:ore_gold）
 */
import { ORE_GOLD_ID } from '../../items/vanilla/ids'
import { MINERAL_GOLD_ID } from './ids'
import type { MineralDef } from '../types'

const def: MineralDef = {
  id: MINERAL_GOLD_ID,
  dropItemId: ORE_GOLD_ID,
  hp: [120, 150],
  requiredMiningPower: 1,
  palette: {
    base: '#57515d',
    baseDark: '#38323e',
    crystal: '#c5a156',
    crystalDark: '#8a6537',
    hi: '#eedba1',
    light: '#e5bd6b'
  },
  text: '#ffe27a',
  // 前两层不出现，保留给第三层及以后的矿物池。
  spawn: { weight: 0.09, minFloor: 3 },
  // 金矿招牌：更亮的呼吸光晕 + 晶顶双星点闪烁
  visual: { form: 'gold', glowPower: 0.18, twinkle: true }
}

export default def
