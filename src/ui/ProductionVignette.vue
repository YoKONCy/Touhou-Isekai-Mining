<script setup lang="ts">
import ItemIcon from './ItemIcon.vue'
import { HEMP_THREAD_ID } from '../content/items/vanilla/ids'
import { t } from '../i18n'

defineProps<{
  kind:'crafting'|'repair'|'smelting'
  itemId:string
  cue:number
  results:readonly {key:number;id:string;qty:number}[]
  repairStage:number
  repairRunning:boolean
  repairDuration:number
  claimResult?:{key:number;id:string;qty:number}|null
  claimDuration?:number
  batchState?:'heating'|'ready'
}>()
</script>

<template>
  <div class="production-vignette" :class="[kind,{'repair-running':repairRunning,'smelt-ready':batchState==='ready','smelt-claimed':!!claimResult}]" :style="{'--repair-duration':`${repairDuration}ms`,'--claim-duration':`${claimDuration??1100}ms`}" aria-hidden="true">
    <template v-if="kind==='crafting'">
      <svg class="scene" viewBox="0 0 230 185">
        <ellipse cx="111" cy="166" rx="91" ry="8" fill="#100d09" opacity=".3"/>
        <path d="M38 131L42 165H54L59 131M176 131L180 165H191L194 131" fill="#66503a" stroke="#352920"/>
        <path d="M23 112L47 98H191L207 112V134H23Z" fill="#70543a" stroke="#3e2e23" stroke-width="2"/>
        <path d="M23 112L47 98H191L207 112Z" fill="#a48455"/>
        <path d="M25 118H205M30 129H201M65 101L54 111M118 100V111M170 100L178 111" fill="none" stroke="#c7a373" opacity=".45"/>
        <path d="M43 122L79 123M95 124L139 121M156 126L188 124M80 105L107 103M125 108H157" fill="none" stroke="#473726" opacity=".6"/>
        <path d="M70 88L133 85L146 108L64 110Z" fill="#c4ae84" stroke="#736047"/>
        <path d="M78 95L113 93M80 101L99 100M120 93L127 102" stroke="#9c845d" stroke-width="1.5"/>
        <g fill="#8f7350" stroke="#453728"><path d="M159 96L187 88L191 92L164 101Z"/><path d="M158 104L182 101L183 104L159 107Z"/></g>
        <g fill="none" stroke="#c6b88c" stroke-width="2"><ellipse cx="43" cy="99" rx="10" ry="4"/><ellipse cx="43" cy="95" rx="10" ry="4"/><path d="M37 91Q28 76 38 68Q47 64 51 70"/></g>
        <g v-if="cue" :key="cue" class="craft-tool" :class="{'fiber-tool':results.at(-1)?.id===HEMP_THREAD_ID}">
          <template v-if="results.at(-1)?.id===HEMP_THREAD_ID">
            <path d="M139 39L163 49L144 86L123 77Z" fill="#756048" stroke="#30271e"/>
            <path d="M137 49L155 56M133 56L151 63M129 63L147 70M127 70L144 76" stroke="#dccaa2" stroke-width="4"/>
            <path d="M142 77Q133 87 113 99" fill="none" stroke="#d2bd90" stroke-width="2"/>
          </template>
          <template v-else>
            <path d="M130 49L138 46L160 94L153 98Z" fill="#98764c" stroke="#3e3024"/>
            <path d="M116 40L147 29L158 52L126 64Z" fill="#786354" stroke="#322924" stroke-width="2"/>
            <path d="M117 40L126 64L133 61L123 37Z" fill="#b3a388"/>
            <path d="M131 37L141 34L149 49L139 54Z" fill="#91816c"/>
          </template>
        </g>
        <g v-if="cue" :key="`chips-${cue}`" class="craft-chips" fill="#d5b97e"><path d="M142 98L146 91L150 95Z"/><path d="M151 101L160 95L159 102Z"/><path d="M138 101L134 97L132 103Z"/></g>
      </svg>
      <div class="display-item"><ItemIcon :id="itemId" :size="66"/></div>
      <!-- 每次制作各自保留成品快照，换配方和连续点击不会串图或挡住操作。 -->
      <div v-for="result in results" :key="result.key" class="craft-result" :style="{'--lane':`${(result.key%3-1)*16}px`}">
        <ItemIcon :id="result.id" :size="48"/><span>+{{result.qty}}</span><strong>{{t('ui.production.craft_success')}}</strong>
      </div>
    </template>
    <template v-else>
      <svg :key="repairRunning?cue:'still'" class="scene furnace-scene" viewBox="0 0 230 185">
        <ellipse cx="117" cy="165" rx="94" ry="7" fill="#100d09" opacity=".3"/>
        <path d="M65 22H99V90H65Z" fill="#595154" stroke="#b7a48b" stroke-width="2"/>
        <path d="M67 25H97M80 26V55M66 55H98M86 56V81" stroke="#3c3535"/>
        <path d="M30 81H149V146H30Z" fill="#817266" stroke="#b39c7c" stroke-width="2"/>
        <path d="M30 102H149M30 123H149M53 81V102M102 81V102M76 102V123M126 102V123" stroke="#584d45"/>
        <path d="M60 146V123Q88 83 118 123V146Z" fill="#241e20" stroke="#ac987c" stroke-width="2"/>
        <path v-if="repairStage===0" class="furnace-cracks" d="M43 88L52 110L43 124M135 98L126 112L133 132" fill="none" stroke="#33282c" stroke-width="2"/>
        <g v-if="repairStage>0||repairRunning&&repairStage===0" :class="{'masonry-patches':repairStage===0}">
          <path d="M38 87L51 85L60 104L55 126L40 130L48 111Z M129 97L141 99L134 113L141 134L128 138L121 113Z" fill="#afa08a" stroke="#706557"/>
          <path d="M43 92L51 92M45 126L53 124M128 109L134 104M131 127L136 134" stroke="#ded1ae"/>
          <path d="M23 88H29V149H23Z M149 88H155V149H149Z M22 145H58V151H22Z" fill="#8e724e" stroke="#4c3c2c"/>
          <path d="M26 92V137M152 93V138" stroke="#c0a172"/>
        </g>
        <g class="bellows" :class="{'bellows-test':repairStage===1,'bellows-pump':repairStage===2}">
          <path d="M155 119L189 108L196 118L164 129Z M155 134L186 124L195 133L164 144Z" fill="#9c7750" stroke="#5a4535"/>
          <path d="M162 128L190 119V131L164 140Z" :fill="repairStage>=2?'#c5af87':'#655044'" stroke="#48372c"/>
          <path v-if="repairStage<2" class="bellows-tear" d="M176 123L178 134L181 126" fill="none" stroke="#2c2428" stroke-width="2"/>
          <g v-if="repairStage>=2||repairRunning&&repairStage===1" :class="{'bellows-patch':repairStage===1}"><path d="M169 126L187 120V134L169 139Z" fill="#bfa77d" stroke="#796447"/><path :class="{seam:repairStage===1}" d="M172 128L175 134L178 126L181 132L184 124" fill="none" stroke="#e2d0a1" stroke-width="2"/></g>
        </g>
        <g v-if="repairStage>=3||repairRunning&&repairStage===2" class="nozzle"><path d="M144 129H161V136H144Z" fill="#716c61" stroke="#c5b695"/><path d="M147 127H152V138H147Z" fill="#aaa18b"/><path d="M158 128H163V137H158Z" fill="#a68a57"/></g>
        <g v-if="repairRunning&&repairStage===2||kind==='smelting'&&batchState" class="furnace-fire"><path d="M73 141Q68 131 82 119Q80 129 89 112Q111 133 101 141Z" fill="#c7783a"/><path d="M79 141Q79 132 90 121Q98 133 96 141Z" fill="#e9bb6c"/><path d="M87 141Q83 136 90 130Q96 137 93 141Z" fill="#f3de9e"/></g>
        <path d="M71 143H108M72 132H107" stroke="#ab9b7a" stroke-width="3"/>
        <g v-if="repairRunning&&repairStage===2||kind==='smelting'&&batchState==='heating'" class="furnace-smoke" fill="none" stroke="#c8bda2" stroke-linecap="round" opacity=".45"><path d="M76 17Q66 8 78 1M87 16Q97 9 88 0"/></g>
        <g v-if="repairRunning&&repairStage===0" class="repair-hammer"><path d="M50 54L73 97L67 101L43 58Z" fill="#997b52" stroke="#423329"/><path d="M30 48L57 36L69 58L40 70Z" fill="#8f8572" stroke="#413b34" stroke-width="2"/><path d="M31 48L40 70L46 67L36 46Z" fill="#c8bba0"/></g>
        <g v-if="repairRunning&&repairStage===1" class="repair-needle"><path d="M183 89L176 123" stroke="#ded5bc" stroke-width="2"/><path d="M184 89Q211 83 201 111Q197 120 183 128" fill="none" stroke="#d0b787" stroke-width="1.5"/></g>
        <path d="M25 151H207" stroke="#b79d7544"/>
        <g v-if="kind==='smelting'">
          <path d="M64 151L73 145H132L142 151V158H64Z" fill="#514a41" stroke="#8f826b"/>
          <path d="M65 151H140M76 147H130" stroke="#b5a17a" stroke-width=".8"/>
          <g v-if="claimResult" :key="`tongs-${claimResult.key}`" class="claim-tongs" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M132 105L96 134L81 132M139 113L105 130L94 140" stroke="#363c3b" stroke-width="5"/>
            <path d="M132 105L96 134L81 132M139 113L105 130L94 140" stroke="#a9b2a4" stroke-width="2.3"/>
            <circle cx="111" cy="123" r="2" fill="#d5c397" stroke="#6b6753" stroke-width="1"/>
          </g>
          <g v-if="claimResult" :key="`steam-${claimResult.key}`" class="claim-steam" fill="none" stroke="#d7c7a5" stroke-width="1.1" opacity=".5"><path d="M85 122Q79 112 85 107M94 122Q101 111 94 103"/></g>
        </g>
      </svg>
      <template v-if="kind==='smelting'">
        <!-- 始终使用本批成品图案；领取后快照独立保留到演出结束。 -->
        <div :key="claimResult?.key??'waiting'" class="smelt-result" :class="{claiming:!!claimResult}" :style="{visibility:claimResult||batchState==='ready'?'visible':'hidden'}">
          <i class="ingot-glow"></i><ItemIcon :id="claimResult?.id??itemId" :size="48"/><span v-if="claimResult">+{{claimResult.qty}}</span>
        </div>
        <strong v-if="claimResult" :key="`stamp-${claimResult.key}`" class="claim-stamp">{{t('ui.production.claim_success')}}</strong>
      </template>
      <span v-if="repairRunning" class="repair-caption">{{t(`ui.production.repair_motion${repairStage+1}`)}}</span>
      <strong v-if="repairRunning" class="repair-stamp">{{t('ui.production.repair_success')}}</strong>
    </template>
  </div>
</template>

<style scoped>
.production-vignette{position:relative;flex:none;width:190px;height:160px;isolation:isolate;pointer-events:none;background:radial-gradient(ellipse at 50% 76%,#bba37412,transparent 66%)}
.scene{display:block;width:100%;height:100%;overflow:visible}.display-item{position:absolute;left:48px;top:17px;filter:drop-shadow(0 5px 4px #0005)}
.smelt-result{position:absolute;left:38%;top:70%;transform:translate(-50%,-50%) scale(.42);filter:drop-shadow(0 3px 2px #17110c66)}.ingot-glow{position:absolute;inset:-10px;border-radius:50%;background:radial-gradient(ellipse,#efd0a333,#d2903922 35%,transparent 70%);z-index:-1}.smelt-result.claiming{animation:smelt-claim var(--claim-duration) cubic-bezier(.2,.65,.2,1) both}.smelt-result span{position:absolute;right:-8px;bottom:0;font-size:13px;color:#e8d2a0;font-weight:700;text-shadow:0 1px 2px #20170f;animation:claim-count var(--claim-duration) ease-out both}.claim-tongs{transform-box:fill-box;transform-origin:right center;animation:claim-tongs var(--claim-duration) ease-in-out both}.claim-steam{animation:claim-steam var(--claim-duration) ease-out both}.claim-stamp{position:absolute;right:0;top:13px;padding:5px 8px;border:1px solid #b1b48a77;background:#23261ceb;color:#d0d7a5;font-size:12px;letter-spacing:2px;transform:rotate(-5deg);animation:claim-stamp var(--claim-duration) ease-out both}.smelting .furnace-fire{animation:smelt-fire 1.2s ease-in-out infinite alternate}.smelt-ready .furnace-fire{opacity:.6}.smelting .furnace-smoke{animation:smelt-smoke 2.2s ease-out infinite}
.craft-tool{transform-box:fill-box;transform-origin:80% 95%;animation:craft-tap .46s ease-out both}.fiber-tool{animation:thread-twist .46s ease-in-out both}.craft-chips{transform-box:fill-box;transform-origin:center;animation:craft-chips .55s ease-out both}
.craft-result{position:absolute;left:102px;top:50px;display:grid;justify-items:center;min-width:76px;opacity:0;animation:craft-result 1.2s ease-out both;filter:drop-shadow(0 2px 3px #100b)}.craft-result span{position:absolute;right:5px;top:20px;font-size:13px;color:#f0ddb0;font-weight:700}.craft-result strong{margin-top:3px;font-size:11px;letter-spacing:1px;white-space:nowrap;color:#dfca9c;text-shadow:0 1px #251b12}
.repair-caption{position:absolute;left:0;right:0;bottom:0;text-align:center;font-size:9px;letter-spacing:2px;color:#b49d79}.repair-stamp{position:absolute;right:1px;top:20px;padding:5px 6px;border:1px solid #b1b48a66;background:#23261cd9;color:#d0d7a5;font-size:11px;letter-spacing:2px;opacity:0;transform:rotate(-7deg);animation:repair-stamp var(--repair-duration) ease-out both}
.repair-running .masonry-patches{animation:masonry-set var(--repair-duration) ease-out both}.repair-running .furnace-cracks,.repair-running .bellows-tear{animation:repair-hide var(--repair-duration) ease-out both}.repair-hammer{transform-box:fill-box;transform-origin:80% 95%;animation:repair-hammer var(--repair-duration) ease-in-out both}.repair-needle{animation:repair-needle var(--repair-duration) ease-in-out both}.bellows-patch{animation:cloth-set var(--repair-duration) ease-out both}.seam{stroke-dasharray:40;stroke-dashoffset:40;animation:seam-set var(--repair-duration) ease-out both}.bellows-test,.bellows-pump{transform-box:fill-box;transform-origin:left center}.repair-running .bellows-test{animation:bellows-test var(--repair-duration) ease-in-out both}.repair-running .bellows-pump{animation:bellows-pump var(--repair-duration) ease-in-out both}.repair-running .nozzle{animation:nozzle-set var(--repair-duration) ease-out both}.furnace-fire{transform-box:fill-box;transform-origin:center bottom;animation:fire-light var(--repair-duration) ease-out both}.furnace-smoke{animation:smoke-rise var(--repair-duration) ease-out both}
@keyframes craft-tap{0%{opacity:0;transform:translateY(-7px) rotate(18deg)}15%{opacity:1}43%{transform:translateY(31px) rotate(-15deg)}66%{transform:translateY(-3px) rotate(12deg)}82%{opacity:1;transform:translateY(29px) rotate(-14deg)}100%{opacity:0;transform:translateY(-5px) rotate(15deg)}}
@keyframes thread-twist{0%{opacity:0;transform:translate(3px,-5px) rotate(-12deg)}15%{opacity:1}40%{transform:translate(-4px,3px) rotate(18deg)}70%{opacity:1;transform:translate(3px,-2px) rotate(-9deg)}100%{opacity:0;transform:translate(-2px,4px) rotate(14deg)}}
@keyframes craft-chips{0%,30%{opacity:0;transform:scale(.5)}45%{opacity:.9}100%{opacity:0;transform:translateY(-10px) scale(1.6)}}
@keyframes craft-result{0%,16%{opacity:0;transform:translate(var(--lane),20px) scale(.35)}36%{opacity:1;transform:translate(var(--lane),-8px) scale(1.08)}55%{opacity:1;transform:translate(var(--lane),-14px) scale(1)}80%{opacity:.9}100%{opacity:0;transform:translate(var(--lane),-37px) scale(.93)}}
@keyframes masonry-set{0%,18%{opacity:0;transform:translateY(-5px)}42%{opacity:.7}65%,100%{opacity:1;transform:none}}
@keyframes repair-hide{0%,35%{opacity:1}70%,100%{opacity:0}}
@keyframes repair-hammer{0%{opacity:0;transform:translateY(-4px) rotate(20deg)}12%{opacity:1}25%,52%{transform:translateY(26px) rotate(-14deg)}38%,65%{transform:translateY(-4px) rotate(20deg)}76%{opacity:1;transform:translateY(26px) rotate(-14deg)}92%,100%{opacity:0;transform:translateY(-4px) rotate(18deg)}}
@keyframes cloth-set{0%,12%{opacity:0;transform:translateY(-6px)}30%,100%{opacity:1;transform:none}}
@keyframes seam-set{0%,25%{stroke-dashoffset:40}68%,100%{stroke-dashoffset:0}}
@keyframes repair-needle{0%{opacity:0;transform:translate(3px,-5px)}15%{opacity:1}30%,51%{transform:translate(-3px,9px)}40%,62%{transform:translate(3px,-5px)}75%,100%{opacity:0;transform:translate(-3px,9px)}}
@keyframes bellows-test{0%,72%,100%{transform:none}82%,94%{transform:scaleY(.76)}88%{transform:scaleY(1.04)}}
@keyframes nozzle-set{0%,10%{opacity:0;transform:translateX(20px)}35%,100%{opacity:1;transform:none}}
@keyframes bellows-pump{0%,38%,68%,90%,100%{transform:none}50%,80%{transform:scaleY(.73)}}
@keyframes fire-light{0%,50%{opacity:0;transform:scale(.3)}62%{opacity:.8;transform:scale(.8,1.05)}72%{opacity:1;transform:scale(1,.92)}85%{transform:scale(.95,1.08)}100%{opacity:1;transform:none}}
@keyframes smoke-rise{0%,58%{opacity:0;transform:translateY(4px)}78%{opacity:.35}100%{opacity:.45;transform:translateY(-4px)}}
@keyframes repair-stamp{0%,78%{opacity:0;transform:rotate(-7deg) scale(1.3)}88%,100%{opacity:1;transform:rotate(-7deg) scale(1)}}
@keyframes smelt-claim{0%{opacity:1;transform:translate(-50%,-50%) scale(.42)}28%{opacity:1;transform:translate(calc(-50% + 22px),calc(-50% - 3px)) scale(.5)}58%{opacity:1;transform:translate(calc(-50% + 24px),calc(-50% - 42px)) scale(1.08)}78%{opacity:1;transform:translate(calc(-50% + 24px),calc(-50% - 46px)) scale(1)}100%{opacity:0;transform:translate(calc(-50% + 28px),calc(-50% - 63px)) scale(.88)}}
@keyframes claim-tongs{0%{opacity:0;transform:translate(18px,-3px) rotate(-7deg)}12%,22%{opacity:1;transform:none}40%{opacity:1;transform:translate(27px,-4px) rotate(4deg)}62%,100%{opacity:0;transform:translate(42px,-12px) rotate(8deg)}}
@keyframes claim-steam{0%,15%{opacity:0;transform:translateY(3px)}35%{opacity:.45;transform:translate(15px,-7px)}72%,100%{opacity:0;transform:translate(27px,-27px)}}
@keyframes claim-count{0%,38%{opacity:0;transform:translateY(4px)}55%,85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-4px)}}
@keyframes claim-stamp{0%,45%{opacity:0;transform:rotate(-5deg) scale(1.18)}62%,85%{opacity:1;transform:rotate(-5deg) scale(1)}100%{opacity:0;transform:rotate(-5deg) scale(1)}}
@keyframes smelt-fire{from{transform:scale(.93,.92)}to{transform:scale(1,1.06)}}
@keyframes smelt-smoke{0%{opacity:0;transform:translateY(3px)}30%{opacity:.3}100%{opacity:0;transform:translateY(-12px)}}
@media(max-width:700px){.production-vignette{width:155px;height:140px}.display-item{left:34px;top:10px}.craft-result{left:70px;top:35px}}
@media(prefers-reduced-motion:reduce){.claim-tongs,.claim-steam{display:none}.smelting .furnace-fire,.smelting .furnace-smoke{animation:none}.smelt-result.claiming{transform:translate(calc(-50% + 24px),calc(-50% - 42px)) scale(1);animation:quiet-result var(--claim-duration) ease-out both}.claim-stamp{animation:quiet-result var(--claim-duration) ease-out both}.smelt-result span{animation:none}}
@media(prefers-reduced-motion:reduce){.craft-tool,.craft-chips,.repair-hammer,.repair-needle{display:none}.craft-result{animation:quiet-result .7s ease-out both}.repair-running :is(.masonry-patches,.bellows-patch,.seam,.bellows-test,.bellows-pump,.nozzle,.furnace-fire,.furnace-smoke){animation:none;transform:none;stroke-dashoffset:0}.repair-running :is(.furnace-cracks,.bellows-tear){opacity:0;animation:none}.repair-stamp{animation:quiet-result var(--repair-duration) ease-out both}@keyframes quiet-result{0%{opacity:0}20%,85%{opacity:1}100%{opacity:0}}}
</style>
