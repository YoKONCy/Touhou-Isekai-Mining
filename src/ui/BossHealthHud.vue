<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { BossHudState } from '../shared/bossHud'
import { t } from '../i18n'
import GrimmBossFrame from './GrimmBossFrame.vue'
import KedamaBossFrame from './KedamaBossFrame.vue'

const props = defineProps<{ boss: BossHudState; paused?: boolean }>()
const ratio = computed(() => Math.max(0, Math.min(1, props.boss.hp / Math.max(1, props.boss.maxHp))))
const health = computed(() => Math.max(0, Math.ceil(props.boss.hp)))
const impact = ref(0), stageChange = ref(0), healing = ref(false)
watch(() => props.boss.hp, (hp, previous) => { healing.value = hp > previous; if (hp < previous) impact.value++ })
watch(() => props.boss.stage, () => stageChange.value++)
const style = computed(() => ({ '--health': `${ratio.value * 100}%`, '--threshold': `${props.boss.threshold * 100}%`,
  '--hit-x': `${(props.boss.id === 'grimm' ? 18.5 : 19) + ratio.value * (props.boss.id === 'grimm' ? 71 : 69)}%` }))
</script>

<template>
  <section class="boss-health" :class="[boss.id, `stage-${boss.stage}`, { defeated: boss.defeated, sealed: boss.invulnerable, paused, healing }]" :style="style" :aria-label="t(boss.nameKey)">
    <div class="boss-heading">
      <h2>{{ t(boss.nameKey) }}</h2>
      <span class="stage-marks" :aria-label="t('trial.stage', { n: boss.stage })"><i v-for="n in (boss.id === 'grimm' ? 3 : 2)" :key="n" :class="{ current: n === boss.stage, passed: n < boss.stage }"></i></span>
    </div>
    <div class="blood-track" role="progressbar" :aria-label="t(boss.nameKey)" :aria-valuemin="0" :aria-valuemax="boss.maxHp" :aria-valuenow="health">
      <div class="blood-lag"></div><div class="blood-fill"><span></span></div>
      <span v-if="boss.stage === 1" class="phase-notch"></span>
      <span v-if="boss.invulnerable" class="seal-grating"></span>
      <span v-if="impact" :key="impact" class="hit-glint"></span>
    </div>
    <GrimmBossFrame v-if="boss.id === 'grimm'"/><KedamaBossFrame v-else/>
    <span v-if="impact" :key="`dust-${impact}`" class="hit-dust" aria-hidden="true"></span>
    <div class="boss-numbers"><span>{{ health }}</span><small>/ {{ boss.maxHp }}</small></div>
    <span v-if="boss.guardian" class="guardian-mark" :aria-label="t('enemy.touhou:slime_guardian.name')" :title="t('enemy.touhou:slime_guardian.name')">
      <svg viewBox="0 0 28 26" fill="none" aria-hidden="true"><path d="M5 19Q3 10 8 8L10 3l4 4 5-2 1 5q7 3 4 10-9 6-19-1Z" fill="#7c718a" stroke="#d8cedc"/><path d="m11 11 7 1-1 7-4 3-4-5Z" fill="#373041" stroke="#b7a4c9"/></svg>
    </span>
    <span v-if="stageChange" :key="stageChange" class="phase-flare" aria-hidden="true"></span>
    <div v-if="boss.spell" class="time-spell"><span class="spell-rule"></span><strong>{{ t(boss.spell.nameKey) }}</strong><span class="spell-clock">{{ t('trial.time_spell_timer', { seconds: boss.spell.remaining.toFixed(1) }) }}</span></div>
  </section>
</template>

<style scoped>
.boss-health{position:absolute;z-index:10;pointer-events:none;top:calc(var(--safe-top,0px) + 5px);left:50%;width:min(660px,55vw);aspect-ratio:6.4;transform:translateX(-50%);font-family:zpix,monospace;color:#dfc4bf;text-shadow:0 2px 2px #09060d;isolation:isolate;--blood-dark:#63182d;--blood-mid:#b62946;--blood-light:#ed8b86;--lag:#975c53;--rim:#dba48c}
.boss-frame{position:absolute;inset:0;width:100%;height:100%;overflow:visible;z-index:2}
.boss-heading{position:absolute;left:20%;right:12%;top:6%;display:flex;align-items:center;gap:12px;height:26%;z-index:3}
h2{margin:0;font:normal clamp(12px,1.15vw,17px)/1.2 zpix,monospace;letter-spacing:3px;white-space:nowrap}
.stage-marks{display:flex;align-items:center;gap:5px}.stage-marks i{width:4px;height:8px;background:#533641;transform:skewX(-18deg)}.stage-marks i.current{background:#eab6a0;box-shadow:0 0 5px #dc536c66}.stage-marks i.passed{background:#94656d;height:4px}
.blood-track{position:absolute;left:18.5%;right:10.5%;top:46%;height:14%;background:linear-gradient(#08070e,#26141f);clip-path:polygon(0 0,98% 0,100% 30%,98% 100%,1% 100%);z-index:1;overflow:hidden}
.blood-fill,.blood-lag{position:absolute;inset:0 auto 0 0;width:var(--health);height:100%}
.blood-fill{background:linear-gradient(0deg,var(--blood-dark),var(--blood-mid) 45%,var(--blood-light) 100%);transition:width .12s ease-out;box-shadow:inset 0 1px #ffeadb66,inset 0 -2px #1c071f88}
.blood-fill span{position:absolute;right:0;top:0;width:2px;height:100%;background:#ffe2ce;box-shadow:0 0 5px #ff809a;opacity:.65}
.blood-lag{background:var(--lag);transition:width .55s cubic-bezier(.2,.6,.3,1) .2s}.healing .blood-lag{transition:none}
.phase-notch{position:absolute;left:var(--threshold);top:0;bottom:0;width:2px;background:#1b0e20;box-shadow:1px 0 #eed5b244}
.boss-numbers{position:absolute;right:12%;top:72%;font:12px/1 zpix,monospace;letter-spacing:1px;color:#e5cabc;z-index:3;font-variant-numeric:tabular-nums}.boss-numbers small{font-size:10px;color:#a58b8f;margin-left:5px}
.seal-grating{position:absolute;inset:0;background:repeating-linear-gradient(110deg,transparent 0 9px,#e4b7a544 10px 11px,transparent 12px 18px);border-top:1px solid #f1cab755}
.sealed .blood-fill{filter:saturate(.3) brightness(.7)}.sealed .blood-fill span{opacity:0}
.hit-glint{position:absolute;left:var(--health);top:0;bottom:0;width:32px;background:linear-gradient(90deg,#fff0dc,transparent);transform:translateX(-100%);animation:hit-glint .3s ease-out both}
.hit-dust{position:absolute;left:var(--hit-x);top:43%;z-index:3;width:3px;height:3px;background:#e9a180;box-shadow:6px -3px #af364d,-4px 2px #f0c8a2;animation:hit-dust .4s ease-out both}.kedama .hit-dust{width:4px;height:2px;background:#ebdce9;box-shadow:7px 2px #b792c9,-3px -4px #d9c5e0;transform:rotate(-25deg)}
.phase-flare{position:absolute;left:17%;right:9%;top:40%;height:28%;background:linear-gradient(90deg,transparent,#ee7a8166,transparent);animation:phase-flare .85s ease-out both;z-index:3;clip-path:polygon(0 45%,30% 38%,55% 0,60% 38%,100% 45%,75% 60%,45% 100%,40% 62%)}
.grimm :deep(.grimm-embers){animation:embers 3.6s ease-in-out infinite;transform-origin:90px 50px}
.grimm.stage-2 :deep(.grimm-seal),.grimm.stage-3 :deep(.grimm-seal){opacity:.15;transform:translateY(4px)}
.grimm :deep(.grimm-seal){transition:transform .5s,opacity .5s}
.grimm.stage-3{--blood-dark:#7a1834;--blood-mid:#cc3453;--blood-light:#f1b1a0}
.time-spell{position:absolute;left:22%;right:8%;top:91%;display:grid;grid-template-columns:1fr auto;gap:6px 14px;text-align:left;color:#edbcae;animation:spell-appear .3s ease-out both}
.time-spell strong{font:normal clamp(11px,1.15vw,16px)/1.5 zpix,monospace;letter-spacing:1px}.spell-clock{font:12px/1.8 zpix,monospace;color:#ffd3b3;font-variant-numeric:tabular-nums}.spell-rule{grid-column:1/-1;height:1px;background:linear-gradient(90deg,#b74a57,transparent)}
.kedama{--blood-dark:#604078;--blood-mid:#a774b5;--blood-light:#edbddc;--lag:#a89bb3;color:#e5d6e5}
.kedama .boss-heading{left:22%;right:16%;top:5%}.kedama h2{letter-spacing:2px}.kedama .blood-track{left:19%;right:12%;height:12%;top:47%;clip-path:polygon(0 0,99% 0,100% 65%,98% 100%,1% 100%)}
.kedama .boss-numbers{right:20%;color:#dfcbe4}.kedama .boss-numbers small{color:#ad99b6}.kedama .stage-marks i{border-radius:50%;transform:none;width:5px;height:5px;background:#695773}.kedama .stage-marks i.current{background:#e1bce6;box-shadow:0 0 5px #ddadeb55}
.kedama :deep(.kedama-charms){transform-origin:110px 64px;animation:charms 4.5s ease-in-out infinite}
.kedama :deep(.kedama-wing){transform-origin:550px 54px;transition:transform .65s cubic-bezier(.2,.8,.2,1)}
.kedama.stage-2 :deep(.kedama-wing){transform:rotate(-7deg) translateY(-2px)}.kedama.stage-2 :deep(.kedama-knot){transform:translateY(5px) rotate(2deg);opacity:.5}.kedama :deep(.kedama-knot){transform-origin:324px 47px;transition:transform .5s,opacity .5s}
.kedama.stage-2{--blood-dark:#5b2d78;--blood-mid:#bb70c1;--blood-light:#f3cce4}.kedama :deep(.kedama-flecks){animation:embers 4.7s ease-in-out infinite}
.guardian-mark{position:absolute;width:25px;height:24px;left:64%;top:68%;z-index:3}.guardian-mark svg{width:100%;height:100%}
.defeated .blood-fill,.defeated .blood-lag{width:0}.defeated :deep(.grimm-embers){animation:embers-out .6s ease-out both}.defeated :deep(.grimm-mask){opacity:.45;transition:opacity .45s}.defeated :deep(.kedama-wing){transform:rotate(13deg) translateY(4px);opacity:.6}.defeated :deep(.kedama-flecks){animation:embers-out .6s ease-out both}
.paused *,.paused :deep(svg *){animation-play-state:paused!important}
@keyframes hit-glint{from{opacity:.85}to{opacity:0}}@keyframes phase-flare{0%{opacity:0;transform:scaleX(.2)}20%{opacity:1}100%{opacity:0;transform:scaleX(1.12)}}
@keyframes hit-dust{from{opacity:.9;translate:0 0}to{opacity:0;translate:7px -10px}}
@keyframes embers{0%,100%{opacity:.25;transform:translateY(1px)}50%{opacity:.8;transform:translateY(-2px)}}@keyframes charms{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1.4deg)}}@keyframes embers-out{to{opacity:0;transform:translateY(-10px)}}@keyframes spell-appear{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media(max-width:1100px){.boss-health{width:56vw}h2{font-size:13px;letter-spacing:1px}.boss-numbers{font-size:10px}.boss-numbers small{font-size:9px}.boss-heading{gap:8px}}
:global(html[data-layout='compact']) .boss-health{top:calc(var(--safe-top,0px) + 54px);width:min(540px,68vw)}
/* 紧凑横屏把整套首领信息放到顶栏下方，避开状态组和右侧四个触控入口。 */
@media(max-height:600px),(max-width:740px){.boss-health{top:calc(var(--safe-top,0px) + 54px);width:min(540px,68vw);max-width:calc(100vw - var(--safe-left,0px) - var(--safe-right,0px) - 36px)}.boss-heading{top:0;height:30%;gap:7px}h2{font-size:12px;letter-spacing:1px}.boss-numbers{top:75%;font-size:10px}.boss-numbers small{font-size:9px}.time-spell{top:97%;left:20%;right:7%;gap:2px 8px}.time-spell strong{font-size:11px}.spell-clock{font-size:10px}.guardian-mark{width:19px;height:18px}.stage-marks{gap:4px}}
@media(prefers-reduced-motion:reduce){*, :deep(svg *){animation:none!important;transition:none!important}}
.boss-hud-enter-active{transition:opacity .45s ease-out,transform .45s ease-out}.boss-hud-leave-active{transition:opacity .65s ease-out,transform .65s ease-out}.boss-hud-enter-from{opacity:0;transform:translate(-50%,-7px)}.boss-hud-leave-to{opacity:0;transform:translate(-50%,-4px)}
</style>
