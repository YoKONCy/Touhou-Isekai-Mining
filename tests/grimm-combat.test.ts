import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/content/vanillaPack'
import { GrimmBoss } from '../src/game/GrimmBoss'
import { BossAttacks } from '../src/game/BossAttacks'
import { TileMap } from '../src/game/tilemap'
import { SimulationSession } from '../src/core/simulation/SimulationSession'
import type { Player } from '../src/game/Player'
import type { FxLayer } from '../src/game/FxLayer'
import type { EngineContext } from '../src/core/types'
import type { PlayerLike } from '../src/game/Enemy'

const STEP = 1 / 60
function fixture(stage: 1 | 3, repeats = 1) {
  const session = new SimulationSession(421)
  return session.run(() => {
    const map = new TileMap({ spawnCol: 12, spawnRow: 10, oreRange: [0, 0], roomKind: 'normal', depth: 1, floor: 1, doors: [] })
    const boss = new GrimmBoss(600, 600)
    const player: PlayerLike = { x: 720, y: boss.y, half: 9, alive: true }
    const control = boss as unknown as {
      battleStage: number; skill: number; repeats: number; lastSkill: number
      warning: { x: number; y: number; targetX: number; targetY: number }
      enter(state: string, duration: number): void
    }
    control.battleStage = stage; control.skill = control.lastSkill = 1; control.repeats = repeats
    control.warning = { x: boss.x, y: boss.y, targetX: player.x, targetY: player.y }
    control.enter('hidden', 0)
    const tick = () => session.step(() => boss.update(STEP, map, player))
    return { session, boss, player, map, tick }
  })
}

test('一阶段每次闪现一刀，三阶段每次闪现两刀，整套闪现次数保持不变', () => {
  for (const stage of [1, 3] as const) {
    const { boss, tick } = fixture(stage, 2)
    let completed = false, hiddenEntries = 0, previous = boss.state
    for (let i = 0; i < 300; i++) {
      tick()
      if (boss.state === 'hidden' && previous !== 'hidden') hiddenEntries++
      previous = boss.state
      if (boss.state === 'recovery') { completed = true; break }
    }
    assert.ok(completed)
    assert.equal(hiddenEntries, 1)
    const slashes = boss.attacks.hazards.filter(hazard => hazard.kind === 'slash')
    assert.equal(slashes.length, stage === 3 ? 4 : 2)
  }
})

test('三阶段第二刀重新锁定方向，起手后不持续追踪玩家', () => {
  const { boss, tick, player } = fixture(3)
  for (let i = 0; i < 90 && boss.state !== 'followupSlash'; i++) tick()
  assert.equal(boss.state, 'followupSlash')
  const direction = (boss as unknown as { angle: number }).angle
  player.x = boss.x + 300; player.y = boss.y + 300
  for (let i = 0; i < 4; i++) tick()
  const slashes = boss.attacks.hazards.filter(hazard => hazard.kind === 'slash')
  assert.equal(slashes.length, 2)
  assert.equal(slashes[1].angle, direction)
})

test('斩击扩大后能命中旧范围外的目标，范围外与背后目标不受伤', () => {
  const { boss, map, tick } = fixture(1)
  for (let i = 0; i < 20 && !boss.attacks.hazards.some(hazard => hazard.kind === 'slash'); i++) tick()
  const slash = boss.attacks.hazards.find(hazard => hazard.kind === 'slash')!
  assert.ok(slash)
  const engine = { shake() {} } as unknown as EngineContext
  const effects = { damageText() {}, chips() {} } as unknown as FxLayer
  for (const [distance, angle, expected] of [[150, 0, 90], [190, 0, 100], [150, Math.PI, 100]]) {
    const attacks = new BossAttacks()
    const target = { x: slash.x + Math.cos(angle) * distance, y: slash.y + Math.sin(angle) * distance,
      hp: 100, alive: true, entityId: '测试玩家', isInvincible: false, debugGod: false, hitR: 9,
      takeHit(this: { hp: number }, amount: number) { this.hp -= amount } } as unknown as Player
    attacks.add('slash', slash.x, slash.y, { angle: slash.angle, rx: slash.rx, duration: .2 })
    attacks.update(STEP, target, map, engine, effects)
    assert.equal(target.hp, expected)
  }
})

test('连段收招与退步合计只留短暂攻防窗口，不再空等原来的长后摇', () => {
  for (const stage of [1, 3] as const) {
    const { boss, tick } = fixture(stage)
    for (let i = 0; i < 90 && boss.state !== 'recovery'; i++) tick()
    assert.equal(boss.state, 'recovery')
    let elapsed = 0
    while ((boss.state === 'recovery' || boss.state === 'retreat') && elapsed < 1) { tick(); elapsed += STEP }
    assert.ok(boss.state === 'run' || boss.state === 'cast')
    assert.ok(elapsed <= .28)
  }
})
