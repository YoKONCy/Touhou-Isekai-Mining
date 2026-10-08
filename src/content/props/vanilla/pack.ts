/**
 * 官方摆件包注册入口。
 * 注册顺序即布局摆放顺序：大石→石柱→木堆→矿车→蘑菇→大件组
 * （大件统一进 largeDefs 摇号，与注册顺序无关；每房至多一件）。
 */
import { propDefs } from '../registry'
import { propBoulder } from './boulder'
import { propPillar } from './pillar'
import { propLogs } from './logs'
import { propCart } from './cart'
import { propMushroom } from './mushroom'
import { propCartWreck } from './cartWreck'
import { propTimberCollapse } from './timberCollapse'
import { propBrokenRails } from './brokenRails'
import { propRockCollapse } from './rockCollapse'

export function registerVanillaProps(): void {
  propDefs.register(propBoulder)
  propDefs.register(propPillar)
  propDefs.register(propLogs)
  propDefs.register(propCart)
  propDefs.register(propMushroom)
  propDefs.register(propCartWreck)
  propDefs.register(propTimberCollapse)
  propDefs.register(propBrokenRails)
  propDefs.register(propRockCollapse)
}
