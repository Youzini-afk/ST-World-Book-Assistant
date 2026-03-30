<template>
  <div class="wb-floating-window find-window" :style="panelStyle" @pointerdown="emit('bringToFront')">
    <div class="wb-floating-header" @pointerdown="onStartDrag">
      <strong>🔎 查找与替换</strong>
      <div class="wb-floating-header-actions">
        <button class="btn mini" type="button" :disabled="!hasEntries" @pointerdown.stop @click="emit('findFirst')">
          查找
        </button>
        <button class="btn mini" type="button" :disabled="!hasEntries" @pointerdown.stop @click="emit('findPrevious')">
          上一个
        </button>
        <button class="btn mini" type="button" :disabled="!hasEntries" @pointerdown.stop @click="emit('findNext')">
          下一个
        </button>
        <button class="btn mini" type="button" :disabled="!hasEntries" @pointerdown.stop @click="emit('replaceAll')">
          替换全部
        </button>
        <button class="btn mini danger" type="button" @pointerdown.stop @click="emit('close')">
          关闭
        </button>
      </div>
    </div>

    <div class="wb-floating-body">
      <div class="tool-line stacked">
        <input v-model="batchFindTextModel" type="text" class="text-input" placeholder="查找文本 / 正则" />
        <input v-model="batchReplaceTextModel" type="text" class="text-input" placeholder="替换为" />

        <div class="find-scope-line">
          <label class="checkbox-inline">
            <input v-model="batchSearchScopeModel" type="radio" value="all" />
            <span>全部条目</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="batchSearchScopeModel" type="radio" value="current" :disabled="!hasSelectedEntry" />
            <span>当前条目</span>
          </label>
          <span class="find-summary-text">{{ findHitSummaryText }}</span>
        </div>

        <input
          v-model="batchExcludeTextModel"
          type="text"
          class="text-input"
          placeholder="排除项：#UID / 名称 / 内容 / 关键词（逗号或换行）"
        />

        <div v-if="activeFindHit" class="find-active-hit">
          <strong>#{{ activeFindHit.entryUid }} {{ activeFindHit.entryName || `条目 ${activeFindHit.entryUid}` }}</strong>
          <span>{{ getFindFieldLabel(activeFindHit.field) }} · {{ activeFindHit.preview }}</span>
        </div>

        <div class="batch-exclude-note">
          示例: `#12, name:世界观, content:&#123;&#123;user&#125;&#125;, keys:吸血鬼`（默认命中名称/内容/关键词即排除）
        </div>

        <div v-if="batchExcludeTokensPreview.length" class="batch-exclude-chips">
          <span v-for="token in batchExcludeTokensPreview" :key="token" class="exclude-chip">{{ token }}</span>
        </div>

        <div class="find-flags">
          <label class="checkbox-inline">
            <input v-model="batchUseRegexModel" type="checkbox" />
            <span>正则模式</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="batchInNameModel" type="checkbox" />
            <span>名称</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="batchInContentModel" type="checkbox" />
            <span>内容</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="batchInKeysModel" type="checkbox" />
            <span>关键词</span>
          </label>
        </div>
      </div>

      <details class="tool-details">
        <summary>附加批处理工具</summary>
        <div class="tool-line">
          <button class="btn" type="button" :disabled="!hasEntries" @click="emit('normalizeAllEntries')">
            标准化全部
          </button>
          <button class="btn" type="button" :disabled="!hasEntries" @click="emit('sortEntriesByOrderDesc')">
            按 order 排序
          </button>
        </div>
        <div class="tool-line">
          <button class="btn" type="button" :disabled="!hasEntries" @click="emit('setEnabledForAll', true)">
            全部启用
          </button>
          <button class="btn" type="button" :disabled="!hasEntries" @click="emit('setEnabledForAll', false)">
            全部禁用
          </button>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BatchSearchScope, FindFieldKey, FindHit } from '../types';

interface FloatingFindWindowProps {
  panelStyle?: Record<string, string>;
  hasEntries: boolean;
  hasSelectedEntry: boolean;
  batchFindText: string;
  batchReplaceText: string;
  batchExcludeText: string;
  batchUseRegex: boolean;
  batchInName: boolean;
  batchInContent: boolean;
  batchInKeys: boolean;
  batchSearchScope: BatchSearchScope;
  findHitSummaryText: string;
  activeFindHit: FindHit | null;
  batchExcludeTokensPreview: string[];
  getFindFieldLabel: (field: FindFieldKey) => string;
}

const props = defineProps<FloatingFindWindowProps>();

const emit = defineEmits<{
  (event: 'update:batchFindText', value: string): void;
  (event: 'update:batchReplaceText', value: string): void;
  (event: 'update:batchExcludeText', value: string): void;
  (event: 'update:batchUseRegex', value: boolean): void;
  (event: 'update:batchInName', value: boolean): void;
  (event: 'update:batchInContent', value: boolean): void;
  (event: 'update:batchInKeys', value: boolean): void;
  (event: 'update:batchSearchScope', value: BatchSearchScope): void;
  (event: 'bringToFront'): void;
  (event: 'startDrag', payload: PointerEvent): void;
  (event: 'findFirst'): void;
  (event: 'findPrevious'): void;
  (event: 'findNext'): void;
  (event: 'replaceAll'): void;
  (event: 'close'): void;
  (event: 'normalizeAllEntries'): void;
  (event: 'sortEntriesByOrderDesc'): void;
  (event: 'setEnabledForAll', value: boolean): void;
}>();

const batchFindTextModel = computed({
  get: () => props.batchFindText,
  set: value => emit('update:batchFindText', value),
});

const batchReplaceTextModel = computed({
  get: () => props.batchReplaceText,
  set: value => emit('update:batchReplaceText', value),
});

const batchExcludeTextModel = computed({
  get: () => props.batchExcludeText,
  set: value => emit('update:batchExcludeText', value),
});

const batchUseRegexModel = computed({
  get: () => props.batchUseRegex,
  set: value => emit('update:batchUseRegex', value),
});

const batchInNameModel = computed({
  get: () => props.batchInName,
  set: value => emit('update:batchInName', value),
});

const batchInContentModel = computed({
  get: () => props.batchInContent,
  set: value => emit('update:batchInContent', value),
});

const batchInKeysModel = computed({
  get: () => props.batchInKeys,
  set: value => emit('update:batchInKeys', value),
});

const batchSearchScopeModel = computed({
  get: () => props.batchSearchScope,
  set: value => emit('update:batchSearchScope', value),
});

function onStartDrag(event: PointerEvent): void {
  emit('startDrag', event);
}
</script>

<style scoped>
.wb-floating-window {
  position: fixed;
  max-width: calc(100vw - 16px);
  max-height: min(74vh, 760px);
  border: 1px solid var(--wb-border-subtle);
  border-radius: 12px;
  background: var(--wb-glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-floating-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--wb-border-subtle);
  background: var(--wb-glass-header);
  cursor: move;
  user-select: none;
  touch-action: none;
}

.wb-floating-header strong {
  font-size: 12px;
  color: var(--wb-text-main);
}

.wb-floating-header-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-floating-body {
  min-height: 0;
  padding: 12px;
  display: grid;
  gap: 10px;
  overflow: auto;
}

.find-window .wb-floating-body {
  gap: 10px;
}

.text-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--wb-text-main);
  background: var(--wb-input-bg);
  transition: background 0.25s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.25s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.text-input:hover {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
}

.text-input:focus {
  background: var(--wb-input-bg-focus);
  border-color: var(--wb-primary-light);
  outline: none;
  box-shadow: 0 0 0 3px var(--wb-primary-soft), inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.tool-line {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tool-line.stacked {
  display: grid;
  gap: 6px;
}

.find-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.find-scope-line {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.find-summary-text {
  margin-left: auto;
  color: var(--wb-primary-light);
  font-size: 12px;
}

.find-active-hit {
  border: 1px solid var(--wb-primary-light);
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 4px;
  background: var(--wb-primary-soft);
  box-shadow: 0 0 0 2px var(--wb-primary-soft);
}

.find-active-hit strong {
  color: var(--wb-text-main);
  font-size: 12px;
}

.find-active-hit span {
  color: var(--wb-text-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.batch-exclude-note {
  color: var(--wb-text-muted);
  font-size: 11px;
}

.batch-exclude-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.exclude-chip {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 999px;
  padding: 1px 8px;
  font-size: 11px;
  color: var(--wb-text-main);
  background: var(--wb-bg-panel);
}

.tool-details {
  border: 1px solid var(--wb-border-main);
  border-radius: 8px;
  padding: 6px;
  background: var(--wb-bg-panel);
}

.tool-details > summary {
  cursor: pointer;
  color: var(--wb-text-main);
  font-size: 12px;
}

.tool-details[open] > summary {
  margin-bottom: 6px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--wb-input-bg);
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  color: var(--wb-text-main);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: background 0.25s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.25s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s cubic-bezier(0.25, 1, 0.5, 1), transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transform: translateZ(0);
}

.btn:hover:not(:disabled) {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.97);
  box-shadow: 0 0 0 0 transparent;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn.primary {
  background: var(--wb-primary-soft);
  border-color: var(--wb-primary);
  color: var(--wb-primary-light);
}

.btn.primary:hover:not(:disabled) {
  background: var(--wb-primary);
  color: #fff;
  box-shadow: 0 4px 12px var(--wb-primary-soft);
}

.btn.danger {
  background: rgba(225, 29, 72, 0.1);
  border-color: rgba(225, 29, 72, 0.4);
  color: #f43f5e;
}

.btn.danger:hover:not(:disabled) {
  background: #e11d48;
  color: #fff;
  border-color: #be123c;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
}

.btn.mini {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
}

@media (max-width: 1100px) {
  .wb-floating-window {
    width: calc(100vw - 16px) !important;
    left: 8px !important;
    right: 8px;
  }
}

@media (max-width: 760px) {
  .wb-floating-window {
    position: absolute;
    left: 8px !important;
    right: 8px !important;
    width: auto !important;
    max-width: none !important;
  }
}
</style>
