/**
 * Composable: Find & Replace
 * - Batch find across entries (name/content/keys)
 * - Hit navigation with editor reveal
 * - Batch replace with regex support
 * - Exclude filter
 */

import { ref, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import { stringifyKeyword, normalizeKeywordList } from '../utils';
import type { FindHit, FindFieldKey, BatchSearchScope } from '../types';

export interface UseFindReplaceOptions {
  draftEntries: Ref<WorldbookEntry[]>;
  selectedEntry: ComputedRef<WorldbookEntry | null>;
  selectedEntryUid: Ref<number | null>;
  editorShellRef: Ref<HTMLElement | null>;
  setStatus: (msg: string) => void;
}

export interface UseFindReplaceReturn {
  // State
  batchFindText: Ref<string>;
  batchReplaceText: Ref<string>;
  batchExcludeText: Ref<string>;
  batchUseRegex: Ref<boolean>;
  batchInName: Ref<boolean>;
  batchInContent: Ref<boolean>;
  batchInKeys: Ref<boolean>;
  batchSearchScope: Ref<BatchSearchScope>;
  findHits: Ref<FindHit[]>;
  findHitIndex: Ref<number>;

  // Computed
  activeFindHit: ComputedRef<FindHit | null>;
  findHitSummaryText: ComputedRef<string>;
  batchExcludeTokensPreview: ComputedRef<string[]>;

  // Actions
  getFindFieldLabel: (field: FindFieldKey) => string;
  findFirstMatch: () => void;
  findNextMatch: () => void;
  findPreviousMatch: () => void;
  applyBatchReplace: () => void;
  resetFindState: () => void;
}

export function useFindReplace(options: UseFindReplaceOptions): UseFindReplaceReturn {
  const { draftEntries, selectedEntry, selectedEntryUid, editorShellRef, setStatus } = options;

  // ── State ──────────────────────────────────────────────────────────
  const batchFindText = ref('');
  const batchReplaceText = ref('');
  const batchExcludeText = ref('');
  const batchUseRegex = ref(false);
  const batchInName = ref(true);
  const batchInContent = ref(true);
  const batchInKeys = ref(false);
  const batchSearchScope = ref<BatchSearchScope>('all');
  const findHits = ref<FindHit[]>([]);
  const findHitIndex = ref(-1);

  // ── Computed ───────────────────────────────────────────────────────
  const activeFindHit = computed(() => {
    if (findHitIndex.value < 0 || findHitIndex.value >= findHits.value.length) {
      return null;
    }
    return findHits.value[findHitIndex.value] ?? null;
  });

  const findHitSummaryText = computed(() => {
    if (!batchFindText.value.trim()) {
      return '输入查找文本后可定位';
    }
    if (!findHits.value.length) {
      return '暂无匹配';
    }
    if (!activeFindHit.value) {
      return `匹配 0 / ${findHits.value.length}`;
    }
    return `匹配 ${findHitIndex.value + 1} / ${findHits.value.length}`;
  });

  const batchExcludeTokensPreview = computed(() => parseBatchExcludeTokens(batchExcludeText.value));

  // ── Helpers ────────────────────────────────────────────────────────
  function getFindFieldLabel(field: FindFieldKey): string {
    if (field === 'name') return '名称';
    if (field === 'content') return '内容';
    return '关键词';
  }

  function resolveBatchRegex(findText: string): RegExp | null {
    if (!batchUseRegex.value) return null;
    try {
      return new RegExp(findText, 'g');
    } catch (error) {
      toastr.error(`正则表达式无效: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  function getBatchTargetEntries(): WorldbookEntry[] {
    if (batchSearchScope.value === 'current') {
      return selectedEntry.value ? [selectedEntry.value] : [];
    }
    return draftEntries.value;
  }

  function getEnabledFindFields(): FindFieldKey[] {
    const fields: FindFieldKey[] = [];
    if (batchInName.value) fields.push('name');
    if (batchInContent.value) fields.push('content');
    if (batchInKeys.value) fields.push('keys');
    return fields;
  }

  function getEntryFieldText(entry: WorldbookEntry, field: FindFieldKey): string {
    if (field === 'name') return entry.name;
    if (field === 'content') return entry.content;
    return entry.strategy.keys.map(key => stringifyKeyword(key)).join(', ');
  }

  function parseBatchExcludeTokens(raw: string): string[] {
    return raw
      .split(/[,\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
  }

  function shouldExcludeEntryForBatch(entry: WorldbookEntry, excludeTokens: string[]): boolean {
    if (!excludeTokens.length) return false;
    const nameKey = entry.name.toLowerCase();
    return excludeTokens.some(token => nameKey.includes(token));
  }

  function collectMatchIndexes(
    text: string,
    findText: string,
    regex: RegExp | null,
  ): Array<{ start: number; end: number; matchedText: string }> {
    const hits: Array<{ start: number; end: number; matchedText: string }> = [];
    if (!text || !findText) return hits;

    if (!regex) {
      let cursor = 0;
      while (cursor <= text.length) {
        const start = text.indexOf(findText, cursor);
        if (start < 0) break;
        const end = start + findText.length;
        hits.push({ start, end, matchedText: text.slice(start, end) });
        cursor = Math.max(end, start + 1);
      }
      return hits;
    }

    const runtime = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : `${regex.flags}g`);
    let result: RegExpExecArray | null = null;
    while ((result = runtime.exec(text)) !== null) {
      const matched = result[0] ?? '';
      if (!matched) {
        runtime.lastIndex += 1;
        continue;
      }
      hits.push({ start: result.index, end: result.index + matched.length, matchedText: matched });
    }
    return hits;
  }

  function buildFindPreview(text: string, start: number, end: number): string {
    const left = Math.max(0, start - 18);
    const right = Math.min(text.length, end + 22);
    const prefix = left > 0 ? '...' : '';
    const suffix = right < text.length ? '...' : '';
    return `${prefix}${text.slice(left, right).replace(/\s+/g, ' ')}${suffix}`;
  }

  function collectFindHits(findText: string, regex: RegExp | null, excludeTokens: string[]): FindHit[] {
    const fields = getEnabledFindFields();
    if (!fields.length) return [];
    const entries = getBatchTargetEntries();
    const hits: FindHit[] = [];

    for (const entry of entries) {
      if (shouldExcludeEntryForBatch(entry, excludeTokens)) continue;
      for (const field of fields) {
        const text = getEntryFieldText(entry, field);
        const indexes = collectMatchIndexes(text, findText, regex);
        for (const match of indexes) {
          hits.push({
            entryUid: entry.uid,
            entryName: entry.name,
            field,
            start: match.start,
            end: match.end,
            matchedText: match.matchedText,
            preview: buildFindPreview(text, match.start, match.end),
          });
        }
      }
    }
    return hits;
  }

  function isSameFindHit(left: FindHit, right: FindHit): boolean {
    return (
      left.entryUid === right.entryUid &&
      left.field === right.field &&
      left.start === right.start &&
      left.end === right.end &&
      left.matchedText === right.matchedText
    );
  }

  function resetFindState(): void {
    findHits.value = [];
    findHitIndex.value = -1;
  }

  // ── Editor reveal ─────────────────────────────────────────────────
  function getFindTargetElement(field: FindFieldKey): HTMLInputElement | HTMLTextAreaElement | null {
    const root = editorShellRef.value;
    if (!root) return null;
    if (field === 'name') return root.querySelector('.editor-comment input.text-input');
    if (field === 'content') return root.querySelector('.editor-content-area');
    return root.querySelector('.editor-keyword-grid .field textarea');
  }

  function getTextareaLineHeight(element: HTMLTextAreaElement): number {
    const style = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(lineHeight) && lineHeight > 0) return lineHeight;
    const fontSize = Number.parseFloat(style.fontSize);
    if (Number.isFinite(fontSize) && fontSize > 0) return fontSize * 1.4;
    return 18;
  }

  function scrollTextareaToSelection(element: HTMLTextAreaElement, start: number): void {
    const lineHeight = getTextareaLineHeight(element);
    const before = element.value.slice(0, start);
    const lineIndex = before.split('\n').length - 1;
    const desiredTop = Math.max(0, lineIndex * lineHeight - element.clientHeight * 0.35);
    element.scrollTop = desiredTop;
  }

  async function revealFindHitInEditor(hit: FindHit): Promise<void> {
    await nextTick();
    let target = getFindTargetElement(hit.field);
    if (!target) {
      await nextTick();
      target = getFindTargetElement(hit.field);
      if (!target) return;
    }

    const maxLen = target.value.length;
    const start = Math.max(0, Math.min(hit.start, maxLen));
    const end = Math.max(start, Math.min(hit.end, maxLen));

    target.focus();
    target.setSelectionRange(start, end);
    if (target instanceof HTMLTextAreaElement) {
      scrollTextareaToSelection(target, start);
    }
    target.scrollIntoView({ block: 'center', inline: 'nearest' });
    requestAnimationFrame(() => {
      target?.scrollIntoView({ block: 'center', inline: 'nearest' });
      if (target instanceof HTMLTextAreaElement) {
        scrollTextareaToSelection(target, start);
      }
    });
  }

  function moveToFindHit(hit: FindHit, index: number, total: number): void {
    findHitIndex.value = index;
    selectedEntryUid.value = hit.entryUid;
    void revealFindHitInEditor(hit);
    const entryLabel = hit.entryName || `条目 ${hit.entryUid}`;
    setStatus(`查找 ${index + 1}/${total}: ${entryLabel} · ${getFindFieldLabel(hit.field)} · ${hit.preview}`);
  }

  // ── Run find ───────────────────────────────────────────────────────
  function runFind(step: -1 | 0 | 1): void {
    const findText = batchFindText.value;
    if (!findText) {
      toastr.warning('请先输入查找文本');
      return;
    }
    if (!getEnabledFindFields().length) {
      toastr.warning('请至少勾选一个查找字段');
      return;
    }
    if (batchSearchScope.value === 'current' && !selectedEntry.value) {
      toastr.warning('当前条目模式下请先选择一个条目');
      return;
    }

    const excludeTokens = parseBatchExcludeTokens(batchExcludeText.value);
    const regex = resolveBatchRegex(findText);
    if (batchUseRegex.value && !regex) return;

    const hits = collectFindHits(findText, regex, excludeTokens);
    findHits.value = hits;

    if (!hits.length) {
      findHitIndex.value = -1;
      setStatus('查找完成：未找到匹配');
      toastr.info('未找到匹配项');
      return;
    }

    if (step === 0) {
      moveToFindHit(hits[0], 0, hits.length);
      return;
    }

    const prevHit = activeFindHit.value;
    const currentIndex = prevHit ? hits.findIndex(item => isSameFindHit(item, prevHit)) : findHitIndex.value;
    let nextIndex: number;
    if (currentIndex < 0) {
      nextIndex = step > 0 ? 0 : hits.length - 1;
    } else {
      nextIndex = (currentIndex + step + hits.length) % hits.length;
    }
    moveToFindHit(hits[nextIndex], nextIndex, hits.length);
  }

  function findFirstMatch(): void { runFind(0); }
  function findNextMatch(): void { runFind(1); }
  function findPreviousMatch(): void { runFind(-1); }

  // ── Replace ───────────────────────────────────────────────────────
  function applyBatchReplace(): void {
    const findText = batchFindText.value;
    if (!findText) {
      toastr.warning('请先输入查找文本');
      return;
    }
    if (!getEnabledFindFields().length) {
      toastr.warning('请至少勾选一个查找字段');
      return;
    }
    if (batchSearchScope.value === 'current' && !selectedEntry.value) {
      toastr.warning('当前条目模式下请先选择一个条目');
      return;
    }

    const targetEntries = getBatchTargetEntries();
    if (!targetEntries.length) {
      toastr.warning('没有可处理的条目');
      return;
    }

    const excludeTokens = parseBatchExcludeTokens(batchExcludeText.value);
    const regex = resolveBatchRegex(findText);
    if (batchUseRegex.value && !regex) return;

    let touched = 0;
    let skipped = 0;
    for (const entry of targetEntries) {
      if (shouldExcludeEntryForBatch(entry, excludeTokens)) {
        skipped += 1;
        continue;
      }

      let changed = false;

      if (batchInName.value) {
        const next = regex
          ? entry.name.replace(regex, batchReplaceText.value)
          : entry.name.split(findText).join(batchReplaceText.value);
        if (next !== entry.name) {
          entry.name = next;
          changed = true;
        }
      }

      if (batchInContent.value) {
        const next = regex
          ? entry.content.replace(regex, batchReplaceText.value)
          : entry.content.split(findText).join(batchReplaceText.value);
        if (next !== entry.content) {
          entry.content = next;
          changed = true;
        }
      }

      if (batchInKeys.value) {
        const nextKeys = entry.strategy.keys.map(key => {
          const text = stringifyKeyword(key);
          return regex ? text.replace(regex, batchReplaceText.value) : text.split(findText).join(batchReplaceText.value);
        });
        const normalized = normalizeKeywordList(nextKeys);
        if (
          JSON.stringify(normalized.map(stringifyKeyword)) !== JSON.stringify(entry.strategy.keys.map(stringifyKeyword))
        ) {
          entry.strategy.keys = normalized;
          changed = true;
        }
      }

      if (changed) touched += 1;
    }

    resetFindState();
    setStatus(
      `查找替换完成（${batchSearchScope.value === 'current' ? '当前条目' : '全部条目'}），修改 ${touched} 条，排除 ${skipped} 条`,
    );
  }

  return {
    batchFindText,
    batchReplaceText,
    batchExcludeText,
    batchUseRegex,
    batchInName,
    batchInContent,
    batchInKeys,
    batchSearchScope,
    findHits,
    findHitIndex,
    activeFindHit,
    findHitSummaryText,
    batchExcludeTokensPreview,
    getFindFieldLabel,
    findFirstMatch,
    findNextMatch,
    findPreviousMatch,
    applyBatchReplace,
    resetFindState,
  };
}
