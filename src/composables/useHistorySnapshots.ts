/**
 * Composable: History Snapshots
 * - Worldbook snapshot CRUD (push/restore/delete/clear)
 * - Entry snapshot CRUD (push/restore/delete/clear)
 * - Version views (current + baseline + history)
 * - History comparison (field diff + content diff)
 * - History modal state
 * - History section resize
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { createId, normalizeEntry, normalizeEntryList, clampNumber } from '../utils';
import { HISTORY_LIMIT, ENTRY_HISTORY_LIMIT } from '../store/persistedState';
import {
  buildEntryFieldDiffRows,
  buildCrossCopyTextDiff,
  buildWorldbookHistoryCompareRows,
  getEntryVersionDiffSummary,
} from '../diffUtils';
import type {
  PersistedState,
  WorldbookSnapshot,
  EntrySnapshot,
  EntryVersionView,
  WorldbookVersionView,
  WorldbookHistoryCompareRow,
  CrossCopyFieldDiffRow,
  CrossCopyTextDiffResult,
  HistoryResizeTarget,
  HistorySectionResizeState,
} from '../types';

declare const klona: <T>(val: T) => T;

export interface UseHistorySnapshotsOptions {
  persistedState: Ref<PersistedState>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
  setStatus: (msg: string) => void;
  selectedWorldbookName: Ref<string>;
  draftEntries: Ref<WorldbookEntry[]>;
  originalEntries: Ref<WorldbookEntry[]>;
  selectedEntry: ComputedRef<WorldbookEntry | null>;
  selectedEntryIndex: ComputedRef<number>;
  selectedEntryUid: Ref<number | null>;
  ensureSelectedEntryExists: () => void;
  canResizeHistorySections: ComputedRef<boolean>;
}

export interface UseHistorySnapshotsReturn {
  // Modal state
  showEntryHistoryModal: Ref<boolean>;
  showWorldbookHistoryModal: Ref<boolean>;
  entryHistoryLeftId: Ref<string>;
  entryHistoryRightId: Ref<string>;
  worldbookHistoryLeftId: Ref<string>;
  worldbookHistoryRightId: Ref<string>;
  worldbookHistoryActiveRowKey: Ref<string>;
  entryHistoryLayoutRef: Ref<HTMLElement | null>;
  worldbookHistoryLayoutRef: Ref<HTMLElement | null>;
  entryHistorySectionRatios: Ref<[number, number, number]>;
  worldbookHistorySectionRatios: Ref<[number, number, number]>;
  historySectionResizeState: Ref<HistorySectionResizeState | null>;

  // Computed — snapshots
  snapshotsForCurrent: ComputedRef<WorldbookSnapshot[]>;
  entrySnapshotsForSelected: ComputedRef<EntrySnapshot[]>;

  // Computed — version views
  entryVersionViews: ComputedRef<EntryVersionView[]>;
  worldbookVersionViews: ComputedRef<WorldbookVersionView[]>;
  selectedEntryHistoryLeft: ComputedRef<EntryVersionView | null>;
  selectedEntryHistoryRight: ComputedRef<EntryVersionView | null>;
  selectedWorldbookHistoryLeft: ComputedRef<WorldbookVersionView | null>;
  selectedWorldbookHistoryRight: ComputedRef<WorldbookVersionView | null>;
  canRestoreEntryFromLeft: ComputedRef<boolean>;
  canRestoreWorldbookFromLeft: ComputedRef<boolean>;

  // Computed — diffs
  entryHistoryFieldDiffRows: ComputedRef<CrossCopyFieldDiffRow[]>;
  entryHistoryContentDiff: ComputedRef<CrossCopyTextDiffResult>;
  entryHistoryFieldDiffSummary: ComputedRef<string>;
  entryHistoryContentDiffSummary: ComputedRef<string>;
  worldbookHistoryCompareRows: ComputedRef<WorldbookHistoryCompareRow[]>;
  worldbookHistoryCompareSummary: ComputedRef<string>;
  worldbookHistoryActiveRow: ComputedRef<WorldbookHistoryCompareRow | null>;
  worldbookHistoryFieldDiffRows: ComputedRef<CrossCopyFieldDiffRow[]>;
  worldbookHistoryFieldDiffSummary: ComputedRef<string>;
  worldbookHistoryContentDiff: ComputedRef<CrossCopyTextDiffResult>;
  worldbookHistoryContentDiffSummary: ComputedRef<string>;
  entryHistorySummary: ComputedRef<string>;

  // Snapshot push
  pushSnapshotForWorldbook: (worldbookName: string, entries: WorldbookEntry[], label: string) => void;
  pushSnapshot: (label: string) => void;
  createManualSnapshot: () => void;
  createEntrySnapshotRecord: (label: string, uid: number, name: string, entry: WorldbookEntry) => EntrySnapshot;
  pushEntrySnapshotsBulk: (items: Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }>) => number;
  pushEntrySnapshot: (label: string, entry: WorldbookEntry) => boolean;
  collectEntrySnapshotsBeforeSave: () => Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }>;

  // Snapshot restore/delete
  restoreSnapshot: (snapshotId: string) => void;
  restoreWorldbookFromLeftHistory: () => void;
  deleteSnapshot: (snapshotId: string) => void;
  clearCurrentSnapshots: () => void;
  restoreEntrySnapshot: (snapshotId: string) => void;
  restoreEntryFromLeftHistory: () => void;
  deleteEntrySnapshot: (snapshotId: string) => void;
  clearCurrentEntrySnapshots: () => void;
  createManualEntrySnapshot: () => void;

  // History modals
  openEntryHistoryModal: () => void;
  openWorldbookHistoryModal: () => void;

  // History section resize
  getHistorySectionRatios: (target: HistoryResizeTarget) => [number, number, number];
  setHistorySectionRatios: (target: HistoryResizeTarget, next: [number, number, number]) => void;
  getHistorySectionStyle: (target: HistoryResizeTarget, sectionIndex: 0 | 1 | 2) => Record<string, string> | undefined;
  startHistorySectionResize: (target: HistoryResizeTarget, handleIndex: 0 | 1, event: PointerEvent) => void;
  stopHistorySectionResize: () => void;
}

export function useHistorySnapshots(options: UseHistorySnapshotsOptions): UseHistorySnapshotsReturn {
  const {
    persistedState, updatePersistedState, setStatus,
    selectedWorldbookName, draftEntries, originalEntries,
    selectedEntry, selectedEntryIndex, selectedEntryUid,
    ensureSelectedEntryExists, canResizeHistorySections,
  } = options;

  // ── Modal state ───────────────────────────────────────────────────
  const showEntryHistoryModal = ref(false);
  const showWorldbookHistoryModal = ref(false);
  const entryHistoryLeftId = ref('');
  const entryHistoryRightId = ref('');
  const worldbookHistoryLeftId = ref('');
  const worldbookHistoryRightId = ref('');
  const worldbookHistoryActiveRowKey = ref('');
  const entryHistoryLayoutRef = ref<HTMLElement | null>(null);
  const worldbookHistoryLayoutRef = ref<HTMLElement | null>(null);
  const entryHistorySectionRatios = ref<[number, number, number]>([24, 34, 42]);
  const worldbookHistorySectionRatios = ref<[number, number, number]>([24, 32, 44]);
  const historySectionResizeState = ref<HistorySectionResizeState | null>(null);

  // ── Computed: snapshots ────────────────────────────────────────────
  const snapshotsForCurrent = computed(() => {
    if (!selectedWorldbookName.value) return [];
    return persistedState.value.history[selectedWorldbookName.value] ?? [];
  });

  const entrySnapshotsForSelected = computed(() => {
    if (!selectedWorldbookName.value || !selectedEntry.value) return [];
    const byWorldbook = persistedState.value.entry_history[selectedWorldbookName.value] ?? {};
    return byWorldbook[String(selectedEntry.value.uid)] ?? [];
  });

  // ── Computed: version views ────────────────────────────────────────
  const entryVersionViews = computed<EntryVersionView[]>(() => {
    if (!selectedEntry.value) return [];
    const baselineEntry = originalEntries.value.find(item => item.uid === selectedEntry.value?.uid) ?? null;
    const current: EntryVersionView = {
      id: '__current__', label: '当前版本', ts: Date.now(),
      name: selectedEntry.value.name, entry: selectedEntry.value, isCurrent: true,
    };
    const baseline = baselineEntry
      ? ({ id: '__baseline__', label: '加载基线', ts: 0, name: baselineEntry.name, entry: baselineEntry, isCurrent: false } satisfies EntryVersionView)
      : null;
    const history = entrySnapshotsForSelected.value.map(item => ({
      id: item.id, label: item.label, ts: item.ts, name: item.name, entry: item.entry, isCurrent: false,
    }));
    return [current, ...(baseline ? [baseline] : []), ...history];
  });

  const worldbookVersionViews = computed<WorldbookVersionView[]>(() => {
    if (!selectedWorldbookName.value) return [];
    const current: WorldbookVersionView = {
      id: '__current__', label: '当前草稿', ts: Date.now(), entries: draftEntries.value, isCurrent: true,
    };
    const baseline: WorldbookVersionView | null = {
      id: '__baseline__', label: '加载基线', ts: 0, entries: originalEntries.value, isCurrent: false,
    };
    const history = snapshotsForCurrent.value.map(item => ({
      id: item.id, label: item.label, ts: item.ts, entries: item.entries, isCurrent: false,
    }));
    return [current, ...(originalEntries.value.length ? [baseline] : []), ...history];
  });

  const selectedEntryHistoryLeft = computed(() => entryVersionViews.value.find(item => item.id === entryHistoryLeftId.value) ?? null);
  const selectedEntryHistoryRight = computed(() => entryVersionViews.value.find(item => item.id === entryHistoryRightId.value) ?? null);
  const canRestoreEntryFromLeft = computed(() => Boolean(selectedEntry.value && selectedEntryHistoryLeft.value && !selectedEntryHistoryLeft.value.isCurrent));
  const selectedWorldbookHistoryLeft = computed(() => worldbookVersionViews.value.find(item => item.id === worldbookHistoryLeftId.value) ?? null);
  const selectedWorldbookHistoryRight = computed(() => worldbookVersionViews.value.find(item => item.id === worldbookHistoryRightId.value) ?? null);
  const canRestoreWorldbookFromLeft = computed(() => Boolean(selectedWorldbookHistoryLeft.value && !selectedWorldbookHistoryLeft.value.isCurrent));

  // ── Computed: diffs ───────────────────────────────────────────────
  const entryHistoryFieldDiffRows = computed<CrossCopyFieldDiffRow[]>(() =>
    buildEntryFieldDiffRows(selectedEntryHistoryLeft.value?.entry ?? null, selectedEntryHistoryRight.value?.entry ?? null, { left_fallback: '（不存在）', right_fallback: '（不存在）' }),
  );
  const entryHistoryContentDiff = computed<CrossCopyTextDiffResult>(() => {
    const left = selectedEntryHistoryLeft.value?.entry?.content ?? '';
    const right = selectedEntryHistoryRight.value?.entry?.content ?? '';
    return buildCrossCopyTextDiff(String(left), String(right));
  });
  const entryHistoryFieldDiffSummary = computed(() => {
    const rows = entryHistoryFieldDiffRows.value;
    if (!rows.length) return '无可对比字段';
    return `不同字段 ${rows.filter(row => row.changed).length} / ${rows.length}`;
  });
  const entryHistoryContentDiffSummary = computed(() => {
    const result = entryHistoryContentDiff.value;
    return `新增行 ${result.added} / 修改行 ${result.changed} / 删除行 ${result.removed}`;
  });

  const worldbookHistoryCompareRows = computed<WorldbookHistoryCompareRow[]>(() =>
    buildWorldbookHistoryCompareRows(selectedWorldbookHistoryLeft.value, selectedWorldbookHistoryRight.value),
  );
  const worldbookHistoryCompareSummary = computed(() => {
    let added = 0, removed = 0, changed = 0;
    for (const row of worldbookHistoryCompareRows.value) {
      if (row.status === 'added') added += 1;
      else if (row.status === 'removed') removed += 1;
      else changed += 1;
    }
    return `新增 ${added} / 修改 ${changed} / 删除 ${removed}`;
  });
  const worldbookHistoryActiveRow = computed(() => {
    if (!worldbookHistoryActiveRowKey.value) return null;
    return worldbookHistoryCompareRows.value.find(row => row.key === worldbookHistoryActiveRowKey.value) ?? null;
  });
  const worldbookHistoryFieldDiffRows = computed<CrossCopyFieldDiffRow[]>(() =>
    buildEntryFieldDiffRows(worldbookHistoryActiveRow.value?.left_entry ?? null, worldbookHistoryActiveRow.value?.right_entry ?? null, { left_fallback: '（不存在）', right_fallback: '（不存在）' }),
  );
  const worldbookHistoryFieldDiffSummary = computed(() => {
    const rows = worldbookHistoryFieldDiffRows.value;
    if (!rows.length) return '无可对比字段';
    return `不同字段 ${rows.filter(row => row.changed).length} / ${rows.length}`;
  });
  const worldbookHistoryContentDiff = computed<CrossCopyTextDiffResult>(() => {
    const left = worldbookHistoryActiveRow.value?.left_entry?.content ?? '';
    const right = worldbookHistoryActiveRow.value?.right_entry?.content ?? '';
    return buildCrossCopyTextDiff(String(left), String(right));
  });
  const worldbookHistoryContentDiffSummary = computed(() => {
    const result = worldbookHistoryContentDiff.value;
    return `新增行 ${result.added} / 修改行 ${result.changed} / 删除行 ${result.removed}`;
  });
  const entryHistorySummary = computed(() => getEntryVersionDiffSummary(selectedEntryHistoryLeft.value, selectedEntryHistoryRight.value));

  // ── Snapshot push ─────────────────────────────────────────────────
  function pushSnapshotForWorldbook(worldbookName: string, entries: WorldbookEntry[], label: string): void {
    if (!worldbookName) return;
    const snapshot: WorldbookSnapshot = {
      id: createId('snapshot'),
      label,
      ts: Date.now(),
      entries: normalizeEntryList(entries.map(entry => klona(entry))),
    };
    updatePersistedState(state => {
      const list = state.history[worldbookName] ?? [];
      list.unshift(snapshot);
      if (list.length > HISTORY_LIMIT) list.length = HISTORY_LIMIT;
      state.history[worldbookName] = list;
    });
  }

  function pushSnapshot(label: string): void {
    if (!selectedWorldbookName.value) return;
    pushSnapshotForWorldbook(selectedWorldbookName.value, draftEntries.value, label);
  }

  function createManualSnapshot(): void {
    if (!selectedWorldbookName.value) {
      toastr.warning('请先选择世界书');
      return;
    }
    pushSnapshot('手动快照');
    toastr.success('已创建快照');
  }

  function createEntrySnapshotRecord(label: string, uid: number, name: string, entry: WorldbookEntry): EntrySnapshot {
    return {
      id: createId('entry-snapshot'),
      label,
      ts: Date.now(),
      uid,
      name: name || `条目 ${uid}`,
      entry: normalizeEntry(klona(entry), uid),
    };
  }

  function pushEntrySnapshotsBulk(
    items: Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }>,
  ): number {
    if (!selectedWorldbookName.value || !items.length) return 0;
    let added = 0;
    const worldbookName = selectedWorldbookName.value;
    updatePersistedState(state => {
      const byWorldbook = state.entry_history[worldbookName] ?? {};
      for (const item of items) {
        const uidKey = String(item.uid);
        const incoming = createEntrySnapshotRecord(item.label, item.uid, item.name, item.entry);
        const list = byWorldbook[uidKey] ?? [];
        if (list[0] && JSON.stringify(list[0].entry) === JSON.stringify(incoming.entry)) continue;
        list.unshift(incoming);
        if (list.length > ENTRY_HISTORY_LIMIT) list.length = ENTRY_HISTORY_LIMIT;
        byWorldbook[uidKey] = list;
        added += 1;
      }
      state.entry_history[worldbookName] = byWorldbook;
    });
    return added;
  }

  function pushEntrySnapshot(label: string, entry: WorldbookEntry): boolean {
    return pushEntrySnapshotsBulk([{ label, uid: entry.uid, name: entry.name, entry }]) > 0;
  }

  function collectEntrySnapshotsBeforeSave(): Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }> {
    const result: Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }> = [];
    const draftByUid = new Map<number, WorldbookEntry>();
    draftEntries.value.forEach(entry => draftByUid.set(entry.uid, entry));
    for (const previous of originalEntries.value) {
      const current = draftByUid.get(previous.uid);
      if (!current) {
        result.push({ label: '保存前（删除前）', uid: previous.uid, name: previous.name, entry: previous });
        continue;
      }
      if (JSON.stringify(previous) !== JSON.stringify(current)) {
        result.push({ label: '保存前', uid: previous.uid, name: previous.name, entry: previous });
      }
    }
    return result;
  }

  // ── Snapshot restore/delete ───────────────────────────────────────
  function restoreSnapshot(snapshotId: string): void {
    const snapshot = snapshotsForCurrent.value.find(item => item.id === snapshotId);
    if (!snapshot) return;
    if (!confirm(`回滚到快照 "${snapshot.label}" ? 当前未保存修改会被覆盖。`)) return;
    draftEntries.value = normalizeEntryList(snapshot.entries);
    ensureSelectedEntryExists();
    setStatus(`已回滚到快照：${snapshot.label}`);
  }

  function restoreWorldbookFromLeftHistory(): void {
    const target = selectedWorldbookHistoryLeft.value;
    if (!target || target.isCurrent) return;
    if (!confirm(`恢复到 Left 版本 "${target.label}" ? 当前未保存修改会被覆盖。`)) return;
    draftEntries.value = normalizeEntryList(klona(target.entries));
    ensureSelectedEntryExists();
    setStatus(`已从时光机恢复：${target.label}`);
    toastr.success('已恢复整本世界书到 Left 版本');
  }

  function deleteSnapshot(snapshotId: string): void {
    if (!selectedWorldbookName.value) return;
    updatePersistedState(state => {
      const list = state.history[selectedWorldbookName.value] ?? [];
      state.history[selectedWorldbookName.value] = list.filter(item => item.id !== snapshotId);
    });
  }

  function clearCurrentSnapshots(): void {
    if (!selectedWorldbookName.value || !snapshotsForCurrent.value.length) return;
    if (!confirm(`清空 "${selectedWorldbookName.value}" 的全部快照？`)) return;
    updatePersistedState(state => { delete state.history[selectedWorldbookName.value]; });
  }

  function restoreEntrySnapshot(snapshotId: string): void {
    if (!selectedEntry.value || selectedEntryIndex.value < 0) return;
    const snapshot = entrySnapshotsForSelected.value.find(item => item.id === snapshotId);
    if (!snapshot) return;
    if (!confirm(`回滚当前条目到快照 "${snapshot.label}" ?`)) return;
    pushEntrySnapshot('回滚前自动快照', selectedEntry.value);
    const restored = normalizeEntry(klona(snapshot.entry), selectedEntry.value.uid);
    restored.uid = selectedEntry.value.uid;
    draftEntries.value.splice(selectedEntryIndex.value, 1, restored);
    selectedEntryUid.value = restored.uid;
    setStatus(`已回滚条目到快照：${snapshot.label}`);
    toastr.success('已恢复条目快照');
  }

  function restoreEntryFromLeftHistory(): void {
    const target = selectedEntryHistoryLeft.value;
    if (!target || target.isCurrent) return;
    if (!selectedEntry.value || selectedEntryIndex.value < 0) return;
    if (!confirm(`回滚当前条目到 "${target.label}" ?`)) return;
    pushEntrySnapshot('回滚前自动快照', selectedEntry.value);
    const restored = normalizeEntry(klona(target.entry), selectedEntry.value.uid);
    restored.uid = selectedEntry.value.uid;
    draftEntries.value.splice(selectedEntryIndex.value, 1, restored);
    selectedEntryUid.value = restored.uid;
    setStatus(`已从条目时光机恢复：${target.label}`);
    toastr.success('已恢复条目到 Left 版本');
  }

  function deleteEntrySnapshot(snapshotId: string): void {
    if (!selectedWorldbookName.value || !selectedEntry.value) return;
    const worldbookName = selectedWorldbookName.value;
    const uidKey = String(selectedEntry.value.uid);
    updatePersistedState(state => {
      const byWorldbook = state.entry_history[worldbookName] ?? {};
      byWorldbook[uidKey] = (byWorldbook[uidKey] ?? []).filter(item => item.id !== snapshotId);
      state.entry_history[worldbookName] = byWorldbook;
    });
  }

  function clearCurrentEntrySnapshots(): void {
    if (!selectedWorldbookName.value || !selectedEntry.value || !entrySnapshotsForSelected.value.length) return;
    if (!confirm(`清空条目 #${selectedEntry.value.uid} 的历史快照？`)) return;
    const worldbookName = selectedWorldbookName.value;
    const uidKey = String(selectedEntry.value.uid);
    updatePersistedState(state => {
      const byWorldbook = state.entry_history[worldbookName] ?? {};
      delete byWorldbook[uidKey];
      state.entry_history[worldbookName] = byWorldbook;
    });
  }

  function createManualEntrySnapshot(): void {
    if (!selectedEntry.value) {
      toastr.warning('请先选择条目');
      return;
    }
    const added = pushEntrySnapshot('手动条目快照', selectedEntry.value);
    if (added) {
      toastr.success('已记录当前条目快照');
    } else {
      toastr.info('当前条目与最近快照一致，未重复记录');
    }
  }

  // ── History modals ────────────────────────────────────────────────
  function openEntryHistoryModal(): void {
    if (!selectedEntry.value) {
      toastr.warning('请先选择条目');
      return;
    }
    const nonCurrent = entryVersionViews.value.find(item => !item.isCurrent) ?? null;
    entryHistoryRightId.value = '__current__';
    entryHistoryLeftId.value = nonCurrent?.id ?? '__current__';
    showEntryHistoryModal.value = true;
  }

  function openWorldbookHistoryModal(): void {
    if (!selectedWorldbookName.value) {
      toastr.warning('请先选择世界书');
      return;
    }
    const nonCurrent = worldbookVersionViews.value.find(item => !item.isCurrent) ?? null;
    worldbookHistoryRightId.value = '__current__';
    worldbookHistoryLeftId.value = nonCurrent?.id ?? '__current__';
    worldbookHistoryActiveRowKey.value = worldbookHistoryCompareRows.value[0]?.key ?? '';
    showWorldbookHistoryModal.value = true;
  }

  // ── History section resize ────────────────────────────────────────
  function getHistorySectionRatios(target: HistoryResizeTarget): [number, number, number] {
    return target === 'entry' ? entryHistorySectionRatios.value : worldbookHistorySectionRatios.value;
  }

  function setHistorySectionRatios(target: HistoryResizeTarget, next: [number, number, number]): void {
    const normalized: [number, number, number] = [
      Number(next[0].toFixed(2)),
      Number(next[1].toFixed(2)),
      Number(next[2].toFixed(2)),
    ];
    const delta = Number((100 - (normalized[0] + normalized[1] + normalized[2])).toFixed(2));
    normalized[2] = Number((normalized[2] + delta).toFixed(2));
    if (target === 'entry') {
      entryHistorySectionRatios.value = normalized;
    } else {
      worldbookHistorySectionRatios.value = normalized;
    }
  }

  function getHistorySectionStyle(target: HistoryResizeTarget, sectionIndex: 0 | 1 | 2): Record<string, string> | undefined {
    if (!canResizeHistorySections.value) return undefined;
    const ratios = getHistorySectionRatios(target);
    return { flex: `0 0 ${ratios[sectionIndex]}%` };
  }

  function onHistorySectionResizeMove(event: PointerEvent): void {
    const state = historySectionResizeState.value;
    if (!state || state.pointerId !== event.pointerId) return;
    const deltaPercent = ((event.clientY - state.startY) / state.containerHeight) * 100;
    const minPercent = 14;
    const [a, b, c] = state.startRatios;
    if (state.handleIndex === 0) {
      const nextA = clampNumber(a + deltaPercent, minPercent, 100 - minPercent - c);
      const nextB = 100 - nextA - c;
      setHistorySectionRatios(state.target, [nextA, nextB, c]);
      return;
    }
    const nextB = clampNumber(b + deltaPercent, minPercent, 100 - minPercent - a);
    const nextC = 100 - a - nextB;
    setHistorySectionRatios(state.target, [a, nextB, nextC]);
  }

  function stopHistorySectionResize(): void {
    const state = historySectionResizeState.value;
    if (!state) return;
    state.doc.removeEventListener('pointermove', onHistorySectionResizeMove);
    state.doc.removeEventListener('pointerup', stopHistorySectionResize);
    state.doc.removeEventListener('pointercancel', stopHistorySectionResize);
    state.win.removeEventListener('blur', stopHistorySectionResize);
    historySectionResizeState.value = null;
  }

  function startHistorySectionResize(target: HistoryResizeTarget, handleIndex: 0 | 1, event: PointerEvent): void {
    if (!canResizeHistorySections.value) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const container = target === 'entry' ? entryHistoryLayoutRef.value : worldbookHistoryLayoutRef.value;
    const containerHeight = container?.getBoundingClientRect().height ?? 0;
    if (!container || containerHeight < 120) return;
    const trigger = event.currentTarget as HTMLElement | null;
    const hostDoc = trigger?.ownerDocument ?? document;
    const hostWin = hostDoc.defaultView ?? window;
    historySectionResizeState.value = {
      target, handleIndex, pointerId: event.pointerId, startY: event.clientY,
      containerHeight, startRatios: [...getHistorySectionRatios(target)] as [number, number, number],
      doc: hostDoc, win: hostWin,
    };
    trigger?.setPointerCapture?.(event.pointerId);
    hostDoc.addEventListener('pointermove', onHistorySectionResizeMove);
    hostDoc.addEventListener('pointerup', stopHistorySectionResize);
    hostDoc.addEventListener('pointercancel', stopHistorySectionResize);
    hostWin.addEventListener('blur', stopHistorySectionResize);
    event.preventDefault();
  }

  return {
    showEntryHistoryModal, showWorldbookHistoryModal,
    entryHistoryLeftId, entryHistoryRightId,
    worldbookHistoryLeftId, worldbookHistoryRightId, worldbookHistoryActiveRowKey,
    entryHistoryLayoutRef, worldbookHistoryLayoutRef,
    entryHistorySectionRatios, worldbookHistorySectionRatios, historySectionResizeState,
    snapshotsForCurrent, entrySnapshotsForSelected,
    entryVersionViews, worldbookVersionViews,
    selectedEntryHistoryLeft, selectedEntryHistoryRight,
    selectedWorldbookHistoryLeft, selectedWorldbookHistoryRight,
    canRestoreEntryFromLeft, canRestoreWorldbookFromLeft,
    entryHistoryFieldDiffRows, entryHistoryContentDiff,
    entryHistoryFieldDiffSummary, entryHistoryContentDiffSummary,
    worldbookHistoryCompareRows, worldbookHistoryCompareSummary,
    worldbookHistoryActiveRow,
    worldbookHistoryFieldDiffRows, worldbookHistoryFieldDiffSummary,
    worldbookHistoryContentDiff, worldbookHistoryContentDiffSummary,
    entryHistorySummary,
    pushSnapshotForWorldbook, pushSnapshot, createManualSnapshot,
    createEntrySnapshotRecord, pushEntrySnapshotsBulk, pushEntrySnapshot,
    collectEntrySnapshotsBeforeSave,
    restoreSnapshot, restoreWorldbookFromLeftHistory, deleteSnapshot, clearCurrentSnapshots,
    restoreEntrySnapshot, restoreEntryFromLeftHistory, deleteEntrySnapshot, clearCurrentEntrySnapshots,
    createManualEntrySnapshot,
    openEntryHistoryModal, openWorldbookHistoryModal,
    getHistorySectionRatios, setHistorySectionRatios, getHistorySectionStyle,
    startHistorySectionResize,
    stopHistorySectionResize,
  };
}
