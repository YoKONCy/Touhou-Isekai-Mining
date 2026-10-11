import { lootTables } from '../registry'
import chestBasic from './chestBasic'
import searchSupplies, { searchChest, searchPrologue,searchSealed,searchSealedRare } from './searchSupplies'

export function registerVanillaLoot(): void {
  lootTables.register(chestBasic)
  lootTables.register(searchSupplies)
  lootTables.register(searchChest)
  lootTables.register(searchPrologue)
  lootTables.register(searchSealed)
  lootTables.register(searchSealedRare)
}
