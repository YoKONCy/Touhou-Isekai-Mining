<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { inventoryMouse } from './inventoryMouse'
import type { InventorySlotAccess } from './inventorySlots'
import type { CharacterProfile } from '../shared/profile'
import { findItemDef } from '../shared/itemDefs'
import { deriveCombat } from '../shared/combat'
import { gradeNameKey, itemQualityColor } from '../shared/itemQuality'
import { touchControls } from '../browser/display'
import { t, itemName, itemDesc } from '../i18n'
import ItemStatSheet from './ItemStatSheet.vue'
import ItemIcon from './ItemIcon.vue'
const props=defineProps<{controller:ReturnType<typeof inventoryMouse>;slots:InventorySlotAccess;profile:CharacterProfile;tick:number}>()
const details=ref(false),message=ref('')
const selected=computed(()=>props.controller.selection.value)
const moving=computed(()=>props.controller.touchMoving.value)
const stack=computed(()=>{void props.tick;return props.controller.selectedStack()})
const def=computed(()=>stack.value?findItemDef(stack.value.id):undefined)
const quality=computed(()=>def.value?.grade?t(gradeNameKey(def.value.grade)):def.value?.rarity?t('ui.item.rarity',{n:def.value.rarity}):'')
const action=computed(()=>{void props.tick;return selected.value?props.slots.action(selected.value):null})
const combat=computed(()=>{void props.tick;return deriveCombat(props.profile.combat)})
const amount=computed({get:()=>Math.min(stack.value?.qty??1,props.controller.amount.value),set:(n:number)=>{props.controller.amount.value=n}})
watch(selected,()=>{details.value=false;message.value=''})
function run(which:'move'|'transfer'|'drop'|'action'):void {
  const controller=props.controller
  const ok=which==='move'?controller.touchTake():which==='transfer'?controller.touchTransfer():which==='drop'?controller.touchDrop():selected.value?controller.act(selected.value):false
  message.value=ok?'':t('ui.item.action_failed')
}
</script>
<template>
  <div v-if="touchControls" class="touch-item-actions" data-inventory-action="touch" @pointerdown.stop @click.stop>
    <template v-if="stack">
      <div class="touch-item-caption"><strong>{{ itemName(stack.id) }} <small>×{{ stack.qty }}</small></strong><span v-if="moving">{{ t('ui.mobile.place_hint') }}</span><button @click="details=true">{{ t('ui.mobile.details') }}</button></div>
      <div class="touch-item-tools">
        <template v-if="!moving"><label v-if="stack.qty>1">{{ t('ui.mobile.quantity') }} <input v-model.number="amount" type="range" min="1" :max="stack.qty" step="1"/><b>{{ amount }}</b></label><button v-if="action" @click="run('action')">{{ t(`ui.item.action.${action}`) }}</button><button @click="run('move')">{{ t('ui.mobile.move_item') }}</button><button @click="run('transfer')">{{ t('ui.mobile.transfer') }}</button><button @click="run('drop')">{{ t('ui.mobile.drop') }}</button></template>
        <button v-else @click="controller.cancel()">{{ t('ui.mobile.cancel_move') }}</button>
      </div>
    </template>
    <span v-else class="touch-item-hint">{{ t('ui.mobile.item_hint') }}</span>
    <small v-if="message" role="status">{{ message }}</small>
    <Teleport to="body"><div v-if="details&&def&&stack" class="touch-detail-mask" data-inventory-action="touch" @pointerdown.stop @click.self="details=false"><article class="touch-item-detail hud-panel"><header><ItemIcon :id="stack.id" :size="36"/><strong :style="{color:itemQualityColor(def,'ui')}">{{ itemName(stack.id) }}<small>{{ quality }}</small></strong><button @click="details=false">×</button></header><p v-if="selected === 'eq:vanityOutfit'">{{ t('ui.vanity.cosmetic_only') }}</p><p>{{ itemDesc(stack.id) }}</p><ItemStatSheet :def="def" expanded :ranged-crit="combat.rangedCritChance" :shooting-deviation="combat.shootingDeviation" :durability="stack.durability"/></article></div></Teleport>
  </div>
</template>
<style scoped>
.touch-item-actions{flex:none;margin-top:8px;padding-top:8px;border-top:1px solid #b3976855;color:#d9c5a4;font-size:12px}.touch-item-caption,.touch-item-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.touch-item-caption{margin-bottom:6px}.touch-item-caption strong{flex:1;min-width:0;font-weight:normal}.touch-item-caption small{color:#b6a185}.touch-item-caption>span,.touch-item-hint{font-size:11px;color:#b9a788}.touch-item-tools label{display:flex;align-items:center;gap:6px}.touch-item-tools input{width:90px;accent-color:#c1a06c}.touch-item-actions button,.touch-item-detail button{min-height:40px;min-width:44px;padding:7px 12px;font:inherit;color:#ead7b4;border:1px solid #a8895866;background:#4a382bbd}.touch-item-actions>small{display:block;margin-top:6px;color:#dfa294}.touch-detail-mask{position:fixed;inset:0;height:var(--view-height);z-index:2600;display:grid;place-items:center;padding:calc(var(--safe-top) + 10px) calc(var(--safe-right) + 10px) calc(var(--safe-bottom) + 10px) calc(var(--safe-left) + 10px);background:#090711bb}.touch-item-detail{width:min(500px,100%);max-height:100%;overflow:auto;padding:18px;background:linear-gradient(145deg,#efe3c7,#d8c39b);color:#69553c;touch-action:pan-y}.touch-item-detail header{display:flex;align-items:center;gap:10px}.touch-item-detail header strong{flex:1;font-size:15px}.touch-item-detail p{font-size:12px;line-height:1.8;margin:12px 0}.touch-item-detail button{font-size:22px;padding:4px}
</style>
