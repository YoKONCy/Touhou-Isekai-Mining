/**
 * 官方矿种：铁矿（中量常见，冷灰晶簇，碎矿掉落 touhou:ore_iron）
 */
import { ORE_IRON_ID } from '../../items/vanilla/ids'
import { MINERAL_IRON_ID } from './ids'
import type { MineralDef } from '../types'

const def: MineralDef = {
  id: MINERAL_IRON_ID,
  dropItemId: ORE_IRON_ID,
  hp: [100, 120],
  requiredMiningPower: 1,
  palette: {
    base: '#606b77',
    baseDark: '#39424e',
    crystal: '#8c98a4',
    crystalDark: '#586575',
    hi: '#c6cfcc',
    light: '#aebfd4'
  },
  text: '#cfd6e0',
  spawn: { weight: 0.28 },
  visual: { form: 'iron', glowPower: 0.09 }
}

export default def
