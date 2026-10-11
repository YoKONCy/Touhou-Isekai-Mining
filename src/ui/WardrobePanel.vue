<script setup lang="ts">
import { computed,onMounted,onBeforeUnmount,ref } from 'vue'
import type { CharacterProfile } from '../shared/profile'
import type { ModuleActions } from '../shared/moduleActions'
import type { PlayerCostume } from '../shared/playerAppearance'
import { OLD_MINER_OUTFIT_ID } from '../content/items/vanilla/ids'
import { saveService } from '../core/save/saveService'
import { t } from '../i18n'
import ItemIcon from './ItemIcon.vue'

const props=defineProps<{profile:CharacterProfile;actions:ModuleActions;tick:number}>()
const emit=defineEmits<{close:[]}>()
const revision=ref(0)
const selected=computed(()=>{void props.tick;void revision.value;return props.profile.costume})
const outfits=computed(()=>{void props.tick;return ['default',...(props.profile.flagBool('unlock.costume.old_miner')?['old_miner']:[])] as PlayerCostume[]})
function wear(costume:PlayerCostume):void {
  if(selected.value===costume||!props.actions.selectCostume(costume))return
  revision.value++;void saveService.autosave()
}
function key(event:KeyboardEvent):void {
  if(event.code!=='Escape')return
  event.preventDefault();event.stopImmediatePropagation()
  if(!event.repeat)emit('close')
}
onMounted(()=>window.addEventListener('keydown',key,true))
onBeforeUnmount(()=>window.removeEventListener('keydown',key,true))
</script>

<template>
  <div class="wardrobe-mask hud-modal" @click.self="emit('close')">
    <section class="wardrobe-panel gpanel hud-panel gpanel-pop" role="dialog" aria-modal="true" :aria-label="t('base.wardrobe.name')">
      <header><div><small>{{t('ui.wardrobe.eyebrow')}}</small><h2>{{t('base.wardrobe.name')}}</h2></div><button class="wardrobe-close" :aria-label="t('ui.common.close_esc')" @click="emit('close')">×</button></header>
      <div class="outfits">
        <button v-for="outfit in outfits" :key="outfit" class="outfit-card" :class="{selected:selected===outfit}" :aria-pressed="selected===outfit" @click="wear(outfit)">
          <span class="hanger" aria-hidden="true"><svg viewBox="0 0 100 30"><path d="M48 11Q43 1 51 2Q60 4 51 12L51 17L16 28H84L51 17" fill="none" stroke="currentColor" stroke-width="2"/></svg></span>
          <span class="outfit-art"><ItemIcon v-if="outfit==='old_miner'" :id="OLD_MINER_OUTFIT_ID" :size="112"/><svg v-else viewBox="0 0 80 90" aria-hidden="true"><path d="M24 12L7 26L15 48L26 39L21 78H60L54 39L65 48L73 26L56 12L40 19Z" fill="#5e6d89" stroke="#282635" stroke-width="2"/><path d="M32 17L40 24L48 17L50 73H30Z" fill="#dedbd1"/><path d="M24 14L33 22L29 65M56 14L47 22L52 65" fill="none" stroke="#9aa8bd" stroke-width="2"/><path d="M12 36L23 32M57 32L69 36M23 68H30M51 68H58" stroke="#d2d6d2" stroke-width="4"/></svg></span>
          <strong>{{t(`ui.costume.${outfit}`)}}</strong><span class="outfit-state">{{t(selected===outfit?'ui.wardrobe.selected':'ui.wardrobe.wear')}}<i v-if="selected===outfit" aria-hidden="true">✓</i></span>
        </button>
      </div>
      <p>{{t('ui.wardrobe.hint')}}</p><footer><button class="gbtn" @click="emit('close')">{{t('ui.common.close')}}</button></footer>
    </section>
  </div>
</template>

<style scoped>
.wardrobe-mask{position:absolute;inset:0;display:grid;place-items:center;background:#100d17b3;backdrop-filter:blur(2px);z-index:35}
.wardrobe-panel{width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 50px);overflow:auto;padding:28px;color:#e8d9b5;background:linear-gradient(135deg,#43353b,#2b242e)}
header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #b1945c55;padding-bottom:18px}header small{color:#bba47e;letter-spacing:3px;font-size:12px}h2{font-size:27px;letter-spacing:3px;margin:7px 0 0;font-weight:normal}.wardrobe-close{border:1px solid #aa8d5355;background:#17121d77;color:#dec9a5;font:inherit;font-size:26px;width:38px;height:38px;cursor:pointer}
.outfits{display:flex;gap:18px;justify-content:center;margin:24px 0}.outfit-card{flex:1;max-width:220px;min-width:0;display:flex;flex-direction:column;align-items:center;padding:14px 12px 18px;background:linear-gradient(#bba17b20,#17121d70);border:1px solid #a38c5b66;color:#c9b898;font:inherit;cursor:pointer;transition:transform .18s,border-color .18s,box-shadow .18s}.outfit-card:hover,.outfit-card:focus-visible{transform:translateY(-4px);border-color:#e5c587;outline:2px solid #cba86b44;outline-offset:3px}.outfit-card.selected{border-color:#e0bf7e;box-shadow:inset 0 0 24px #c5a46b15;color:#f1dfb7}.hanger{width:110px;height:35px;color:#a78e64}.outfit-art{height:135px;display:grid;place-items:center;filter:drop-shadow(0 7px 4px #0c081657)}.outfit-art>svg{width:95px;height:110px}.outfit-card strong{font-size:18px;font-weight:normal;margin:9px 0 12px}.outfit-state{font-size:12px;color:#af9c7b}.selected .outfit-state{color:#d3c690}.outfit-state i{font-style:normal;margin-left:8px}p{color:#b9a98c;font-size:12px;line-height:1.8;text-align:center;margin:0}footer{text-align:right;margin-top:20px}footer .gbtn{padding:7px 22px}
@media(max-width:460px){.wardrobe-panel{padding:20px}.outfits{gap:10px}.outfit-card{padding:12px 5px}.outfit-card strong{font-size:15px}}
</style>
