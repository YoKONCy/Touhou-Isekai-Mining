<script setup lang="ts">
import { computed } from 'vue'
import type { ItemDef } from '../content/items/types'
import { findMineralDef } from '../content/minerals/registry'
import { t } from '../i18n'
import ItemStatIcon from './ItemStatIcon.vue'

const props=defineProps<{def:ItemDef;expanded:boolean;rangedCrit:number;shootingDeviation:number}>()
interface Stat {key:string;icon:string;value:string|number;unit?:string;note?:string;wide?:boolean}
interface Group {key:string;stats:Stat[]}
const rounded=(n:number)=>Number(n.toFixed(3))
const groups=computed(()=>{
  const d=props.def,m=d.melee,r=d.ranged,s=d.spell,combat=d.combat,ammo=d.ammunition,result:Group[]=[]
  const add=(key:string,stats:Array<Stat|null>)=>{const items=stats.filter((v):v is Stat=>v!==null);if(items.length)result.push({key,stats:items})}
  const stat=(key:string,icon:string,value:string|number,unit?:string):Stat=>({key,icon,value,unit})
  const addSkills=()=>{
    const rangedCharge=r?.charge
    if(rangedCharge)add('skills',[{key:'weaponSkill',icon:'effect',value:t(rangedCharge.nameKey),note:t(rangedCharge.descriptionKey),wide:true}])
    const descriptions=d.weapon?.skillDescriptions
    const criticalPassive=d.weapon?.criticalPassive
    if(criticalPassive)add('skills',[{key:'weaponSkill',icon:'crit',value:t(criticalPassive.nameKey),note:t(criticalPassive.descriptionKey),wide:true}])
    if(descriptions)add('skills',[
      {key:'weaponSkill',icon:'effect',value:t(descriptions.summaryKey),wide:true},
      ...(props.expanded?descriptions.effects.map(effect=>({key:'weaponSkill',icon:'effect',value:t(effect.nameKey),note:t(effect.descriptionKey),wide:true})):[])
    ])
    const parry=d.weapon?.eraseProjectiles
    if(parry?.descriptionKey)add('skills',[{key:'weaponSkill',icon:'purify',value:t('ui.stats.bladeParry'),note:t(parry.descriptionKey),wide:true}])
    const skill=d.weapon?.windupRollBonus
    if(skill)add('skills',[
      {key:'weaponSkill',icon:'effect',value:t(skill.nameKey),note:t(skill.conditionKey),wide:true},
      {...stat('modifier.damageDealt','damage',`+${rounded(skill.damageBonus*100)}`,'percent'),note:t('ui.stats.currentAttack')}
    ])
    const charge=d.weapon?.chargeAttack
    const fullMove=charge?.move&&m?charge.move(m,1):undefined
    if(charge)add('skills',[
      {key:'weaponSkill',icon:'effect',value:t(charge.nameKey),note:t(charge.conditionKey),wide:true},
      stat('chargeDuration','windup',charge.duration,'seconds'),
      fullMove&&fullMove.damage!==m?.damage?stat('chargeDamage','damage',fullMove.damage):null,
      charge.minimumMoveMultiplier < 1 ? stat('chargeMinimumSpeed','speed',rounded(charge.minimumMoveMultiplier*100),'percent') : null,
      ...(charge.burst ? [stat('burstCount','slash',charge.burst.count), stat('burstDuration','cycle',charge.burst.duration,'seconds'),stat('cooldown','cooldown',charge.burst.cooldown,'seconds')] : []),
      charge.cooldown !== undefined ? stat('cooldown','cooldown',charge.cooldown,'seconds') : null,
      ...(charge.readyEffects?.definitions??[]).map(effect=>({...stat('chargeBuff','effect',t(effect.nameKey)),note:t(effect.effectKey??effect.descriptionKey),wide:true})),
      ...charge.tiers.map(tier=>({...stat(tier.progress>=1?'fullCharge':'halfCharge','damage',`×${tier.multiplier}`),note:t('ui.stats.chargeThreshold',{seconds:rounded(tier.progress*charge.duration)})})),
      ...(charge.fullHitEffects??[]).map(effect=>({...stat('chargeHitEffect','effect',t(effect.nameKey)),note:t('ui.stats.effectSeconds',{seconds:effect.duration??0})}))
    ])
  }
  if(!props.expanded){
    add('essentials',[
      m||r?{...stat('damage','damage',m?.innerZone?`${m.damage} / ${m.innerZone.damage}`:m?.damage??r!.damage),note:m?.innerZone?t('ui.stats.outerInnerDamage'):undefined}:null,
      d.kind==='weapon'&&m?stat('cycle','cycle',Math.round((m.windup+m.active+m.recover)*1000),'milliseconds'):null,
      d.miningPower!==undefined?stat('miningPower','mining',d.miningPower,'tier'):null,
      r?stat('deviation','accuracy',rounded(Math.max(0,props.shootingDeviation+r.accuracyPenalty)),'degree'):null,
      r?.type==='bow'?stat('cycle','cycle',Math.round(r.attackInterval*1000),'milliseconds'):null,
      ammo?stat('ammunitionDamage','damage',`+${ammo.damage}`):null,
      ammo&&ammo.penetration>0?stat('ammunitionPenetration','penetration',`+${ammo.penetration}`):null,
      combat?.physicalResist!==undefined?stat('physicalResist','physical',combat.physicalResist):null,
      combat?.magicResist!==undefined?stat('magicResist','magic',combat.magicResist):null,
      combat?.projectileReduction!==undefined?stat('projectileReduction','physical',combat.projectileReduction):null,
      d.consume?.heal!==undefined?stat('heal','heal',d.consume.heal,'hp'):null,
      s?stat('mana','mana',s.manaCost):null,
      s?stat('cooldown','cooldown',s.cooldown,'seconds'):null
    ])
    addSkills()
    return result
  }
  add('combat',[
    m||r?stat('damage','damage',m?.damage??r!.damage):null,
    combat?.critChance!==undefined?stat('crit','crit',rounded((combat.critChance+(r?props.rangedCrit:0))*100),'percent'):null,
    combat?.penetration!==undefined?stat('penetration','penetration',combat.penetration):null,
    m?stat('coefficient','coefficient',m.powerCoefficient??rounded(m.windup+m.active+m.recover)):null
  ])
  if(m?.innerZone)add('innerZone',[
    stat('innerDamage','damage',m.innerZone.damage),stat('innerPenetration','penetration',m.innerZone.penetration),stat('innerReach','reach',m.innerZone.reach,'pixels')
  ])
  add('defense',[
    combat?.physicalResist!==undefined?stat('physicalResist','physical',combat.physicalResist):null,
    combat?.magicResist!==undefined?stat('magicResist','magic',combat.magicResist):null,
    combat?.projectileReduction!==undefined?stat('projectileReduction','physical',combat.projectileReduction):null
  ])
  if(m){
    add('handling',[
      stat('shape',d.meleePattern?.mode==='mixed'?'mixed':m.shape,t(`ui.stats.shape.${d.meleePattern?.mode==='mixed'?'mixed':m.shape}`)),stat('reach','reach',m.reach,'pixels'),
      m.shape==='slash'?stat('angle','angle',rounded((m.arc??0)*360/Math.PI),'degree'):stat('width','width',m.stabWidth??0,'pixels'),
      stat('knockback','knockback',m.knockback??0),stat('stun','stun',m.stun??0,'seconds')
    ])
    add('timing',[
      stat('windup','windup',Math.round(m.windup*1000),'milliseconds'),stat('active','active',Math.round(m.active*1000),'milliseconds'),
      stat('recover','recover',Math.round(m.recover*1000),'milliseconds'),stat('cycle','cycle',Math.round((m.windup+m.active+m.recover)*1000),'milliseconds')
    ])
  }
  if(d.meleePattern)add('moves',d.meleePattern.moves.map((move,index)=>({
    key:'moveSegment',icon:move.shape,value:t('ui.stats.move_index',{n:index+1}),
    note:t(`ui.stats.shape.${move.shape}`)+' · '+(move.shape==='slash'?rounded((move.arc??0)*360/Math.PI)+'°':(move.stabWidth??14)+' '+t('ui.stats.unit.pixels'))
  })))
  if(r)add('ranged',[
    stat('speed','speed',r.speed,'speed'),stat('deviation','accuracy',rounded(Math.max(0,props.shootingDeviation+r.accuracyPenalty)),'degree'),
    stat('accuracy','accuracy',-r.accuracyPenalty,'degree'),r.type!=='boomerang'?stat('interval','cycle',Math.round(r.attackInterval*1000),'milliseconds'):null,
    r.knockback!==undefined?stat('knockback','knockback',r.knockback):null,r.stun!==undefined?stat('stun','stun',r.stun,'seconds'):null
  ])
  if(ammo)add('ammunition',[
    stat('ammunitionDamage','damage',`+${ammo.damage}`),stat('ammunitionCrit','crit',rounded(ammo.critChance*100),'percent'),
    stat('ammunitionPenetration','penetration',`+${ammo.penetration}`),stat('ammunitionAccuracy','accuracy',ammo.accuracyCorrection,'degree'),
    stat('ammunitionAttackSpeed','cycle',rounded(ammo.attackSpeed*100),'percent'),stat('ammunitionProjectileSpeed','speed',ammo.projectileSpeed,'speed'),
    stat('ammunitionKnockback','knockback',ammo.knockback),stat('ammunitionStun','stun',ammo.stun,'seconds')
  ])
  const aoe=m?.aoe??r?.aoe
  if(aoe)add('targets',[
    stat('aoe','aoe',t(`ui.stats.aoe.${aoe.mode}`)),
    aoe.mode!=='none'?stat('retention','aoe',rounded(aoe.retention*100),'percent'):null
  ])
  if(s){
    const waves=s.waves??1
    add('spell',[
      stat('damage','magic',s.damage),stat('radius','radius',s.radius,'pixels'),stat('mana','mana',s.manaCost),
      stat('cooldown','cooldown',s.cooldown,'seconds'),stat('knockback','knockback',s.knockback),stat('stun','stun',s.stun,'seconds')
    ])
    if(waves>1)add('waves',[
      stat('waves','waves',waves),stat('waveInterval','cycle',s.waveInterval??.4,'seconds'),stat('totalDamage','damage',s.damage*waves)
    ])
    if(s.clearBullets)add('effects',[{key:'purify',icon:'purify',value:t(waves>1?'ui.inv.spell.clear_multi':'ui.inv.spell.clear_single'),wide:true}])
  }
  const mineral=d.mineral?findMineralDef(d.mineral):undefined
  add('harvest',[
    d.miningPower!==undefined?stat('miningPower','mining',d.miningPower,'tier'):null,
    d.miningEfficiency!==undefined?stat('miningEfficiency','efficiency',d.miningEfficiency,'hp'):null,
    mineral?stat('mineralHp','hardness',mineral.hp[0]===mineral.hp[1]?mineral.hp[0]:`${mineral.hp[0]}–${mineral.hp[1]}`,'hp'):null,
    mineral?stat('requiredPower','mining',mineral.requiredMiningPower,'tier'):null
  ])
  if(d.consume?.heal!==undefined)add('recovery',[stat('heal','heal',d.consume.heal,'hp')])
  const held:Stat[]=[]
  const modifierIcons:Record<string,string>={physicalDamageTaken:'physical',moveSpeed:'speed',attackSpeed:'active',damageTaken:'physical',damageDealt:'damage',dodgeCooldown:'cooldown',spellCooldown:'cooldown',manaCost:'mana',healing:'heal'}
  for(const effect of [...(d.weapon?.heldEffects??[]),...(d.weapon?.afterDodgeEffects??[])]){
    const modifiers=effect.modifiers??[]
    const afterDodge=d.weapon?.afterDodgeEffects?.includes(effect)
    held.push({key:afterDodge?'afterDodgeEffect':'heldEffect',icon:'effect',value:t(effect.nameKey),note:modifiers.length?(effect.conditionKey?t(effect.conditionKey):t(effect.descriptionKey)):t(effect.effectKey??effect.descriptionKey),wide:true})
    if(effect.duration!==undefined)held.push(stat('effectDuration','cooldown',effect.duration,'seconds'))
    if(effect.heldReleaseDuration!==undefined)held.push(stat('heldReleaseDuration','cooldown',effect.heldReleaseDuration,'seconds'))
    // 结构化的持握增益也拆成图标数值，保留百分比加值与独立倍率的区别。
    for(const modifier of modifiers){
      const key=`modifier.${modifier.stat}`,icon=modifierIcons[modifier.stat]??'effect'
      if(modifier.add!==undefined)held.push({...stat(key,icon,`${modifier.add>0?'+':''}${rounded(modifier.add)}`),note:t('ui.stats.flatBonus')})
      if(modifier.percent!==undefined)held.push({...stat(key,icon,`${modifier.percent>0?'+':''}${rounded(modifier.percent*100)}`,'percent'),note:t('ui.stats.percentBonus')})
      if(modifier.multiply!==undefined)held.push({...stat(key,icon,`×${rounded(modifier.multiply)}`),note:t('ui.stats.multiplier')})
    }
  }
  add('held',held)
  addSkills()
  return result
})
const label=(key:string)=>t(`ui.stats.${key}`)
const unit=(key?:string)=>key?t(`ui.stats.unit.${key}`):''
</script>

<template>
  <div v-if="groups.length" class="stat-sheet" :class="{expanded}">
    <section v-for="group in groups" :key="group.key" class="stat-group" :aria-label="t(`ui.stats.group.${group.key}`)">
      <h4 v-if="expanded">{{t(`ui.stats.group.${group.key}`)}}</h4>
      <div class="stat-grid">
        <div v-for="(entry,index) in group.stats" :key="`${entry.key}:${index}`" class="stat-entry" :class="{wide:entry.wide}" :aria-label="`${label(entry.key)} ${entry.value}${unit(entry.unit)}${entry.note?'，'+entry.note:''}`">
          <ItemStatIcon :kind="entry.icon"/>
          <div><span class="stat-label">{{label(entry.key)}}</span><strong class="stat-value">{{entry.value}}<small v-if="entry.unit">{{unit(entry.unit)}}</small></strong><p v-if="entry.note">{{entry.note}}</p></div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 雕刻图标与独立数值栏排在纸面上，组间留白代替密集的说明文字。 */
.stat-sheet{padding:7px 0 5px;border-top:1px solid #876e4126}.stat-group+.stat-group{margin-top:13px;padding-top:9px;border-top:1px solid #94754826}.stat-group h4{display:flex;align-items:center;gap:9px;margin:0 0 8px;color:#998362;font-size:9px;font-weight:normal;letter-spacing:2px}.stat-group h4::after{content:'';height:1px;flex:1;background:linear-gradient(90deg,#9b81582b,transparent)}.stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}.expanded .stat-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:9px 14px}.stat-entry{display:flex;align-items:center;gap:7px;min-width:0;min-height:35px}.stat-entry>div{min-width:0}.stat-label{display:block;color:#958365;font-size:9px;line-height:1.5;letter-spacing:.3px}.stat-value{display:block;margin-top:1px;color:#5d4830;font-size:16px;font-weight:normal;line-height:1.35;font-variant-numeric:tabular-nums}.stat-value small{margin-left:3px;font-size:9px;color:#9c8561;white-space:nowrap}.stat-entry.wide{grid-column:1/-1;align-items:flex-start}.wide .stat-value{font-size:11px;line-height:1.7}.stat-entry p{margin:3px 0 0;color:#8c795e;font-size:10px;line-height:1.65;overflow-wrap:anywhere}
@media(max-width:480px){.expanded .stat-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 10px}.stat-entry{gap:5px}.stat-value{font-size:14px}}
@media(max-height:650px){.expanded .stat-entry{min-height:29px}.expanded .stat-grid{gap:5px 12px}.expanded .stat-group+.stat-group{margin-top:8px;padding-top:6px}.expanded .stat-group h4{margin-bottom:5px}}
</style>
