<template>
  <div style="border:1px solid var(--wb-border-subtle);border-radius:8px;padding:10px;margin-bottom:8px;background:var(--wb-bg-card);">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-weight:600;font-size:13px;">🌐 全局世界书（{{ bindingsGlobal.length }}）</span>
      <button class="btn mini danger" type="button" :disabled="!bindingsGlobal.length" @click="emit('clearGlobalWorldbooks')" style="font-size:11px;">清空</button>
    </div>
    <label class="field" style="margin-bottom:6px;">
      <span style="font-size:12px;">预设（切换即应用）</span>
      <select v-model="selectedGlobalPresetIdModel" class="text-input" @change="emit('globalPresetSelectionChanged')" style="font-size:12px;">
        <option value="">默认预设（清空全局世界书）</option>
        <option v-for="preset in globalWorldbookPresets" :key="preset.id" :value="preset.id">
          {{ preset.name }}（{{ preset.worldbooks.length }}）
        </option>
      </select>
    </label>
    <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
      <button class="btn mini" type="button" :disabled="!bindingsGlobal.length" @click="emit('saveCurrentAsGlobalPreset')" style="font-size:11px;">保存组合</button>
      <button class="btn mini" type="button" :disabled="!selectedGlobalPreset" @click="emit('overwriteSelectedGlobalPreset')" style="font-size:11px;">覆盖预设</button>
      <button class="btn mini danger" type="button" :disabled="!selectedGlobalPreset" @click="emit('deleteSelectedGlobalPreset')" style="font-size:11px;">删除预设</button>
    </div>
    <label class="field" style="margin-bottom:6px;">
      <span style="font-size:12px;">搜索并添加</span>
      <input v-model="globalAddSearchTextModel" type="text" class="text-input" placeholder="搜索世界书..." @keydown.enter.prevent="emit('addFirstGlobalCandidate')" style="font-size:12px;" />
    </label>
    <div v-if="globalAddCandidates.length" style="max-height:120px;overflow-y:auto;margin-bottom:6px;">
      <button
        v-for="name in globalAddCandidates"
        :key="`m-add-${name}`"
        type="button"
        style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:none;background:var(--wb-input-bg);border-radius:4px;color:var(--wb-text-main);font-size:12px;margin-bottom:2px;cursor:pointer;"
        @click="emit('addGlobalWorldbook', name)"
      >
        <span>{{ name }}</span><span style="color:#22c55e;">+ 添加</span>
      </button>
    </div>
    <div v-if="filteredGlobalWorldbooks.length" style="font-size:12px;margin-bottom:4px;opacity:0.7;">已启用：</div>
    <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;">
      <button
        v-for="name in filteredGlobalWorldbooks"
        :key="`m-gl-${name}`"
        type="button"
        style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:none;background:var(--wb-input-bg);border-radius:4px;color:var(--wb-text-main);font-size:12px;cursor:pointer;"
        @click="emit('removeGlobalWorldbook', name)"
      >
        <span>{{ name }}</span><span style="color:#ef4444;">移除</span>
      </button>
    </div>
    <div style="border-top:1px solid var(--wb-border-subtle);padding-top:8px;margin-top:4px;">
      <div style="font-size:12px;font-weight:600;margin-bottom:6px;">角色绑定</div>
      <div style="font-size:11px;margin-bottom:6px;opacity:0.8;" :style="{ color: currentRoleContext ? '#60a5fa' : '#94a3b8' }">
        {{ currentRoleContext ? `当前角色: ${currentRoleContext.name}` : '当前未进入角色聊天' }}
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
        <button class="btn mini" type="button" :disabled="!selectedGlobalPreset || !currentRoleContext" @click="emit('bindCurrentRoleToSelectedPreset')" style="font-size:11px;">绑定当前角色</button>
        <button class="btn mini" type="button" :disabled="!selectedGlobalPreset || !isCurrentRoleBoundToSelectedPreset" @click="emit('unbindCurrentRoleFromSelectedPreset')" style="font-size:11px;">解绑当前角色</button>
      </div>
      <div style="margin-bottom:6px;">
        <button
          type="button"
          :disabled="!selectedGlobalPreset"
          @click="emit('toggleRolePicker')"
          style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:1px solid var(--wb-border-subtle);border-radius:4px;background:var(--wb-input-bg);color:var(--wb-text-main);font-size:12px;cursor:pointer;"
        >
          <span>{{ selectedGlobalPreset ? '从角色卡列表选择绑定' : '请先选择预设' }}</span>
          <span>{{ rolePickerOpen ? '▴' : '▾' }}</span>
        </button>
        <div v-if="rolePickerOpen" style="margin-top:4px;">
          <input v-model="roleBindSearchTextModel" type="text" class="text-input" placeholder="搜索角色名..." style="font-size:12px;margin-bottom:4px;" @keydown.enter.prevent="emit('bindFirstRoleCandidate')" />
          <div style="max-height:120px;overflow-y:auto;">
            <button
              v-for="candidate in roleBindingCandidates"
              :key="`m-role-${candidate.key}`"
              type="button"
              :disabled="candidate.bound"
              style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:none;background:var(--wb-input-bg);border-radius:4px;color:var(--wb-text-main);font-size:12px;margin-bottom:2px;cursor:pointer;opacity: 1;"
              :style="{ opacity: candidate.bound ? '0.5' : '1' }"
              @click="emit('bindRoleCandidateToSelectedPreset', candidate)"
            >
              <span>{{ candidate.name }}</span><span :style="{ color: candidate.bound ? '#94a3b8' : '#22c55e' }">{{ candidate.bound ? '已绑定' : '绑定' }}</span>
            </button>
            <div v-if="!roleBindingCandidates.length" style="font-size:11px;opacity:0.5;padding:4px;">没有匹配角色</div>
          </div>
        </div>
      </div>
      <div v-if="selectedGlobalPreset" style="display:flex;flex-wrap:wrap;gap:4px;">
        <button
          v-for="binding in selectedGlobalPresetRoleBindings"
          :key="`m-rb-${selectedGlobalPreset?.id}-${binding.key}`"
          type="button"
          style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid var(--wb-border-subtle);border-radius:4px;background:var(--wb-input-bg);color:var(--wb-text-main);font-size:11px;cursor:pointer;"
          @click="emit('removeRoleBindingFromSelectedPreset', binding.key)"
        >
          {{ binding.name }} <span style="color:#ef4444;">×</span>
        </button>
        <div v-if="!selectedGlobalPresetRoleBindings.length" style="font-size:11px;opacity:0.5;">当前预设尚未绑定角色</div>
      </div>
      <div v-else style="font-size:11px;opacity:0.5;">选择预设后可配置角色绑定</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { GlobalWorldbookPreset, PresetRoleBinding, RoleBindingCandidate } from '../types';

interface GlobalModeMobilePanelProps {
  bindingsGlobal: string[];
  selectedGlobalPresetId: string;
  globalWorldbookPresets: GlobalWorldbookPreset[];
  selectedGlobalPreset: GlobalWorldbookPreset | null;
  globalAddSearchText: string;
  globalAddCandidates: string[];
  filteredGlobalWorldbooks: string[];
  currentRoleContext: PresetRoleBinding | null;
  isCurrentRoleBoundToSelectedPreset: boolean;
  rolePickerOpen: boolean;
  roleBindSearchText: string;
  roleBindingCandidates: RoleBindingCandidate[];
  selectedGlobalPresetRoleBindings: PresetRoleBinding[];
}

const props = defineProps<GlobalModeMobilePanelProps>();

const emit = defineEmits<{
  (event: 'update:selectedGlobalPresetId', value: string): void;
  (event: 'update:globalAddSearchText', value: string): void;
  (event: 'update:roleBindSearchText', value: string): void;
  (event: 'clearGlobalWorldbooks'): void;
  (event: 'globalPresetSelectionChanged'): void;
  (event: 'saveCurrentAsGlobalPreset'): void;
  (event: 'overwriteSelectedGlobalPreset'): void;
  (event: 'deleteSelectedGlobalPreset'): void;
  (event: 'addFirstGlobalCandidate'): void;
  (event: 'addGlobalWorldbook', name: string): void;
  (event: 'removeGlobalWorldbook', name: string): void;
  (event: 'bindCurrentRoleToSelectedPreset'): void;
  (event: 'unbindCurrentRoleFromSelectedPreset'): void;
  (event: 'toggleRolePicker'): void;
  (event: 'bindFirstRoleCandidate'): void;
  (event: 'bindRoleCandidateToSelectedPreset', candidate: RoleBindingCandidate): void;
  (event: 'removeRoleBindingFromSelectedPreset', roleKey: string): void;
}>();

const selectedGlobalPresetIdModel = computed({
  get: () => props.selectedGlobalPresetId,
  set: (value: string) => emit('update:selectedGlobalPresetId', value),
});

const globalAddSearchTextModel = computed({
  get: () => props.globalAddSearchText,
  set: (value: string) => emit('update:globalAddSearchText', value),
});

const roleBindSearchTextModel = computed({
  get: () => props.roleBindSearchText,
  set: (value: string) => emit('update:roleBindSearchText', value),
});
</script>
