<template>
  <section class="cross-copy-panel desktop">
    <div class="cross-copy-head">
      <div class="cross-copy-head-main">
        <strong>📚 跨世界书复制条目</strong>
        <span>{{ workspaceSummary }}</span>
      </div>
      <div class="cross-copy-head-actions">
        <span>{{ workspaceComparedText }}</span>
        <button class="btn mini utility-btn" type="button" @click="emit('toggleControlsCollapsed')">
          {{ controlsCollapsed ? '展开高级项' : '收起高级项' }}
        </button>
        <button class="btn mini utility-btn" type="button" :disabled="isAnyCineLocked" @click="emit('toggleMode')">退出模式</button>
        <div class="copy-cine-sink-cluster" aria-hidden="true">
          <span class="copy-cine-sink" data-copy-sink="focus_toggle"></span>
          <span class="copy-cine-sink" data-copy-sink="save_btn"></span>
          <span class="copy-cine-sink" data-copy-sink="more_btn"></span>
          <span class="copy-cine-sink" data-copy-sink="tools_btn"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_global"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_entry_history"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_worldbook_history"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_activation"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_ai_generate"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_extract"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_tag"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_copy"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_settings"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_ai_config"></span>
        </div>
      </div>
    </div>

    <div class="cross-copy-controls-wrap">
      <div class="cross-copy-controls cross-copy-controls-primary">
        <label class="field">
          <span>来源世界书</span>
          <select v-model="sourceWorldbookModel" class="text-input">
            <option value="">请选择来源世界书</option>
            <option v-for="name in worldbookNames" :key="`d-copy-source-${name}`" :value="name">{{ name }}</option>
          </select>
        </label>
        <label class="field">
          <span>目标世界书</span>
          <select v-model="targetWorldbookModel" class="text-input">
            <option value="">请选择目标世界书</option>
            <option v-for="name in worldbookNames" :key="`d-copy-target-${name}`" :value="name">{{ name }}</option>
          </select>
        </label>
        <div class="cross-copy-control-actions">
          <button class="btn" type="button" :disabled="!canCompare || compareLoading || applyLoading" @click="emit('refreshComparison')">
            {{ compareLoading ? '比较中...' : '刷新比较' }}
          </button>
        </div>
      </div>

      <Transition name="copy-controls-advanced">
        <div v-if="!controlsCollapsed" class="cross-copy-controls cross-copy-controls-advanced">
          <label class="checkbox-inline">
            <input
              v-model="useDraftSourceWhenCurrentModel"
              type="checkbox"
              :disabled="!sourceIsCurrentWorldbook"
            />
            <span>{{ sourceVersionLabel }}</span>
          </label>
          <label class="checkbox-inline">
            <input v-model="snapshotBeforeApplyModel" type="checkbox" />
            <span>执行前写入目标快照</span>
          </label>
        </div>
      </Transition>

      <div v-if="controlsCollapsed" class="cross-copy-inline-tip">
        {{ sourceVersionLabel }} | {{ snapshotBeforeApply ? '执行前写入快照' : '不写入快照' }}
      </div>
      <div class="cross-copy-inline-tips">
        <div v-if="sourceTargetInvalid" class="cross-copy-inline-tip warning">来源和目标不能相同。</div>
        <div v-if="compareSummary" class="cross-copy-inline-tip">{{ compareSummary }}</div>
        <div v-if="lastResultSummary" class="cross-copy-inline-tip success">{{ lastResultSummary }}</div>
      </div>
    </div>

    <div
      :ref="setGridRef"
      class="cross-copy-grid"
      :class="{ 'single-column': desktopSingleColumn }"
      :style="crossCopyGridStyle"
    >
      <aside class="cross-copy-left">
        <div class="cross-copy-list-head">
          <strong>来源条目</strong>
          <span>{{ rows.length }} 条</span>
        </div>
        <div class="cross-copy-list-tools">
          <input v-model="searchTextModel" type="text" class="text-input" placeholder="搜索来源名称 / 内容" />
          <div class="cross-copy-mini-actions">
            <button class="btn mini" type="button" :disabled="!sourceRowsFiltered.length" @click="emit('setSelectionForFiltered', true)">全选显示</button>
            <button class="btn mini" type="button" :disabled="!rows.length" @click="emit('setSelectionForAll', false)">全不选</button>
          </div>
        </div>
        <div class="cross-copy-source-list">
          <label v-for="row in sourceRowsFiltered" :key="`d-copy-pick-${row.id}`" class="cross-copy-source-item" :class="{ checked: row.selected }">
            <input v-model="row.selected" type="checkbox" :disabled="row.status === 'invalid_same_source_target' || applyLoading" />
            <span class="cross-copy-status-dot" :class="getStatusBadgeClass(row.status)"></span>
            <span class="cross-copy-source-name" :title="row.source_entry.name || `条目 ${row.source_entry.uid}`">
              {{ row.source_entry.name || `条目 ${row.source_entry.uid}` }}
            </span>
          </label>
          <div v-if="!sourceRowsFiltered.length" class="empty-note">暂无可选条目，请先刷新比较</div>
        </div>
      </aside>

      <div
        v-if="!desktopSingleColumn"
        class="cross-copy-splitter"
        :class="{ dragging: Boolean(paneResizeState) }"
        @pointerdown="onStartPaneResize"
      >
        <span>⋮</span>
      </div>

      <section class="cross-copy-right">
        <div class="cross-copy-list-head">
          <strong>对比与动作</strong>
          <span>已选 {{ selectedCount }} 条</span>
        </div>
        <div class="cross-copy-list-tools">
          <select v-model="statusFilterModel" class="text-input">
            <option value="all">全部状态</option>
            <option v-for="status in statusPriority" :key="`d-copy-filter-${status}`" :value="status">
              {{ getStatusLabel(status) }} ({{ statusCounts[status] }})
            </option>
          </select>
        </div>
        <div class="cross-copy-rows">
          <article v-for="row in rowsFiltered" :key="`d-copy-row-${row.id}`" class="cross-copy-row">
            <div class="cross-copy-row-head">
              <div class="cross-copy-row-title">
                <span class="cross-copy-status-badge" :class="getStatusBadgeClass(row.status)">{{ getStatusLabel(row.status) }}</span>
                <strong :title="row.source_entry.name || `条目 ${row.source_entry.uid}`">{{ row.source_entry.name || `条目 ${row.source_entry.uid}` }}</strong>
              </div>
              <label class="checkbox-inline">
                <input v-model="row.selected" type="checkbox" :disabled="row.status === 'invalid_same_source_target' || applyLoading" />
                <span>选中</span>
              </label>
            </div>
            <div class="cross-copy-row-note">{{ row.note || getRowDiffSummary(row) }}</div>
            <div class="cross-copy-row-actions">
              <select v-model="row.action" class="text-input" :disabled="!row.selected || row.status === 'invalid_same_source_target' || applyLoading" @change="emit('rowActionChange', row)">
                <option value="skip">{{ getActionLabel('skip') }}</option>
                <option value="overwrite">{{ getActionLabel('overwrite') }}</option>
                <option value="create">{{ getActionLabel('create') }}</option>
                <option value="rename_create">{{ getActionLabel('rename_create') }}</option>
              </select>
              <input
                v-if="row.action === 'rename_create'"
                v-model="row.rename_name"
                type="text"
                class="text-input"
                placeholder="输入新名称（自动去重）"
                :disabled="!row.selected || applyLoading"
                @blur="emit('rowRenameBlur', row)"
              />
            </div>
            <button class="btn mini cross-copy-detail-trigger" type="button" @click="emit('openDiff', row)">
              ▷ 查看对比明细
            </button>
          </article>
          <div v-if="!rowsFiltered.length" class="empty-note">当前筛选下无条目</div>
        </div>
      </section>
    </div>

    <div class="cross-copy-actions">
      <button class="btn mini" type="button" :disabled="!rows.length" @click="emit('setSelectionForAll', false)">全不选</button>
      <button class="btn mini" type="button" :disabled="!selectedCount" @click="emit('applyActionByStatus', 'same_name_changed', 'overwrite')">同名更新→覆盖</button>
      <button class="btn mini" type="button" :disabled="!selectedCount" @click="emit('applyActionByStatus', 'duplicate_exact', 'skip')">同名同内容→跳过</button>
      <button class="btn mini" type="button" :disabled="!selectedCount" @click="emit('applyActionByStatus', 'content_duplicate_other_name', 'skip')">异名同内容→跳过</button>
      <div class="cross-copy-bulk-box">
        <select v-model="bulkActionModel" class="text-input">
          <option value="skip">{{ getActionLabel('skip') }}</option>
          <option value="overwrite">{{ getActionLabel('overwrite') }}</option>
          <option value="create">{{ getActionLabel('create') }}</option>
          <option value="rename_create">{{ getActionLabel('rename_create') }}</option>
        </select>
        <button class="btn mini" type="button" :disabled="!selectedCount" @click="emit('applyBulkAction')">应用到已选</button>
      </div>
      <button class="btn primary" type="button" :disabled="!canApply" @click="emit('applySelection')">
        {{ applyLoading ? '执行中...' : `执行复制（${selectedCount}）` }}
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue';
import type {
  CrossCopyAction,
  CrossCopyRow,
  CrossCopyRowStatus,
  CrossCopyStatusFilter,
} from '../types';

interface CrossCopyDesktopPanelProps {
  isAnyCineLocked: boolean;
  workspaceSummary: string;
  workspaceComparedText: string;
  controlsCollapsed: boolean;
  canCompare: boolean;
  compareLoading: boolean;
  applyLoading: boolean;
  sourceWorldbook: string;
  targetWorldbook: string;
  worldbookNames: string[];
  useDraftSourceWhenCurrent: boolean;
  sourceIsCurrentWorldbook: boolean;
  sourceVersionLabel: string;
  snapshotBeforeApply: boolean;
  sourceTargetInvalid: boolean;
  compareSummary: string;
  lastResultSummary: string;
  setGridElement: (element: HTMLElement | null) => void;
  desktopSingleColumn: boolean;
  crossCopyGridStyle?: Record<string, string>;
  rows: CrossCopyRow[];
  searchText: string;
  sourceRowsFiltered: CrossCopyRow[];
  rowsFiltered: CrossCopyRow[];
  selectedCount: number;
  statusFilter: CrossCopyStatusFilter;
  statusCounts: Record<CrossCopyRowStatus, number>;
  bulkAction: CrossCopyAction;
  canApply: boolean;
  paneResizeState: unknown;
  statusPriority: CrossCopyRowStatus[];
  getStatusLabel: (status: CrossCopyRowStatus) => string;
  getActionLabel: (action: CrossCopyAction) => string;
  getStatusBadgeClass: (status: CrossCopyRowStatus) => string;
  getRowDiffSummary: (row: CrossCopyRow) => string;
}

const props = defineProps<CrossCopyDesktopPanelProps>();

const emit = defineEmits<{
  (event: 'update:sourceWorldbook', value: string): void;
  (event: 'update:targetWorldbook', value: string): void;
  (event: 'update:useDraftSourceWhenCurrent', value: boolean): void;
  (event: 'update:snapshotBeforeApply', value: boolean): void;
  (event: 'update:searchText', value: string): void;
  (event: 'update:statusFilter', value: CrossCopyStatusFilter): void;
  (event: 'update:bulkAction', value: CrossCopyAction): void;
  (event: 'toggleControlsCollapsed'): void;
  (event: 'toggleMode'): void;
  (event: 'refreshComparison'): void;
  (event: 'startPaneResize', pointerEvent: PointerEvent): void;
  (event: 'setSelectionForFiltered', selected: boolean): void;
  (event: 'setSelectionForAll', selected: boolean): void;
  (event: 'rowActionChange', row: CrossCopyRow): void;
  (event: 'rowRenameBlur', row: CrossCopyRow): void;
  (event: 'openDiff', row: CrossCopyRow): void;
  (event: 'applyActionByStatus', status: CrossCopyRowStatus, action: CrossCopyAction): void;
  (event: 'applyBulkAction'): void;
  (event: 'applySelection'): void;
}>();

const sourceWorldbookModel = computed({
  get: () => props.sourceWorldbook,
  set: value => emit('update:sourceWorldbook', value),
});

const targetWorldbookModel = computed({
  get: () => props.targetWorldbook,
  set: value => emit('update:targetWorldbook', value),
});

const useDraftSourceWhenCurrentModel = computed({
  get: () => props.useDraftSourceWhenCurrent,
  set: value => emit('update:useDraftSourceWhenCurrent', value),
});

const snapshotBeforeApplyModel = computed({
  get: () => props.snapshotBeforeApply,
  set: value => emit('update:snapshotBeforeApply', value),
});

const searchTextModel = computed({
  get: () => props.searchText,
  set: value => emit('update:searchText', value),
});

const statusFilterModel = computed({
  get: () => props.statusFilter,
  set: value => emit('update:statusFilter', value),
});

const bulkActionModel = computed({
  get: () => props.bulkAction,
  set: value => emit('update:bulkAction', value),
});

function onStartPaneResize(event: PointerEvent): void {
  emit('startPaneResize', event);
}

function setGridRef(element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    props.setGridElement(element);
    return;
  }
  const hostElement = (element as ComponentPublicInstance | null)?.$el;
  props.setGridElement(hostElement instanceof HTMLElement ? hostElement : null);
}
</script>
