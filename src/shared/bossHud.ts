/** 首领只向界面提供表现快照；装饰、残血和转阶段动画不进入战斗模拟。 */
export interface BossHudState {
  id: 'grimm' | 'kedama'
  nameKey: string
  hp: number
  maxHp: number
  stage: number
  threshold: number
  defeated: boolean
  invulnerable: boolean
  guardian: boolean
  spell?: { nameKey: string; remaining: number }
}
