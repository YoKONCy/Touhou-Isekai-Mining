/**
 * 官方弹幕包注册清单（加新弹种：建文件 + 下面加一行）
 */
import { projectiles } from '../registry'
import venomStraight from './venomStraight'
import venomPlantBullet from './venomPlantBullet'
import venomRing from './venomRing'
import { furryWave, furrySeed } from './furryBullets'
import { bossFurryBullets } from './kedamaBossBullets'

/** 注册全部官方弹种（由 content/vanillaPack 在启动期调用一次） */
export function registerVanillaProjectiles(): void {
  for (const def of [venomStraight, venomRing, venomPlantBullet, furryWave, furrySeed, ...bossFurryBullets]) {
    projectiles.register(def)
  }
}
