/** 官方生物群系包注册入口 */
import { biomeDefs } from '../registry'
import { biomeCave } from './cave'
import { biomeDeepHollow } from './deepHollow'
import { biomeOldHell } from './oldHell'

export function registerVanillaBiomes(): void {
  biomeDefs.register(biomeCave)
  biomeDefs.register(biomeDeepHollow)
  biomeDefs.register(biomeOldHell)
}
