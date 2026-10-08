<script setup lang="ts">
import { computed } from 'vue'
import type { RunStats } from '../game/gameEvents'
import { ORE_COPPER_ID, ORE_IRON_ID, ORE_GOLD_ID } from '../content/items/vanilla/ids'
import { itemName, t } from '../i18n'
import ItemIcon from './ItemIcon.vue'

const props = defineProps<{ kind: 'extract' | 'died'; stats: RunStats; ready: boolean }>()
const emit = defineEmits<{ return: [] }>()
const failed = computed(() => props.kind === 'died')
// 这里只展示结算快照中的随身矿石，归仓仍由基地接管。
const ores = computed(() => [
  { id: ORE_COPPER_ID, qty: props.stats.bag.copper },
  { id: ORE_IRON_ID, qty: props.stats.bag.iron },
  { id: ORE_GOLD_ID, qty: props.stats.bag.gold }
].filter(ore => ore.qty > 0))
</script>

<template>
  <div class="result-mask hud-modal" :class="kind">
    <section v-if="ready" class="result-panel hud-panel" :class="kind" role="dialog" aria-modal="true" aria-labelledby="run-result-title" aria-describedby="run-result-sub">
      <header class="record-cover">
        <span class="record-kicker">{{ t('ui.result.record') }}</span>
        <span class="record-tag">{{ t(failed ? 'ui.result.died.tag' : 'ui.result.extract.tag') }}</span>
      </header>
      <div class="record-sheet">
        <div class="result-heading">
          <div class="result-emblem" aria-hidden="true">
            <svg viewBox="0 0 80 80" fill="none" stroke-linecap="round" stroke-linejoin="round">
              <path d="M31 22 V16 Q40 6 49 16 V22" stroke="currentColor" stroke-width="2"/>
              <path d="M24 24 H56 L54 31 H26 Z M26 58 H54 L58 64 H22 Z" fill="currentColor" opacity=".7"/>
              <path d="M27 31 L25 58 M53 31 L55 58 M31 31 L32 58 M49 31 L48 58" stroke="currentColor" stroke-width="2"/>
              <path d="M33 32 H47 L46 57 H34 Z" fill="currentColor" opacity=".12"/>
              <path v-if="!failed" d="M36 51 Q31 44 39 35 Q38 42 43 43 Q48 49 43 53 Z" fill="currentColor"/>
              <path v-else d="M40 33 L36 42 L43 46 L38 55 M33 51 L45 54" stroke="currentColor" stroke-width="1.8"/>
              <path d="M17 68 H63 M17 18 L20 15 M60 15 L63 18" stroke="currentColor" opacity=".35"/>
            </svg>
          </div>
          <div><h1 id="run-result-title">{{ t(failed ? 'ui.result.died.title' : 'ui.result.extract.title') }}</h1><p id="run-result-sub">{{ t(failed ? 'ui.result.died.sub' : 'ui.result.extract.sub') }}</p></div>
        </div>
        <div class="record-divider" aria-hidden="true"><span>◆</span></div>
        <dl class="result-stats">
          <div><dt>{{ t('ui.result.depth') }}</dt><dd>{{ stats.depth }}<small>{{ t('ui.result.floor_unit') }}</small></dd></div>
          <div><dt>{{ t('ui.result.rooms') }}</dt><dd>{{ stats.roomsCleared }}<small>/ {{ stats.roomsTotal }}</small></dd></div>
          <div><dt>{{ t('ui.result.kills') }}</dt><dd>{{ stats.kills }}</dd></div>
        </dl>
        <section class="outcome-note" :class="{ loss: failed }">
          <h2>{{ t(failed ? 'ui.result.died.outcome' : 'ui.result.extract.outcome') }}</h2>
          <template v-if="failed">
            <div v-if="stats.losses.items.length" class="loss-list">
              <div v-for="item in stats.losses.items" :key="item.id" class="lost-item">
                <div class="loss-icon"><ItemIcon :id="item.id" :size="32"/></div>
                <span class="lost-item-name">{{ itemName(item.id) }}</span>
                <b>−{{ item.qty }}</b>
              </div>
            </div>
            <p v-else>{{ t('ui.result.died.no_items') }}</p>
            <dl class="loss-exp" :class="{ unchanged: stats.losses.exp === 0 }"><dt>{{ t('ui.result.died.exp') }}</dt><dd>{{ stats.losses.exp > 0 ? '−' : '' }}{{ stats.losses.exp }}<small>{{ t('ui.result.exp_unit') }}</small></dd></dl>
            <span class="retained-note">{{ t('ui.result.died.retained') }}</span>
          </template>
          <template v-else>
            <div v-if="ores.length" class="ore-list">
              <div v-for="ore in ores" :key="ore.id" class="ore-entry"><ItemIcon :id="ore.id" :size="26"/><span>{{ itemName(ore.id) }}</span><b>×{{ ore.qty }}</b></div>
            </div>
            <p v-else>{{ t('ui.result.no_ores') }}</p>
            <span class="retained-note">{{ t('ui.result.extract.storage') }}</span>
          </template>
        </section>
      </div>
      <footer class="record-footer">
        <span class="return-hint"><kbd>Enter</kbd>{{ t('ui.result.continue') }}</span>
        <button class="return-button" @click="emit('return')">{{ t('ui.result.return') }}<span aria-hidden="true">›</span></button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.loss-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
.lost-item{display:flex;align-items:center;gap:8px;min-width:0;padding:7px 9px 7px 6px;border:1px solid #9c6a552b;background:linear-gradient(135deg,#91704c0c,#d0b39016);box-shadow:inset 0 1px #f6e6cb33}
.loss-icon{display:grid;place-items:center;flex:none;width:37px;height:37px;background:#937d5012;border:1px solid #a48a5e33;box-shadow:inset 0 2px 3px #735e3822,inset 0 -1px #f4e2bd55}
.lost-item-name{flex:1;min-width:0;font-size:11px;line-height:1.6;color:#746044;overflow-wrap:anywhere}.lost-item b{font-size:13px;font-weight:normal;color:#a16b54;white-space:nowrap;font-variant-numeric:tabular-nums}
.loss-exp{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 0;padding-top:11px;border-top:1px dashed #a17b553d}.loss-exp dt{font-size:11px;color:#81684d;letter-spacing:1px}.loss-exp dd{margin:0;font-size:18px;color:#a16b54;font-variant-numeric:tabular-nums}.loss-exp small{margin-left:6px;font-size:10px;color:#9a8260}.loss-exp.unchanged dd{color:#8c806c}
@media(max-width:420px){.loss-list{grid-template-columns:1fr}}
/* 结算沿用营地手账的皮革、纸页和黄铜，遮罩只压暗现场。 */
.result-mask{position:absolute;inset:0;display:grid;place-items:center;padding:24px;box-sizing:border-box;pointer-events:auto;cursor:default;z-index:1400;isolation:isolate}
.result-mask::before{content:'';position:absolute;inset:0;z-index:-1;background:#17121bd1}.result-mask.extract::before{background:#17121b9c}.result-mask.died::before{animation:death-dim 1.5s ease-in-out forwards}
.result-panel{--result-accent:#8b754c;position:relative;box-sizing:border-box;width:min(560px,100%);max-height:calc(100dvh - 48px);overflow:auto;padding:8px;border:1px solid #947449;border-radius:3px;background:repeating-linear-gradient(35deg,#ddbd8505 0 1px,transparent 1px 5px),linear-gradient(135deg,#49382d,#30282b);color:#dbcaac;box-shadow:0 24px 75px #06081099,inset 0 0 0 3px #241e24,inset 0 0 0 4px #ae8a513d;animation:record-arrive .4s ease-out both;font-family:var(--font-body)}
.result-panel.died{--result-accent:#986958}
.record-cover{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 17px 15px;border:1px dashed #ad8c5659;border-bottom:none;margin:0 2px;color:#c3aa80;font-size:10px;letter-spacing:3px}.record-tag{padding:4px 8px;border:1px solid #a1835540;background:#c3a2670b;letter-spacing:1px;color:#d7c399}.died .record-tag{color:#cba491;border-color:#af796650}
.record-sheet{position:relative;margin:0 2px;padding:24px 28px 23px;border-left:5px solid #95815e;border-right:2px solid #a58e67;border-bottom:3px double #9a835e;background:repeating-linear-gradient(0deg,transparent 0 3px,#7a5c3606 3px 4px),radial-gradient(ellipse at 100% 0,#b79a6426,transparent 65%),linear-gradient(100deg,#cbb796,#e2d3b5 5%,#dbc9a8 96%,#c3ae87);box-shadow:inset 3px 0 6px #765a3522,inset -1px 0 #f0e1c2;color:#504435}
.result-heading{display:flex;align-items:center;gap:20px}.result-heading>div:last-child{min-width:0}.result-emblem{width:76px;height:76px;flex:none;display:grid;place-items:center;color:var(--result-accent);border:1px solid #a28a603d;box-shadow:inset 0 0 0 4px #dfcba433,inset 0 0 0 5px #a28a6026;background:#ac8e5310;transform:rotate(-3deg)}.result-emblem svg{width:64px;height:64px}.result-heading h1{margin:0 0 9px;font-size:29px;letter-spacing:4px;font-weight:normal;color:#514333;font-family:var(--font-sign)}.result-heading p{margin:0;font-size:12px;color:#857257;line-height:1.8}
.record-divider{height:1px;margin:25px 0 20px;background:#9479513d;text-align:center}.record-divider span{display:inline-block;position:relative;top:-8px;background:#decead;padding:0 9px;font-size:10px;color:#9b8054}
.result-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));margin:0 0 22px;padding:0}.result-stats>div{padding:1px 16px;border-right:1px solid #a38b632b}.result-stats>div:first-child{padding-left:0}.result-stats>div:last-child{border-right:0;padding-right:0}.result-stats dt{font-size:10px;letter-spacing:1px;color:#8c7959;margin-bottom:9px}.result-stats dd{margin:0;color:#62503a;font-size:26px;line-height:1.2;font-variant-numeric:tabular-nums}.result-stats small{margin-left:6px;font-size:12px;color:#9a8661}
.outcome-note{padding:13px 15px;background:#8f764910;border:1px solid #9d865b33;box-shadow:inset 0 1px #f5e4c148}.outcome-note h2{font-size:11px;font-weight:normal;color:var(--result-accent);letter-spacing:2px;margin:0 0 9px}.outcome-note p{font-size:12px;color:#76634b;margin:0;line-height:1.8}.outcome-note.loss{border-color:#9c6a5533;background:#9c6a5509}.retained-note{display:block;margin-top:9px;font-size:10px;line-height:1.7;color:#96805d}.ore-list{display:flex;flex-wrap:wrap;gap:6px 18px}.ore-entry{display:flex;align-items:center;gap:6px;font-size:11px;color:#6a573e}.ore-entry b{font-weight:normal;color:#8c7048;font-size:12px;font-variant-numeric:tabular-nums}
.record-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;margin:0 2px;padding:18px 18px 13px}.return-hint{display:flex;gap:7px;align-items:center;font-size:10px;color:#a18f71}.return-hint kbd{padding:3px 5px;border:1px solid #8d765144;border-bottom-width:2px;background:#1f1c2280;color:#c0ab85;font:inherit;font-size:9px;letter-spacing:0}
.return-button{display:flex;justify-content:center;align-items:center;gap:23px;min-width:176px;padding:11px 19px;border:1px solid #ae8d56;border-radius:2px;background:linear-gradient(#826747,#644e37);color:#efddb5;box-shadow:inset 0 1px #dbc28b59,inset 0 -2px #30272499,0 3px 4px #18111d44;font:inherit;font-size:13px;letter-spacing:2px;cursor:pointer}.return-button span{font-size:21px;line-height:1;color:#c9ab72}.return-button:hover{background:linear-gradient(#927551,#71583c)}.return-button:active{transform:translateY(1px);box-shadow:inset 0 2px 5px #211b2759}.return-button:focus-visible{outline:2px solid #dec28b;outline-offset:3px}
@keyframes death-dim{from{background:#17121b00}to{background:#17121bd1}}
@keyframes record-arrive{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@media(max-width:520px){.result-mask{padding:18px}.result-panel{max-height:calc(100dvh - 36px)}.record-sheet{padding:21px 19px}.record-cover{padding:13px 12px;letter-spacing:2px}.result-heading{gap:14px}.result-heading h1{font-size:25px;letter-spacing:2px}.result-emblem{width:60px;height:66px}.result-emblem svg{width:54px;height:54px}.result-stats>div{padding:0 10px}.result-stats dd{font-size:23px}.result-stats dt{font-size:9px}.record-footer{padding:15px 12px 10px}.return-button{min-width:144px;gap:15px}.return-hint{font-size:9px}}
@media(max-width:360px){.result-heading{gap:11px}.result-heading h1{font-size:22px}.result-stats small{margin-left:3px;font-size:10px}.record-footer{flex-wrap:wrap}.return-button{width:100%}}
@media(prefers-reduced-motion:reduce){.result-panel,.result-mask.died::before{animation:none}}
</style>
