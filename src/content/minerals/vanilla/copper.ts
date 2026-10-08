/**
 * 官方矿种：铜矿（浅层最常见，色板/产量/发光迁自原 ORE_ART/CONFIG.mine）
 * 碎矿掉落 touhou:ore_copper（铜矿石物品）。
 */
import { ORE_COPPER_ID } from '../../items/vanilla/ids'
import { MINERAL_COPPER_ID } from './ids'
import type { MineralDef } from '../types'

const def: MineralDef = {
  id: MINERAL_COPPER_ID,
  dropItemId: ORE_COPPER_ID,
  hp: [80, 100],
  requiredMiningPower: 1,
  palette: {
    base: '#826a58',
    baseDark: '#524242',
    crystal: '#c8773f',
    crystalDark: '#8f4f28',
    hi: '#f6b27e',
    light: '#ff9a52'
  },
  text: '#ffb27a',
  // 浅层主力矿种（60%）
  spawn: { weight: 0.6 },
  visual: { form: 'copper', glowPower: 0.12 }
}

export default def
