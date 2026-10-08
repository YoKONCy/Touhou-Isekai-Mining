<script setup lang="ts">
/**
 * 对话覆盖层（全局常驻）
 *
 * - 双主题叙事框：纸签姓名栏 + 打字机台词 + 轻呼吸继续标记；
 * - 旁白节点（narration）：居中黑底字幕，用于黑屏 OS/剧情旁述；
 * - 选项：木牌按钮纵向排列，hover 铜金高亮；
 * - 输入拦截：对话期间空格/回车/F/E/点击只推进对话，绝不漏进游戏
 *   （玩法模块每帧另查 dialogue.isActive 冻结输入，双保险）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { dialogue } from '../game/dialogue/dialogueService'
import { resolvePortraits } from '../game/dialogue/portraitPresentation'
import { resolveDialogueCG } from '../game/dialogue/dialogueCG'
import type { DialogueCG } from '../game/dialogue/types'
import { t } from '../i18n'

/** 打字机：每字间隔 ms */
const CHAR_MS = 26

/** 两套场景主题共用布局，不随台词情绪跳色。 */
withDefaults(defineProps<{ theme?: 'warm' | 'ink' }>(), { theme: 'warm' })

const revealed = ref(0)
let typeTimer = 0
const punctuationPause = ref(false)

function punctuationDelay(text: string, end: number): number {
  const prefix = text.slice(0, end)
  const dots = prefix.match(/\.+$/)?.[0].length ?? 0
  if (dots > 0 && dots % 3 === 0) return 500
  const ellipses = prefix.match(/…+$/)?.[0].length ?? 0
  if (ellipses > 0 && (ellipses % 2 === 0 || text[end] !== '…')) return 500
  return CHAR_MS
}

function typeNext(): void {
  punctuationPause.value = false
  if (revealed.value >= fullText.value.length) { clearType(); return }
  revealed.value += 1
  const delay = punctuationDelay(fullText.value, revealed.value)
  punctuationPause.value = delay > CHAR_MS
  typeTimer = window.setTimeout(typeNext, delay)
}

/** 当前节点的完整译文（带插值） */
const fullText = computed(() => {
  const node = dialogue.state.value?.node
  if (!node?.text) return ''
  return t(node.text, node.params as Record<string, string> | undefined)
})
const isNarration = computed(() => dialogue.state.value?.node.narration === true)
/** 游戏内 OS：底部窄字幕，世界不被压黑（战斗/探索旁述） */
const isOs = computed(() => isNarration.value && dialogue.state.value?.node.os === true)
const speakerName = computed(() => {
  const sp = dialogue.state.value?.node.speaker
  return sp ? t(sp) : ''
})
const loadedPortraits = ref<Record<string, boolean>>({})
const requestedCG=computed(()=>resolveDialogueCG(dialogue.state.value?.node))
const visibleCG=ref<DialogueCG>()
const cgOnStage=ref(false)
let cgHoldTimer=0
let cgLoadTimer=0
let cgSequence=0
let cgSceneFinished=false
const CG_HOLD_MS=2800
function clearCGHold():void {if(cgHoldTimer)window.clearTimeout(cgHoldTimer);cgHoldTimer=0}
function clearCGLoad():void {if(cgLoadTimer)window.clearTimeout(cgLoadTimer);cgLoadTimer=0}
// 每张 CG 独占当前旁白的演出节拍，加载、停留、左侧退场全部结束后才释放推进。
watch([
  ()=>dialogue.seq.value,
  ()=>requestedCG.value?.src,
  ()=>requestedCG.value?loadedPortraits.value[requestedCG.value.src]:false
],([sequence,src,ready],[previousSequence,previousSrc])=>{
  if(sequence!==previousSequence||src!==previousSrc){clearCGHold();clearCGLoad();cgSequence=sequence;cgSceneFinished=false;visibleCG.value=undefined}
  if(!src||cgSceneFinished){visibleCG.value=undefined;return}
  if(ready===false){cgSceneFinished=true;visibleCG.value=undefined;clearCGLoad();if(!cgOnStage.value)dialogue.finishCG(sequence);return}
  if(!ready){
    if(!cgLoadTimer)cgLoadTimer=window.setTimeout(()=>{
      cgLoadTimer=0
      if(cgSequence!==sequence||cgOnStage.value)return
      cgSceneFinished=true;dialogue.finishCG(sequence)
    },15000)
    return
  }
  clearCGLoad()
  visibleCG.value=requestedCG.value
},{immediate:true})
function cgEntered(element:Element):void {
  const src=element.getAttribute('data-cg-src'),sequence=Number(element.getAttribute('data-cg-sequence'))
  if(!src||visibleCG.value?.src!==src||sequence!==cgSequence)return
  clearCGHold()
  cgHoldTimer=window.setTimeout(()=>{
    cgHoldTimer=0
    if(visibleCG.value?.src!==src||sequence!==cgSequence)return
    cgSceneFinished=true;visibleCG.value=undefined
  },CG_HOLD_MS)
}
function cgLeft(element:Element):void {
  if(!visibleCG.value)cgOnStage.value=false
  dialogue.finishCG(Number(element.getAttribute('data-cg-sequence')))
}
const portraits = computed(() => cgOnStage.value?[]:resolvePortraits(dialogue.state.value?.node))
function portraitReady(event: Event): void {
  const src = (event.target as HTMLImageElement).getAttribute('src')
  if (src) loadedPortraits.value[src] = true
}
function portraitFailed(event: Event): void {
  const src = (event.target as HTMLImageElement).getAttribute('src')
  if (src) loadedPortraits.value[src] = false
}
const visibleChoices = computed(() => dialogue.state.value?.choices ?? [])
const typingDone = computed(() => revealed.value >= fullText.value.length && !punctuationPause.value)
/** 打字机当前应显示的文本 */
const shownText = computed(() => fullText.value.slice(0, revealed.value))

/** 停止打字计时器 */
function clearType(): void {
  clearTimeout(typeTimer)
  typeTimer = 0
  punctuationPause.value = false
}

/** 换节点：重启打字机（immediate：组件挂载晚于首句开播时也要立刻起字） */
watch(
  () => [dialogue.seq.value, dialogue.state.value !== null],
  () => {
    clearType()
    revealed.value = 0
    if (!fullText.value) return
    typeTimer = window.setTimeout(typeNext, CHAR_MS)
  },
  { immediate: true }
)

/** 推进：自动停顿静默期完全不响应；打字中先补全文；补全后再推进对话 */
function proceed(): void {
  if (!dialogue.state.value) return
  if (dialogue.isAutoLocked) return
  if (!typingDone.value) {
    revealed.value = fullText.value.length
    clearType()
    return
  }
  dialogue.advance()
}

function choose(i: number): void {
  dialogue.choose(i)
}

/** 键盘推进（捕获阶段拦截，防止 F/E/空格漏进游戏输入表） */
const ADVANCE_KEYS = new Set(['Space', 'Enter', 'KeyF', 'KeyE'])
function onKey(e: KeyboardEvent): void {
  if (!dialogue.state.value) return
  if (ADVANCE_KEYS.has(e.code)) {
    e.preventDefault()
    e.stopPropagation()
    proceed()
  }
}

onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  clearType()
  clearCGHold()
  clearCGLoad()
})
</script>

<template>
  <!-- 演出层常驻，结束对话不会截断CG左侧滑出的动画。 -->
  <div class="dlg-cg-layer" aria-hidden="true">
    <img v-if="requestedCG" class="dlg-cg-preload" :src="requestedCG.src" alt="" @load="portraitReady" @error="portraitFailed"/>
    <Transition name="dlg-cg-slide" @before-enter="cgOnStage=true" @after-enter="cgEntered" @after-leave="cgLeft">
      <div v-if="visibleCG" :key="`${cgSequence}:${visibleCG.src}`" class="dlg-cg" :data-cg-src="visibleCG.src" :data-cg-sequence="cgSequence">
        <img :src="visibleCG.src" alt="" draggable="false" @click="proceed"/>
      </div>
    </Transition>
  </div>
  <div v-if="dialogue.state.value" class="dlg-root" :class="[{ narration: isNarration, os: isOs, 'has-cg': cgOnStage }, 'theme-' + theme]" @click.self="cgOnStage&&proceed()">
    <!-- 游戏内 OS 旁述：底部窄字幕条（不压屏，世界持续可见） -->
    <div v-if="isOs" class="dlg-os-bar" @click="proceed">
      <p class="os-text" :class="{ done: typingDone }">{{ shownText }}</p>
      <span v-if="typingDone && visibleChoices.length === 0 && !dialogue.isAutoLocked" class="os-hint">{{ t('ui.dialogue.continue') }}</span>
      <div v-if="visibleChoices.length" class="dlg-choices center">
        <button v-for="(c, i) in visibleChoices" :key="i" class="dlg-choice" @click="choose(i)">
          <span class="mark">◇</span>{{ t(c.text) }}
        </button>
      </div>
    </div>

    <!-- 电影式旁白 / 黑屏字幕：居中压屏 -->
    <div v-else-if="isNarration" class="dlg-narration">
      <p class="narration-text" :class="{ done: typingDone }" @click="proceed">{{ shownText }}</p>
      <span v-if="typingDone && visibleChoices.length === 0 && !dialogue.isAutoLocked" class="narration-hint">{{ t('ui.dialogue.continue') }}</span>
      <div v-if="visibleChoices.length" class="dlg-choices center">
        <button v-for="(c, i) in visibleChoices" :key="i" class="dlg-choice" @click="choose(i)">
          <span class="mark">◇</span>{{ t(c.text) }}
        </button>
      </div>
    </div>

    <!-- 立绘与正文共用底部锚点；立绘不接收指针，也不覆盖阅读面。 -->
    <div v-else class="dlg-stage">
      <div v-for="p in portraits" :key="p.actor??p.src" class="dlg-portrait"
        :class="[p.side ?? 'left', { visible: loadedPortraits[p.src], listening: !p.active, paired: portraits.length > 1 }]" aria-hidden="true">
        <img :src="p.src" alt="" draggable="false"
          :class="{ pixel: p.rendering !== 'smooth' }" @load="portraitReady" @error="portraitFailed" />
      </div>
    <div class="dlg-box hud-panel" @click="proceed">
      <div v-if="speakerName" class="dlg-nameplate">
        <span class="name-seal" aria-hidden="true"></span>{{ speakerName }}
      </div>
      <p class="dlg-text" :class="{ done: typingDone }">{{ shownText }}</p>
      <span v-if="typingDone && visibleChoices.length === 0 && !dialogue.isAutoLocked" class="dlg-next">{{ t('ui.dialogue.continue') }} <b>▼</b></span>
      <div v-if="visibleChoices.length" class="dlg-choices" @click.stop>
        <button v-for="(c, i) in visibleChoices" :key="i" class="dlg-choice" @click="choose(i)">
          <span class="mark">◇</span>{{ t(c.text) }}
        </button>
      </div>
    </div>
    </div>
  </div>
</template>

<style scoped>
.dlg-root {
  --dlg-bg: rgba(25, 23, 22, .96);
  --dlg-bottom: rgba(16, 15, 16, .97);
  --dlg-text: #eee7d9;
  --dlg-accent: #bea17b;
  --dlg-border: rgba(174, 150, 116, .36);
  --dlg-sign: #302c27;
  --dlg-seal: #94433e;
  position: absolute;
  inset: 0;
  z-index: 40;
}
.dlg-root.theme-ink {
  --dlg-bg: rgba(18, 23, 32, .96);
  --dlg-bottom: rgba(10, 14, 22, .97);
  --dlg-text: #e0e6ed;
  --dlg-accent: #aab9c8;
  --dlg-border: rgba(129, 150, 170, .35);
  --dlg-sign: #242d39;
  --dlg-seal: #a64451;
}

.dlg-cg-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:39}
.dlg-cg-preload{display:none}
.dlg-cg{position:absolute;inset:0;pointer-events:none}
.dlg-cg img{position:absolute;top:5%;left:50%;transform:translateX(-50%);width:min(66%,800px);height:62%;object-fit:contain;user-select:none;pointer-events:auto;cursor:pointer}
.dlg-cg-slide-enter-active{transition:transform .42s cubic-bezier(.18,.75,.25,1)}
.dlg-cg-slide-leave-active{transition:transform .38s cubic-bezier(.55,0,.85,.35)}
.dlg-cg-slide-enter-from{transform:translateX(100%)}
.dlg-cg-slide-leave-to{transform:translateX(-100%)}
.dlg-cg-slide-leave-active img{pointer-events:none}
.dlg-root.has-cg .dlg-narration{justify-content:flex-end;padding:0 14% 6%;background:transparent}
.dlg-root.has-cg .narration-text{box-sizing:border-box;width:100%;padding:16px 24px;border-top:1px solid var(--dlg-border);background:#171320e8;font-size:clamp(18px,1.8vw,22px);line-height:1.8}
@media(prefers-reduced-motion:reduce){.dlg-cg-slide-enter-active,.dlg-cg-slide-leave-active{transition-duration:.01ms}}

/* OS 模式：根层不接收指针，世界可点（只有字幕条自身可点推进） */
.dlg-root.os {
  pointer-events: none;
}
.dlg-os-bar {
  position: absolute;
  left: 12%;
  right: 12%;
  bottom: 6%;
  min-height: 64px;
  padding: 14px 30px 16px;
  background: linear-gradient(180deg, rgba(10, 8, 14, 0.62), rgba(5, 4, 9, 0.78));
  border-top: 1px solid rgba(214, 172, 96, 0.4);
  border-bottom: 1px solid rgba(0, 0, 0, 0.6);
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
}
.os-text {
  margin: 0;
  font-family: var(--font-sign);
  font-size: 19px;
  line-height: 1.8;
  letter-spacing: 3px;
  color: #e8e0ce;
  text-align: center;
  white-space: pre-wrap;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.95);
}
.os-hint {
  display: block;
  margin-top: 6px;
  text-align: right;
  font-size: 12px;
  letter-spacing: 2px;
  color: rgba(214, 172, 96, 0.75);
  animation: dlg-blink 1.1s ease-in-out infinite;
}

/* 立绘放在叙事栏后方，下缘被正文遮住；长台词和选项增高时一起上移。 */
.dlg-stage {
  position: absolute;
  left: 50%;
  bottom: 6%;
  width: min(980px, 82%);
  max-height: 48%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
}
.dlg-portrait {
  position: absolute;
  bottom: calc(100% - 22px);
  width: min(42%, 340px);
  height: min(58vh, 520px);
  max-height: calc(94vh - 100%);
  pointer-events: none;
  opacity: 0;
  filter: brightness(1);
  transform-origin: center bottom;
  transition: opacity .16s ease, filter .26s ease, transform .26s cubic-bezier(.22,.61,.36,1);
}
.dlg-portrait.paired { transform: scale(1.035); filter: brightness(1.06); }
.dlg-portrait.paired.listening { transform: scale(.92); filter: brightness(.62) saturate(.85); }
.dlg-portrait.left { left: 2%; }
.dlg-portrait.right { right: 2%; }
.dlg-portrait.visible { opacity: 1; }
.dlg-portrait img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
}
.dlg-portrait img.pixel { image-rendering: pixelated; }
/* —— 克制东方叙事框：干净阅读面，装饰只留在边界 —— */
.dlg-box {
  position: relative;
  z-index: 1;
  width: 100%;
  box-sizing: border-box;
  min-height: min(142px, 48vh);
  max-height: 48vh;
  overflow-y: auto;
  padding: 30px 34px 42px;
  color: var(--dlg-text);
  background: linear-gradient(165deg, var(--dlg-bg), var(--dlg-bottom));
  border: 1px solid var(--dlg-border);
  border-radius: 2px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, .4), inset 0 1px rgba(255, 255, 255, .035);
  cursor: pointer;
  user-select: none;
}
.dlg-nameplate {
  position: absolute;
  top: 0;
  left: 24px;
  padding: 6px 14px 7px;
  display: flex;
  align-items: center;
  gap: 11px;
  font-family: var(--font-sign);
  font-size: 19px;
  letter-spacing: 2px;
  color: var(--dlg-accent);
  background: var(--dlg-sign);
  border: 1px solid var(--dlg-border);
  border-top: 0;
  border-radius: 0 0 2px 2px;
  white-space: nowrap;
}
.name-seal {
  width: 8px;
  height: 13px;
  border: 1px solid var(--dlg-seal);
  background: var(--dlg-seal);
  box-shadow: inset 0 0 0 2px var(--dlg-sign);
  transform: rotate(-5deg);
  flex-shrink: 0;
}
.dlg-text {
  margin: 17px 0 0;
  font-size: clamp(17px, 1.8vw, 21px);
  line-height: 1.85;
  letter-spacing: 1px;
  color: var(--dlg-text);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.dlg-next {
  position: absolute;
  right: 28px;
  bottom: 15px;
  font-size: 12px;
  color: var(--dlg-accent);
  letter-spacing: 1px;
}
.dlg-next b {
  display: inline-block;
  margin-left: 8px;
  font-size: 10px;
  color: var(--dlg-seal);
  animation: dlg-breathe 2.2s ease-in-out infinite;
}
@keyframes dlg-breathe {
  0%, 100% { opacity: .55; transform: translateY(0); }
  50% { opacity: 1; transform: translateY(2px); }
}
@keyframes dlg-blink {
  0%,
  100% {
    opacity: 0.35;
  }
  50% {
    opacity: 1;
  }
}

/* —— 选项 —— */
.dlg-choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}
.dlg-choices.center {
  align-items: center;
  margin-top: 22px;
}
.dlg-choice {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 20px;
  font-family: inherit;
  font-size: 16px;
  letter-spacing: 2px;
  color: var(--dlg-text);
  background: var(--dlg-sign);
  border: 1px solid var(--dlg-border);
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.12s ease;
}
.dlg-choices.center .dlg-choice {
  align-self: auto;
}
.dlg-choice .mark {
  color: var(--brass);
  font-size: 12px;
}
.dlg-choice:hover {
  color: var(--dlg-text);
  border-color: var(--dlg-accent);
  background: var(--dlg-bg);
  box-shadow: inset 3px 0 var(--dlg-seal);
  transform: translateX(4px);
}
.dlg-choice:hover .mark {
  color: var(--brass-hi);
}

/* —— 旁白：黑底居中 —— */
.dlg-narration {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 14%;
  background: radial-gradient(ellipse at center, rgba(4, 3, 8, 0.82), rgba(2, 1, 5, 0.95));
  cursor: pointer;
}
.narration-text {
  margin: 0;
  max-width: 760px;
  font-family: var(--font-sign);
  font-size: 22px;
  line-height: 2.1;
  letter-spacing: 4px;
  color: #d8cfbf;
  text-align: center;
  white-space: pre-wrap;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.9);
}
.narration-hint {
  margin-top: 34px;
  font-size: 13px;
  letter-spacing: 3px;
  color: rgba(214, 172, 96, 0.75);
  animation: dlg-blink 1.1s ease-in-out infinite;
}
/* 键盘选项也能辨认焦点；窄视口保留正文和提示的阅读空间。 */
.dlg-choice:focus-visible {
  outline: 2px solid var(--dlg-accent);
  outline-offset: 3px;
}
.dlg-choice .mark, .dlg-choice:hover .mark { color: var(--dlg-accent); }
@media (max-width: 640px) {
  .dlg-stage { width: 92%; bottom: 7%; }
  .dlg-box { padding: 28px 20px 40px; }
  .dlg-portrait { width: 55%; height: min(45vh, 360px); max-height: calc(93vh - 100%); }
  .dlg-portrait.paired { width: 46%; }
  .dlg-nameplate { left: 14px; font-size: 17px; }
  .dlg-next { right: 18px; }
}
@media (prefers-reduced-motion: reduce) {
  .dlg-next b, .os-hint, .narration-hint { animation: none; }
  .dlg-choice, .dlg-portrait { transition: none; }
}
</style>
