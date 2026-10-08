<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

/** 两个解码器交替接力，完整保留首尾帧，不叠加不同时间的运动画面。 */
defineProps<{ src: string; poster: string }>()
const first = ref<HTMLVideoElement | null>(null), second = ref<HTMLVideoElement | null>(null)
const videos = (): Array<HTMLVideoElement | null> => [first.value, second.value]
let active = 0, mounted = false, switching = false, epoch = 0
let frameCallback = 0, boundaryTimer = 0
let callbackVideo: HTMLVideoElement | null = null

function clearBoundary(): void {
  clearTimeout(boundaryTimer); boundaryTimer = 0
  if (frameCallback && callbackVideo) callbackVideo.cancelVideoFrameCallback(frameCallback)
  frameCallback = 0; callbackVideo = null
}
function prepareStandby(): void {
  const standby = videos()[1 - active]
  if (!standby) return
  standby.pause()
  standby.style.opacity = '0'
  standby.style.zIndex = '0'
  if (standby.readyState >= 1 && standby.currentTime !== 0) standby.currentTime = 0
}
function monitorFrames(): void {
  clearBoundary()
  const current = videos()[active]
  if (!mounted || document.hidden || !current || current.paused || typeof current.requestVideoFrameCallback !== 'function') return
  const ticket = epoch
  callbackVideo = current
  frameCallback = current.requestVideoFrameCallback((_now, frame) => {
    frameCallback = 0; callbackVideo = null
    if (!mounted || document.hidden || ticket !== epoch) return
    const remaining = current.duration - frame.mediaTime
    if (Number.isFinite(remaining) && remaining > 0 && remaining <= .075) {
      // 最后一帧也保持完整显示时长；以呈现时刻计算交接点，不提前截尾。
      const deadline = frame.expectedDisplayTime + remaining * 1000 / current.playbackRate
      boundaryTimer = window.setTimeout(switchAtBoundary, Math.max(0, deadline - performance.now()))
    } else monitorFrames()
  })
}
function switchAtBoundary(): void {
  if (!mounted || document.hidden || switching) return
  const previous = videos()[active], next = videos()[1 - active]
  if (!previous || !next || next.readyState < 2 || next.seeking) return
  switching = true
  epoch++; clearBoundary()
  previous.pause()
  // 备用视频已经停在解码完成的首帧，交接当下即可显示，无需等待回跳寻址。
  next.style.opacity = '1'; next.style.zIndex = '1'
  previous.style.opacity = '0'; previous.style.zIndex = '0'
  active = 1 - active
  prepareStandby()
  switching = false
  resume()
}
function onEnded(event: Event): void {
  // 无逐帧回调的浏览器或主线程延迟时，结束事件仍能完成交接。
  if (event.target === videos()[active]) switchAtBoundary()
}
function pause(): void {
  epoch++; clearBoundary()
  for (const video of videos()) video?.pause()
  prepareStandby()
}
function resume(): void {
  if (!mounted || document.hidden) return
  const current = videos()[active]
  if (!current) return
  if (current.ended) { switchAtBoundary(); return }
  if (current.paused) {
    const ticket = epoch
    void current.play().then(() => {
      if (!mounted || document.hidden || epoch !== ticket || videos()[active] !== current) return
      monitorFrames()
    }).catch(() => { /* 自动播放不可用时保留封面或已经显示的画面。 */ })
  } else monitorFrames()
}
function visibilityChanged(): void { if (document.hidden) pause(); else resume() }
onMounted(() => {
  mounted = true
  document.addEventListener('visibilitychange', visibilityChanged)
  prepareStandby(); resume()
})
onBeforeUnmount(() => {
  mounted = false; pause()
  document.removeEventListener('visibilitychange', visibilityChanged)
  for (const video of videos()) {
    if (!video) continue
    video.removeAttribute('src'); video.load()
  }
})
defineExpose({ resume })
</script>

<template>
  <div class="looping-video" aria-hidden="true">
    <video ref="first" :src="src" :poster="poster" muted playsinline preload="auto" @canplay="resume" @ended="onEnded"></video>
    <video ref="second" :src="src" :poster="poster" muted playsinline preload="auto" @canplay="resume" @ended="onEnded"></video>
  </div>
</template>

<style scoped>
.looping-video{position:absolute;inset:0;pointer-events:none;isolation:isolate}.looping-video video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none}.looping-video video:first-child{z-index:1;opacity:1}.looping-video video:last-child{z-index:0;opacity:0}
</style>
