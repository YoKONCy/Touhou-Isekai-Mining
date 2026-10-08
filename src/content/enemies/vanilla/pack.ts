/**
 * 官方敌人包注册清单（加新怪：建文件 + 下面两行）
 */
import { enemies } from '../registry'
import slimeBlue from './slimeBlue'
import venomGreen from './venomGreen'
import slimeRed from './slimeRed'
import grimm from './grimm'
import venomPlant from './venomPlant'
import caveBat from './caveBat'
import tricolorSlime from './tricolorSlime'
import kedama from './kedama'
import guardianSlime from './guardianSlime'
import overloadedKedama from './overloadedKedama'

/** 注册全部官方敌人（由 content/vanillaPack 在启动期调用一次） */
export function registerVanillaEnemies(): void {
  for (const def of [slimeBlue, venomGreen, slimeRed, grimm, caveBat, tricolorSlime, venomPlant, kedama, guardianSlime, overloadedKedama]) enemies.register(def)
}
