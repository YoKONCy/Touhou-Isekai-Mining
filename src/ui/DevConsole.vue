<script setup lang="ts">
/**
 * 开发调试控制台（作弊面板）。
 * 按 `~`（反引号）或 F8 开关；打开期间游戏输入被 InputManager.suppressed 整体屏蔽。
 * 操作按钮调用模块的真实调试方法；主角切换只更新共享的视觉选择。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { CaveModule } from '../game/cave/CaveModule'
import type { BaseModule } from '../game/BaseModule'
import type { TrialModule } from '../game/TrialModule'
import { t } from '../i18n'
import { sfx } from '../game/audio/Sfx'
import {
  DOOMSDAY_ID, SWORD_RUSTY_ID, PICK_RUSTY_ID, SPELL_HARAE_ID,
  STAFF_WOOD_ID, SPEAR_STONE_ID, LEATHER_ARMOR_ID, BOOMERANG_ID,WOOD_BOW_ID,WOOD_ARROW_ID,IRON_ARROW_ID,
  NUNCHAKU_ID, WHIP_ID, SWORD_IRON_ID, PICK_IRON_ID, SPEAR_IRON_ID,
  PICK_STEEL_ID, KATANA_FORGED_ID, DAGGER_ASSAULT_ID, DUAL_BLADES_ID, SWORD_STEEL_BROAD_ID, AXE_STEEL_ID, SPEAR_RED_TASSEL_ID, VORPAL_ID
} from '../content/items/vanilla/ids'
import { items } from '../content/items/registry'
import type { EquipSlot, ItemDef } from '../content/items/types'
import { EQUIP_SLOT_META, ENABLED_SLOTS, slotAccepts } from '../shared/equipment'
import { itemName } from '../i18n'
import ItemIcon from './ItemIcon.vue'
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
    say(t('ui.console.appearance_changed', { appearance: t(target === 'sister' ? 'ui.player.sister' : 'ui.player.brother') }))
  } catch { say(t('ui.console.appearance_save_error')) }
  finally { appearanceBusy.value = false }
}

const equipmentOpen = ref(false)
const ownedEquipment = ref<string[]>([])
/** 同品质内按大致时期排列；尚未接入获取方式的装备放在对应进阶位置。 */
const equipmentProgression = new Map<string, number>([
  SWORD_RUSTY_ID, PICK_RUSTY_ID, SPELL_HARAE_ID,
  STAFF_WOOD_ID, SPEAR_STONE_ID,WOOD_BOW_ID,
  LEATHER_ARMOR_ID, BOOMERANG_ID, NUNCHAKU_ID, WHIP_ID,
  SWORD_IRON_ID, PICK_IRON_ID, SPEAR_IRON_ID, PICK_STEEL_ID,
  KATANA_FORGED_ID, DAGGER_ASSAULT_ID, DUAL_BLADES_ID, SWORD_STEEL_BROAD_ID, AXE_STEEL_ID, SPEAR_RED_TASSEL_ID, VORPAL_ID, DOOMSDAY_ID
].map((id, order) => [id, order]))
const equipmentLibrary = items.all()
  .filter(def => def.equipSlot && (def.kind === 'weapon' || def.kind === 'pick' || def.kind === 'armor' || def.kind === 'spellcard' || def.equipSlot === 'trinket'))
  .sort((a, b) => (a.rarity ?? 1) - (b.rarity ?? 1)
    || (equipmentProgression.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (equipmentProgression.get(b.id) ?? Number.MAX_SAFE_INTEGER))
const activeModule = () => props.scene === 'base' ? props.base : props.scene === 'trial' ? props.trial : props.cave

function refreshEquipment(): void {
  const module = activeModule()
  ownedEquipment.value = equipmentLibrary.filter(def => EQUIP_SLOT_META.some(({ slot }) => module.equipment.get(slot) === def.id) || module.inventory.slots.some(slot => slot?.id === def.id)).map(def => def.id)
}
function toggleEquipmentLibrary(): void {
  sfx.uiTap()
  equipmentOpen.value = !equipmentOpen.value
  refreshEquipment()
}

/** 所有装备统一获取和归还；保留原装备，背包满时不做替换。 */
function toggleEquipment(def: ItemDef): void {
  sfx.uiTap()
  const module = activeModule()
  refreshEquipment()
  if (ownedEquipment.value.includes(def.id)) {
    if (def.id === DOOMSDAY_ID) module.debugReturnDoomsday()
    for (const { slot } of EQUIP_SLOT_META) if (module.equipment.get(slot) === def.id) module.equipment.set(slot, null)
    for (let i = 0; i < module.inventory.slots.length; i++) if (module.inventory.slots[i]?.id === def.id) module.inventory.removeAt(i)
    module.selectHand(0)
    say(itemName(def.id) + '已归还，装备槽与背包内副本均已移除')
  } else {
    const preferred: EquipSlot = def.kind === 'weapon' ? (def.equipSlot === 'weaponA' ? 'weaponA' : 'weaponB') : def.kind === 'pick' ? 'pick' : def.equipSlot === 'trinket' ? 'trinketA' : def.equipSlot as EquipSlot
    const slot = EQUIP_SLOT_META.find(entry => entry.slot === preferred && ENABLED_SLOTS.has(entry.slot) && slotAccepts(entry.slot, def.id))?.slot
    if (!slot) { say('此装备的槽位尚未开放'); return }
    const old = module.equipment.get(slot)
    if (old && module.inventory.add(old, 1) !== 1) { say('背包已满，请先腾出一格'); return }
    module.equipment.set(slot, def.id)
    module.selectHand(slot === 'weaponA' ? 0 : slot === 'weaponB' ? 1 : slot === 'pick' ? 2 : 0)
    say(itemName(def.id) + '已获取并装备；原装备已返还背包')
  }
  refreshEquipment()
}
/** 弹药按批直接入包，重复点击继续领取，不走装备归还分支。 */
function giveArrows(id:string):void {
  sfx.uiTap()
  if(!activeModule().debugGiveAmmo(id,100)){say('背包空间不足，无法放入100支箭');return}
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

/** Esc 关闭（开关键 ~ / F8 由 App 统一处理，避免双份监听打架） */
const onKey = (e: KeyboardEvent): void => {
  if (e.code === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => { window.addEventListener('keydown', onKey); refreshEquipment() })
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <!-- 遮罩：挡住画布点击，但不挡面板自身 -->
  <div class="dc-mask" @pointerdown.self="emit('close')"></div>

  <section class="dc-panel hud-panel gpanel gpanel-pop" role="dialog" aria-label="调试控制台">
    <header class="dc-head">
      <span class="dc-title">调试控制台</span>
      <button class="dc-x" title="关闭（~ / F8 / Esc）" @click="emit('close')">×</button>
    </header>

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
      <button
        class="gbtn dc-btn"
        :disabled="scene === 'base' || (scene === 'cave' && !cave.debugCanExtract)"
        @click="extract"
      >
        {{ scene === 'trial' ? t('trial.leave') : '立即撤离结算' }}
      </button>
      <button class="gbtn dc-btn" @click="emit('enter-trial')">{{ t(scene === 'trial' ? 'trial.restart' : 'trial.enter') }}</button>
    </div>

    <aside v-if="equipmentOpen" class="dc-equipment gpanel hud-panel" aria-label="控制台装备库">
      <div class="dc-library-head"><span class="dc-library-title">装备库</span><span class="dc-library-count">{{ ownedEquipment.length }} / {{ equipmentLibrary.length }}</span></div>
      <div class="dc-library-hint">点选领取 · 亮起表示持有 · 再点归还</div>
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
}

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
.dc-equipment-icons { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; max-height: min(480px, 65vh); overflow-y: auto; padding: 2px; scrollbar-color: #7b6043 #211b16; }
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
