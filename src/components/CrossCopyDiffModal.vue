<template>
  <div v-if="visible && row" class="wb-modal-backdrop" @click.self="emit('close')">
    <div class="wb-history-modal cross-copy-diff-modal">
      <div class="wb-history-modal-header">
        <div>
          <strong>📚 跨书条目对比</strong>
          <span>{{ headerText }}</span>
        </div>
        <div class="wb-history-modal-actions">
          <span class="cross-copy-status-badge" :class="getStatusBadgeClass(row.status)">
            {{ getStatusLabel(row.status) }}
          </span>
          <button class="btn mini" type="button" @click="emit('close')">关闭</button>
        </div>
      </div>

      <div class="cross-copy-diff-main">
        <div class="cross-copy-preview-grid cross-copy-preview-grid-modal">
          <div class="cross-copy-preview-card">
            <strong>来源</strong>
            <span class="name">{{ row.source_entry.name || `条目 ${row.source_entry.uid}` }}</span>
            <span class="meta">{{ getEntryProfile(row.source_entry) }}</span>
            <p>{{ getPreviewText(row.source_entry.content, 260) }}</p>
          </div>
          <div class="cross-copy-preview-card">
            <strong>目标命中</strong>
            <template v-if="targetEntry">
              <span class="name">{{ targetEntry.name || `条目 ${targetEntry.uid}` }}</span>
              <span class="meta">{{ getEntryProfile(targetEntry) }}</span>
              <p>{{ getPreviewText(targetEntry.content, 260) }}</p>
            </template>
            <template v-else>
              <span class="meta">无直接命中条目（右侧为空）</span>
              <p class="cross-copy-diff-empty">该条目在目标世界书中将按“新建”逻辑处理。</p>
            </template>
          </div>
        </div>

        <section class="cross-copy-visual-section">
          <div class="cross-copy-visual-head">
            <strong>字段对比</strong>
            <span>{{ diffSummary }}</span>
            <span v-if="row.target_summary.same_name_matches.length > 1" class="cross-copy-diff-note">
              同名命中 {{ row.target_summary.same_name_matches.length }} 条（右侧展示首条）
            </span>
          </div>
          <div class="cross-copy-field-table">
            <div class="cross-copy-field-row cross-copy-field-header">
              <span>字段</span>
              <span>来源</span>
              <span>目标</span>
              <span>状态</span>
            </div>
            <div v-for="field in fieldDiffRows" :key="field.key" class="cross-copy-field-row" :class="{ changed: field.changed }">
              <span class="cross-copy-field-label">{{ field.label }}</span>
              <span class="cross-copy-field-value left">{{ field.left }}</span>
              <span class="cross-copy-field-value right">{{ field.right }}</span>
              <span class="cross-copy-field-state" :class="{ changed: field.changed, same: !field.changed }">
                {{ field.changed ? '不同' : '一致' }}
              </span>
            </div>
          </div>
        </section>

        <section class="cross-copy-visual-section">
          <div class="cross-copy-visual-head">
            <strong>内容差异</strong>
            <span>{{ contentDiffSummary }}</span>
          </div>
          <div class="cross-copy-content-grid">
            <div class="cross-copy-content-col">
              <div class="wb-history-diff-title">Left / 来源内容</div>
              <div class="cross-copy-content-body">
                <div v-for="(line, idx) in contentDiff.left" :key="`cc-left-${idx}`" class="cross-copy-content-line" :class="line.type">
                  <span class="line-no">{{ line.line_no ?? '' }}</span>
                  <span class="line-text">{{ line.text || ' ' }}</span>
                </div>
              </div>
            </div>
            <div class="cross-copy-content-col">
              <div class="wb-history-diff-title">Right / 目标内容</div>
              <div class="cross-copy-content-body">
                <div v-for="(line, idx) in contentDiff.right" :key="`cc-right-${idx}`" class="cross-copy-content-line" :class="line.type">
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
</template>

<script setup lang="ts">
import type {
  CrossCopyFieldDiffRow,
  CrossCopyRow,
  CrossCopyRowStatus,
  CrossCopyTextDiffResult,
} from '../types';

interface CrossCopyDiffModalProps {
  visible: boolean;
  row: CrossCopyRow | null;
  headerText: string;
  diffSummary: string;
  contentDiffSummary: string;
  targetEntry: WorldbookEntry | null;
  fieldDiffRows: CrossCopyFieldDiffRow[];
  contentDiff: CrossCopyTextDiffResult;
  getStatusBadgeClass: (status: CrossCopyRowStatus) => string;
  getStatusLabel: (status: CrossCopyRowStatus) => string;
  getEntryProfile: (entry: WorldbookEntry) => string;
  getPreviewText: (content: string, maxLength?: number) => string;
}

defineProps<CrossCopyDiffModalProps>();

const emit = defineEmits<{
  (event: 'close'): void;
}>();
</script>
