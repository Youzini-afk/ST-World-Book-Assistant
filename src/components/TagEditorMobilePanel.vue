<template>
  <section class="tag-editor-panel mobile-tag-editor">
    <div class="tag-editor-title">🏷️ 标签管理</div>
    <div class="tag-create-panel">
      <div class="tag-create-row">
        <input
          v-model="tagNewNameModel"
          type="text"
          class="text-input"
          placeholder="新标签名称"
          @keydown.enter.prevent="emit('tagCreate')"
        />
        <button class="btn" type="button" @click="emit('tagCreate')">创建</button>
        <button class="btn danger" type="button" @click="emit('tagResetAll')" :disabled="!tagDefinitions.length">清除全部</button>
      </div>
      <label class="field tag-parent-field">
        <span>父标签（可选）</span>
        <select v-model="tagNewParentIdModel" class="text-input">
          <option value="">根级</option>
          <option v-for="option in tagAssignOptions" :key="`new-parent-mobile-${option.id}`" :value="option.id">
            {{ option.path }}
          </option>
        </select>
      </label>
    </div>

    <div v-if="tagDefinitions.length" class="tag-editor-tree-wrap">
      <div class="tag-editor-subtitle">标签树</div>
      <div class="tag-editor-tree-list">
        <div
          v-for="row in tagManagementRows"
          :key="`tag-mobile-row-${row.id}`"
          class="tag-editor-tree-item"
          :style="{ '--tag-color': row.color, '--depth': row.depth }"
        >
          <span class="tag-editor-indent"></span>
          <span class="tag-editor-dot" :style="{ background: row.color }"></span>
          <input
            :value="tagDefinitionMap.get(row.id)?.name ?? ''"
            class="tag-editor-name-input"
            @blur="emit('tagRename', row.id, ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          />
          <select
            class="text-input tag-parent-select"
            :value="tagDefinitionMap.get(row.id)?.parent_id ?? ''"
            @change="emit('tagSetParent', row.id, ($event.target as HTMLSelectElement).value || null)"
          >
            <option value="">根级</option>
            <option
              v-for="option in tagAssignOptions"
              :key="`tag-parent-mobile-${row.id}-${option.id}`"
              :value="option.id"
              :disabled="isTagParentOptionDisabled(row.id, option.id)"
            >
              {{ option.path }}
            </option>
          </select>
          <div class="tag-color-picker">
            <button
              v-for="c in tagColors"
              :key="`mobile-color-${row.id}-${c}`"
              class="tag-color-dot"
              :class="{ active: row.color === c }"
              :style="{ background: c }"
              type="button"
              @click="emit('tagSetColor', row.id, c)"
            ></button>
          </div>
          <button class="tag-delete-btn" type="button" @click="emit('tagDelete', row.id)">×</button>
        </div>
      </div>
    </div>

    <div v-if="tagDefinitions.length" class="tag-assign-panel">
      <div class="tag-editor-subtitle">世界书分配</div>
      <div class="tag-assign-controls">
        <label class="field">
          <span>当前分配标签</span>
          <select v-model="tagAssignTargetIdModel" class="text-input">
            <option value="">请选择标签</option>
            <option v-for="option in tagAssignOptions" :key="`assign-mobile-${option.id}`" :value="option.id">
              {{ option.path }}
            </option>
          </select>
        </label>
        <input v-model="tagAssignSearchModel" type="text" class="text-input" placeholder="搜索世界书..." />
      </div>
      <div class="tag-assign-list compact">
        <button
          v-for="name in tagAssignWorldbooks"
          :key="`assign-mobile-wb-${name}`"
          class="tag-assign-row toggle"
          :class="{ active: tagAssignTargetId ? (tagAssignments[name] ?? []).includes(tagAssignTargetId) : false }"
          type="button"
          :disabled="!tagAssignTargetId"
          @click="emit('tagToggleAssignmentForSelectedTag', name)"
        >
          <span class="tag-assign-name" :title="name">{{ name }}</span>
          <span class="tag-assign-state">{{ tagAssignTargetId && (tagAssignments[name] ?? []).includes(tagAssignTargetId) ? '已分配' : '未分配' }}</span>
          <span class="tag-assign-paths">{{ getWorldbookTagPathSummary(name) }}</span>
        </button>
        <div v-if="!tagAssignWorldbooks.length" class="empty-note">没有匹配的世界书</div>
      </div>
    </div>

    <div v-else class="empty-note" style="margin-top:16px;">暂无标签，请先创建</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { WorldbookTagDefinition } from '../types';

interface TagAssignOption {
  id: string;
  path: string;
  color: string;
}

interface TagManagementRowView {
  id: string;
  depth: number;
  color: string;
}

interface TagEditorMobilePanelProps {
  tagDefinitions: WorldbookTagDefinition[];
  tagNewName: string;
  tagNewParentId: string;
  tagAssignOptions: TagAssignOption[];
  tagManagementRows: TagManagementRowView[];
  tagDefinitionMap: Map<string, WorldbookTagDefinition>;
  tagColors: string[];
  isTagParentOptionDisabled: (tagId: string, parentId: string) => boolean;
  tagAssignTargetId: string;
  tagAssignSearch: string;
  tagAssignWorldbooks: string[];
  tagAssignments: Record<string, string[]>;
  getWorldbookTagPathSummary: (worldbookName: string) => string;
}

const props = defineProps<TagEditorMobilePanelProps>();

const emit = defineEmits<{
  (event: 'update:tagNewName', value: string): void;
  (event: 'update:tagNewParentId', value: string): void;
  (event: 'update:tagAssignTargetId', value: string): void;
  (event: 'update:tagAssignSearch', value: string): void;
  (event: 'tagCreate'): void;
  (event: 'tagResetAll'): void;
  (event: 'tagRename', tagId: string, newName: string): void;
  (event: 'tagSetParent', tagId: string, parentId: string | null): void;
  (event: 'tagSetColor', tagId: string, color: string): void;
  (event: 'tagDelete', tagId: string): void;
  (event: 'tagToggleAssignmentForSelectedTag', worldbookName: string): void;
}>();

const tagNewNameModel = computed({
  get: () => props.tagNewName,
  set: (value: string) => emit('update:tagNewName', value),
});

const tagNewParentIdModel = computed({
  get: () => props.tagNewParentId,
  set: (value: string) => emit('update:tagNewParentId', value),
});

const tagAssignTargetIdModel = computed({
  get: () => props.tagAssignTargetId,
  set: (value: string) => emit('update:tagAssignTargetId', value),
});

const tagAssignSearchModel = computed({
  get: () => props.tagAssignSearch,
  set: (value: string) => emit('update:tagAssignSearch', value),
});
</script>
