<template>
  <div v-if="visibleModel" class="ai-tag-review-overlay" @click.self="visibleModel = false">
    <div class="ai-tag-review-modal">
      <div class="ai-tag-review-head">
        <span class="ai-tag-review-title">📋 提取到的条目（{{ extractedTags.length }}）</span>
        <button class="ai-tag-review-close" type="button" @click="visibleModel = false">×</button>
      </div>
      <div class="ai-tag-review-target">
        <label class="field">
          <span>目标世界书</span>
          <select v-model="targetWorldbookModel" class="text-input" @change="emit('markDuplicates')">
            <option value="">请选择目标世界书</option>
            <option v-for="name in worldbookNames" :key="`ai-wb-${name}`" :value="name">{{ name }}</option>
          </select>
        </label>
      </div>
      <details class="ai-tag-ignore-config">
        <summary>🚫 忽略标签配置</summary>
        <div style="padding:8px 0 0;font-size:12px;color:var(--wb-text-muted);margin-bottom:4px;">
          匹配到这些标签时跳过导入，但继续扫描其内部可用标签（逗号或换行分隔）
        </div>
        <textarea
          class="text-input"
          rows="2"
          :value="ignoreTags.join(', ')"
          @change="onIgnoreTagsChange"
          style="width:100%;font-size:12px;"
        ></textarea>
        <button class="btn" type="button" style="margin-top:4px;font-size:11px;" @click="emit('resetIgnoreTags')">🔄 恢复默认</button>
      </details>
      <div class="ai-tag-list">
        <label
          v-for="(tag, idx) in extractedTags"
          :key="`tag-${idx}`"
          class="ai-tag-item"
          :class="{ 'ai-tag-duplicate': tag.duplicate }"
        >
          <input v-model="tag.selected" type="checkbox" />
          <div class="ai-tag-info">
            <span class="ai-tag-name">
              {{ tag.tag }}
              <span v-if="tag.duplicate" style="color:#f59e0b;font-size:0.85em;margin-left:6px;">⚠️ 已存在</span>
              <span v-else-if="tag.updated" style="color:#3b82f6;font-size:0.85em;margin-left:6px;">🔄 内容已更新</span>
            </span>
            <span class="ai-tag-preview">{{ tag.content.slice(0, 120) }}{{ tag.content.length > 120 ? '...' : '' }}</span>
          </div>
        </label>
      </div>
      <div class="ai-tag-review-actions">
        <button class="btn" type="button" @click="setAllSelected(true)">全选</button>
        <button class="btn" type="button" @click="setAllSelected(false)">全不选</button>
        <button
          class="btn primary"
          type="button"
          :disabled="!targetWorldbookModel || !hasSelectedTags"
          @click="emit('createSelectedEntries')"
        >创建选中条目（{{ selectedTagCount }}）</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ExtractedTag } from '../types';

interface AITagReviewModalProps {
  visible: boolean;
  targetWorldbook: string;
  worldbookNames: string[];
  extractedTags: ExtractedTag[];
  ignoreTags: string[];
}

const props = defineProps<AITagReviewModalProps>();

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
  (event: 'update:targetWorldbook', value: string): void;
  (event: 'markDuplicates'): void;
  (event: 'updateIgnoreTags', raw: string): void;
  (event: 'resetIgnoreTags'): void;
  (event: 'createSelectedEntries'): void;
}>();

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const targetWorldbookModel = computed({
  get: () => props.targetWorldbook,
  set: value => emit('update:targetWorldbook', value),
});

const hasSelectedTags = computed(() => props.extractedTags.some(tag => tag.selected));
const selectedTagCount = computed(() => props.extractedTags.filter(tag => tag.selected).length);

function setAllSelected(selected: boolean): void {
  for (const tag of props.extractedTags) {
    tag.selected = selected;
  }
}

function onIgnoreTagsChange(event: Event): void {
  const target = event.target as HTMLTextAreaElement | null;
  emit('updateIgnoreTags', target?.value ?? '');
}
</script>
