import { RUBY_ID } from '../../items/vanilla/ids'
import { MINERAL_RUBY_ID } from './ids'
import type { MineralDef } from '../types'

/** 三层起露出红玉晶脉，初始镐的挖掘等级不足以采集。 */
const def: MineralDef = {
  id: MINERAL_RUBY_ID,
  dropItemId: RUBY_ID,
  hp: [180, 180],
  requiredMiningPower: 2,
  palette: {
    base: '#625158',
    baseDark: '#3a303a',
    crystal: '#a43c50',
    crystalDark: '#60283c',
    hi: '#e7a0a1',
    light: '#c65e73'
  },
  text: '#dfa0a1',
  // 红玉比金矿更稀少，仍从三层开始加入加权矿物池。
  spawn: { weight: 0.05, minFloor: 3 },
  visual: { glowPower: 0.11 },
  tags: ['gem', 'rare']
}
export default def
