import { CONFIG } from '../game/config'
import type { Equipment } from './equipment'
import { getItemDef } from './itemDefs'

/** 暴击由装备提供，不再属于可投入的战斗能力。 */
export const COMBAT_STAT_KEYS = ['vitality','spirit','strength','agility','fortitude','antimagic','haste','load','shooting'] as const
export type CombatStatKey = typeof COMBAT_STAT_KEYS[number]
/** 抗魔字段仅用于旧存档迁移，新的双抗统一投入坚体字段。 */
export const ACTIVE_COMBAT_STATS: readonly CombatStatKey[] = ['vitality','spirit','strength','agility','fortitude','haste','shooting']
export interface CombatStats {
  level: number
  exp: number
  unspentPoints: number
  points: Record<CombatStatKey, number>
}
export function createCombatStats(): CombatStats {
  return {level:1,exp:0,unspentPoints:0,points:{vitality:0,spirit:0,strength:0,agility:0,fortitude:0,antimagic:0,haste:0,load:0,shooting:0}}
}
/** 每级经验需求：一阶导数递增、二阶导数递减；满级 99 长线规划（近千趟）。 */
export function expNeeded(level:number):number {return Math.ceil(200+25*Math.pow(Math.max(1,level),1.5))}
export function grantExp(stats:CombatStats,amount:number):number {
  if(amount<=0)return 0
  stats.exp+=amount
  let count=0
  while(stats.exp>=expNeeded(stats.level)){stats.exp-=expNeeded(stats.level);stats.level++;stats.unspentPoints++;count++}
  return count
}
export function spendPoint(stats:CombatStats,key:CombatStatKey):boolean {
  if(!ACTIVE_COMBAT_STATS.includes(key)||stats.unspentPoints<1||stats.points[key]>=CONFIG.statCap)return false
  stats.points[key]++;stats.unspentPoints--;return true
}
/** 扣除本级已积累经验的 25%，向上取整；不降级、不影响已经获得的属性点。 */
export function loseDeathExp(stats:CombatStats):number {
  const loss=Math.min(stats.exp,Math.ceil(stats.exp*.25))
  stats.exp-=loss;return loss
}
export interface DerivedCombat {
  maxHp:number
  maxMana:number
  manaRegen:number
  knockbackBonus:number
  moveSpeedMul:number
  attackPower:number
  physicalResist:number
  magicResist:number
  attackSpeedMul:number
  shootingDeviation:number
  rangedCritChance:number
}
/** 被动装备只计装束和饰品，不把备用武器的属性也叠进当前攻击。 */
export function passiveEquipment(equipment:Equipment):{critChance:number;penetration:number;physicalResist:number;magicResist:number;projectileReduction:number} {
  const result={critChance:0,penetration:0,physicalResist:0,magicResist:0,projectileReduction:0}
  for(const slot of ['outfit','trinketA','trinketB','trinketC','trinketD'] as const){
    const id=equipment.get(slot),stats=id?getItemDef(id).combat:undefined
    for(const key of Object.keys(result) as Array<keyof typeof result>)result[key]+=stats?.[key]??0
  }
  return result
}
export function deriveCombat(stats:CombatStats):DerivedCombat {
  const p=stats.points
  return {
    maxHp:CONFIG.player.maxHp+p.vitality*CONFIG.expGrowth.perVitalityHp,
    maxMana:CONFIG.player.spell.maxMana+p.spirit*CONFIG.expGrowth.perSpiritMana,
    manaRegen:CONFIG.player.spell.manaRegen*(1+p.spirit*CONFIG.expGrowth.perSpiritRegen),
    knockbackBonus:p.vitality*CONFIG.expGrowth.perVitalityKnockback,
    moveSpeedMul:1+p.agility*CONFIG.expGrowth.perAgilitySpeed,
    attackPower:p.strength*CONFIG.expGrowth.perStrengthPower,
    physicalResist:p.fortitude*CONFIG.expGrowth.perResist,
    magicResist:p.fortitude*CONFIG.expGrowth.perResist,
    attackSpeedMul:1+p.haste*CONFIG.expGrowth.perHasteSpeed,
    shootingDeviation:5-p.shooting*.5,
    rangedCritChance:p.shooting*.005
  }
}
export type DamageKind='physical'|'magic'
/** 同层加算、异层乘算；护盾吸收在调用方执行，不把免疫伪装成高抗性。 */
export interface DamageInput {
  base:number
  attackPower?:number
  coefficient?:number
  damageBonus?:number
  resistance?:number
  resistanceReduction?:number
  penetration?:number
  critChance?:number
  critMultiplier?:number
  vulnerability?:number
  reduction?:number
  aoeReduction?:number
  area?:boolean
  falloff?:number
  immune?:boolean
}
export function calculateDamage(input:DamageInput,rng:()=>number=Math.random):{damage:number;critical:boolean} {
  if(input.immune)return {damage:0,critical:false}
  const raw=Math.max(0,input.base+(input.attackPower??0)*(input.coefficient??1))*Math.max(0,1+(input.damageBonus??0))
  const resistance=Math.max(0,(input.resistance??0)-(input.resistanceReduction??0)-(input.penetration??0))
  const chance=Math.max(0,Math.min(1,input.critChance??0))
  const critical=chance>0&&rng()<chance
  const damage=raw*100/(100+resistance)*(critical?Math.max(1,input.critMultiplier??1.5):1)
    *Math.max(0,1+(input.vulnerability??0))*(1-Math.max(0,Math.min(1,input.reduction??0)))
    *(input.area?1-Math.max(0,Math.min(1,input.aoeReduction??0)):1)*Math.max(0,input.falloff??1)
  return {damage,critical}
}
/** 数字仅在展示层格式化，内部保留小数避免高攻速武器逐击取整损失。 */
export function damageLabel(value:number):string {return Number(value.toFixed(1)).toString()}
/** 所有远程入口共用：强度参数即使被调用方传入也不会影响弹幕伤害。 */
export function calculateRangedDamage(input:DamageInput,rng:()=>number=Math.random):{damage:number;critical:boolean} {
  return calculateDamage({...input,attackPower:0,coefficient:0},rng)
}
