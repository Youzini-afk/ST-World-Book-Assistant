<template>
  <div class="global-mode-panel">
    <div class="global-mode-head">
      <span class="global-mode-title">全局世界书（{{ bindingsGlobal.length }}）</span>
      <button class="btn mini danger" type="button" :disabled="!bindingsGlobal.length" @click="emit('clearGlobalWorldbooks')">
        清空全局
      </button>
    </div>
    <div class="global-mode-sections">
      <details class="global-mode-section" open>
        <summary class="global-mode-section-summary">
          <span class="global-mode-section-title">世界书预设（切换即应用）</span>
          <span class="global-mode-section-meta">
            {{ selectedGlobalPreset ? selectedGlobalPreset.name : '默认预设（清空全局）' }}
          </span>
        </summary>
        <div class="global-mode-section-body global-preset-panel">
          <label class="field">
            <span>选择预设</span>
            <select v-model="selectedGlobalPresetIdModel" class="text-input" @change="emit('globalPresetSelectionChanged')">
              <option value="">默认预设（清空全局世界书）</option>
              <option v-for="preset in globalWorldbookPresets" :key="preset.id" :value="preset.id">
                {{ preset.name }}（{{ preset.worldbooks.length }}）
              </option>
            </select>
          </label>
          <div class="global-mode-actions">
            <button class="btn" type="button" :disabled="!bindingsGlobal.length" @click="emit('saveCurrentAsGlobalPreset')">
              保存当前组合
            </button>
            <button class="btn" type="button" :disabled="!selectedGlobalPreset" @click="emit('overwriteSelectedGlobalPreset')">
              覆盖当前预设
            </button>
            <button class="btn danger" type="button" :disabled="!selectedGlobalPreset" @click="emit('deleteSelectedGlobalPreset')">
              删除预设
            </button>
          </div>
        </div>
      </details>

      <details class="global-mode-section" open>
        <summary class="global-mode-section-summary">
          <span class="global-mode-section-title">角色绑定（一个预设可绑定多个角色）</span>
          <span class="preset-role-current" :class="{ empty: !currentRoleContext }">
            {{ currentRoleContext ? `当前角色: ${currentRoleContext.name}` : '当前未进入角色聊天' }}
          </span>
        </summary>
        <div class="global-mode-section-body preset-role-panel">
          <div class="preset-role-actions">
            <button
              class="btn mini"
              type="button"
              :disabled="!selectedGlobalPreset || !currentRoleContext"
              @click="emit('bindCurrentRoleToSelectedPreset')"
            >
              绑定当前角色
            </button>
            <button
              class="btn mini"
              type="button"
              :disabled="!selectedGlobalPreset || !isCurrentRoleBoundToSelectedPreset"
              @click="emit('unbindCurrentRoleFromSelectedPreset')"
            >
              解绑当前角色
            </button>
          </div>
          <div :ref="setRolePickerRef" class="role-picker">
            <button
              class="role-picker-trigger"
              type="button"
              :disabled="!selectedGlobalPreset"
              @click="emit('toggleRolePicker')"
            >
              <span class="role-picker-trigger-text">
                {{ selectedGlobalPreset ? '从角色卡列表选择绑定' : '请先选择预设' }}
              </span>
              <span class="role-picker-trigger-arrow">{{ rolePickerOpen ? '▴' : '▾' }}</span>
            </button>
            <div v-if="rolePickerOpen" class="role-picker-dropdown">
              <input
                :ref="setRolePickerSearchInputRef"
                v-model="roleBindSearchTextModel"
                type="text"
                class="text-input role-picker-search"
                placeholder="搜索角色名 / avatar..."
                @keydown.enter.prevent="emit('bindFirstRoleCandidate')"
              />
              <div class="role-picker-list">
                <button
                  v-for="candidate in roleBindingCandidates"
                  :key="`role-candidate-${candidate.key}`"
                  class="role-picker-item"
                  type="button"
                  :disabled="candidate.bound"
                  @click="emit('bindRoleCandidateToSelectedPreset', candidate)"
                >
                  <span class="name">{{ candidate.name }}</span>
                  <span class="meta">{{ candidate.bound ? '已绑定' : '绑定' }}</span>
                </button>
                <div v-if="!roleBindingCandidates.length" class="empty-note">没有匹配角色</div>
              </div>
            </div>
          </div>
          <div class="preset-role-tags">
            <button
              v-for="binding in selectedGlobalPresetRoleBindings"
              :key="`binding-${selectedGlobalPreset?.id}-${binding.key}`"
              class="preset-role-tag"
              type="button"
              :title="`点击移除绑定: ${binding.name}`"
              @click="emit('removeRoleBindingFromSelectedPreset', binding.key)"
            >
              <span>{{ binding.name }}</span>
              <span class="remove">×</span>
            </button>
            <div v-if="selectedGlobalPreset && !selectedGlobalPresetRoleBindings.length" class="empty-note">
              当前预设尚未绑定角色
            </div>
            <div v-if="!selectedGlobalPreset" class="empty-note">选择预设后可配置角色绑定</div>
          </div>
        </div>
      </details>
    </div>
    <div class="global-mode-grid">
      <div class="global-mode-column">
        <label class="field">
          <span>搜索并添加常驻世界书</span>
          <input
            v-model="globalAddSearchTextModel"
            type="text"
            class="text-input"
            placeholder="搜索并添加常驻世界书..."
            @keydown.enter.prevent="emit('addFirstGlobalCandidate')"
          />
        </label>
        <TransitionGroup name="list" tag="div" class="global-mode-list">
          <button
            v-for="name in globalAddCandidates"
            :key="`add-${name}`"
            class="global-mode-item add"
            type="button"
            @click="emit('addGlobalWorldbook', name)"
          >
            <span class="global-mode-item-name">{{ name }}</span>
            <span class="global-mode-item-action">添加</span>
          </button>
          <div v-if="!globalAddCandidates.length" key="empty" class="empty-note">没有可添加的世界书</div>
        </TransitionGroup>
      </div>
      <div class="global-mode-column">
        <label class="field">
          <span>筛选常驻世界书</span>
          <input
            v-model="globalFilterTextModel"
            type="text"
            class="text-input"
            placeholder="筛选常驻世界书..."
          />
        </label>
        <TransitionGroup name="list" tag="div" class="global-mode-list">
          <button
            v-for="name in filteredGlobalWorldbooks"
            :key="`global-${name}`"
            class="global-mode-item active"
            type="button"
            @click="emit('removeGlobalWorldbook', name)"
          >
            <span class="global-mode-item-name">{{ name }}</span>
            <span class="global-mode-item-action">移除</span>
          </button>
          <div v-if="!filteredGlobalWorldbooks.length" key="empty" class="empty-note">
            {{ bindingsGlobal.length ? '没有匹配结果' : '暂无常驻世界书' }}
          </div>
        </TransitionGroup>
      </div>
    </div>
    <div class="global-mode-actions">
      <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="emit('toggleGlobalBinding')">
        {{ isGlobalBound ? '移出全局' : '加入全局' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue';
import type { GlobalWorldbookPreset, PresetRoleBinding, RoleBindingCandidate } from '../types';

interface GlobalModeDesktopPanelProps {
  bindingsGlobal: string[];
  selectedWorldbookName: string;
  selectedGlobalPresetId: string;
  globalWorldbookPresets: GlobalWorldbookPreset[];
  selectedGlobalPreset: GlobalWorldbookPreset | null;
  currentRoleContext: PresetRoleBinding | null;
  isCurrentRoleBoundToSelectedPreset: boolean;
  rolePickerOpen: boolean;
  roleBindSearchText: string;
  roleBindingCandidates: RoleBindingCandidate[];
  selectedGlobalPresetRoleBindings: PresetRoleBinding[];
  globalAddSearchText: string;
  globalFilterText: string;
  globalAddCandidates: string[];
  filteredGlobalWorldbooks: string[];
  isGlobalBound: boolean;
  setRolePickerElement: (element: HTMLElement | null) => void;
  setRolePickerSearchInputElement: (element: HTMLInputElement | null) => void;
}

const props = defineProps<GlobalModeDesktopPanelProps>();

const emit = defineEmits<{
  (event: 'update:selectedGlobalPresetId', value: string): void;
  (event: 'update:roleBindSearchText', value: string): void;
  (event: 'update:globalAddSearchText', value: string): void;
  (event: 'update:globalFilterText', value: string): void;
  (event: 'clearGlobalWorldbooks'): void;
  (event: 'globalPresetSelectionChanged'): void;
  (event: 'saveCurrentAsGlobalPreset'): void;
  (event: 'overwriteSelectedGlobalPreset'): void;
  (event: 'deleteSelectedGlobalPreset'): void;
  (event: 'bindCurrentRoleToSelectedPreset'): void;
  (event: 'unbindCurrentRoleFromSelectedPreset'): void;
  (event: 'toggleRolePicker'): void;
  (event: 'bindFirstRoleCandidate'): void;
  (event: 'bindRoleCandidateToSelectedPreset', candidate: RoleBindingCandidate): void;
  (event: 'removeRoleBindingFromSelectedPreset', roleKey: string): void;
  (event: 'addFirstGlobalCandidate'): void;
  (event: 'addGlobalWorldbook', name: string): void;
  (event: 'removeGlobalWorldbook', name: string): void;
  (event: 'toggleGlobalBinding'): void;
}>();

const selectedGlobalPresetIdModel = computed({
  get: () => props.selectedGlobalPresetId,
  set: (value: string) => emit('update:selectedGlobalPresetId', value),
});

const roleBindSearchTextModel = computed({
  get: () => props.roleBindSearchText,
  set: (value: string) => emit('update:roleBindSearchText', value),
});

const globalAddSearchTextModel = computed({
  get: () => props.globalAddSearchText,
  set: (value: string) => emit('update:globalAddSearchText', value),
});

const globalFilterTextModel = computed({
  get: () => props.globalFilterText,
  set: (value: string) => emit('update:globalFilterText', value),
});

function setRolePickerRef(element: Element | ComponentPublicInstance | null): void {
  props.setRolePickerElement(element instanceof HTMLElement ? element : null);
}

function setRolePickerSearchInputRef(element: Element | ComponentPublicInstance | null): void {
  props.setRolePickerSearchInputElement(element instanceof HTMLInputElement ? element : null);
}
</script>
