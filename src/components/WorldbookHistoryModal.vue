<template>
  <div v-if="visibleModel" class="wb-modal-backdrop" @click.self="visibleModel = false">
    <div class="wb-history-modal">
      <div class="wb-history-modal-header">
        <div>
          <strong>⏪ 时光机（整本回滚）</strong>
          <span>{{ worldbookVersionDiffSummary }}</span>
        </div>
        <div class="wb-history-modal-actions">
          <button class="btn mini" type="button" :disabled="!hasSelectedWorldbook" @click="emit('createManualSnapshot')">
            创建整本快照
          </button>
          <button class="btn mini danger" type="button" :disabled="!hasSnapshots" @click="emit('clearCurrentSnapshots')">
            清空整本快照
          </button>
          <button class="btn mini" type="button" @click="visibleModel = false">关闭</button>
        </div>
      </div>

      <div class="wb-history-modal-main">
        <aside class="wb-history-versions">
          <div class="wb-history-versions-title">版本列表（L/R）</div>
          <div class="wb-history-versions-scroll">
            <div v-for="ver in worldbookVersionViews" :key="ver.id" class="wb-history-version-item">
              <div class="wb-history-version-line">
                <strong>{{ formatHistoryOptionLabel(ver.label, ver.ts, ver.isCurrent) }}</strong>
                <div class="wb-history-lr">
                  <button class="mini-lr" :class="{ active: worldbookHistoryLeftIdModel === ver.id }" @click="worldbookHistoryLeftIdModel = ver.id">L</button>
                  <button class="mini-lr" :class="{ active: worldbookHistoryRightIdModel === ver.id }" @click="worldbookHistoryRightIdModel = ver.id">R</button>
                </div>
              </div>
              <span>entries: {{ ver.entries.length }}</span>
            </div>
          </div>
        </aside>

        <section class="wb-history-diff-wrap">
          <div class="wb-history-diff-head">
            <div>
              Left: {{ selectedWorldbookHistoryLeft ? formatHistoryOptionLabel(selectedWorldbookHistoryLeft.label, selectedWorldbookHistoryLeft.ts, selectedWorldbookHistoryLeft.isCurrent) : '-' }}
              |
              Right: {{ selectedWorldbookHistoryRight ? formatHistoryOptionLabel(selectedWorldbookHistoryRight.label, selectedWorldbookHistoryRight.ts, selectedWorldbookHistoryRight.isCurrent) : '-' }}
            </div>
            <button class="btn mini" type="button" :disabled="!canRestoreWorldbookFromLeft" @click="emit('restoreWorldbookFromLeftHistory')">
              恢复到 Left
            </button>
          </div>

          <div class="wb-history-visual-main">
            <div class="cross-copy-preview-grid cross-copy-preview-grid-modal wb-history-version-preview">
              <div class="cross-copy-preview-card">
                <strong>Left 版本</strong>
                <span class="name">{{ selectedWorldbookHistoryLeft ? formatHistoryOptionLabel(selectedWorldbookHistoryLeft.label, selectedWorldbookHistoryLeft.ts, selectedWorldbookHistoryLeft.isCurrent) : '-' }}</span>
                <span class="meta">entries: {{ selectedWorldbookHistoryLeft ? selectedWorldbookHistoryLeft.entries.length : 0 }}</span>
                <p>{{ selectedWorldbookHistoryLeft ? getWorldbookHistoryVersionPreview(selectedWorldbookHistoryLeft) : '-' }}</p>
              </div>
              <div class="cross-copy-preview-card">
                <strong>Right 版本</strong>
                <span class="name">{{ selectedWorldbookHistoryRight ? formatHistoryOptionLabel(selectedWorldbookHistoryRight.label, selectedWorldbookHistoryRight.ts, selectedWorldbookHistoryRight.isCurrent) : '-' }}</span>
                <span class="meta">entries: {{ selectedWorldbookHistoryRight ? selectedWorldbookHistoryRight.entries.length : 0 }}</span>
                <p>{{ selectedWorldbookHistoryRight ? getWorldbookHistoryVersionPreview(selectedWorldbookHistoryRight) : '-' }}</p>
              </div>
            </div>

            <section class="cross-copy-visual-section wb-worldbook-compare-list-section">
              <div class="cross-copy-visual-head">
                <strong>条目变化列表</strong>
                <span>{{ worldbookHistoryCompareSummary }}</span>
              </div>
              <div class="wb-worldbook-compare-list">
                <button
                  v-for="row in worldbookHistoryCompareRows"
                  :key="row.key"
                  type="button"
                  class="wb-worldbook-compare-row"
                  :class="{ active: worldbookHistoryActiveRowKeyModel === row.key }"
                  @click="worldbookHistoryActiveRowKeyModel = row.key"
                >
                  <div class="wb-worldbook-compare-row-head">
                    <span class="cross-copy-status-badge" :class="getWorldbookHistoryStatusBadgeClass(row.status)">
                      {{ getWorldbookHistoryStatusLabel(row.status) }}
                    </span>
                    <strong>{{ row.title }}</strong>
                    <span v-if="row.uid !== null" class="entry-chip uid">#{{ row.uid }}</span>
                  </div>
                  <div class="wb-worldbook-compare-row-note">{{ row.note }}</div>
                </button>
                <div v-if="!worldbookHistoryCompareRows.length" class="empty-note">左右版本条目一致，无需处理。</div>
              </div>
            </section>

            <template v-if="worldbookHistoryActiveRow">
              <div :ref="setLayoutRef" class="wb-history-resizable-layout wb-history-resizable-layout-detail">
                <div class="wb-history-pane-section" :style="getHistorySectionStyle(0)">
                  <div class="cross-copy-preview-grid cross-copy-preview-grid-modal">
                    <div class="cross-copy-preview-card">
                      <strong>Left 条目</strong>
                      <template v-if="worldbookHistoryActiveRow.left_entry">
                        <span class="name">{{ worldbookHistoryActiveRow.left_entry.name || `条目 ${worldbookHistoryActiveRow.left_entry.uid}` }}</span>
                        <span class="meta">{{ getCrossCopyEntryProfile(worldbookHistoryActiveRow.left_entry) }}</span>
                        <p>{{ getCrossCopyPreviewText(worldbookHistoryActiveRow.left_entry.content, 260) }}</p>
                      </template>
                      <template v-else>
                        <span class="meta">该条目在 Left 版本不存在</span>
                      </template>
                    </div>
                    <div class="cross-copy-preview-card">
                      <strong>Right 条目</strong>
                      <template v-if="worldbookHistoryActiveRow.right_entry">
                        <span class="name">{{ worldbookHistoryActiveRow.right_entry.name || `条目 ${worldbookHistoryActiveRow.right_entry.uid}` }}</span>
                        <span class="meta">{{ getCrossCopyEntryProfile(worldbookHistoryActiveRow.right_entry) }}</span>
                        <p>{{ getCrossCopyPreviewText(worldbookHistoryActiveRow.right_entry.content, 260) }}</p>
                      </template>
                      <template v-else>
                        <span class="meta">该条目在 Right 版本不存在</span>
                      </template>
                    </div>
                  </div>
                </div>

                <div v-if="canResizeHistorySections" class="wb-history-pane-splitter" @pointerdown="onStartHistorySectionResize(0, $event)">
                  <span class="wb-history-pane-splitter-grip">⋯⋯⋯</span>
                </div>

                <div class="wb-history-pane-section" :style="getHistorySectionStyle(1)">
                  <section class="cross-copy-visual-section">
                    <div class="cross-copy-visual-head">
                      <strong>字段对比</strong>
                      <span>{{ worldbookHistoryFieldDiffSummary }}</span>
                    </div>
                    <div class="cross-copy-field-table">
                      <div class="cross-copy-field-row cross-copy-field-header">
                        <span>字段</span>
                        <span>Left</span>
                        <span>Right</span>
                        <span>状态</span>
                      </div>
                      <div v-for="field in worldbookHistoryFieldDiffRows" :key="field.key" class="cross-copy-field-row" :class="{ changed: field.changed }">
                        <span class="cross-copy-field-label">{{ field.label }}</span>
                        <span class="cross-copy-field-value left">{{ field.left }}</span>
                        <span class="cross-copy-field-value right">{{ field.right }}</span>
                        <span class="cross-copy-field-state" :class="{ changed: field.changed, same: !field.changed }">
                          {{ field.changed ? '不同' : '一致' }}
                        </span>
                      </div>
                    </div>
                  </section>
                </div>

                <div v-if="canResizeHistorySections" class="wb-history-pane-splitter" @pointerdown="onStartHistorySectionResize(1, $event)">
                  <span class="wb-history-pane-splitter-grip">⋯⋯⋯</span>
                </div>

                <div class="wb-history-pane-section" :style="getHistorySectionStyle(2)">
                  <section class="cross-copy-visual-section">
                    <div class="cross-copy-visual-head">
                      <strong>内容差异</strong>
                      <span>{{ worldbookHistoryContentDiffSummary }}</span>
                    </div>
                    <div class="cross-copy-content-grid">
                      <div class="cross-copy-content-col">
                        <div class="wb-history-diff-title">Left / 条目内容</div>
                        <div class="cross-copy-content-body">
                          <div v-for="(line, idx) in worldbookHistoryContentDiff.left" :key="`wh-left-${idx}`" class="cross-copy-content-line" :class="line.type">
                            <span class="line-no">{{ line.line_no ?? '' }}</span>
                            <span class="line-text">{{ line.text || ' ' }}</span>
                          </div>
                        </div>
                      </div>
                      <div class="cross-copy-content-col">
                        <div class="wb-history-diff-title">Right / 条目内容</div>
                        <div class="cross-copy-content-body">
                          <div v-for="(line, idx) in worldbookHistoryContentDiff.right" :key="`wh-right-${idx}`" class="cross-copy-content-line" :class="line.type">
                            <span class="line-no">{{ line.line_no ?? '' }}</span>
                            <span class="line-text">{{ line.text || ' ' }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </template>
            <div v-else class="empty-note wb-worldbook-detail-empty">请选择一条变化记录查看详细对比</div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import './historyModalShared.css';
import { computed, type ComponentPublicInstance } from 'vue';
import type {
  CrossCopyFieldDiffRow,
  CrossCopyTextDiffResult,
  WorldbookHistoryCompareRow,
  WorldbookHistoryCompareStatus,
  WorldbookVersionView
} from '../types';

interface WorldbookHistoryModalProps {
  visible: boolean;
  worldbookVersionDiffSummary: string;
  hasSelectedWorldbook: boolean;
  hasSnapshots: boolean;
  worldbookVersionViews: WorldbookVersionView[];
  worldbookHistoryLeftId: string;
  worldbookHistoryRightId: string;
  selectedWorldbookHistoryLeft: WorldbookVersionView | null;
  selectedWorldbookHistoryRight: WorldbookVersionView | null;
  canRestoreWorldbookFromLeft: boolean;
  worldbookHistoryCompareRows: WorldbookHistoryCompareRow[];
  worldbookHistoryCompareSummary: string;
  worldbookHistoryActiveRowKey: string;
  worldbookHistoryActiveRow: WorldbookHistoryCompareRow | null;
  setLayoutElement: (element: HTMLElement | null) => void;
  canResizeHistorySections: boolean;
  worldbookHistoryFieldDiffRows: CrossCopyFieldDiffRow[];
  worldbookHistoryFieldDiffSummary: string;
  worldbookHistoryContentDiff: CrossCopyTextDiffResult;
  worldbookHistoryContentDiffSummary: string;
  formatHistoryOptionLabel: (label: string, ts: number, isCurrent: boolean) => string;
  getHistorySectionStyle: (sectionIndex: 0 | 1 | 2) => Record<string, string> | undefined;
  getCrossCopyEntryProfile: (entry: WorldbookEntry) => string;
  getCrossCopyPreviewText: (content: string, maxLength?: number) => string;
  getWorldbookHistoryVersionPreview: (view: WorldbookVersionView | null) => string;
  getWorldbookHistoryStatusLabel: (status: WorldbookHistoryCompareStatus) => string;
  getWorldbookHistoryStatusBadgeClass: (status: WorldbookHistoryCompareStatus) => string;
}

const props = defineProps<WorldbookHistoryModalProps>();

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
  (event: 'update:worldbookHistoryLeftId', value: string): void;
  (event: 'update:worldbookHistoryRightId', value: string): void;
  (event: 'update:worldbookHistoryActiveRowKey', value: string): void;
  (event: 'createManualSnapshot'): void;
  (event: 'clearCurrentSnapshots'): void;
  (event: 'restoreWorldbookFromLeftHistory'): void;
  (event: 'startHistorySectionResize', handleIndex: 0 | 1, pointerEvent: PointerEvent): void;
}>();

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const worldbookHistoryLeftIdModel = computed({
  get: () => props.worldbookHistoryLeftId,
  set: value => emit('update:worldbookHistoryLeftId', value),
});

const worldbookHistoryRightIdModel = computed({
  get: () => props.worldbookHistoryRightId,
  set: value => emit('update:worldbookHistoryRightId', value),
});

const worldbookHistoryActiveRowKeyModel = computed({
  get: () => props.worldbookHistoryActiveRowKey,
  set: value => emit('update:worldbookHistoryActiveRowKey', value),
});

function setLayoutRef(element: Element | ComponentPublicInstance | null): void {
  if (element instanceof HTMLElement) {
    props.setLayoutElement(element);
    return;
  }
  const hostElement = (element as ComponentPublicInstance | null)?.$el;
  props.setLayoutElement(hostElement instanceof HTMLElement ? hostElement : null);
}

function onStartHistorySectionResize(handleIndex: 0 | 1, event: PointerEvent): void {
  emit('startHistorySectionResize', handleIndex, event);
}
</script>
