import type { Player } from '../../../../../game/Player'
import type { Enemy } from '../../../../../game/Enemy'
import type { TileMap } from '../../../../../game/tilemap'
import { circleHitsProp, type Prop } from '../../../../../game/art/props'
import { getItemDef } from '../../../../../shared/itemDefs'
import { calculateRangedDamage } from '../../../../../shared/combat'
import { aoeMultiplier } from '../../../combatComponents'

export function updateBoomerang(player: Player, dt: number, map: TileMap, props: readonly Prop[], enemies: readonly Enemy[], onHit: (enemy: Enemy, damage: number, critical: boolean) => void): void {
  const flight = player.rangedFlight
  if (!flight) return
  if (!player.alive) { player.rangedFlight = null; return }
  const def = getItemDef(flight.item).ranged!
  let budget = def.speed * dt
  flight.rotation += dt * 20
  const turn = (): void => { flight.returning = true; flight.hits.clear() }
  while (budget > 0 && player.rangedFlight) {
    if (!flight.returning && flight.remaining <= 0) turn()
    const distance = Math.hypot(player.x-flight.x, player.y-flight.y)
    if (flight.returning && distance <= 8) {
      player.rangedFlight = null
      player.rangedCooldown = Math.max(player.rangedCooldown, def.attackInterval)
      break
    }
    const step = Math.min(3, budget, flight.returning ? distance : flight.remaining)
    if (flight.returning) flight.angle = Math.atan2(player.y-flight.y, player.x-flight.x)
    const x = flight.x + Math.cos(flight.angle)*step, y = flight.y + Math.sin(flight.angle)*step
    if (!flight.returning && (x < 0 || y < 0 || x >= map.cols*map.tile || y >= map.rows*map.tile ||
      [[-5,-5],[5,-5],[-5,5],[5,5]].some(([dx,dy]) => map.solidAtWorld(x+dx,y+dy)) || props.some(prop => circleHitsProp(x,y,5,prop)))) { turn(); continue }
    flight.x=x; flight.y=y; budget-=step
    if (!flight.returning) flight.remaining-=step
    let hit = false
    for (const enemy of enemies) {
      // 与近战共用单体模式；每段飞行的命中序列只允许一个目标。
      if (def.aoe?.mode === 'none' && flight.hits.size > 0) break
      if (!enemy.canBeHit || flight.hits.has(enemy) || !enemy.containsHit(x,y,5)) continue
      const multiplier = aoeMultiplier(def.aoe, flight.hits.size)
      flight.hits.add(enemy)
      const result = calculateRangedDamage({ base: def.damage * multiplier,damageBonus:flight.damageBonus??0,
        resistance: enemy.def.combat.physicalResist, penetration: flight.penetration, critChance: flight.critChance })
      const damage = result.damage
      enemy.takeDamage(damage,flight.angle,player.knockbackBonus,0)
      onHit(enemy,damage,result.critical); hit=true
    }
    if (hit && !flight.returning) turn()
  }
}
