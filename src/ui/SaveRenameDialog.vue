<script setup lang="ts">
import { ref } from 'vue'
import HudConfirm from './HudConfirm.vue'
import { SAVE_NAME_MAX_LENGTH } from '../shared/profile'
import { t } from '../i18n'

const props = defineProps<{ name: string; theme: 'game' | 'title'; busy: boolean; error?: string }>()
const emit = defineEmits<{ save: [name: string]; cancel: [] }>()
const draft = ref(props.name)
function submit(): void { if (!props.busy) emit('save', draft.value) }
</script>
<template>
  <HudConfirm :theme="theme" :title="t('ui.records.rename_title')" :message="t('ui.records.rename_hint')" :confirm-label="t('ui.records.save_action')" :busy="busy" @confirm="submit" @cancel="emit('cancel')">
    <template #body>
      <form class="rename-form" :class="{ 'title-rename-form': theme === 'title' }" @submit.prevent="submit">
        <label for="record-name">{{ t('ui.records.rename_label') }}</label>
        <input id="record-name" v-model="draft" type="text" autocomplete="off" :maxlength="SAVE_NAME_MAX_LENGTH" :placeholder="t('ui.records.rename_placeholder')" :disabled="busy" aria-describedby="confirm-message"/>
        <p id="confirm-message">{{ t('ui.records.rename_hint') }}</p>
        <p v-if="error" class="rename-error" role="alert">{{ error }}</p>
      </form>
    </template>
  </HudConfirm>
</template>
<style scoped>
.rename-form{padding:20px 0;border-top:1px solid #a8926f44;border-bottom:1px solid #a8926f44;color:#d8c4a1}.rename-form label{display:block;font-size:12px;letter-spacing:2px;margin-bottom:12px}.rename-form input{width:100%;padding:10px 12px;border:1px solid #a58b6277;border-radius:0;background:#15121d;color:#eadbc1;outline:none;font:inherit;font-size:16px;user-select:text}.rename-form input:focus{border-color:#e2c28e}.rename-form input::placeholder{font-size:12px;color:#a3947d}.rename-form p{font-size:11px;line-height:1.8;margin-top:13px;color:#ad9c83}
.rename-form p.rename-error{color:#e0a58f}
</style>
