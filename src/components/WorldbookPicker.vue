<template>
  <div class="worldbook-picker" :ref="setPickerRef">
    <button class="worldbook-picker-trigger" type="button" @click="emit('toggle')">
      <span class="worldbook-picker-trigger-text" :title="selectedWorldbookName || titlePlaceholder">
        {{ selectedWorldbookName || triggerPlaceholder }}
      </span>
      <span class="worldbook-picker-trigger-arrow">{{ triggerArrow }}</span>
    </button>
    <div v-if="open" class="worldbook-picker-dropdown">
      <div v-if="showTagFilter" class="worldbook-picker-tags tree-mode">
        <div class="tag-filter-toolbar">
          <button class="btn mini tag-filter-open" type="button" @click="emit('toggleTagFilterPanel')">🏷 标签筛选</button>
          <span class="tag-filter-summary">{{ tagFilterSummary }}</span>
          <select v-model="tagFilterLogicModel" class="text-input tag-filter-select">
            <option value="or">OR</option>
            <option value="and">AND</option>
          </select>
          <select v-model="tagFilterMatchModeModel" class="text-input tag-filter-select">
            <option value="descendants">子树</option>
            <option value="exact">精确</option>
          </select>
          <button class="btn mini" type="button" :disabled="!selectedTagFilterIds.length" @click="emit('clearTagFilterSelection')">清空</button>
        </div>
        <Transition name="tag-filter-panel">
          <div v-if="tagFilterPanelOpen" class="tag-filter-panel" :class="{ mobile: isMobile }">
            <input v-model="tagFilterSearchTextModel" type="text" class="text-input tag-filter-search" placeholder="搜索标签名称 / 路径..." />
            <div v-if="selectedTagFilterIds.length" class="tag-filter-selected-list">
              <button
                v-for="tagId in selectedTagFilterIds"
                :key="`tag-selected-${listKeyPrefix}-${tagId}`"
                class="tag-filter-selected-chip"
                type="button"
                @click="emit('toggleTagFilterSelection', tagId)"
              >
                {{ tagPathMap.get(tagId) ?? tagId }} ×
              </button>
            </div>
            <div v-if="isMobile" class="tag-flat-list">
              <label
                v-for="tag in filteredTagAssignOptions"
                :key="`tag-flat-${listKeyPrefix}-${tag.id}`"
                class="tag-flat-item"
                :style="{ '--tag-color': tag.color }"
              >
                <input type="checkbox" :checked="selectedTagFilterIdSet.has(tag.id)" @change="emit('toggleTagFilterSelection', tag.id)" />
                <span>{{ tag.path }}</span>
              </label>
              <div v-if="!tagAssignOptions.length" class="empty-note">暂无标签</div>
            </div>
            <div v-else class="tag-tree-list">
              <div
                v-for="row in tagTreeRows"
                :key="`tag-tree-${listKeyPrefix}-${row.id}`"
                class="tag-tree-row"
                :style="{ '--depth': row.depth, '--tag-color': row.color }"
              >
                <button
                  v-if="row.hasChildren"
                  class="tag-tree-toggle"
                  type="button"
                  @click.stop="emit('toggleTagTreeExpanded', row.id)"
                >{{ tagTreeExpandedIds.includes(row.id) || tagFilterSearchText.trim() ? '▾' : '▸' }}</button>
                <span v-else class="tag-tree-toggle placeholder"></span>
                <input type="checkbox" :checked="selectedTagFilterIdSet.has(row.id)" @change="emit('toggleTagFilterSelection', row.id)" />
                <span class="tag-tree-name">{{ row.name }}</span>
                <span class="tag-tree-path">{{ row.path }}</span>
              </div>
              <div v-if="!tagTreeRows.length" class="empty-note">没有匹配的标签</div>
            </div>
          </div>
        </Transition>
      </div>
      <input
        v-model="searchTextModel"
        type="text"
        class="text-input worldbook-picker-search"
        :placeholder="searchPlaceholder"
        @keydown.enter.prevent="onSearchEnter"
      />
      <div class="worldbook-picker-list">
        <button
          v-for="name in filteredNames"
          :key="`worldbook-${listKeyPrefix}-${name}`"
          class="worldbook-picker-item"
          :class="{ active: name === selectedWorldbookName }"
          type="button"
          @click="emit('select', name)"
        >
          {{ name }}
        </button>
        <div v-if="!filteredNames.length" class="empty-note">{{ emptyText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue';
import type { TagFilterLogic, TagFilterMatchMode } from '../types';

interface TagAssignOption {
  id: string;
  path: string;
  color: string;
}

interface TagTreeRow {
  id: string;
  name: string;
  color: string;
  depth: number;
  path: string;
  hasChildren: boolean;
}

interface WorldbookPickerProps {
  open: boolean;
  searchText: string;
  selectedWorldbookName: string;
  filteredNames: string[];
  triggerPlaceholder: string;
  titlePlaceholder: string;
  searchPlaceholder: string;
  emptyText: string;
  listKeyPrefix: string;
  showOpenStateArrow: boolean;
  setPickerElement: (element: HTMLElement | null) => void;

  showTagFilter: boolean;
  tagFilterPanelOpen: boolean;
  tagFilterSummary: string;
  tagFilterLogic: TagFilterLogic;
  tagFilterMatchMode: TagFilterMatchMode;
  selectedTagFilterIds: string[];
  selectedTagFilterIdSet: Set<string>;
  tagFilterSearchText: string;
  tagAssignOptions: TagAssignOption[];
  tagTreeRows: TagTreeRow[];
  tagTreeExpandedIds: string[];
  tagPathMap: Map<string, string>;
  isMobile: boolean;
}

const props = defineProps<WorldbookPickerProps>();

const emit = defineEmits<{
  (event: 'toggle'): void;
  (event: 'select', name: string): void;
  (event: 'update:searchText', value: string): void;
  (event: 'toggleTagFilterPanel'): void;
  (event: 'clearTagFilterSelection'): void;
  (event: 'toggleTagFilterSelection', tagId: string): void;
  (event: 'toggleTagTreeExpanded', tagId: string): void;
  (event: 'update:tagFilterLogic', value: TagFilterLogic): void;
  (event: 'update:tagFilterMatchMode', value: TagFilterMatchMode): void;
  (event: 'update:tagFilterSearchText', value: string): void;
}>();

const searchTextModel = computed({
  get: () => props.searchText,
  set: (value: string) => emit('update:searchText', value),
});

const tagFilterLogicModel = computed({
  get: () => props.tagFilterLogic,
  set: (value: TagFilterLogic) => emit('update:tagFilterLogic', value),
});

const tagFilterMatchModeModel = computed({
  get: () => props.tagFilterMatchMode,
  set: (value: TagFilterMatchMode) => emit('update:tagFilterMatchMode', value),
});

const tagFilterSearchTextModel = computed({
  get: () => props.tagFilterSearchText,
  set: (value: string) => emit('update:tagFilterSearchText', value),
});

const triggerArrow = computed(() => {
  return props.showOpenStateArrow
    ? (props.open ? '▴' : '▾')
    : '▾';
});

const filteredTagAssignOptions = computed(() => {
  const keyword = props.tagFilterSearchText.trim().toLowerCase();
  if (!keyword) {
    return props.tagAssignOptions;
  }
  return props.tagAssignOptions.filter(item => item.path.toLowerCase().includes(keyword));
});

function setPickerRef(element: Element | ComponentPublicInstance | null): void {
  props.setPickerElement(resolveHostElement(element));
}

function resolveHostElement(element: Element | ComponentPublicInstance | null): HTMLElement | null {
  if (!element) {
    return null;
  }

  const hostElement = ('$el' in element ? element.$el : element) as unknown;
  if (!hostElement || typeof hostElement !== 'object') {
    return null;
  }

  return 'nodeType' in hostElement && hostElement.nodeType === Node.ELEMENT_NODE
    ? hostElement as HTMLElement
    : null;
}

function onSearchEnter(): void {
  const first = props.filteredNames[0];
  if (!first) {
    return;
  }
  emit('select', first);
}
</script>
