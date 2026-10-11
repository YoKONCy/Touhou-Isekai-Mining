<script setup lang="ts">
/**
 * 开发调试控制台（作弊面板）。
 * 按 `~`（反引号）或 F8 开关；打开期间游戏输入被 InputManager.suppressed 整体屏蔽。
 * 操作按钮调用模块的真实调试方法；主角切换只更新共享的视觉选择。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { GameEvents } from '../game/gameEvents'
import type { ModuleManager, SimulationSnapshot } from '../core/ModuleManager'
import type { SimulationReplay } from '../core/simulation/SimulationSession'
import { SIMULATION_VERSION } from '../core/simulation/SimulationSession'
import type { CaveModule } from '../game/cave/CaveModule'
import type { BaseModule } from '../game/BaseModule'
import type { TrialModule } from '../game/TrialModule'
import { t } from '../i18n'
import { sfx } from '../game/audio/Sfx'
import {
  DOOMSDAY_ID, SWORD_RUSTY_ID, CLEAVER_ID, UCHIGATANA_ID, PICK_RUSTY_ID, SPELL_HARAE_ID, OLD_MINER_OUTFIT_ID,
  STAFF_WOOD_ID, SPEAR_STONE_ID, LEATHER_ARMOR_ID, BOOMERANG_ID,WOOD_BOW_ID,RANGER_BOW_ID,RANGER_MEDAL_ID,WOOD_ARROW_ID,IRON_ARROW_ID,
  NUNCHAKU_ID, WHIP_ID, SWORD_IRON_ID, PICK_IRON_ID, SPEAR_IRON_ID,
  PICK_STEEL_ID, KATANA_FORGED_ID, DAGGER_ASSAULT_ID, DUAL_BLADES_ID, SWORD_STEEL_BROAD_ID, AXE_STEEL_ID, SPEAR_RED_TASSEL_ID, VORPAL_ID
} from '../content/items/vanilla/ids'
import { items } from '../content/items/registry'
import { getItemDef } from '../shared/itemDefs'
import type { EquipSlot, ItemDef } from '../content/items/types'
import { EQUIP_SLOT_META, ENABLED_SLOTS, slotAccepts } from '../shared/equipment'
import { itemName } from '../i18n'
import ItemIcon from './ItemIcon.vue'
import SimulationSpeedSelect from './SimulationSpeedSelect.vue'
import { profiler } from '../core/performance/Profiler'
import type { LocalPlayers, LocalPlayer } from '../game/simulation/LocalPlayers'
import type { PlayerAppearance, PlayerCostume } from '../shared/playerAppearance'
import { playerAppearance, setPlayerAppearance } from '../shared/playerAppearance'
import { saveService } from '../core/save/saveService'
import { loadPlayerRigAssets } from '../game/art/rig/playerRig'

const appearanceBusy = ref(false)
async function toggleAppearance(): Promise<void> {
  if (appearanceBusy.value) return
  sfx.uiTap()
  appearanceBusy.value = true
  try {
    const target = playerAppearance.value === 'brother' ? 'sister' : 'brother'
    if (!await loadPlayerRigAssets(target)) { say(t('ui.console.appearance_load_error')); return }
    await saveService.persistAppearance(target)
    setPlayerAppearance(target)
    if(props.players.primary.entity)props.players.primary.entity.appearance=target
    say(t('ui.console.appearance_changed', { appearance: t(target === 'sister' ? 'ui.player.sister' : 'ui.player.brother') }))
  } catch { say(t('ui.console.appearance_save_error')) }
  finally { appearanceBusy.value = false }
}

const equipmentOpen = ref(false)
const wardrobeOpen = ref(false)
const costumeRevision = ref(0)
const selectedCostume = computed(()=>{void costumeRevision.value;return equipmentMember().profile.costume})
const ownedEquipment = ref<string[]>([])
/** 同品质内按大致时期排列；尚未接入获取方式的装备放在对应进阶位置。 */
const equipmentProgression = new Map<string, number>([
  SWORD_RUSTY_ID, CLEAVER_ID, PICK_RUSTY_ID, SPELL_HARAE_ID,
  STAFF_WOOD_ID, SPEAR_STONE_ID,WOOD_BOW_ID,
  LEATHER_ARMOR_ID, BOOMERANG_ID, NUNCHAKU_ID, WHIP_ID,
  SWORD_IRON_ID, UCHIGATANA_ID, PICK_IRON_ID, SPEAR_IRON_ID, PICK_STEEL_ID, RANGER_BOW_ID, RANGER_MEDAL_ID,
  KATANA_FORGED_ID, DAGGER_ASSAULT_ID, DUAL_BLADES_ID, SWORD_STEEL_BROAD_ID, AXE_STEEL_ID, SPEAR_RED_TASSEL_ID, VORPAL_ID, DOOMSDAY_ID
].map((id, order) => [id, order]))
const equipmentLibrary = items.all()
  .filter(def => def.equipSlot && (def.kind === 'weapon' || def.kind === 'pick' || def.kind === 'armor' || def.kind === 'spellcard' || def.equipSlot === 'trinket'))
  .sort((a, b) => (a.grade ?? 1) - (b.grade ?? 1)
    || (equipmentProgression.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (equipmentProgression.get(b.id) ?? Number.MAX_SAFE_INTEGER))
const activeModule = () => props.scene === 'base' ? props.base : props.scene === 'trial' ? props.trial : props.cave

function refreshEquipment(): void {
  const profile = equipmentMember().profile
  ownedEquipment.value = equipmentLibrary.filter(def => EQUIP_SLOT_META.some(({ slot }) => profile.equipment.get(slot) === def.id) || profile.inventory.slots.some(slot => slot?.id === def.id)).map(def => def.id)
}
function toggleEquipmentLibrary(): void {
  sfx.uiTap()
  equipmentOpen.value = !equipmentOpen.value
  if(equipmentOpen.value)wardrobeOpen.value=false
  refreshEquipment()
}

/** 所有装备统一获取和归还；保留原装备，背包满时不做替换。 */
function toggleEquipment(def: ItemDef): void {
  sfx.uiTap()
  const member=equipmentMember(),profile=member.profile
  refreshEquipment()
  if (ownedEquipment.value.includes(def.id)) {
    if (def.id === DOOMSDAY_ID && member.id===props.players.primaryId) activeModule().debugReturnDoomsday()
    for (const { slot } of EQUIP_SLOT_META) if (profile.equipment.get(slot) === def.id) profile.equipment.set(slot, null)
    for (let i = 0; i < profile.inventory.slots.length; i++) if (profile.inventory.slots[i]?.id === def.id) profile.inventory.removeAt(i)
    selectEquipmentHand(member,0)
    say(itemName(def.id) + '已归还，装备槽与背包内副本均已移除')
  } else {
    const preferred: EquipSlot = def.kind === 'weapon' ? (def.equipSlot === 'weaponA' ? 'weaponA' : 'weaponB') : def.kind === 'pick' ? 'pick' : def.equipSlot === 'trinket' ? 'trinketA' : def.equipSlot as EquipSlot
    const slot = EQUIP_SLOT_META.find(entry => entry.slot === preferred && ENABLED_SLOTS.has(entry.slot) && slotAccepts(entry.slot, def.id))?.slot
    if (!slot) { say('此装备的槽位尚未开放'); return }
    const old = profile.equipment.get(slot)
    if (old && profile.inventory.add(old, 1) !== 1) { say('背包已满，请先腾出一格'); return }
    profile.equipment.set(slot, def.id)
    selectEquipmentHand(member,slot === 'weaponA' ? 0 : slot === 'weaponB' ? 1 : slot === 'pick' ? 2 : 0)
    say(itemName(def.id) + '已获取并装备；原装备已返还背包')
  }
  refreshEquipment()
}
/** 弹药按批直接入包，重复点击继续领取，不走装备归还分支。 */
function giveArrows(id:string):void {
  sfx.uiTap()
  const inventory=equipmentMember().profile.inventory,cap=inventory.stackLimit(id)
  const space=inventory.slots.reduce((amount,slot)=>amount+(!slot?cap:slot.id===id?Math.max(0,cap-slot.qty):0),0)
  if(space<100){say('背包空间不足，无法放入100支箭');return}
  inventory.add(id,100)
  say('已获取100支'+itemName(id))
}

/** HUD 只读取需要的字段（App 的 debug reactive 对象结构兼容即可） */
interface ConsoleHud {
  x: number
  y: number
  depth: number
  hp: number
  mana: number
  level: number
  enemiesAlive: number
  kills: number
  roomsCleared: number
  roomsTotal: number
}

const props = defineProps<{
  manager: ModuleManager<GameEvents> | null
  players: LocalPlayers
  cave: CaveModule
  base: BaseModule
  trial: TrialModule
  scene: 'cave' | 'base' | 'trial'
  god: boolean
  hud: ConsoleHud
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'toggle-god'): void
  (e: 'enter-trial'): void
}>()

/** 最近一条操作反馈（常显在面板底部） */
const log = ref('控制台就绪：点击按钮即可作弊')
const performanceEnabled=ref(profiler.enabled)
const performanceData=ref(profiler.snapshot())
function togglePerformance():void {performanceEnabled.value=!performanceEnabled.value;profiler.setEnabled(performanceEnabled.value);performanceData.value=profiler.snapshot()}
function clearPerformance():void {profiler.reset();performanceData.value=profiler.snapshot()}
function exportPerformance():void {
  const data=profiler.snapshot()
  downloadSimulation({version:1,scene:props.scene,seed:props.manager?.simulation.random.seed,tick:props.manager?.simulation.tick,tps:data.counters.tps,viewport:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio},data},'touhou-performance.json')
}
const equipmentPlayerId=ref(props.players.primaryId)
function equipmentMember():LocalPlayer{return props.players.get(equipmentPlayerId.value)??props.players.primary}
function selectEquipmentHand(member:LocalPlayer,index:number):void {
  if(member.id===props.players.primaryId)activeModule().selectHand(index)
  else {member.profile.selected=index;props.players.sync(member)}
}
function chooseEquipmentPlayer(id:string):void {equipmentPlayerId.value=id;refreshEquipment()}
function toggleCostumeLibrary():void {
  sfx.uiTap();wardrobeOpen.value=!wardrobeOpen.value
  if(wardrobeOpen.value)equipmentOpen.value=false
}
/** 调试穿搭可以直接解锁时装，仍写入所选玩家自己的档案和绘制状态。 */
function wearCostume(costume:PlayerCostume):void {
  sfx.uiTap()
  const member=equipmentMember()
  if(costume==='old_miner'){
    member.profile.setFlag('unlock.costume.old_miner',true)
    member.profile.discovery.unlock(OLD_MINER_OUTFIT_ID)
    member.profile.pendingSearchUnlocks.delete(OLD_MINER_OUTFIT_ID)
  }
  if(member.id===props.players.primaryId)activeModule().selectCostume(costume)
  else {member.profile.costume=costume;props.players.sync(member)}
  if(member.entity)member.entity.costume=costume
  costumeRevision.value++
  say(t('ui.console.costume_changed',{n:props.players.all.indexOf(member)+1,name:t(`ui.costume.${costume}`)}))
}
function toggleCostume():void {wearCostume(selectedCostume.value==='default'?'old_miner':'default')}
const partyRevision=ref(0)
function party():readonly LocalPlayer[]{partyRevision.value;return props.players.all}
function addPlayer(appearance:PlayerAppearance):void {
  try{
    const create=()=>activeModule().debugAddLocalPlayer(appearance)
    if(props.manager)props.manager.simulation.run(create);else create()
    partyRevision.value++;say(t('ui.local_players.added'))
  }
  catch(error){say(error instanceof Error?error.message:t('ui.local_players.not_ready'))}
}
function removePlayer(id:string):void {
  activeModule().debugRemoveLocalPlayer(id)
  if(equipmentPlayerId.value===id)equipmentPlayerId.value=props.players.primaryId
  partyRevision.value++;refreshEquipment();say(t('ui.local_players.removed'))
}
function changeController(member:LocalPlayer,step:number):void {
  try{
    let index=member.controller.kind==='gamepad'?member.controller.index+step:step<0?-1:0
    while(index>=0&&props.players.extras.some(other=>other!==member&&other.controller.kind==='gamepad'&&other.controller.index===index))index+=step
    props.players.setController(member.id,index<0?{kind:'idle'}:{kind:'gamepad',index})
    partyRevision.value++
  }catch(error){say(error instanceof Error?error.message:t('ui.local_players.not_ready'))}
}

function say(text: string): void {
  log.value = text
}

/** 当前场景的活动模块（营地只有回血/给物/无敌可用） */
function toggleGod(): void {
  sfx.uiTap()
  emit('toggle-god')
}

function refill(): void {
  sfx.uiTap()
  const ok = props.scene === 'base' ? props.base.debugRefill() : props.scene === 'trial' ? props.trial.debugRefill() : props.cave.debugRefill()
  say(ok ? '生命与灵力已回满' : '现在回不了血（已死亡或结算中）')
}

function killRoom(): void {
  sfx.uiTap()
  if (props.scene !== 'cave') {
    say('营地里没有怪可杀……')
    return
  }
  const n = props.cave.debugKillRoom()
  say(n > 0 ? `已秒杀本房 ${n} 只怪物，门马上开` : '本房没有存活的怪物')
}

function spawnDummy(): void {
  sfx.uiTap()
  if (props.scene !== 'cave') {
    say('营地里不能生成调试史莱姆')
    return
  }
  const ok = props.cave.debugSpawnDummy()
  say(ok ? '已在面前生成 100000 血调试史莱姆' : '现在无法生成（已死亡或结算中）')
}

function extract(): void {
  sfx.uiTap()
  if (props.scene === 'trial') { props.trial.returnToBase(); emit('close'); return }
  if (props.scene === 'base') {
    say('营地不需要撤离呀')
    return
  }
  if (!props.cave.debugCanExtract) {
    say('序章剧情或结算中不能撤离')
    return
  }
  if (props.cave.debugExtract()) say('已发起撤离结算，矿石与成长全部保留')
  else say('现在无法撤离')
}

const simulationFile = ref<HTMLInputElement|null>(null)
const recording = ref(props.manager?.recording??false)
const simulationSpeed = ref(props.manager?.fixedStep.timeScale??1)
function downloadSimulation(value:unknown,name:string):void{
  const url=URL.createObjectURL(new Blob([JSON.stringify(value)],{type:'application/json'}))
  const link=document.createElement('a');link.href=url;link.download=name;link.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function exportSnapshot():void{
  try{
    const manager=props.manager;if(!manager)return
    const snapshot=manager.captureSimulation()
    downloadSimulation({kind:'snapshot',data:snapshot,battle:props.scene==='cave'?props.cave.captureBattleSimulation():undefined},`touhou-snapshot-${snapshot.session.tick}.json`)
    say(t('ui.simulation.exported'))
  }catch(error){say(error instanceof Error?error.message:t('ui.simulation.invalid'))}
}
function toggleRecording():void{
  try{
    const manager=props.manager;if(!manager)return
    if(manager.recording||manager.lastReplay){
      const replay=manager.recording?manager.finishRecording():manager.lastReplay
      if(replay)downloadSimulation({kind:'replay',data:replay},`touhou-replay-${replay.session.tick}.json`)
      manager.lastReplay=null;recording.value=false;say(t('ui.simulation.recorded'))
    }else{manager.startRecording();recording.value=true;say(t('ui.simulation.recording_hint'))}
  }catch(error){say(error instanceof Error?error.message:t('ui.simulation.invalid'))}
}
async function importSimulation(event:Event):Promise<void>{
  const element=event.target as HTMLInputElement,file=element.files?.[0]
  element.value='';if(!file||!props.manager)return
  try{
    const value=JSON.parse(await file.text()) as {kind:string;data:SimulationSnapshot|SimulationReplay<SimulationSnapshot>}
    if(value.data?.version!==SIMULATION_VERSION)throw new Error(t('ui.simulation.invalid'))
    if(value.kind==='snapshot'){props.manager.restoreSimulation(value.data as SimulationSnapshot);say(t('ui.simulation.restored'))}
    else if(value.kind==='replay'){
      props.manager.onReplayError=error=>say(error instanceof Error?error.message:t('ui.simulation.invalid'))
      props.manager.playReplay(value.data as SimulationReplay<SimulationSnapshot>);say(t('ui.simulation.playing'));emit('close')
    }else throw new Error(t('ui.simulation.invalid'))
  }catch(error){say(error instanceof Error?error.message:t('ui.simulation.invalid'))}
}
function changeTimeScale(value:number):void{
  if(props.manager){props.manager.fixedStep.timeScale=value;simulationSpeed.value=value}
}

/** Esc 关闭（开关键 ~ / F8 由 App 统一处理，避免双份监听打架） */
const onKey = (e: KeyboardEvent): void => {
  if (e.code === 'Escape') {
    e.preventDefault()
    e.stopImmediatePropagation()
    if(e.repeat)return
    if(wardrobeOpen.value){wardrobeOpen.value=false;return}
    emit('close')
  }
}

onMounted(() => { profiler.suspended=true;performanceData.value=profiler.snapshot();window.addEventListener('keydown', onKey,true); refreshEquipment() })
onBeforeUnmount(() => {profiler.suspended=false;window.removeEventListener('keydown', onKey,true)})
</script>

<template>
  <!-- 遮罩：挡住画布点击，但不挡面板自身 -->
  <div class="dc-mask" @pointerdown.self="emit('close')"></div>

  <section class="dc-panel hud-panel gpanel gpanel-pop" role="dialog" aria-label="调试控制台">
    <header class="dc-head">
      <span class="dc-title">调试控制台</span>
      <button class="dc-x" title="关闭（~ / F8 / Esc）" @click="emit('close')">×</button>
    </header>

    <div class="dc-scroll">
    <!-- 状态只读区 -->
    <div class="dc-stats gpanel-mini hud-surface">
      <div class="dc-row"><span>场景</span><b>{{ scene === 'cave' ? '矿洞' : scene === 'trial' ? t('trial.title') : '营地' }}</b></div>
      <template v-if="scene === 'cave'">
        <div class="dc-row"><span>楼层</span><b>第 {{ hud.depth }} 层</b></div>
        <div class="dc-row"><span>坐标</span><b>{{ Math.round(hud.x) }}, {{ Math.round(hud.y) }}</b></div>
        <div class="dc-row"><span>本房怪物</span><b :class="{ hot: hud.enemiesAlive > 0 }">{{ hud.enemiesAlive }}</b></div>
        <div class="dc-row"><span>清房进度</span><b>{{ hud.roomsCleared }}/{{ hud.roomsTotal }}</b></div>
      </template>
      <div class="dc-row"><span>等级</span><b>Lv.{{ hud.level }}</b></div>
      <div class="dc-row"><span>生命</span><b>{{ Math.ceil(hud.hp) }}</b></div>
      <div class="dc-row"><span>灵力</span><b>{{ Math.ceil(hud.mana) }}</b></div>
    </div>

    <!-- 作弊按钮区：每个按钮都真实生效 -->
    <div class="dc-grid">
      <button class="gbtn dc-btn" :class="{ on: god }" @click="toggleGod">
        无敌模式 · {{ god ? '开' : '关' }}
      </button>
      <button class="gbtn dc-btn" @click="refill">回满血灵</button>
      <button class="gbtn dc-btn" :disabled="appearanceBusy" @click="toggleAppearance">{{ t(playerAppearance === 'brother' ? 'ui.console.switch_sister' : 'ui.console.switch_brother') }}</button>
      <button class="gbtn dc-btn" :disabled="scene !== 'cave'" @click="killRoom">
        秒杀本房怪物
      </button>
      <button class="gbtn dc-btn" :disabled="scene !== 'cave'" @click="spawnDummy">
        生成10万血靶子
      </button>
      <button class="gbtn dc-btn" :class="{ on: equipmentOpen }" :aria-expanded="equipmentOpen" @click="toggleEquipmentLibrary">获取装备</button>
      <button class="gbtn dc-btn" @click="toggleCostume">{{t('ui.console.costume_toggle',{n:party().indexOf(equipmentMember())+1})}}</button>
      <button class="gbtn dc-btn" :class="{on:wardrobeOpen}" :aria-expanded="wardrobeOpen" @click="toggleCostumeLibrary">{{t('ui.console.costume_library')}}</button>
      <button
        class="gbtn dc-btn"
        :disabled="scene === 'base' || (scene === 'cave' && !cave.debugCanExtract)"
        @click="extract"
      >
        {{ scene === 'trial' ? t('trial.leave') : '立即撤离结算' }}
      </button>
      <button class="gbtn dc-btn" @click="emit('enter-trial')">{{ t(scene === 'trial' ? 'trial.restart' : 'trial.enter') }}</button>
    </div>

    <div class="dc-simulation">
      <div class="dc-row"><span>{{t('ui.simulation.seed')}}</span><b>{{manager?.simulation.random.seed}}</b></div>
      <div class="dc-row"><span>{{t('ui.simulation.tick')}}</span><b>{{manager?.simulation.tick}}</b></div>
      <div class="dc-row dc-speed-row"><span>{{t('ui.simulation.speed')}}</span><SimulationSpeedSelect :model-value="simulationSpeed" :label="t('ui.simulation.speed')" :disabled="!manager" @update:model-value="changeTimeScale" /></div>
      <div class="dc-grid">
        <button class="gbtn dc-btn" @click="exportSnapshot">{{t('ui.simulation.export')}}</button>
        <button class="gbtn dc-btn" @click="simulationFile?.click()">{{t('ui.simulation.import')}}</button>
        <button class="gbtn dc-btn" :class="{on:recording}" @click="toggleRecording">{{t(recording||manager?.lastReplay?'ui.simulation.finish_recording':'ui.simulation.start_recording')}}</button>
        <button class="gbtn dc-btn" :disabled="!manager?.replaying" @click="manager?.stopReplay()">{{t('ui.simulation.stop_replay')}}</button>
      </div>
      <input ref="simulationFile" type="file" accept="application/json,.json" hidden @change="importSimulation" />
    </div>

    <div class="dc-performance">
      <div class="dc-party-head"><span>{{t('ui.performance.title')}}</span><span>{{t('ui.performance.ms')}}</span></div>
      <div class="dc-grid">
        <button class="gbtn dc-btn" :class="{on:performanceEnabled}" :aria-pressed="performanceEnabled" @click="togglePerformance">{{t(performanceEnabled?'ui.performance.stop':'ui.performance.start')}}</button>
        <button class="gbtn dc-btn" @click="exportPerformance">{{t('ui.performance.export')}}</button>
      </div>
      <p class="dc-party-hint">{{t('ui.performance.hint')}}</p>
      <table v-if="performanceData.sections.length" class="dc-performance-table">
        <thead><tr><th>{{t('ui.performance.section')}}</th><th>{{t('ui.performance.mean')}}</th><th>P95</th></tr></thead>
        <tbody><tr v-for="section in performanceData.sections" :key="section.name"><td>{{t('ui.performance.'+section.name)}}</td><td>{{section.mean.toFixed(2)}}</td><td>{{section.p95.toFixed(2)}}</td></tr></tbody>
      </table>
      <div v-for="(value,key) in performanceData.counters" :key="key" class="dc-row"><span>{{t('ui.performance.'+key)}}</span><b>{{Number(value).toFixed(key==='roomRasterMiB'||key==='frameMs'?2:0)}}</b></div>
      <button v-if="performanceData.sections.length" class="gbtn dc-btn" @click="clearPerformance">{{t('ui.performance.clear')}}</button>
    </div>

    <div class="dc-party">
      <div class="dc-party-head"><span>{{t('ui.local_players.title')}}</span><span>{{party().length}}</span></div>
      <div class="dc-grid">
        <button class="gbtn dc-btn" :disabled="!activeModule().canAddLocalPlayer" @click="addPlayer('brother')">{{t('ui.local_players.add_brother')}}</button>
        <button class="gbtn dc-btn" :disabled="!activeModule().canAddLocalPlayer" @click="addPlayer('sister')">{{t('ui.local_players.add_sister')}}</button>
      </div>
      <div class="dc-party-list">
        <div v-for="(member,index) in party()" :key="member.id" class="dc-party-row">
          <span class="dc-party-name">P{{index+1}} · {{t(member.profile.playerAppearance==='sister'?'ui.player.sister':'ui.player.brother')}}</span>
          <span v-if="member.id===players.primaryId" class="dc-party-controller">{{t('ui.local_players.keyboard')}}</span>
          <template v-else>
            <button class="dc-party-step" :aria-label="t('ui.local_players.previous')" @click="changeController(member,-1)">−</button>
            <span class="dc-party-controller">{{member.controller.kind==='gamepad'?t('ui.local_players.gamepad',{n:member.controller.index+1}):t(member.controller.kind==='script'&&member.source?'ui.local_players.script':'ui.local_players.idle')}}</span>
            <button class="dc-party-step" :aria-label="t('ui.local_players.next')" @click="changeController(member,1)">+</button>
            <button class="dc-party-remove" :aria-label="t('ui.local_players.remove',{n:index+1})" @click="removePlayer(member.id)">×</button>
          </template>
        </div>
      </div>
      <div class="dc-party-hint">{{t('ui.local_players.controls')}}</div>
    </div>

    </div>
    <aside v-if="equipmentOpen" class="dc-equipment gpanel hud-panel" aria-label="控制台装备库">
      <div class="dc-library-head"><span class="dc-library-title">装备库</span><span class="dc-library-count">{{ ownedEquipment.length }} / {{ equipmentLibrary.length }}</span></div>
      <div class="dc-library-hint">点选领取 · 亮起表示持有 · 再点归还</div>
      <div v-if="party().length>1" class="dc-equipment-players" :aria-label="t('ui.local_players.equipment_target')">
        <button v-for="(member,index) in party()" :key="member.id" class="gbtn" :class="{selected:equipmentMember().id===member.id}"
          :aria-pressed="equipmentMember().id===member.id" :aria-label="t('ui.local_players.equipment_for',{n:index+1})" @click="chooseEquipmentPlayer(member.id)">P{{index+1}}</button>
      </div>
      <div class="dc-equipment-icons">
        <button v-for="def in equipmentLibrary" :key="def.id" class="dc-equipment-item" :class="{ owned: ownedEquipment.includes(def.id) }" :aria-pressed="ownedEquipment.includes(def.id)" :title="itemName(def.id) + (ownedEquipment.includes(def.id) ? ' · 点击归还' : ' · 点击获取')" @click="toggleEquipment(def)">
          <ItemIcon :id="def.id" :size="42" />
          <span>{{ itemName(def.id) }}</span>
        </button>
      </div>
      <div class="dc-controls" aria-label="领取弹药">
        <button class="gbtn dc-btn" @click="giveArrows(WOOD_ARROW_ID)">获取100支木箭</button>
        <button class="gbtn dc-btn" @click="giveArrows(IRON_ARROW_ID)">获取100支铁头箭</button>
      </div>
    </aside>

    <aside v-if="wardrobeOpen" class="dc-equipment dc-wardrobe gpanel hud-panel" :aria-label="t('ui.console.costume_library')">
      <div class="dc-library-head"><span class="dc-library-title">{{t('ui.console.costume_library')}}</span><button class="dc-x" :aria-label="t('ui.common.close')" @click="wardrobeOpen=false">×</button></div>
      <div class="dc-library-hint">{{t('ui.console.costume_hint')}}</div>
      <div v-if="party().length>1" class="dc-equipment-players" :aria-label="t('ui.console.costume_target')">
        <button v-for="(member,index) in party()" :key="member.id" class="gbtn" :class="{selected:equipmentMember().id===member.id}" :aria-pressed="equipmentMember().id===member.id" :aria-label="t('ui.console.costume_for',{n:index+1})" @click="chooseEquipmentPlayer(member.id)">P{{index+1}}</button>
      </div>
      <div class="dc-costume-cards">
        <button class="dc-equipment-item" :class="{owned:selectedCostume==='default'}" :aria-pressed="selectedCostume==='default'" @click="wearCostume('default')">
          <svg class="dc-default-clothes" viewBox="0 0 80 90" aria-hidden="true"><path d="M24 12L7 26L15 48L26 39L21 78H60L54 39L65 48L73 26L56 12L40 19Z" fill="#5e6d89" stroke="#282635" stroke-width="2"/><path d="M32 17L40 24L48 17L50 73H30Z" fill="#dedbd1"/><path d="M12 36L23 32M57 32L69 36M23 68H30M51 68H58" stroke="#d2d6d2" stroke-width="4"/></svg>
          <span>{{t('ui.costume.default')}}</span><small v-if="selectedCostume==='default'">{{t('ui.wardrobe.selected')}}</small>
        </button>
        <button class="dc-equipment-item" :class="{owned:selectedCostume==='old_miner'}" :aria-pressed="selectedCostume==='old_miner'" @click="wearCostume('old_miner')">
          <ItemIcon :id="OLD_MINER_OUTFIT_ID" :size="76"/><span>{{t('ui.costume.old_miner')}}</span><small>{{t(selectedCostume==='old_miner'?'ui.wardrobe.selected':equipmentMember().profile.flagBool('unlock.costume.old_miner')?'ui.wardrobe.wear':'ui.console.costume_unlock')}}</small>
        </button>
      </div>
    </aside>
    <footer class="dc-log">{{ log }}</footer>
    <div class="dc-hint">按 <kbd>~</kbd> 或 <kbd>F8</kbd> 或 <kbd>Esc</kbd> 关闭 · 仅调试用</div>
  </section>
</template>

<style scoped>
/* 半透明遮罩：吃掉打开期间的画布交互（玩法输入已在 InputManager 层屏蔽） */
.dc-mask {
  position: fixed;
  inset: 0;
  z-index: 110;
  background: rgba(10, 6, 2, 0.35);
}

.dc-panel {
  position: fixed;
  z-index: 111;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  width: 312px;
  padding: 14px 16px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* 九宫格厚边太重，这里压薄一圈 */
  border-width: 8px;
  border-radius: 4px;
  box-shadow: 0 10px 34px rgba(0, 0, 0, 0.6);
  max-height: calc(100vh - 44px);
}
.dc-scroll { min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:2px;scrollbar-color:#a38450 #241e21; }
.dc-scroll > * { flex-shrink:0; }
.dc-head,.dc-log,.dc-hint { flex-shrink:0; }

.dc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dc-title {
  font-family: var(--font-sign);
  font-size: 17px;
  letter-spacing: 5px;
  color: var(--brass-hi);
  text-shadow: 0 2px 0 rgba(0, 0, 0, 0.45);
}
.dc-x {
  width: 24px;
  height: 24px;
  line-height: 20px;
  padding: 0;
  font-size: 16px;
  color: var(--text-dim);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #1c1006;
  cursor: pointer;
}
.dc-x:hover {
  color: var(--text);
  filter: brightness(1.25);
}

.dc-stats {
  padding: 8px 10px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px 12px;
  font-size: 12px;
  letter-spacing: 1px;
}
.dc-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-dim);
}
.dc-row b {
  color: var(--text);
  font-weight: 400;
}
.dc-row b.hot {
  color: var(--danger);
}

.dc-simulation { padding: 10px; border-top: 1px solid var(--brass-dim); display: grid; gap: 8px; }
.dc-performance {padding:10px;border-top:1px solid var(--brass-dim);display:grid;gap:8px;}
.dc-performance-table {width:100%;border-collapse:collapse;font-size:11px;color:#e4d2b6;font-variant-numeric:tabular-nums;}
.dc-performance-table th,.dc-performance-table td {padding:5px 3px;text-align:right;border-bottom:1px solid #92734433;}
.dc-performance-table th:first-child,.dc-performance-table td:first-child {text-align:left;}
.dc-performance-table th {color:#c2ae8a;font-weight:normal;}
.dc-speed-row { align-items: center; }
.dc-party { display:grid;gap:8px;padding:10px;border-top:1px solid var(--brass-dim); }
.dc-party-head { display:flex;justify-content:space-between;color:var(--brass-hi);font-size:13px; }
.dc-party-list { display:grid;gap:4px;max-height:156px;overflow-y:auto;scrollbar-color:#927344 #241e21; }
.dc-party-row { display:flex;align-items:center;gap:5px;min-height:28px;padding:3px 5px;background:#1b172366;border-left:2px solid #92734466; }
.dc-party-name { flex:1;color:#e4d2b6;font-size:11px;white-space:nowrap; }
.dc-party-controller { color:#c1b29b;font-size:10px;white-space:nowrap; }
.dc-party-step,.dc-party-remove { border:1px solid #82613e;background:#34251b;color:#eed5a7;width:22px;height:22px;padding:0;cursor:pointer; }
.dc-party-step:hover,.dc-party-remove:hover { background:#654728;color:#ffedc8; }
.dc-party-hint { color:#b6a58b;font-size:10px;line-height:1.6; }

.dc-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.dc-btn {
  padding: 9px 6px;
  font-size: 12px;
  letter-spacing: 1px;
  white-space: nowrap;
}
/* 无敌开启时按钮变铜金高亮，一眼看出作弊状态 */
.dc-btn.on {
  background:
    linear-gradient(180deg, rgba(255, 235, 180, 0.22), rgba(0, 0, 0, 0.1)),
    linear-gradient(180deg, #b5863b, #8a5d24);
  color: #fff3d2;
}
.dc-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  filter: grayscale(0.4);
}

.dc-log {
  min-height: 30px;
  padding: 6px 9px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--heal);
  background: rgba(0, 0, 0, 0.28);
  border-left: 2px solid var(--brass-dim);
}
.dc-hint {
  text-align: center;
  font-size: 11px;
  letter-spacing: 1px;
  color: var(--text-dim);
}
.dc-hint kbd {
  padding: 0 4px;
  border: 1px solid rgba(240, 205, 126, 0.35);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.35);
  color: var(--brass-hi);
  font-family: var(--font-body);
}
/* 装备库是控制台右侧的独立抽屉，卡片采用凹槽底与旧黄铜包边。 */
.dc-equipment {
  position: absolute; left: calc(100% + 14px); top: 0;
  width: 352px; box-sizing: border-box; padding: 16px;
  border: 1px solid #8a704b; border-radius: 5px;
  background: radial-gradient(ellipse at 30% 0, #5a4634 0, transparent 65%), linear-gradient(145deg, #30271f, #211b18);
  box-shadow: inset 0 0 0 3px #211913, inset 0 0 0 4px #675039, 0 12px 32px #0009;
}
.dc-library-head { display: flex; align-items: center; justify-content: space-between; padding-bottom: 9px; border-bottom: 1px solid #82674666; }
.dc-library-title { color: #d4bd92; font-family: var(--font-sign); font-size: 17px; letter-spacing: 4px; text-shadow: 0 2px #100d09; }
.dc-library-count { color: #ad9876; font-size: 11px; padding: 3px 7px; background: #17130f88; border: 1px solid #65513b; border-radius: 3px; }
.dc-library-hint { margin: 10px 0 13px; color: #a9977f; font-size: 11px; line-height: 1.5; letter-spacing: .4px; }
.dc-equipment-players { display:flex;gap:5px;overflow-x:auto;padding:2px 0 10px;scrollbar-color:#927344 #241e21; }
.dc-equipment-players button { padding:4px 8px;flex-shrink:0;font-size:11px; }
.dc-equipment-players .selected { color:#ffe1a2;border-color:#d2b075;box-shadow:inset 0 0 0 1px #caa26388; }
.dc-equipment-icons { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; max-height: min(480px, 65vh); overflow-y: auto; padding: 2px; scrollbar-color: #7b6043 #211b16; }
.dc-costume-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
.dc-costume-cards .dc-equipment-item{min-height:170px;padding:14px 8px;font-size:13px;}
.dc-costume-cards small{color:#ccb98f;font-size:10px;}
.dc-default-clothes{width:76px;height:86px;}
.dc-equipment-item {
  appearance: none; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px;
  min-width: 0; min-height: 91px; padding: 10px 3px 7px; cursor: pointer;
  color: #bdb09a; font-family: var(--font-body); font-size: 10px; line-height: 1.35;
  border: 1px solid #66513b; border-radius: 4px;
  background: radial-gradient(ellipse at 50% 28%, #51433255, transparent 70%), linear-gradient(#27211c, #181512);
  box-shadow: inset 0 1px 1px #0009, inset 0 -1px #82674644, 0 2px 3px #0005;
  transition: border-color .15s, background .15s, color .15s;
}
.dc-equipment-item span { width: 100%; text-align: center; overflow-wrap: anywhere; }
.dc-equipment-item :deep(.item-icon) { filter: drop-shadow(0 3px 2px #0009); }
.dc-equipment-item:hover, .dc-equipment-item:focus-visible { outline: none; border-color: #c3a46a; color: #eee0bc; background: linear-gradient(#463728, #292119); }
.dc-equipment-item.owned { border-color: #c9a568; color: #eddbaf; background: radial-gradient(ellipse at 50% 30%, #b18a3f36, transparent 75%), linear-gradient(#4b3b28, #2e251b); box-shadow: inset 0 0 0 1px #b78a4244, inset 0 1px #e0bf7166, 0 2px 4px #0006; }
.dc-equipment-item.owned::after { content: ''; position: absolute; top: 5px; right: 5px; width: 5px; height: 5px; border-radius: 50%; background: #ebcb81; box-shadow: 0 0 5px #d6af6088; }
@media (max-width: 760px) {
  .dc-panel { left: 10px; width: min(312px, calc(100vw - 52px)); max-height: 85vh; overflow-y: auto; }
  .dc-equipment { position: static; width: 100%; margin-top: 4px; }
  .dc-equipment-icons { grid-template-columns: repeat(3, minmax(0, 1fr)); max-height: 240px; }
}
</style>
