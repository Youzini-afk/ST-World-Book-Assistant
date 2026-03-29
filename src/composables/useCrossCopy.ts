/**
 * Composable: Cross-Copy System
 * - Source/target worldbook comparison
 * - Row building, filtering, selection
 * - Diff modal
 * - Bulk actions & apply
 * - Pane resize
 * - Mobile step navigation
 * - Persistence
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { createId, toStringSafe, clampNumber, normalizeEntry } from '../utils';
import {
  normalizeCrossCopyPersistState,
  CROSS_COPY_DESKTOP_LEFT_DEFAULT,
  CROSS_COPY_DESKTOP_LEFT_MIN,
  CROSS_COPY_DESKTOP_LEFT_MAX,
} from '../store/persistedState';
import {
  normalizeCrossCopyNameKey,
  normalizeCrossCopyContentKey,
  buildEntryFieldDiffRows,
  buildCrossCopyTextDiff,
  getEntryPairDiffSummary,
} from '../diffUtils';
import type {
  PersistedState,
  CrossCopyRow,
  CrossCopyRowStatus,
  CrossCopyAction,
  CrossCopyStatusFilter,
  CrossCopyMobileStep,
  CrossCopyPaneResizeState,
  CrossCopyMatchSummary,
  CrossCopyFieldDiffRow,
  CrossCopyTextDiffResult,
} from '../types';

declare const klona: <T>(val: T) => T;

const CROSS_COPY_STATUS_LABELS: Record<CrossCopyRowStatus, string> = {
  new: '新增',
  duplicate_exact: '同名同内容',
  same_name_changed: '同名内容不同',
  content_duplicate_other_name: '异名同内容',
  invalid_same_source_target: '来源与目标相同',
};
const CROSS_COPY_ACTION_LABELS: Record<CrossCopyAction, string> = {
  skip: '跳过',
  overwrite: '覆盖同名',
  rename_create: '另存新名',
  create: '直接创建',
};

export interface UseCrossCopyOptions {
  persistedState: Ref<PersistedState>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
  setStatus: (msg: string) => void;
  worldbookNames: Ref<string[]>;
  selectedWorldbookName: Ref<string>;
  draftEntries: Ref<WorldbookEntry[]>;
  hasUnsavedChanges: ComputedRef<boolean>;
  isAnyCineLocked: ComputedRef<boolean>;
  isMobile: ComputedRef<boolean>;
  saveCurrentWorldbook: () => Promise<void>;
  loadWorldbook: (name: string) => Promise<void>;
  pushSnapshotForWorldbook: (worldbookName: string, entries: WorldbookEntry[], label: string) => void;
}

export interface UseCrossCopyReturn {
  // State
  crossCopyMode: Ref<boolean>;
  crossCopySourceWorldbook: Ref<string>;
  crossCopyTargetWorldbook: Ref<string>;
  crossCopyUseDraftSourceWhenCurrent: Ref<boolean>;
  crossCopySnapshotBeforeApply: Ref<boolean>;
  crossCopyControlsCollapsed: Ref<boolean>;
  crossCopyWorkspaceToolsExpanded: Ref<boolean>;
  crossCopyDesktopLeftWidth: Ref<number>;
  crossCopyRows: Ref<CrossCopyRow[]>;
  crossCopySourceBaselineEntries: Ref<WorldbookEntry[]>;
  crossCopyTargetBaselineEntries: Ref<WorldbookEntry[]>;
  crossCopyCompareLoading: Ref<boolean>;
  crossCopyApplyLoading: Ref<boolean>;
  crossCopySearchText: Ref<string>;
  crossCopyStatusFilter: Ref<CrossCopyStatusFilter>;
  crossCopyBulkAction: Ref<CrossCopyAction>;
  crossCopyCompareSummary: Ref<string>;
  crossCopyLastResultSummary: Ref<string>;
  crossCopyLastComparedAt: Ref<number>;
  crossCopyPaneResizeState: Ref<CrossCopyPaneResizeState | null>;
  crossCopyGridRef: Ref<HTMLElement | null>;
  crossCopyMobileStep: Ref<CrossCopyMobileStep>;
  showCrossCopyDiffModal: Ref<boolean>;
  crossCopyDiffRowId: Ref<string>;

  // Computed
  crossCopyDesktopLeftWidthClamped: ComputedRef<number>;
  crossCopySourceIsCurrentWorldbook: ComputedRef<boolean>;
  crossCopySourceVersionLabel: ComputedRef<string>;
  crossCopyHasCompared: ComputedRef<boolean>;
  crossCopyWorkspaceSummary: ComputedRef<string>;
  crossCopySourceTargetInvalid: ComputedRef<boolean>;
  crossCopySourceRowsFiltered: ComputedRef<CrossCopyRow[]>;
  crossCopyRowsFiltered: ComputedRef<CrossCopyRow[]>;
  crossCopySelectedRows: ComputedRef<CrossCopyRow[]>;
  crossCopyStatusCounts: ComputedRef<Record<CrossCopyRowStatus, number>>;
  crossCopySelectedCount: ComputedRef<number>;
  crossCopyCanCompare: ComputedRef<boolean>;
  crossCopyMobileCanGoStep2: ComputedRef<boolean>;
  crossCopyMobileCanGoStep3: ComputedRef<boolean>;
  crossCopyDiffActiveRow: ComputedRef<CrossCopyRow | null>;
  crossCopyDiffFieldRows: ComputedRef<CrossCopyFieldDiffRow[]>;
  crossCopyDiffTextResult: ComputedRef<CrossCopyTextDiffResult>;

  // Functions
  normalizeCrossCopyWorldbookSelection: () => void;
  applyCrossCopyStateFromPersisted: () => void;
  persistCrossCopyState: () => void;
  getCrossCopyStatusLabel: (status: CrossCopyRowStatus) => string;
  getCrossCopyActionLabel: (action: CrossCopyAction) => string;
  getCrossCopyStatusBadgeClass: (status: CrossCopyRowStatus) => string;
  getCrossCopyEntryProfile: (entry: WorldbookEntry) => string;
  getCrossCopyPrimaryTargetMatch: (row: CrossCopyRow) => WorldbookEntry | null;
  getCrossCopyRowDiffSummary: (row: CrossCopyRow) => string;
  getCrossCopyPreviewText: (text: string, maxLength?: number) => string;
  refreshCrossCopyComparison: () => Promise<void>;
  setCrossCopySelectionForFiltered: (selected: boolean) => void;
  setCrossCopySelectionForAll: (selected: boolean) => void;
  applyCrossCopyBulkAction: (action?: CrossCopyAction) => void;
  applyCrossCopyActionByStatus: (status: CrossCopyRowStatus, action: CrossCopyAction) => void;
  onCrossCopyRowActionChange: (row: CrossCopyRow) => void;
  onCrossCopyRowRenameBlur: (row: CrossCopyRow) => void;
  applyCrossCopySelection: () => Promise<void>;
  openCrossCopyDiff: (row: CrossCopyRow) => void;
  closeCrossCopyDiff: () => void;
  toggleCrossCopyWorkspaceTools: () => void;
  toggleCrossCopyControlsCollapsed: () => void;
  setCrossCopyModeActive: (next: boolean) => void;
  toggleCrossCopyMode: () => void;
  startCrossCopyPaneResize: (event: PointerEvent) => void;
  stopCrossCopyPaneResize: () => void;
  goToCrossCopyMobileStep: (step: CrossCopyMobileStep) => void;
  goToPreviousCrossCopyMobileStep: () => void;
  goToNextCrossCopyMobileStep: () => void;
}

export function useCrossCopy(options: UseCrossCopyOptions): UseCrossCopyReturn {
  const {
    persistedState, updatePersistedState, setStatus,
    worldbookNames, selectedWorldbookName, draftEntries,
    hasUnsavedChanges, isAnyCineLocked, isMobile,
    saveCurrentWorldbook, loadWorldbook, pushSnapshotForWorldbook,
  } = options;

  // ── State ──────────────────────────────────────────────────────────
  const crossCopyMode = ref(false);
  const crossCopySourceWorldbook = ref('');
  const crossCopyTargetWorldbook = ref('');
  const crossCopyUseDraftSourceWhenCurrent = ref(true);
  const crossCopySnapshotBeforeApply = ref(true);
  const crossCopyControlsCollapsed = ref(true);
  const crossCopyWorkspaceToolsExpanded = ref(false);
  const crossCopyDesktopLeftWidth = ref(CROSS_COPY_DESKTOP_LEFT_DEFAULT);
  const crossCopyRows = ref<CrossCopyRow[]>([]);
  const crossCopySourceBaselineEntries = ref<WorldbookEntry[]>([]);
  const crossCopyTargetBaselineEntries = ref<WorldbookEntry[]>([]);
  const crossCopyCompareLoading = ref(false);
  const crossCopyApplyLoading = ref(false);
  const crossCopySearchText = ref('');
  const crossCopyStatusFilter = ref<CrossCopyStatusFilter>('all');
  const crossCopyBulkAction = ref<CrossCopyAction>('skip');
  const crossCopyCompareSummary = ref('');
  const crossCopyLastResultSummary = ref('');
  const crossCopyLastComparedAt = ref<number>(0);
  const crossCopyPaneResizeState = ref<CrossCopyPaneResizeState | null>(null);
  const crossCopyGridRef = ref<HTMLElement | null>(null);
  const crossCopyMobileStep = ref<CrossCopyMobileStep>(1);
  const showCrossCopyDiffModal = ref(false);
  const crossCopyDiffRowId = ref('');

  // ── Computed ───────────────────────────────────────────────────────
  const crossCopyDesktopLeftWidthClamped = computed(() =>
    clampNumber(crossCopyDesktopLeftWidth.value, CROSS_COPY_DESKTOP_LEFT_MIN, CROSS_COPY_DESKTOP_LEFT_MAX),
  );

  const crossCopySourceIsCurrentWorldbook = computed(() =>
    Boolean(crossCopySourceWorldbook.value) && crossCopySourceWorldbook.value === selectedWorldbookName.value,
  );

  const crossCopySourceVersionLabel = computed(() => {
    if (!crossCopySourceIsCurrentWorldbook.value) return '已保存版本';
    return crossCopyUseDraftSourceWhenCurrent.value ? '当前草稿' : '已保存版本';
  });

  const crossCopyHasCompared = computed(() => crossCopyLastComparedAt.value > 0);

  const crossCopyWorkspaceSummary = computed(() => {
    const source = crossCopySourceWorldbook.value || '未选择来源';
    const target = crossCopyTargetWorldbook.value || '未选择目标';
    return `${source} → ${target}`;
  });

  const crossCopySourceTargetInvalid = computed(() => {
    if (!crossCopySourceWorldbook.value || !crossCopyTargetWorldbook.value) return false;
    return crossCopySourceWorldbook.value === crossCopyTargetWorldbook.value;
  });

  const crossCopySourceRowsFiltered = computed(() => {
    const keyword = crossCopySearchText.value.trim().toLowerCase();
    if (!keyword) return crossCopyRowsFiltered.value;
    return crossCopyRowsFiltered.value.filter(row =>
      row.source_entry.name.toLowerCase().includes(keyword) ||
      row.source_entry.content.toLowerCase().includes(keyword),
    );
  });

  const crossCopyRowsFiltered = computed(() => {
    if (crossCopyStatusFilter.value === 'all') return crossCopyRows.value;
    return crossCopyRows.value.filter(row => row.status === crossCopyStatusFilter.value);
  });

  const crossCopySelectedRows = computed(() => crossCopyRows.value.filter(row => row.selected));

  const crossCopyStatusCounts = computed(() => {
    const counts: Record<CrossCopyRowStatus, number> = {
      new: 0, duplicate_exact: 0, same_name_changed: 0,
      content_duplicate_other_name: 0, invalid_same_source_target: 0,
    };
    for (const row of crossCopyRows.value) {
      counts[row.status] = (counts[row.status] ?? 0) + 1;
    }
    return counts;
  });

  const crossCopySelectedCount = computed(() => crossCopySelectedRows.value.length);
  const crossCopyCanCompare = computed(() =>
    Boolean(crossCopySourceWorldbook.value && crossCopyTargetWorldbook.value) && !crossCopySourceTargetInvalid.value,
  );
  const crossCopyMobileCanGoStep2 = computed(() => crossCopyHasCompared.value && crossCopyRows.value.length > 0);
  const crossCopyMobileCanGoStep3 = computed(() => crossCopyMobileCanGoStep2.value && crossCopySelectedCount.value > 0);

  const crossCopyDiffActiveRow = computed(() => {
    if (!crossCopyDiffRowId.value) return null;
    return crossCopyRows.value.find(row => row.id === crossCopyDiffRowId.value) ?? null;
  });
  const crossCopyDiffFieldRows = computed<CrossCopyFieldDiffRow[]>(() => {
    const row = crossCopyDiffActiveRow.value;
    if (!row) return [];
    const target = getCrossCopyPrimaryTargetMatch(row);
    return buildEntryFieldDiffRows(row.source_entry, target);
  });
  const crossCopyDiffTextResult = computed<CrossCopyTextDiffResult>(() => {
    const row = crossCopyDiffActiveRow.value;
    if (!row) return { left: [], right: [], added: 0, removed: 0, changed: 0 };
    const target = getCrossCopyPrimaryTargetMatch(row);
    return buildCrossCopyTextDiff(row.source_entry.content || '', target?.content || '');
  });

  // ── Helpers ────────────────────────────────────────────────────────
  function getCrossCopyStatusLabel(status: CrossCopyRowStatus): string {
    return CROSS_COPY_STATUS_LABELS[status];
  }
  function getCrossCopyActionLabel(action: CrossCopyAction): string {
    return CROSS_COPY_ACTION_LABELS[action];
  }
  function getCrossCopyStatusBadgeClass(status: CrossCopyRowStatus): string {
    if (status === 'new') return 'new';
    if (status === 'same_name_changed') return 'changed';
    if (status === 'duplicate_exact') return 'duplicate';
    if (status === 'content_duplicate_other_name') return 'content-duplicate';
    return 'invalid';
  }
  function getCrossCopyPreviewText(text: string, maxLength = 180): string {
    const compact = toStringSafe(text).replace(/\s+/g, ' ').trim();
    if (!compact) return '(空内容)';
    return compact.length <= maxLength ? compact : `${compact.slice(0, maxLength)}...`;
  }
  function getCrossCopyEntryProfile(entry: WorldbookEntry): string {
    const statusLabel = entry.enabled ? (entry.strategy.type === 'constant' ? '🔵' : '🟢') : '⚫';
    return [
      statusLabel,
      `Keys ${entry.strategy.keys.length}/${entry.strategy.keys_secondary.keys.length}`,
      `#${entry.position.order}`,
      `p:${entry.probability}`,
    ].join(' · ');
  }
  function getCrossCopyPrimaryTargetMatch(row: CrossCopyRow): WorldbookEntry | null {
    if (row.target_summary.same_name_matches.length) return row.target_summary.same_name_matches[0];
    if (row.target_summary.content_duplicate_other_name_matches.length) return row.target_summary.content_duplicate_other_name_matches[0];
    return null;
  }
  function getCrossCopyRowDiffSummary(row: CrossCopyRow): string {
    const target = getCrossCopyPrimaryTargetMatch(row);
    if (!target) return '目标无直接命中';
    return getEntryPairDiffSummary(row.source_entry, target, { left: '来源', right: '目标' });
  }

  function generateCrossCopyUniqueName(baseName: string, occupiedNameKeys: Set<string>): string {
    const base = toStringSafe(baseName).trim() || '未命名条目';
    const first = `${base} (复制)`;
    if (!occupiedNameKeys.has(normalizeCrossCopyNameKey(first))) return first;
    for (let index = 2; index < 2000; index += 1) {
      const candidate = `${base} (复制${index})`;
      if (!occupiedNameKeys.has(normalizeCrossCopyNameKey(candidate))) return candidate;
    }
    return `${base} (复制${Date.now()})`;
  }

  function getCrossCopyReservedNameKeys(excludeRowId = ''): Set<string> {
    const occupied = new Set(crossCopyTargetBaselineEntries.value.map(entry => normalizeCrossCopyNameKey(entry.name)));
    for (const row of crossCopyRows.value) {
      if (row.id === excludeRowId || row.action !== 'rename_create') continue;
      const key = normalizeCrossCopyNameKey(row.rename_name);
      if (key) occupied.add(key);
    }
    return occupied;
  }

  function ensureCrossCopyRenameForRow(row: CrossCopyRow): void {
    if (row.action !== 'rename_create') return;
    const occupied = getCrossCopyReservedNameKeys(row.id);
    const typed = toStringSafe(row.rename_name).trim();
    if (!typed) {
      row.rename_name = generateCrossCopyUniqueName(row.source_entry.name, occupied);
      return;
    }
    const typedKey = normalizeCrossCopyNameKey(typed);
    if (occupied.has(typedKey)) {
      row.rename_name = generateCrossCopyUniqueName(typed, occupied);
      return;
    }
    row.rename_name = typed;
  }

  // ── Row building ──────────────────────────────────────────────────
  function buildCrossCopyRows(
    sourceEntries: WorldbookEntry[],
    targetEntries: WorldbookEntry[],
  ): CrossCopyRow[] {
    const isSameSourceTarget = crossCopySourceWorldbook.value === crossCopyTargetWorldbook.value;
    const targetNameMap = new Map<string, WorldbookEntry[]>();
    const targetContentMap = new Map<string, WorldbookEntry[]>();
    for (const entry of targetEntries) {
      const nameKey = normalizeCrossCopyNameKey(entry.name);
      const contentKey = normalizeCrossCopyContentKey(entry.content);
      targetNameMap.set(nameKey, [...(targetNameMap.get(nameKey) ?? []), entry]);
      if (contentKey) {
        targetContentMap.set(contentKey, [...(targetContentMap.get(contentKey) ?? []), entry]);
      }
    }

    const rows: CrossCopyRow[] = [];
    for (let i = 0; i < sourceEntries.length; i++) {
      const source = sourceEntries[i];
      const nameKey = normalizeCrossCopyNameKey(source.name);
      const contentKey = normalizeCrossCopyContentKey(source.content);
      const sameNameMatches = targetNameMap.get(nameKey) ?? [];
      const sameNameExactCount = sameNameMatches.filter(t => normalizeCrossCopyContentKey(t.content) === contentKey).length;
      const contentDupOtherName = contentKey
        ? (targetContentMap.get(contentKey) ?? []).filter(t => normalizeCrossCopyNameKey(t.name) !== nameKey)
        : [];
      const summary: CrossCopyMatchSummary = {
        same_name_matches: sameNameMatches,
        same_name_exact_count: sameNameExactCount,
        content_duplicate_other_name_matches: contentDupOtherName,
      };

      let status: CrossCopyRowStatus;
      let action: CrossCopyAction;
      if (isSameSourceTarget) {
        status = 'invalid_same_source_target';
        action = 'skip';
      } else if (!sameNameMatches.length && !contentDupOtherName.length) {
        status = 'new';
        action = 'create';
      } else if (sameNameExactCount > 0) {
        status = 'duplicate_exact';
        action = 'skip';
      } else if (sameNameMatches.length) {
        status = 'same_name_changed';
        action = 'overwrite';
      } else {
        status = 'content_duplicate_other_name';
        action = 'skip';
      }

      rows.push({
        id: createId('cc-row'),
        source_entry: source,
        source_index: i,
        source_name_key: nameKey,
        source_content_key: contentKey,
        status,
        selected: action !== 'skip',
        action,
        rename_name: '',
        note: '',
        details_open: false,
        target_summary: summary,
      });
    }
    return rows;
  }

  function buildCrossCopyCompareSummaryText(rows: CrossCopyRow[], sourceCount: number, targetCount: number): string {
    const counts: Record<string, number> = { new: 0, duplicate_exact: 0, same_name_changed: 0, content_duplicate_other_name: 0, invalid_same_source_target: 0 };
    for (const row of rows) counts[row.status] = (counts[row.status] ?? 0) + 1;
    return `来源 ${sourceCount} 条 / 目标 ${targetCount} 条 · 新增 ${counts.new} · 完全重复 ${counts.duplicate_exact} · 同名不同内容 ${counts.same_name_changed} · 内容重复 ${counts.content_duplicate_other_name}`;
  }

  // ── Comparison ─────────────────────────────────────────────────────
  async function refreshCrossCopyComparison(): Promise<void> {
    if (crossCopyCompareLoading.value) return;
    if (!crossCopySourceWorldbook.value || !crossCopyTargetWorldbook.value) {
      toastr.warning('请先选择来源和目标世界书');
      return;
    }
    crossCopyCompareLoading.value = true;
    try {
      let sourceEntries: WorldbookEntry[];
      if (crossCopySourceIsCurrentWorldbook.value && crossCopyUseDraftSourceWhenCurrent.value) {
        sourceEntries = draftEntries.value;
      } else {
        sourceEntries = await getWorldbook(crossCopySourceWorldbook.value);
      }
      const targetEntries = await getWorldbook(crossCopyTargetWorldbook.value);

      crossCopySourceBaselineEntries.value = sourceEntries;
      crossCopyTargetBaselineEntries.value = targetEntries;
      const rows = buildCrossCopyRows(sourceEntries, targetEntries);
      crossCopyRows.value = rows;
      crossCopyCompareSummary.value = buildCrossCopyCompareSummaryText(rows, sourceEntries.length, targetEntries.length);
      crossCopyLastComparedAt.value = Date.now();
      crossCopySearchText.value = '';
      crossCopyStatusFilter.value = 'all';
      setStatus(`跨书比较完成: ${crossCopyCompareSummary.value}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toastr.error(`比较失败: ${msg}`);
    } finally {
      crossCopyCompareLoading.value = false;
    }
  }

  // ── Selection & actions ────────────────────────────────────────────
  function setCrossCopySelectionForFiltered(selected: boolean): void {
    for (const row of crossCopySourceRowsFiltered.value) {
      if (row.status !== 'invalid_same_source_target') row.selected = selected;
    }
  }
  function setCrossCopySelectionForAll(selected: boolean): void {
    for (const row of crossCopyRows.value) {
      if (row.status !== 'invalid_same_source_target') row.selected = selected;
    }
  }
  function applyCrossCopyBulkAction(action = crossCopyBulkAction.value): void {
    for (const row of crossCopyRows.value) {
      if (row.status === 'invalid_same_source_target') continue;
      row.action = action;
      if (action === 'rename_create') ensureCrossCopyRenameForRow(row);
    }
  }
  function applyCrossCopyActionByStatus(status: CrossCopyRowStatus, action: CrossCopyAction): void {
    for (const row of crossCopyRows.value) {
      if (row.status !== status) continue;
      row.action = action;
      if (action === 'rename_create') ensureCrossCopyRenameForRow(row);
    }
  }
  function onCrossCopyRowActionChange(row: CrossCopyRow): void {
    if (row.action === 'rename_create') ensureCrossCopyRenameForRow(row);
  }
  function onCrossCopyRowRenameBlur(row: CrossCopyRow): void {
    ensureCrossCopyRenameForRow(row);
  }

  // ── Apply ─────────────────────────────────────────────────────────
  async function applyCrossCopySelection(): Promise<void> {
    if (!crossCopySourceWorldbook.value || !crossCopyTargetWorldbook.value) {
      toastr.warning('请先选择来源与目标世界书');
      return;
    }
    if (crossCopySourceWorldbook.value === crossCopyTargetWorldbook.value) {
      toastr.warning('来源和目标不能相同');
      return;
    }
    const selectedRows = crossCopyRows.value.filter(row => row.selected);
    if (!selectedRows.length) {
      toastr.warning('请至少勾选一条来源条目');
      return;
    }
    if (crossCopyApplyLoading.value) return;

    if (crossCopyTargetWorldbook.value === selectedWorldbookName.value && hasUnsavedChanges.value) {
      setStatus('目标为当前世界书，正在自动保存未保存修改...');
      await saveCurrentWorldbook();
      if (hasUnsavedChanges.value) {
        toastr.error('自动保存失败，请先处理保存问题后再执行复制');
        return;
      }
    }

    crossCopyApplyLoading.value = true;
    try {
      const targetName = crossCopyTargetWorldbook.value;
      const targetEntries = await getWorldbook(targetName);

      if (crossCopySnapshotBeforeApply.value) {
        pushSnapshotForWorldbook(targetName, targetEntries, '跨书复制前快照');
      }

      const resultEntries = [...targetEntries];
      let created = 0;
      let overwritten = 0;
      let skipped = 0;

      for (const row of selectedRows) {
        if (row.action === 'skip') { skipped += 1; continue; }
        const source = klona(row.source_entry);
        if (row.action === 'create' || row.action === 'rename_create') {
          if (row.action === 'rename_create' && row.rename_name.trim()) {
            source.name = row.rename_name.trim();
          }
          source.uid = Math.max(0, ...resultEntries.map(e => e.uid)) + 1;
          resultEntries.push(normalizeEntry(source, source.uid));
          created += 1;
        } else if (row.action === 'overwrite') {
          const targetIdx = resultEntries.findIndex(e => normalizeCrossCopyNameKey(e.name) === row.source_name_key);
          if (targetIdx >= 0) {
            source.uid = resultEntries[targetIdx].uid;
            resultEntries[targetIdx] = normalizeEntry(source, source.uid);
            overwritten += 1;
          } else {
            source.uid = Math.max(0, ...resultEntries.map(e => e.uid)) + 1;
            resultEntries.push(normalizeEntry(source, source.uid));
            created += 1;
          }
        }
      }

      await createOrReplaceWorldbook(targetName, resultEntries);

      const summary = `跨书复制完成：新增 ${created} / 覆盖 ${overwritten} / 跳过 ${skipped}`;
      crossCopyLastResultSummary.value = summary;
      setStatus(summary);
      toastr.success(summary);

      if (targetName === selectedWorldbookName.value) {
        await loadWorldbook(targetName);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toastr.error(`跨书复制失败: ${msg}`);
    } finally {
      crossCopyApplyLoading.value = false;
    }
  }

  // ── Diff modal ────────────────────────────────────────────────────
  function openCrossCopyDiff(row: CrossCopyRow): void {
    crossCopyDiffRowId.value = row.id;
    showCrossCopyDiffModal.value = true;
  }
  function closeCrossCopyDiff(): void {
    showCrossCopyDiffModal.value = false;
    crossCopyDiffRowId.value = '';
  }

  // ── Mode toggle ───────────────────────────────────────────────────
  function setCrossCopyModeActive(next: boolean): void {
    if (!next) {
      crossCopyMode.value = false;
      persistCrossCopyState();
      return;
    }
    crossCopyMode.value = true;
    normalizeCrossCopyWorldbookSelection();
  }
  function toggleCrossCopyMode(): void {
    if (isAnyCineLocked.value) return;
    setCrossCopyModeActive(!crossCopyMode.value);
  }
  function toggleCrossCopyWorkspaceTools(): void {
    if (isAnyCineLocked.value) return;
    crossCopyWorkspaceToolsExpanded.value = !crossCopyWorkspaceToolsExpanded.value;
  }
  function toggleCrossCopyControlsCollapsed(): void {
    crossCopyControlsCollapsed.value = !crossCopyControlsCollapsed.value;
  }

  // ── Persistence ───────────────────────────────────────────────────
  function normalizeCrossCopyWorldbookSelection(): void {
    const names = worldbookNames.value;
    if (!names.length) {
      crossCopySourceWorldbook.value = '';
      crossCopyTargetWorldbook.value = '';
      return;
    }
    if (!crossCopySourceWorldbook.value || !names.includes(crossCopySourceWorldbook.value)) {
      crossCopySourceWorldbook.value = selectedWorldbookName.value && names.includes(selectedWorldbookName.value)
        ? selectedWorldbookName.value
        : names[0];
    }
    if (!crossCopyTargetWorldbook.value || !names.includes(crossCopyTargetWorldbook.value)) {
      const firstDifferent = names.find(name => name !== crossCopySourceWorldbook.value) ?? names[0];
      crossCopyTargetWorldbook.value = firstDifferent;
    }
  }

  function applyCrossCopyStateFromPersisted(): void {
    const state = normalizeCrossCopyPersistState(persistedState.value.cross_copy);
    crossCopySourceWorldbook.value = state.last_source_worldbook;
    crossCopyTargetWorldbook.value = state.last_target_worldbook;
    crossCopyUseDraftSourceWhenCurrent.value = state.use_draft_source_when_current;
    crossCopySnapshotBeforeApply.value = state.snapshot_before_apply;
    crossCopyDesktopLeftWidth.value = state.desktop_left_width;
    crossCopyControlsCollapsed.value = state.controls_collapsed;
    crossCopyWorkspaceToolsExpanded.value = state.workspace_tools_expanded;
  }

  function persistCrossCopyState(): void {
    updatePersistedState(state => {
      state.cross_copy = {
        last_source_worldbook: crossCopySourceWorldbook.value,
        last_target_worldbook: crossCopyTargetWorldbook.value,
        use_draft_source_when_current: crossCopyUseDraftSourceWhenCurrent.value,
        snapshot_before_apply: crossCopySnapshotBeforeApply.value,
        desktop_left_width: crossCopyDesktopLeftWidthClamped.value,
        controls_collapsed: crossCopyControlsCollapsed.value,
        workspace_tools_expanded: crossCopyWorkspaceToolsExpanded.value,
      };
    });
  }

  // ── Pane resize ────────────────────────────────────────────────────
  function startCrossCopyPaneResize(event: PointerEvent): void {
    if (isAnyCineLocked.value || isMobile.value) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.currentTarget as HTMLElement | null;
    const hostDoc = target?.ownerDocument ?? document;
    const hostWin = hostDoc.defaultView ?? window;
    crossCopyPaneResizeState.value = { pointerId: event.pointerId, doc: hostDoc, win: hostWin };
    target?.setPointerCapture?.(event.pointerId);
    hostDoc.addEventListener('pointermove', onCrossCopyPaneResizeMove);
    hostDoc.addEventListener('pointerup', stopCrossCopyPaneResize);
    hostDoc.addEventListener('pointercancel', stopCrossCopyPaneResize);
    hostWin.addEventListener('blur', stopCrossCopyPaneResize);
    event.preventDefault();
  }
  function onCrossCopyPaneResizeMove(event: PointerEvent): void {
    const state = crossCopyPaneResizeState.value;
    if (!state || state.pointerId !== event.pointerId) return;
    const grid = crossCopyGridRef.value;
    if (!grid) return;
    const rect = grid.getBoundingClientRect();
    const x = event.clientX - rect.left;
    crossCopyDesktopLeftWidth.value = clampNumber(x, CROSS_COPY_DESKTOP_LEFT_MIN, CROSS_COPY_DESKTOP_LEFT_MAX);
  }
  function stopCrossCopyPaneResize(): void {
    const state = crossCopyPaneResizeState.value;
    if (state) {
      state.doc.removeEventListener('pointermove', onCrossCopyPaneResizeMove);
      state.doc.removeEventListener('pointerup', stopCrossCopyPaneResize);
      state.doc.removeEventListener('pointercancel', stopCrossCopyPaneResize);
      state.win.removeEventListener('blur', stopCrossCopyPaneResize);
    }
    crossCopyPaneResizeState.value = null;
    persistCrossCopyState();
  }

  // ── Mobile steps ──────────────────────────────────────────────────
  function canEnterCrossCopyMobileStep(step: CrossCopyMobileStep): boolean {
    if (step <= 1) return true;
    if (step === 2) return crossCopyMobileCanGoStep2.value;
    return crossCopyMobileCanGoStep3.value;
  }
  function goToCrossCopyMobileStep(step: CrossCopyMobileStep): void {
    if (step === crossCopyMobileStep.value) return;
    if (!canEnterCrossCopyMobileStep(step)) {
      toastr.info('请先完成比较，再继续下一步');
      return;
    }
    crossCopyMobileStep.value = step;
  }
  function goToPreviousCrossCopyMobileStep(): void {
    crossCopyMobileStep.value = clampNumber(crossCopyMobileStep.value - 1, 1, 3) as CrossCopyMobileStep;
  }
  function goToNextCrossCopyMobileStep(): void {
    goToCrossCopyMobileStep(clampNumber(crossCopyMobileStep.value + 1, 1, 3) as CrossCopyMobileStep);
  }

  return {
    crossCopyMode, crossCopySourceWorldbook, crossCopyTargetWorldbook,
    crossCopyUseDraftSourceWhenCurrent, crossCopySnapshotBeforeApply,
    crossCopyControlsCollapsed, crossCopyWorkspaceToolsExpanded,
    crossCopyDesktopLeftWidth, crossCopyRows, crossCopySourceBaselineEntries,
    crossCopyTargetBaselineEntries, crossCopyCompareLoading, crossCopyApplyLoading,
    crossCopySearchText, crossCopyStatusFilter, crossCopyBulkAction,
    crossCopyCompareSummary, crossCopyLastResultSummary, crossCopyLastComparedAt,
    crossCopyPaneResizeState, crossCopyGridRef, crossCopyMobileStep,
    showCrossCopyDiffModal, crossCopyDiffRowId,
    crossCopyDesktopLeftWidthClamped, crossCopySourceIsCurrentWorldbook,
    crossCopySourceVersionLabel, crossCopyHasCompared, crossCopyWorkspaceSummary,
    crossCopySourceTargetInvalid, crossCopySourceRowsFiltered, crossCopyRowsFiltered,
    crossCopySelectedRows, crossCopyStatusCounts, crossCopySelectedCount,
    crossCopyCanCompare, crossCopyMobileCanGoStep2, crossCopyMobileCanGoStep3,
    crossCopyDiffActiveRow, crossCopyDiffFieldRows, crossCopyDiffTextResult,
    normalizeCrossCopyWorldbookSelection, applyCrossCopyStateFromPersisted,
    persistCrossCopyState, getCrossCopyStatusLabel, getCrossCopyActionLabel,
    getCrossCopyStatusBadgeClass, getCrossCopyEntryProfile,
    getCrossCopyPrimaryTargetMatch, getCrossCopyRowDiffSummary,
    getCrossCopyPreviewText, refreshCrossCopyComparison,
    setCrossCopySelectionForFiltered, setCrossCopySelectionForAll,
    applyCrossCopyBulkAction, applyCrossCopyActionByStatus,
    onCrossCopyRowActionChange, onCrossCopyRowRenameBlur,
    applyCrossCopySelection, openCrossCopyDiff, closeCrossCopyDiff,
    toggleCrossCopyWorkspaceTools, toggleCrossCopyControlsCollapsed,
    setCrossCopyModeActive, toggleCrossCopyMode,
    startCrossCopyPaneResize, goToCrossCopyMobileStep,
    stopCrossCopyPaneResize,
    goToPreviousCrossCopyMobileStep, goToNextCrossCopyMobileStep,
  };
}
