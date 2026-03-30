<template>
  <div v-if="visibleModel" class="wb-modal-backdrop" @click.self="visibleModel = false">
    <div class="wb-history-modal">
      <div class="wb-history-modal-header">
        <div>
          <strong>🕰️ 条目时光机</strong>
          <span>{{ entryHistorySummary }}</span>
        </div>
        <div class="wb-history-modal-actions">
          <button class="btn mini" type="button" :disabled="!hasSelectedEntry" @click="emit('createManualEntrySnapshot')">
            记录条目
          </button>
          <button class="btn mini danger" type="button" :disabled="!hasEntrySnapshots" @click="emit('clearCurrentEntrySnapshots')">
            清空条目历史
          </button>
          <button class="btn mini" type="button" @click="visibleModel = false">关闭</button>
        </div>
      </div>

      <div class="wb-history-modal-main">
        <aside class="wb-history-versions">
          <div class="wb-history-versions-title">版本列表（L/R）</div>
          <div class="wb-history-versions-scroll">
            <div v-for="ver in entryVersionViews" :key="ver.id" class="wb-history-version-item">
              <div class="wb-history-version-line">
                <strong>{{ formatHistoryOptionLabel(ver.label, ver.ts, ver.isCurrent) }}</strong>
                <div class="wb-history-lr">
                  <button class="mini-lr" :class="{ active: entryHistoryLeftIdModel === ver.id }" @click="entryHistoryLeftIdModel = ver.id">L</button>
                  <button class="mini-lr" :class="{ active: entryHistoryRightIdModel === ver.id }" @click="entryHistoryRightIdModel = ver.id">R</button>
                </div>
              </div>
              <span>{{ ver.name }}</span>
            </div>
            <div v-if="entryVersionViews.length <= 1" class="empty-note">暂无历史条目版本</div>
          </div>
        </aside>

        <section class="wb-history-diff-wrap">
          <div class="wb-history-diff-head">
            <div>
              Left: {{ selectedEntryHistoryLeft ? formatHistoryOptionLabel(selectedEntryHistoryLeft.label, selectedEntryHistoryLeft.ts, selectedEntryHistoryLeft.isCurrent) : '-' }}
              |
              Right: {{ selectedEntryHistoryRight ? formatHistoryOptionLabel(selectedEntryHistoryRight.label, selectedEntryHistoryRight.ts, selectedEntryHistoryRight.isCurrent) : '-' }}
            </div>
            <button class="btn mini" type="button" :disabled="!canRestoreEntryFromLeft" @click="emit('restoreEntryFromLeftHistory')">
              恢复到 Left
            </button>
          </div>

          <div class="wb-history-visual-main">
            <div :ref="setLayoutRef" class="wb-history-resizable-layout">
              <div class="wb-history-pane-section" :style="getHistorySectionStyle(0)">
                <div class="cross-copy-preview-grid cross-copy-preview-grid-modal wb-history-version-preview">
                  <div class="cross-copy-preview-card">
                    <strong>Left 版本</strong>
                    <span class="name">{{ selectedEntryHistoryLeft ? selectedEntryHistoryLeft.name || `条目 ${selectedEntryHistoryLeft.entry.uid}` : '-' }}</span>
                    <span class="meta">{{ selectedEntryHistoryLeft ? getCrossCopyEntryProfile(selectedEntryHistoryLeft.entry) : '-' }}</span>
                    <p>{{ getEntryVersionPreview(selectedEntryHistoryLeft) || '-' }}</p>
                  </div>
                  <div class="cross-copy-preview-card">
                    <strong>Right 版本</strong>
                    <span class="name">{{ selectedEntryHistoryRight ? selectedEntryHistoryRight.name || `条目 ${selectedEntryHistoryRight.entry.uid}` : '-' }}</span>
                    <span class="meta">{{ selectedEntryHistoryRight ? getCrossCopyEntryProfile(selectedEntryHistoryRight.entry) : '-' }}</span>
                    <p>{{ getEntryVersionPreview(selectedEntryHistoryRight) || '-' }}</p>
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
                    <span>{{ entryHistoryFieldDiffSummary }}</span>
                  </div>
                  <div class="cross-copy-field-table">
                    <div class="cross-copy-field-row cross-copy-field-header">
                      <span>字段</span>
                      <span>Left</span>
                      <span>Right</span>
                      <span>状态</span>
                    </div>
                    <div v-for="field in entryHistoryFieldDiffRows" :key="field.key" class="cross-copy-field-row" :class="{ changed: field.changed }">
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
                    <span>{{ entryHistoryContentDiffSummary }}</span>
                  </div>
                  <div class="cross-copy-content-grid">
                    <div class="cross-copy-content-col">
                      <div class="wb-history-diff-title">Left / 条目内容</div>
                      <div class="cross-copy-content-body">
                        <div v-for="(line, idx) in entryHistoryContentDiff.left" :key="`eh-left-${idx}`" class="cross-copy-content-line" :class="line.type">
                          <span class="line-no">{{ line.line_no ?? '' }}</span>
                          <span class="line-text">{{ line.text || ' ' }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="cross-copy-content-col">
                      <div class="wb-history-diff-title">Right / 条目内容</div>
                      <div class="cross-copy-content-body">
                        <div v-for="(line, idx) in entryHistoryContentDiff.right" :key="`eh-right-${idx}`" class="cross-copy-content-line" :class="line.type">
                          <span class="line-no">{{ line.line_no ?? '' }}</span>
                          <span class="line-text">{{ line.text || ' ' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
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
  EntryVersionView
} from '../types';

interface EntryHistoryModalProps {
  visible: boolean;
  entryHistorySummary: string;
  hasSelectedEntry: boolean;
  hasEntrySnapshots: boolean;
  entryVersionViews: EntryVersionView[];
  entryHistoryLeftId: string;
  entryHistoryRightId: string;
  selectedEntryHistoryLeft: EntryVersionView | null;
  selectedEntryHistoryRight: EntryVersionView | null;
  canRestoreEntryFromLeft: boolean;
  canResizeHistorySections: boolean;
  setLayoutElement: (element: HTMLElement | null) => void;
  entryHistoryFieldDiffRows: CrossCopyFieldDiffRow[];
  entryHistoryFieldDiffSummary: string;
  entryHistoryContentDiff: CrossCopyTextDiffResult;
  entryHistoryContentDiffSummary: string;
  formatHistoryOptionLabel: (label: string, ts: number, isCurrent: boolean) => string;
  getHistorySectionStyle: (sectionIndex: 0 | 1 | 2) => Record<string, string> | undefined;
  getCrossCopyEntryProfile: (entry: WorldbookEntry) => string;
  getEntryVersionPreview: (view: EntryVersionView | null) => string;
}

const props = defineProps<EntryHistoryModalProps>();

const emit = defineEmits<{
  (event: 'update:visible', value: boolean): void;
  (event: 'update:entryHistoryLeftId', value: string): void;
  (event: 'update:entryHistoryRightId', value: string): void;
  (event: 'createManualEntrySnapshot'): void;
  (event: 'clearCurrentEntrySnapshots'): void;
  (event: 'restoreEntryFromLeftHistory'): void;
  (event: 'startHistorySectionResize', handleIndex: 0 | 1, pointerEvent: PointerEvent): void;
}>();

const visibleModel = computed({
  get: () => props.visible,
  set: value => emit('update:visible', value),
});

const entryHistoryLeftIdModel = computed({
  get: () => props.entryHistoryLeftId,
  set: value => emit('update:entryHistoryLeftId', value),
});

const entryHistoryRightIdModel = computed({
  get: () => props.entryHistoryRightId,
  set: value => emit('update:entryHistoryRightId', value),
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
