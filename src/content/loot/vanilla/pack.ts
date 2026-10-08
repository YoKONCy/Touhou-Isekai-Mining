import { lootTables } from '../registry'
import chestBasic from './chestBasic'

export function registerVanillaLoot(): void {
  lootTables.register(chestBasic)
}
