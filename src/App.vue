<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, reactive, ref, watch } from 'vue'
import { GameEngine } from './core/GameEngine'
import { ModuleManager } from './core/ModuleManager'
import { CONFIG } from './game/config'
import type { GameEvents, RunStats, UIPanelKind } from './game/gameEvents'
import { CaveModule } from './game/cave/CaveModule'
import { BaseModule } from './game/BaseModule'
import { TrialModule } from './game/TrialModule'
import type { ModuleActions } from './shared/moduleActions'
import { findItemDef } from './shared/itemDefs'
import { t, itemName } from './i18n'
import { SWORD_RUSTY_ID, PICK_RUSTY_ID } from './content/items/vanilla/ids'
import { deriveCombat } from './shared/combat'
import type { CharacterProfile } from './shared/profile'
import { PROFILE_KEY } from './core/save/saveService'
import { setDialogueHooks } from './game/dialogue/effects'
import Hotbar from './ui/Hotbar.vue'
import StatusEffectsHud from './ui/StatusEffectsHud.vue'
import type { StatusSnapshot } from './shared/statusEffects'
import InventoryPanel from './ui/InventoryPanel.vue'
import BigMap from './ui/BigMap.vue'
import NeighborMap from './ui/NeighborMap.vue'
import PauseMenu from './ui/PauseMenu.vue'
import PrayerTransition from './ui/PrayerTransition.vue'
import CampPanel from './ui/CampPanel.vue'
import FloorSelectPanel from './ui/FloorSelectPanel.vue'
import RunResultPanel from './ui/RunResultPanel.vue'
import { dialogue } from './game/dialogue/dialogueService'
import { talkToNpc } from './game/story/npcDialogue'
import DialogueOverlay from './ui/DialogueOverlay.vue'
import TutorialBubble from './ui/TutorialBubble.vue'
import FloorTitle from './ui/FloorTitle.vue'
import DevConsole from './ui/DevConsole.vue'
import { sfx, type AudioSettings } from './game/audio/Sfx'

const canvasRef = ref<HTMLCanvasElement | null>(null)
let engine: GameEngine | null = null
let manager: ModuleManager<GameEvents> | null = null
let hudTimer = 0
/** 显影模糊同步 rAF 句柄（每帧把导演 blurPx 直写 canvas CSS filter，不走 Vue 响应式） */
let blurRaf = 0

const props = defineProps<{ profile: CharacterProfile }>()
const emit = defineEmits<{ loaded: [profile: CharacterProfile]; newGame: []; title: [] }>()
// 每次入场使用独立档案实例，退出时整棵玩法树卸载。
const character = props.profile
provide(PROFILE_KEY, character)

// 矿洞模块实例（App 与 ModuleManager 共享同一对象：UI 直接调背包/装备动作）
const cave = new CaveModule(character)
const base = new BaseModule(character)
const trial = new TrialModule(character)
const scene = ref<'cave' | 'base' | 'trial'>('cave')
const passage = ref<{ destination: string; failed: boolean } | null>(null)
const currentActions = computed<ModuleActions>(() => scene.value === 'base' ? base : scene.value === 'trial' ? trial : cave)

// HUD 数据（节流刷新，避免 Vue 每帧重渲染）
const stats = reactive({ fps: 0, frameMs: 0 })
const hudTick = ref(0)
const audioMuted = ref(sfx.muted)
const statusEffects = ref<StatusSnapshot[]>([])
const debug = reactive({
  x: 0,
  y: 0,
  speed: 0,
  hp: 100,
  hpRatio: 1,
  mana: 100,
  manaRatio: 1,
  spellCd: 0,
  alive: true,
  swing: 'none',
  dodge: 'ready',
  iFrame: false,
  dodgeCd: 0,
  enemiesAlive: 0,
  enemiesTotal: 0,
  oresLeft: 0,
  dropsOnGround: 0,
  kills: 0,
  depth: 1,
  roomKind: 'start' as string,
  roomId: 0,
  roomsCleared: 0,
  roomsTotal: 0,
  bagCopper: 0,
  bagIron: 0,
  bagGold: 0,
  selected: 0,
  panel: null as UIPanelKind | null,
  // B2：序章固定楼层进行中（楼层牌/横幅显示章节名）
  prologue: false,
  deathBlackAlpha: 0,
  // 成长信息（B0 调试窗可见）
  level: 1,
  exp: 0,
  expNeed: 10,
  unspentPoints: 0,
  round: 1
})

/** 结算面板 */
type ResultKind = 'extract' | 'died' | null
const result = ref<ResultKind>(null)
const resultStats = ref<RunStats | null>(null)
const resultReady = ref(false)
let resultTimer = 0
function showResult(kind: Exclude<ResultKind, null>, s: RunStats): void {
  clearTimeout(resultTimer)
  result.value = kind
  resultStats.value = s
  panel.value = null
  resultReady.value = kind === 'extract'
  if (kind === 'died') resultTimer = window.setTimeout(() => { resultReady.value = true }, 1500)
}

/**
 * 升级金色提示（击杀/挖矿经验触发；B0 无加点 UI，只做一行庆贺提示）。
 * toastSeq 变化重播 CSS 动画；连升两级时以最新等级为准。
 */


/** 机器码 → 语言文案（引擎只出机器码，UI 负责翻译） */
const swingText = (phase: string): string => t(`ui.swing.${phase}`)
const roomName = (kind: string): string => t(`ui.room.${kind}.name`)
const dodgeText = (code: string): string => t(`ui.dodge.${code}`)

/** 秒 → 毫秒（模板用） */
const ms = (s: number): number => Math.round(s * 1000)
/** 右下调试面板：当前手持招式（selected 变化时随装备槽实时取） */
const HAND_SLOTS = ['weaponA', 'weaponB', 'pick'] as const
const handMelee = computed(() => {
  const slot = HAND_SLOTS[debug.selected] ?? 'pick'
  const id = cave.equipment.get(slot)
  return id ? (findItemDef(id)?.melee ?? null) : null
})
const handName = computed(() => {
  const slot = HAND_SLOTS[debug.selected] ?? 'pick'
  const id = cave.equipment.get(slot)
  return id ? itemName(id) ?? t('ui.hand.unknown') : t('ui.hand.empty')
})
/** 装备中符卡的灵力消耗（无符卡时给满值，灵力条不做低量警示） */
const spellCost = computed(() => {
  const id = cave.equipment.get('spellA')
  return id ? (findItemDef(id)?.spell?.manaCost ?? 100) : 100
})

/** 操作木牌上的默认装备名（随当前语言实时取） */
const swordName = computed(() => itemName(SWORD_RUSTY_ID))
const pickName = computed(() => itemName(PICK_RUSTY_ID))

/** Tab/M 面板开关（模块为真值，Vue 经事件即时同步） */
const panel = ref<UIPanelKind | null>(null)
function requestPanel(kind: UIPanelKind | null): void {
  if (passage.value) return
  manager?.bus.emit('ui:requestPanel', kind)
}

function talkToReimu(): void {
  requestPanel(null)
  talkToNpc('touhou:reimu',character)
}

/**
 * 收音机「正在播放」小牌：基地模块切歌/回家时经事件总线推送曲名键，
 * 左上角状态组底部浮现 3 秒淡出；:key 自减重放 CSS 动画。
 */
const nowPlaying = ref<{ nameKey: string; seq: number } | null>(null)
let nowPlayingTimer = 0
function showNowPlaying(nameKey: string): void {
  clearTimeout(nowPlayingTimer)
  nowPlaying.value = { nameKey, seq: Date.now() }
  nowPlayingTimer = window.setTimeout(() => {
    nowPlaying.value = null
  }, 3000)
}

function blockPassageKeys(e: KeyboardEvent): void {
  if (!passage.value && !result.value) return
  e.preventDefault()
  e.stopImmediatePropagation()
  if(result.value&&resultReady.value&&e.code==='Enter'&&!e.repeat)restartRun()
}

/**
 * 调试悬浮窗总开关（P 键，默认全关）：
 * 右上调试状态 / 左下操作木牌 / 右下手持招式三窗一起显隐。
 */
const debugVisible = ref(false)
const onDebugKey = (e: KeyboardEvent): void => {
  if (e.code === 'KeyP') debugVisible.value = !debugVisible.value
}

/** 调试控制台（作弊面板）：`~`（Backquote）或 F8 开关 */
const consoleOpen = ref(false)
/** 无敌全局开关：下矿重建 Player 后由 10Hz HUD 同步重新写入 */
const godMode = ref(false)
const onConsoleKey = (e: KeyboardEvent): void => {
  if (e.code === 'Backquote' || e.code === 'F8') {
    // F8 默认无行为，反引号也无滚动，统一拦掉避免漏给画布
    e.preventDefault()
    consoleOpen.value = !consoleOpen.value
  } else if (e.code === 'Escape' && consoleOpen.value) {
    consoleOpen.value = false
  }
}
/** 控制台开关同步输入抑制；关闭时清边沿，防止"打开前按着的键"漏进玩法 */
watch(consoleOpen, (open) => {
  if (!engine) return
  engine.input.suppressed = open
  if (!open) engine.input.reset()
})
/** 无敌开关即时写入当前模块（10Hz 同步负责换场景/重开本局后的补写） */
watch(godMode, (v) => {
  if (scene.value === 'base') base.debugSetGod(v)
  else if (scene.value === 'trial') trial.debugSetGod(v)
  else cave.debugSetGod(v)
})

/**
 * 进房横幅：房间/层数变化时浮现 1.6s 后自动淡出（替代常驻顶栏，
 * 既释放北门通道又给出"到了新房间"的仪式感）。
 * toastSeq 每变一次就用 :key 重放 CSS 动画。
 */
const toastSeq = ref(0)
/** 首次 hud 状态同步前不渲染横幅（debug 初始 prologue=false，否则序章开屏会误闪普通层横幅） */
const toastHydrated = ref(false)
watch(
  () => [debug.roomId, debug.depth, debug.prologue],
  () => {
    toastSeq.value++
  },
  { immediate: true }
)
const toastText = computed(() =>
  // 序章小横幅只报房间名（层级名由居中大标题卡承担；首房不显示横幅）
  debug.prologue
    ? roomName(debug.roomKind)
    : t('ui.hud.room_toast', { depth: debug.depth, room: roomName(debug.roomKind) })
)
/** 首房（序章 R0）只放层级大标题卡，不弹房间小横幅 */
const showRoomToast = computed(() => !(debug.prologue && debug.roomId === 0))


/** 关闭页面不自动落盘：下次启动恢复最近的成功撤离存档点。 */
onMounted(() => {
  if (!canvasRef.value) return
  window.addEventListener('keydown', onDebugKey)
  window.addEventListener('keydown', onConsoleKey)
  window.addEventListener('keydown', blockPassageKeys, true)

  // J 批次：音量设置从 localStorage 恢复（引擎未初始化时仅写入 settings 字段，
  // 首次手势 ensure() 建总线时取用；BGM/音效全流程遵守用户音量）
  try {
    const raw = localStorage.getItem('touhou-isekai-mine:audio-v1')
    if (raw) {
      const saved = JSON.parse(raw) as Partial<AudioSettings>
      const clamp01 = (v: unknown, d: number): number =>
        typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : d
      sfx.applySettings({
        master: clamp01(saved.master, sfx.settings.master),
        sfx: clamp01(saved.sfx, sfx.settings.sfx),
        music: clamp01(saved.music, sfx.settings.music)
      })
    }
  } catch {
    // 存档损坏/不可读：用默认音量
  }

  engine = new GameEngine(canvasRef.value)

  // 对话系统的治疗钩子（事件/剧情回复玩家时用）
  setDialogueHooks({
    healPlayer: (amount) => currentActions.value.healPlayer(amount)
  })

  // 模块架构：引擎只认识 GameScene，玩法全部挂到 ModuleManager
  // 顺序铁律：先 setScene（manager.enter 注入 engine），再 switchTo（模块 onEnter 才能拿到引擎）
  manager = new ModuleManager<GameEvents>()
  manager.onTransition = state => {
    passage.value = state
    if (!state) {
      scene.value = manager?.currentId as 'cave'|'base'|'trial' ?? 'cave'
      debug.deathBlackAlpha = 0
      Object.assign(debug, manager?.getHudState())
    }
  }
  manager.register(cave)
  manager.register(base)
  manager.register(trial)
  engine.setScene(manager)
  manager.switchTo(character.flagBool('prologue.done') || character.flagBool('prologue.campPending') ? 'base' : 'cave')
  scene.value = manager.currentId as 'cave'|'base'|'trial' ?? 'cave'

  // 撤离 / 死亡结算（CaveModule → EventBus → Vue 面板）
  manager.bus.on('cave:extract', (s) => showResult('extract', s))
  manager.bus.on('cave:died', (s) => showResult('died', s))
  // R 键与按钮同路：任何 restart 请求都关闭结算/覆盖面板
  manager.bus.on('cave:restart', () => {
    clearTimeout(resultTimer)
    resultReady.value = false
    result.value = null
    resultStats.value = null
    panel.value = null
  })
  manager.bus.on('ui:panel', (kind) => {
    panel.value = kind
  })
  // 收音机切歌/回基地自动播放：左上角弹 3 秒曲目小牌
  manager.bus.on('base:now-playing', (nameKey) => showNowPlaying(nameKey))

  engine.onStats = (s) => {
    stats.fps = s.fps
    stats.frameMs = s.frameMs
  }
  engine.start()

  // 逻辑调试信息 10Hz 刷新即可
  hudTimer = window.setInterval(() => {
    if (!manager) return
    scene.value = manager.currentId as 'cave'|'base'|'trial' ?? 'cave'
    // 矿洞快照不含基地的死亡遮罩字段，先清除旧值再同步当前模块。
    debug.deathBlackAlpha = 0
    Object.assign(debug, manager.getHudState())
    audioMuted.value = sfx.muted
    const activePlayer = scene.value === 'base' ? base.player : scene.value === 'trial' ? trial.player : cave.player
    statusEffects.value = activePlayer?.effects.snapshot() ?? []
    // 调试无敌同步到当前活动模块（新一趟下矿会重建 Player，靠这里持续补写）
    if (scene.value === 'base') base.debugSetGod(godMode.value)
    else if (scene.value === 'trial') trial.debugSetGod(godMode.value)
    else cave.debugSetGod(godMode.value)
    toastHydrated.value = true
    hudTick.value++
  }, 100)

  // 序章显影模糊：每帧直写 canvas 的 CSS filter（DOM 合成层，GPU 加速，不碰 ctx.filter）
  const syncBlur = (): void => {
    const cv = canvasRef.value
    if (cv) {
      const b = manager?.currentId === 'base' ? base.worldBlurPx : manager?.currentId === 'trial' ? 0 : cave.worldBlurPx
      cv.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : ''
    }
    blurRaf = requestAnimationFrame(syncBlur)
  }
  blurRaf = requestAnimationFrame(syncBlur)
})

/** 调试入口不经过探索结算，保留装备并重建整场挑战。 */
function enterTrial():void {
  if (!manager || manager.transitioning) return
  consoleOpen.value=false;panel.value=null;result.value=null;resultStats.value=null
  manager.switchTo('trial');trial.debugSetGod(godMode.value);scene.value='trial'
  Object.assign(debug,trial.getHudState());engine?.input.reset()
}

/** 结算按钮：回到独立基地，保留共享档案与资源。 */
function restartRun(): void {
  manager?.bus.emit('cave:restart', undefined)
  result.value = null
  resultStats.value = null
}

onBeforeUnmount(() => {
  clearTimeout(resultTimer)
  clearTimeout(nowPlayingTimer)
  clearInterval(hudTimer)
  cancelAnimationFrame(blurRaf)
  window.removeEventListener('keydown', onDebugKey)
  window.removeEventListener('keydown', onConsoleKey)
  window.removeEventListener('keydown', blockPassageKeys, true)
  engine?.destroy()
  manager?.leave()
  dialogue.cancel()
  sfx.dispose()
})
</script>

<template>
  <div class="game-root" :class="{ 'ui-pointer': panel !== null || result !== null || consoleOpen, 'base-art': scene === 'base' }">
    <canvas ref="canvasRef" class="game-canvas"></canvas>
    <PrayerTransition v-if="passage" :destination="passage.destination" :failed="passage.failed" />

    <!-- 进房横幅：房间/层数变化时浮现淡出（首房只放层级大标题卡，不弹此横幅； :key 变化重放动画） -->
    <div v-if="scene === 'cave' && toastHydrated && showRoomToast" :key="toastSeq" class="room-toast hud-surface">
      <span class="nail">◆</span>{{ toastText }}<span class="nail">◆</span>
    </div>

    <!-- 左上状态组：楼层牌 → 生命 → 灵力 → 小地图，竖排贴角（门廊通道全空） -->
    <div class="hud-topleft">
      <svg v-if="audioMuted" class="audio-muted-indicator" viewBox="0 0 24 24" aria-label="静音" role="img">
        <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" />
        <path d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <!-- 楼层牌：序章进行中显示章节名；正常下矿显示层数 + 房型 -->
      <div class="floor-frame gpanel-mini">
        <span class="floor-no">{{ scene === 'base' ? '废弃矿营' : scene === 'trial' ? t('trial.title') : debug.prologue ? t('ui.hud.chapter_prologue') : t('ui.hud.floor', { n: debug.depth }) }}</span>
        <span v-if="scene === 'base'" class="floor-kind">安全基地</span>
        <span v-if="scene === 'cave' && !debug.prologue" class="floor-kind">{{ roomName(debug.roomKind) }}</span>
      </div>

      <!-- 生命条（金属凹槽） -->
      <div class="hp-frame gpanel-mini">
        <span class="hp-word">{{ t('ui.hud.hp') }}</span>
        <div class="hp-track">
          <div class="hp-fill" :class="{ low: debug.hpRatio <= 0.3 }" :style="{ width: `${debug.hpRatio * 100}%` }"></div>
          <span class="hp-num">{{ debug.hp }}</span>
        </div>
        <span v-if="scene === 'base'" class="base-stat-num">{{ debug.hp }}</span>
      </div>

      <!-- 灵力条（符卡资源：不自动回复的整洞有限资源，不足时符卡格压暗） -->
      <div class="mp-frame gpanel-mini">
        <span class="mp-word">{{ t('ui.hud.mana') }}</span>
        <div class="mp-track">
          <div
            class="mp-fill"
            :class="{ low: debug.mana < spellCost }"
            :style="{ width: `${debug.manaRatio * 100}%` }"
          ></div>
          <span class="mp-num">{{ debug.mana }}</span>
        </div>
        <span v-if="scene === 'base'" class="base-stat-num">{{ debug.mana }}</span>
      </div>

      <!-- 等级与本级经验：灵力条下的细金线，无独立面板框 -->
      <div class="xp-frame">
        <span class="xp-level">{{ t('ui.hud.lv') }}<b>{{ debug.level }}</b></span>
        <div class="xp-track">
          <i class="xp-fill" :style="{ width: `${Math.min(1, debug.exp / Math.max(1, debug.expNeed)) * 100}%` }"></i>
        </div>
        <span class="xp-pct">{{ Math.round(Math.min(1, debug.exp / Math.max(1, debug.expNeed)) * 100) }}%</span>
      </div>

      <!-- 相邻房小地图（M 键看整层大地图） -->
      <NeighborMap v-if="scene === 'cave'" :cave="cave" :tick="hudTick" />

      <StatusEffectsHud :effects="statusEffects" />

      <!-- 收音机曲目小牌：回家自动播或 F 换台时浮现 3 秒（:key 重放动画） -->
      <div v-if="nowPlaying" :key="nowPlaying.seq" class="now-playing gpanel-mini">
        <span class="np-note">♪</span>{{ t('base.radio.now_playing', { name: t(nowPlaying.nameKey) }) }}
      </div>
    </div>

    <!-- 右上：调试状态（P 键唤出，高透明悬浮） -->
    <div v-if="debugVisible" class="hud-panel panel-right">
      <div class="panel-title">{{ t('ui.debug.title') }}</div>
      <div class="row"><span>{{ t('ui.debug.hp') }}</span><span>{{ debug.hp }}</span></div>
      <div class="row"><span>{{ t('ui.debug.speed') }}</span><span>{{ t('ui.debug.speed_val', { n: debug.speed }) }}</span></div>
      <div class="row"><span>{{ t('ui.debug.position') }}</span><span>{{ t('ui.debug.pos_val', { x: debug.x, y: debug.y }) }}</span></div>
      <div class="row">
        <span>{{ t('ui.debug.swing_phase') }}</span>
        <span :class="{ hot: debug.swing === 'active' }">{{ swingText(debug.swing) }}</span>
      </div>
      <div class="row">
        <span>{{ t('ui.debug.dodge') }}</span>
        <span :class="{ hot: debug.iFrame, ready: debug.dodge === 'ready' }">{{ dodgeText(debug.dodge) }}</span>
      </div>
      <div class="cd-track">
        <div class="cd-fill" :style="{ width: `${(1 - debug.dodgeCd) * 100}%` }"></div>
      </div>
      <div class="row sub"><span>{{ t('ui.debug.enemies', { alive: debug.enemiesAlive, total: debug.enemiesTotal }) }}</span></div>
      <div class="row sub"><span>{{ t('ui.debug.ores_left', { n: debug.oresLeft }) }}</span></div>
      <div class="row sub" v-if="debug.dropsOnGround > 0"><span>{{ t('ui.debug.drops', { n: debug.dropsOnGround }) }}</span></div>
      <div class="row sub growth">
        <span>{{ t('ui.debug.growth', { level: debug.level, exp: debug.exp, need: debug.expNeed, round: debug.round }) }}</span>
        <span v-if="debug.unspentPoints > 0" class="pts">{{ t('ui.debug.unspent', { n: debug.unspentPoints }) }}</span>
      </div>
      <div class="row sub fps"><span>{{ t('ui.debug.fps', { fps: stats.fps, ms: stats.frameMs.toFixed(2) }) }}</span></div>
    </div>

    <!-- 左下：操作木牌（P 键唤出；注意它在快捷栏上方） -->
    <div v-if="debugVisible" class="hud-panel panel-bottom">
      <div class="panel-title">{{ t('ui.debug.controls') }}</div>
      <div class="row"><kbd>WASD</kbd> {{ t('ui.word.move') }}　<kbd>{{ t('ui.debug.kbd.mouse_l') }}</kbd> {{ t('ui.word.attack') }}</div>
      <div class="row"><kbd>{{ t('ui.debug.kbd.shift') }}</kbd> {{ t('ui.debug.ctl.dodge') }}</div>
      <div class="row"><kbd>1</kbd>{{ swordName }} <kbd>2</kbd>{{ t('ui.slot.weaponB') }} <kbd>3</kbd>{{ pickName }}　<kbd>4 5 6</kbd> {{ t('ui.word.item') }}</div>
      <div class="row"><kbd>Tab</kbd> {{ t('ui.debug.ctl.inventory') }}　<kbd>M</kbd> {{ t('ui.debug.ctl.map') }}　<kbd>ESC</kbd> {{ t('ui.debug.ctl.pause') }}</div>
      <div class="row"><kbd>F</kbd> {{ t('ui.debug.ctl.extract') }}　<kbd>E</kbd> {{ t('ui.debug.ctl.spell') }}　<kbd>N</kbd> {{ t('ui.debug.ctl.mute') }}</div>
    </div>

    <!-- 右下：当前手持招式参数（P 键唤出） -->
    <div v-if="debugVisible" class="hud-panel panel-params">
      <div class="panel-title">{{ t('ui.debug.params.title', { name: handName }) }}</div>
      <template v-if="handMelee">
        <div class="row sub">
          {{ t('ui.debug.params.melee', {
            shape: t(handMelee.shape === 'slash' ? 'ui.word.slash' : 'ui.word.stab'),
            damage: handMelee.damage,
            reach: handMelee.reach,
            knockback: handMelee.knockback,
            stun: (handMelee.stun ?? 0).toFixed(2)
          }) }}
          <template v-if="handMelee.arc"> · {{ t('ui.debug.params.arc', { deg: Number((handMelee.arc * 360 / Math.PI).toFixed(2)) }) }}</template>
        </div>
        <div class="row sub">
          {{ t('ui.debug.params.timing', {
            windup: ms(handMelee.windup),
            active: ms(handMelee.active),
            recover: ms(handMelee.recover)
          }) }}
        </div>
      </template>
      <div class="row sub">
        {{ t('ui.debug.params.dodge_cd', {
          short: ms(CONFIG.player.dodge.short.cooldown),
          long: ms(CONFIG.player.dodge.long.cooldown)
        }) }}
      </div>
      <div class="row sub">
        {{ t('ui.debug.params.room', {
          cols: CONFIG.roomCols,
          rows: CONFIG.roomRows,
          min: CONFIG.dungeon.roomsMin,
          max: CONFIG.dungeon.roomsMax
        }) }}
      </div>
    </div>

    <!-- 底部操作快捷栏（武器/镐/符卡/道具） -->
    <Hotbar
      :cave="currentActions"
      :tick="hudTick"
      :hand="debug.selected"
      :mana="debug.mana"
      :spell-cd="debug.spellCd"
    />

    <!-- 背包 / 大地图 / ESC 暂停菜单 -->
    <InventoryPanel v-if="panel === 'inventory'" :cave="currentActions" :profile="character" :tick="hudTick" @growth="(scene === 'base' ? base.player : scene === 'trial' ? trial.player : cave.player).applyGrowth(deriveCombat(character.combat), false)" @close="requestPanel(null)" />
    <BigMap v-if="panel === 'map'" :cave="cave" :tick="hudTick" :depth="debug.depth" @close="requestPanel(null)" />
    <PauseMenu v-if="panel === 'pause'" :can-save="scene === 'base'" @close="requestPanel(null)" @loaded="emit('loaded', $event)" @new-game="emit('newGame')" @title="emit('title')" />
    <CampPanel v-if="scene==='base' && panel && ['npc','quests','storage','cooking','crafting','furnace'].includes(panel)" :kind="panel" :profile="character" :actions="currentActions" :tick="hudTick" :anchor="base.npcAnchor" @close="requestPanel(null)" @panel="requestPanel" @talk="talkToReimu" />
    <FloorSelectPanel v-if="scene==='base'&&panel==='floors'" :profile="character" @close="requestPanel(null)" @enter="floor=>manager?.bus.emit('base:enterFloor',{floor})"/>

    <!-- 教程气泡（非模态小木牌，序章/事件提示共用） -->
    <TutorialBubble />

    <!-- 楼层标题卡（序章/进矿洞楼层的大字开场） -->
    <FloorTitle />

    <!-- 对话覆盖层（全局最上层；剧情/NPC/事件共用） -->
    <div v-if="scene === 'base' && debug.deathBlackAlpha > 0" :style="{ position: 'absolute', inset: '0', background: '#000', opacity: debug.deathBlackAlpha, zIndex: 39, pointerEvents: 'none' }" aria-hidden="true"></div>
    <DialogueOverlay :theme="scene === 'base' ? 'warm' : 'ink'" />

    <!-- 撤离与失败共用矿行记录页；失败先压暗现场，再显示结算。 -->
    <RunResultPanel v-if="result && resultStats" :kind="result" :stats="resultStats" :ready="resultReady" @return="restartRun"/>

    <!-- 开发调试控制台（作弊面板）：`~` / F8 开关，Esc 关闭；打开时玩法输入整体屏蔽 -->
    <DevConsole
      v-if="consoleOpen"
      :cave="cave"
      :base="base"
      :trial="trial"
      :scene="scene"
      :god="godMode"
      :hud="debug"
      @close="consoleOpen = false"
      @toggle-god="godMode = !godMode"
      @enter-trial="enterTrial"
    />
  </div>
</template>

<style scoped>
.game-root {
  position: fixed;
  inset: 0;
  cursor: none;
}
/* 面板打开时恢复系统光标，可点击 DOM */
.game-root.ui-pointer {
  cursor: auto;
}
.game-canvas {
  width: 100%;
  height: 100%;
}

/* —— 左上常驻状态组（贴角竖排，四边门廊通道留空） —— */
.hud-topleft {
  position: absolute;
  top: 12px;
  left: 12px;
  width: min(220px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  pointer-events: none;
  z-index: 5;
}

/* 基地常驻状态整合成样板中的一块轻面板，经验与状态提示继续保留。 */
.base-art .hud-topleft {
  width: min(270px, calc(100vw - 24px));
  box-sizing: border-box;
  padding: 12px 14px 8px;
  gap: 6px;
  background: rgba(46, 37, 44, 0.94);
  border: 1px solid #51434c;
  border-radius: 3px;
  box-shadow: inset 0 1px 0 #927254, 0 2px 5px #14121c55;
}
.base-art .floor-frame,
.base-art .hp-frame,
.base-art .mp-frame {
  background: none;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  padding: 0;
  width: 100%;
}
.base-art .floor-frame {
  justify-content: space-between;
  padding-bottom: 8px;
  margin-bottom: 2px;
  border-bottom: 1px solid #67534e;
}
.base-art .floor-no { font-size: 19px; letter-spacing: 1px; color: #eadcc4; }
.base-art .floor-kind { color: #b6bea6; letter-spacing: 0; }
.base-art .hp-word,
.base-art .mp-word { font-size: 13px; letter-spacing: 0; color: #cdbfae; }
.base-art .hp-track,
.base-art .mp-track { height: 9px; background: #161924; border-color: #51434c; box-shadow: none; }
.base-art .hp-fill { background: #ac586c; box-shadow: inset 0 2px 0 #d98694; }
.base-art .mp-fill { background: #526f99; box-shadow: inset 0 2px 0 #90b0ce; }
.base-art .hp-fill.low { background: #bd454e; }
.base-art .mp-fill.low { background: #a39855; }
.base-art .hp-num,
.base-art .mp-num { display: none; }
.base-art .xp-frame { padding: 2px 0 0; }
.base-stat-num { min-width: 28px; font-size: 12px; color: #eadcc4; text-align: right; font-variant-numeric: tabular-nums; }

/* —— 收音机「正在播放」小牌：状态组底部木牌，3s 淡出 —— */
.now-playing {
  position: absolute;
  left: 0;
  top: calc(100% + 10px);
  width: max-content;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 7px 14px;
  font-size: 14px;
  letter-spacing: 1px;
  color: var(--brass-hi);
  white-space: nowrap;
  opacity: 0;
  animation: now-playing 3s ease-in-out forwards;
}
.now-playing .np-note {
  color: var(--brass);
  margin-right: 8px;
}
@keyframes now-playing {
  0% {
    opacity: 0;
    transform: translateY(6px);
  }
  12% {
    opacity: 1;
    transform: translateY(0);
  }
  78% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-4px);
  }
}

/* —— 进房横幅：浮现 → 停留 → 淡出，共 1.8s —— */
.room-toast {
  position: absolute;
  top: 12%;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-sign);
  font-size: 26px;
  letter-spacing: 8px;
  color: var(--brass-hi);
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.9), 0 0 18px rgba(240, 205, 126, 0.35);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  animation: room-toast 1.8s ease-in-out forwards;
  z-index: 8;
}
.room-toast .nail {
  font-size: 12px;
  color: var(--brass);
  margin: 0 14px;
}
@keyframes room-toast {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(8px);
    letter-spacing: 14px;
  }
  14% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
    letter-spacing: 8px;
  }
  72% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-6px);
  }
}

/* —— 升级金色提示：放大落定 → 停留 → 上浮淡出，共 3.2s —— */
.levelup-toast {
  position: absolute;
  top: 22%;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-sign);
  font-size: 30px;
  letter-spacing: 6px;
  color: #ffe79a;
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.95),
    0 0 22px rgba(255, 214, 102, 0.75),
    0 0 44px rgba(255, 190, 60, 0.4);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  animation: levelup-toast 3.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  z-index: 9;
}
.levelup-toast .levelup-seal {
  font-size: 16px;
  color: #ffd76a;
  margin: 0 16px;
  text-shadow: 0 0 12px rgba(255, 214, 102, 0.9);
}
@keyframes levelup-toast {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(14px) scale(1.35);
  }
  14% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  78% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-10px) scale(1.04);
  }
}

/* 调试窗：成长行（未分配点数用暖金高亮） */
.panel-right .growth {
  justify-content: space-between;
  gap: 8px;
}
.panel-right .growth .pts {
  color: var(--brass-hi);
  text-shadow: 0 0 8px rgba(240, 205, 126, 0.5);
}

/* —— 楼层牌（组内首件：层数 + 房型横排） —— */
.floor-frame {
  width: max-content;
  max-width: calc(100vw - 24px);
  box-sizing: border-box;
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 5px 14px 6px;
}
.floor-no {
  font-family: var(--font-sign);
  font-size: 17px;
  letter-spacing: 2px;
  color: var(--brass-hi);
}
.floor-kind {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 1px;
}

/* —— 血条金属框（组内流式：轨道弹性充满固定组宽） —— */
.hp-frame {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 4px 10px;
}
.hp-word {
  font-family: var(--font-sign);
  font-size: 14px;
  letter-spacing: 3px;
  color: var(--brass-hi);
}
.hp-track {
  position: relative;
  flex: 1;
  height: 13px;
  background: #1c1308;
  border: 1px solid #0c0703;
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.8);
  overflow: hidden;
}
.hp-fill {
  height: 100%;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 45%),
    linear-gradient(90deg, #a83648, #d8546c);
  box-shadow: 0 0 8px rgba(216, 84, 108, 0.5);
  transition: width 0.12s ease-out;
}
.hp-fill.low {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.35), rgba(255, 255, 255, 0) 45%),
    linear-gradient(90deg, #8e1f24, #e03a3a);
  animation: hp-blink 0.7s ease-in-out infinite;
}
@keyframes hp-blink {
  50% {
    filter: brightness(1.5);
  }
}
.hp-num {
  position: absolute;
  right: 5px;
  top: -1px;
  font-size: 10px;
  font-weight: 700;
  color: #ffe9d0;
  text-shadow: 0 1px 2px #000;
  font-variant-numeric: tabular-nums;
}

/* —— 灵力条（青蓝，组内紧贴血条下沿，同宽） —— */
.mp-frame {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 3px 10px;
}
.mp-word {
  font-family: var(--font-sign);
  font-size: 12px;
  letter-spacing: 3px;
  color: #9fd8f0;
}
.mp-track {
  position: relative;
  flex: 1;
  height: 9px;
  background: #0a1420;
  border: 1px solid #04101c;
  box-shadow: inset 0 2px 3px rgba(0, 0, 0, 0.8);
  overflow: hidden;
}
.mp-fill {
  height: 100%;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 45%),
    linear-gradient(90deg, #2f7fb8, #59c6e8);
  box-shadow: 0 0 7px rgba(89, 198, 232, 0.55);
  transition: width 0.12s linear;
}
/* 灵力不够放符卡：转金色提醒而不是红色（这不是危险，是攒满即可） */
.mp-fill.low {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0) 45%),
    linear-gradient(90deg, #6a6a3a, #c9b64f);
  box-shadow: 0 0 7px rgba(201, 182, 79, 0.5);
}
.mp-num {
  position: absolute;
  right: 4px;
  top: -2px;
  font-size: 9px;
  font-weight: 700;
  color: #d8f0ff;
  text-shadow: 0 1px 2px #000;
  font-variant-numeric: tabular-nums;
}

/* —— 等级经验条：无框细线，贴在灵力条下沿；百分比置于条外保证可读 —— */
.xp-frame {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 2px 12px 5px;
}
.xp-level {
  font-size: 10px;
  letter-spacing: 1px;
  color: #b69e68;
  white-space: nowrap;
}
.xp-level b {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
  color: #f0d489;
  font-variant-numeric: tabular-nums;
}
.xp-track {
  position: relative;
  flex: 1;
  height: 5px;
  background: #100b05;
  border: 1px solid #060402;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.9);
  overflow: hidden;
}
.xp-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #8a6420, #e3c063);
  transition: width 0.18s ease-out;
}
.xp-pct {
  min-width: 32px;
  text-align: right;
  font-size: 9px;
  color: #ecd08c;
  text-shadow: 0 1px 2px #000;
  font-variant-numeric: tabular-nums;
}

/* 矿石菱形小图标（结算面板等使用） */
.od {
  width: 8px;
  height: 8px;
  transform: rotate(45deg);
  display: inline-block;
}
.od.copper {
  background: #c0703f;
  box-shadow: 0 0 4px #c0703f88;
}
.od.iron {
  background: #aab6c6;
  box-shadow: 0 0 4px #aab6c688;
}
.od.gold {
  background: #e8c04e;
  box-shadow: 0 0 6px #ffd96bcc;
}

/* —— 调试悬浮窗（P 键唤出：高透明 + 等宽细字，尽量不挡画面） —— */
.hud-panel {
  position: absolute;
  min-width: 168px;
  padding: 8px 10px;
  border-radius: 4px;
  background: rgba(10, 12, 18, 0.38);
  border: 1px solid rgba(120, 150, 220, 0.22);
  color: #c8d4ee;
  font-family: 'zpix', 'Cascadia Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.65;
  pointer-events: none;
  backdrop-filter: blur(2px);
  z-index: 9;
}
.panel-right {
  top: 12px;
  right: 12px;
  text-align: right;
  min-width: 182px;
}
.panel-bottom {
  bottom: 96px;
  left: 12px;
}
.panel-params {
  bottom: 96px;
  right: 12px;
  max-width: 330px;
}
.panel-title {
  font-size: 10px;
  color: #8fa4d8;
  margin-bottom: 3px;
  letter-spacing: 1px;
  opacity: 0.8;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  white-space: nowrap;
}
.row.sub {
  opacity: 0.6;
  font-size: 11px;
}
.row .hot {
  color: #ffd166;
  font-weight: 700;
}
.row .ready {
  color: #6be07a;
}
.fps {
  margin-top: 3px;
}
kbd {
  display: inline-block;
  padding: 0 6px;
  margin-right: 4px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.18);
  font-family: inherit;
  font-size: 11px;
}
.cd-track {
  margin: 5px 0 2px;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  overflow: hidden;
}
.cd-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f7cff, #6be0ff);
  transition: width 0.08s linear;
}

</style>
