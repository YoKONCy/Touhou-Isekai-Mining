/**
 * 官方矿物包注册清单（加新矿种：建文件 + 下面加一行）
 */
import { minerals } from '../registry'
import copper from './copper'
import iron from './iron'
import gold from './gold'
import ruby from './ruby'
import { coal, saltRock } from './deepMinerals'

/** 注册全部官方矿种（由 content/vanillaPack 在启动期调用一次） */
export function registerVanillaMinerals(): void {
  for (const def of [copper, iron, gold, ruby, coal, saltRock]) {
    minerals.register(def)
  }
}
