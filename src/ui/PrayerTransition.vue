<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { drawReimuPrayer, loadReimuPrayerAssets } from '../game/art/rig/reimuCelRig'

const props = defineProps<{ destination: string; failed: boolean }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const tips = props.failed ? [
  '别逞强了。先把你带回来再说。',
  '血量不足时，先拉开距离，再找机会使用回复道具。',
  '被敌群包围时，闪避可以帮助你脱离危险。'
] : [
  '按 Tab 或 I 打开背包，在基地也可以整理装备。',
  '按 1 / 2 / 3 切换武器与矿镐。',
  '将回复道具放入快捷槽，按 4 / 5 / 6 使用。',
  '矿营里的设施可以靠近后按 F 调查。',
  '空装备槽也能切换：空手和矿镐不是同一种招式。'
]
const tip = tips[Math.floor(Math.random() * tips.length)]
let frame = 0
let disposed = false
let motionPreference: MediaQueryList | undefined
let refreshMotion: (() => void) | undefined
onMounted(async () => {
  const target = canvas.value
  const g = target?.getContext('2d')
  if (!g) return
  const loaded = await loadReimuPrayerAssets()
  if (!loaded || disposed || canvas.value !== target) return
  motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  const started = performance.now()
  let lastDraw = -Infinity
  function draw(time: number): void {
    g!.setTransform(1, 0, 0, 1, 0, 0); g!.clearRect(0, 0, 440, 420)
    g!.setTransform(6.8, 0, 0, 6.8, 220, 292)
    drawReimuPrayer(g!, 0, 0, time)
  }
  function animate(now: number): void {
    if (disposed) return
    // 只刷新角色的小画布；祈祷动作保持克制，限制为每秒 30 帧。
    if (now - lastDraw >= 1000 / 30) { draw((now - started) / 1000); lastDraw = now }
    frame = requestAnimationFrame(animate)
  }
  refreshMotion = () => {
    cancelAnimationFrame(frame)
    draw(0); lastDraw = -Infinity
    if (!motionPreference!.matches) frame = requestAnimationFrame(animate)
  }
  motionPreference.addEventListener('change', refreshMotion)
  refreshMotion()
})
onBeforeUnmount(() => {
  disposed = true
  cancelAnimationFrame(frame)
  if (refreshMotion) motionPreference?.removeEventListener('change', refreshMotion)
})
</script>

<template>
  <div class="prayer-mask" role="status" aria-live="polite" aria-label="少女祈祷中" @pointerdown.stop.prevent @wheel.stop.prevent @contextmenu.prevent>
    <div class="prayer-card">
      <div class="portrait">
        <div class="seal seal-outer"></div>
        <div class="seal seal-inner"></div>
        <div class="talisman-orbit">
          <div class="talisman talisman-left"><i></i></div>
          <div class="talisman talisman-right"><i></i></div>
        </div>
        <canvas ref="canvas" width="440" height="420" aria-hidden="true"></canvas>
      </div>
      <div class="prayer-title">少女祈祷中<span class="dots">...</span></div>
      <div class="destination">{{ destination === 'base' ? '返回旧矿营' : '前往矿洞' }}</div>
      <div class="tip"><span>TIPS</span>{{ tip }}</div>
    </div>
  </div>
</template>

<style scoped>
.prayer-mask {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  background: radial-gradient(ellipse at 50% 43%, #40323c, #211f2c 55%, #13141e);
  color: #ecd9b4;
  cursor: default;
  animation: prayer-passage 2.5s linear both;
}
.prayer-mask::before {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.13;
  background-image: repeating-linear-gradient(13deg, transparent 0 5px, #c3ad88 6px, transparent 7px 13px), repeating-linear-gradient(103deg, transparent 0 11px, #090c16 12px, transparent 13px 21px);
  pointer-events: none;
}
.prayer-card { position: relative; width: min(520px, 86vw); text-align: center; }
.portrait { position: relative; width: 220px; height: 210px; margin: 0 auto 18px; }
canvas { position: relative; width: 220px; height: 210px; }
.talisman-orbit { position: absolute; inset: 0; animation: orbit 2.4s linear infinite; }
.seal { position: absolute; border: 1px solid #c4a87970; border-radius: 50%; }
.seal-outer { inset: 13px 16px 9px; border-style: dashed; animation: orbit 24s linear infinite; }
.seal-inner { inset: 27px 30px 23px; border-color: #e4c48f30; box-shadow: 0 0 24px #e0a35712; }
.talisman { position: absolute; width: 18px; height: 43px; background: #d9c7a0; border: 1px solid #967758; box-shadow: 2px 3px 0 #100f192f; animation: float 3s ease-in-out infinite alternate; }
.talisman i { position: absolute; inset: 7px 6px; border-left: 2px solid #a64d45; border-top: 3px solid #a64d45; border-bottom: 3px solid #a64d45; }
.talisman-left { left: 16px; top: 70px; rotate: -15deg; }
.talisman-right { right: 13px; top: 105px; rotate: 13deg; animation-delay: -1.4s; }
.prayer-title { font-size: clamp(24px, 4vw, 32px); letter-spacing: 5px; }
.dots { display: inline-block; width: 34px; text-align: left; animation: breathe 1s ease-in-out infinite alternate; }
.destination { margin-top: 12px; font-size: 12px; letter-spacing: 4px; color: #b5a58e; }
.tip { margin-top: 32px; min-height: 40px; font-size: 13px; line-height: 1.8; color: #c4b69e; }
.tip span { display: block; margin-bottom: 6px; font-size: 10px; letter-spacing: 3px; color: #978772; }
@keyframes prayer-passage { 0% { opacity: 0; } 12%, 88% { opacity: 1; } 100% { opacity: 0; } }
@keyframes orbit { to { transform: rotate(360deg); } }
@keyframes float { to { transform: translateY(-6px) rotate(3deg); } }
@keyframes breathe { to { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .seal, .talisman, .talisman-orbit, canvas, .dots { animation: none; } }
</style>
