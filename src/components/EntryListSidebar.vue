<template>
  <aside v-show="!showMobileEditor" class="wb-entry-list" :class="{ focus: isDesktopFocusMode }">
    <div v-if="!isDesktopFocusMode" class="list-search">
      <input v-model="searchTextModel" type="text" class="text-input" placeholder="搜索名称 / 内容 / 关键词" />
      <label class="checkbox-inline">
        <input v-model="onlyEnabledModel" type="checkbox" />
        <span>仅启用</span>
      </label>
    </div>

    <div v-if="!isDesktopFocusMode" class="list-summary">
      <span>条目 {{ filteredEntries.length }} / {{ draftEntriesCount }} | 启用 {{ enabledEntryCount }} | 选中 {{ selectedEntryCount }}</span>
      <button
        class="btn mini"
        type="button"
        :disabled="!draftEntriesCount"
        :class="{ active: viewSortActive }"
        style="margin-left:auto;font-size:11px;"
        @click="emit('sort-entries')"
      >
        🔢 排序
      </button>
    </div>

    <div v-if="selectedEntryCount > 1 && !isMobile" class="list-multi-edit-hint" :class="{ off: !multiEditEnabled }">
      {{ multiEditHintText }}
    </div>

    <TransitionGroup name="list" tag="div" class="list-scroll">
      <button
        v-for="entry in filteredEntries"
        :key="entry.uid"
        type="button"
        class="entry-item"
        :data-status="getEntryVisualStatus(entry)"
        :class="{
          selected: selectedEntryUidSet.has(entry.uid),
          primary: entry.uid === selectedEntryUid,
          'drag-source': draggingEntryUids.includes(entry.uid),
          'drop-before': entryDropTargetUid === entry.uid && entryDropPosition === 'before',
          'drop-after': entryDropTargetUid === entry.uid && entryDropPosition === 'after',
          disabled: !entry.enabled,
        }"
        :draggable="!isMobile"
        @click="onSelectEntry(entry.uid, $event)"
        @dragstart="onEntryDragStart(entry.uid, $event)"
        @dragover="onEntryDragOver(entry.uid, $event)"
        @drop="onEntryDrop(entry.uid, $event)"
        @dragend="emit('entry-drag-end')"
      >
        <div class="entry-item-head">
          <span class="entry-status-dot" :data-status="getEntryVisualStatus(entry)"></span>
          <div class="entry-item-title">{{ entry.name || `条目 ${entry.uid}` }}</div>
          <span v-if="!isDesktopFocusMode" class="entry-chip uid">#{{ entry.uid }}</span>
        </div>

        <div v-if="!isDesktopFocusMode" class="entry-item-tags">
          <span class="entry-chip status" :data-status="getEntryVisualStatus(entry)">
            {{ getEntryStatusLabel(entry) }}
          </span>
          <span class="entry-chip">🔑 {{ entry.strategy.keys.length }}</span>
          <span class="entry-chip">🎯 {{ entry.probability }}</span>
          <span class="entry-chip mono">#{{ entry.position.order }}</span>
        </div>

        <div v-if="!isDesktopFocusMode" class="entry-item-preview">{{ getEntryKeyPreview(entry) }}</div>
      </button>
    </TransitionGroup>

    <div v-if="!isDesktopFocusMode" class="list-actions">
      <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="emit('add-entry')">新增</button>
      <button class="btn" type="button" :disabled="!hasSelectedEntry" @click="emit('duplicate-selected-entry')">复制</button>
      <button class="btn danger" type="button" :disabled="!hasSelectedEntry" @click="emit('remove-selected-entry')">删除</button>
      <button class="btn" type="button" :disabled="!hasSelectedEntry" @click="emit('move-selected-entry', -1)">上移</button>
      <button class="btn" type="button" :disabled="!hasSelectedEntry" @click="emit('move-selected-entry', 1)">下移</button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type EntryDropPosition = 'before' | 'after' | null;


interface EntryListSidebarProps {
  showMobileEditor: boolean;
  isDesktopFocusMode: boolean;
  searchText: string;
  onlyEnabled: boolean;
  filteredEntries: any[];
  draftEntriesCount: number;
  enabledEntryCount: number;
  selectedEntryCount: number;
  viewSortActive: boolean;
  multiEditEnabled: boolean;
  multiEditHintText: string;
  isMobile: boolean;
  selectedEntryUidSet: Set<number>;
  selectedEntryUid: number | null;
  draggingEntryUids: number[];
  entryDropTargetUid: number | null;
  entryDropPosition: EntryDropPosition;
  selectedWorldbookName: string;
  hasSelectedEntry: boolean;
  getEntryVisualStatus: (entry: any) => string;
  getEntryStatusLabel: (entry: any) => string;
  getEntryKeyPreview: (entry: any) => string;
}

const props = defineProps<EntryListSidebarProps>();

const emit = defineEmits<{
  (event: 'update:search-text', value: string): void;
  (event: 'update:only-enabled', value: boolean): void;
  (event: 'sort-entries'): void;
  (event: 'select-entry', uid: number, mouseEvent: MouseEvent): void;
  (event: 'entry-drag-start', uid: number, dragEvent: DragEvent): void;
  (event: 'entry-drag-over', uid: number, dragEvent: DragEvent): void;
  (event: 'entry-drop', uid: number, dragEvent: DragEvent): void;
  (event: 'entry-drag-end'): void;
  (event: 'add-entry'): void;
  (event: 'duplicate-selected-entry'): void;
  (event: 'remove-selected-entry'): void;
  (event: 'move-selected-entry', direction: -1 | 1): void;
}>();

const searchTextModel = computed({
  get: () => props.searchText,
  set: (value: string) => emit('update:search-text', value),
});

const onlyEnabledModel = computed({
  get: () => props.onlyEnabled,
  set: (value: boolean) => emit('update:only-enabled', value),
});

function onSelectEntry(uid: number, event: Event): void {
  emit('select-entry', uid, event as MouseEvent);
}

function onEntryDragStart(uid: number, event: DragEvent): void {
  emit('entry-drag-start', uid, event);
}

function onEntryDragOver(uid: number, event: DragEvent): void {
  emit('entry-drag-over', uid, event);
}

function onEntryDrop(uid: number, event: DragEvent): void {
  emit('entry-drop', uid, event);
}
</script>
