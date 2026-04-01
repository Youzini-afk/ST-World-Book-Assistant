/**
 * Composable: worldbook data flow
 * - Worldbook load / reload / hard refresh
 * - Save current worldbook
 */

import { klona } from 'klona';
import type { ComputedRef, Ref } from 'vue';
import { getWorldbook, getWorldbookNames, replaceWorldbook } from '../hostApi';
import { normalizeEntryList } from '../utils';
import type { HardRefreshOptions, PersistedState, SelectionSource, WorldbookSwitchOptions } from '../types';

type ContextSelectionOptions = {
  preferWhenEmptyOnly?: boolean;
  source?: SelectionSource;
};

export interface UseWorldbookDataFlowOptions {
  selectedWorldbookName: Ref<string>;
  worldbookNames: Ref<string[]>;
  draftEntries: Ref<WorldbookEntry[]>;
  originalEntries: Ref<WorldbookEntry[]>;
  selectedEntryUid: Ref<number | null>;
  selectedKeysRaw: Ref<string>;
  selectedSecondaryKeysRaw: Ref<string>;
  selectedKeysText: ComputedRef<string>;
  selectedSecondaryKeysText: ComputedRef<string>;
  persistedState: Ref<PersistedState>;
  hasUnsavedChanges: ComputedRef<boolean>;
  isBusy: Ref<boolean>;
  isSaving: Ref<boolean>;
  setStatus: (message: string) => void;
  syncEntriesDigestNow: () => void;
  ensureSelectedEntryExists: () => void;
  normalizeCrossCopyWorldbookSelection: () => void;
  persistCrossCopyState: () => void;
  switchWorldbookSelection: (nextName: string, options?: WorldbookSwitchOptions) => boolean;
  ensureRefreshAllowed: (options?: HardRefreshOptions) => boolean;
  readPersistedState: () => PersistedState;
  syncSelectedGlobalPresetFromState: () => void;
  applyCrossCopyStateFromPersisted: () => void;
  refreshBindings: () => Promise<void>;
  refreshRoleBindingCandidates: () => void;
  refreshCurrentRoleContext: () => void;
  autoApplyRoleBoundPreset: () => Promise<void>;
  globalWorldbookMode: Ref<boolean>;
  ensureSelectionForGlobalMode: (options?: WorldbookSwitchOptions) => boolean;
  trySelectWorldbookByContext: (options?: ContextSelectionOptions) => boolean;
  collectEntrySnapshotsBeforeSave: () => any[];
  pushEntrySnapshotsBulk: (snapshots: any[]) => number;
  pushSnapshot: (label: string) => void;
}

export interface UseWorldbookDataFlowReturn {
  loadWorldbook: (name: string) => Promise<void>;
  reloadWorldbookNames: (preferred?: string, switchOptions?: WorldbookSwitchOptions) => Promise<boolean>;
  hardRefresh: (options?: HardRefreshOptions) => Promise<void>;
  saveCurrentWorldbook: () => Promise<void>;
}

export function useWorldbookDataFlow(options: UseWorldbookDataFlowOptions): UseWorldbookDataFlowReturn {
  const {
    selectedWorldbookName,
    worldbookNames,
    draftEntries,
    originalEntries,
    selectedEntryUid,
    selectedKeysRaw,
    selectedSecondaryKeysRaw,
    selectedKeysText,
    selectedSecondaryKeysText,
    persistedState,
    hasUnsavedChanges,
    isBusy,
    isSaving,
    setStatus,
    syncEntriesDigestNow,
    ensureSelectedEntryExists,
    normalizeCrossCopyWorldbookSelection,
    persistCrossCopyState,
    switchWorldbookSelection,
    ensureRefreshAllowed,
    readPersistedState,
    syncSelectedGlobalPresetFromState,
    applyCrossCopyStateFromPersisted,
    refreshBindings,
    refreshRoleBindingCandidates,
    refreshCurrentRoleContext,
    autoApplyRoleBoundPreset,
    globalWorldbookMode,
    ensureSelectionForGlobalMode,
    trySelectWorldbookByContext,
    collectEntrySnapshotsBeforeSave,
    pushEntrySnapshotsBulk,
    pushSnapshot,
  } = options;

  let worldbookLoadRequestId = 0;
  let pendingWorldbookLoadCount = 0;

  async function loadWorldbook(name: string): Promise<void> {
    if (!name) {
      return;
    }
    const requestId = ++worldbookLoadRequestId;
    pendingWorldbookLoadCount += 1;
    isBusy.value = true;
    const isStaleRequest = () => requestId !== worldbookLoadRequestId || selectedWorldbookName.value !== name;
    try {
      let rawEntries: WorldbookEntry[];
      try {
        rawEntries = await getWorldbook(name);
      } catch {
        // Fallback: try trimmed name in case of whitespace mismatch
        rawEntries = await getWorldbook(name.trim());
      }
      if (isStaleRequest()) {
        return;
      }
      const normalized = normalizeEntryList(rawEntries);
      draftEntries.value = klona(normalized);
      originalEntries.value = klona(normalized);
      syncEntriesDigestNow();
      ensureSelectedEntryExists();
      setStatus(`已加载 "${name}"，条目 ${normalized.length}`);
    } catch (error) {
      if (isStaleRequest()) {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (name !== name.trim()) {
        toastr.error(`读取世界书失败: 世界书名称「${name.trim()}」首尾含有空格，请在酒馆中重命名该世界书以去除空格`);
        setStatus('读取失败: 世界书名称含首尾空格，请重命名');
      } else {
        toastr.error(`读取世界书失败: ${message}`);
        setStatus(`读取失败: ${message}`);
      }
    } finally {
      pendingWorldbookLoadCount = Math.max(0, pendingWorldbookLoadCount - 1);
      if (pendingWorldbookLoadCount === 0) {
        isBusy.value = false;
      }
    }
  }

  async function reloadWorldbookNames(preferred?: string, switchOptions: WorldbookSwitchOptions = {}): Promise<boolean> {
    const names = [...getWorldbookNames()].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
    worldbookNames.value = names;
    normalizeCrossCopyWorldbookSelection();
    persistCrossCopyState();

    if (!names.length) {
      const switched = switchWorldbookSelection('', {
        source: switchOptions.source ?? 'auto',
        reason: switchOptions.reason ?? '世界书列表已为空',
        allowDirty: switchOptions.allowDirty,
        silentOnCancel: true,
      });
      if (!switched) {
        setStatus('世界书列表已变化，但已保留未保存草稿');
        return false;
      }
      draftEntries.value = [];
      originalEntries.value = [];
      selectedEntryUid.value = null;
      return true;
    }

    const fallbackName = persistedState.value.last_worldbook;
    const candidate =
      (preferred && names.includes(preferred) && preferred)
      || (fallbackName && names.includes(fallbackName) && fallbackName)
      || selectedWorldbookName.value
      || names[0];

    if (candidate && selectedWorldbookName.value !== candidate) {
      return switchWorldbookSelection(candidate, {
        source: switchOptions.source ?? 'auto',
        reason: switchOptions.reason ?? '同步世界书选择',
        allowDirty: switchOptions.allowDirty,
        silentOnCancel: true,
      });
    }

    if (selectedWorldbookName.value && !draftEntries.value.length) {
      await loadWorldbook(selectedWorldbookName.value);
    }
    return true;
  }

  async function hardRefresh(options: HardRefreshOptions = {}): Promise<void> {
    if (!ensureRefreshAllowed(options)) {
      return;
    }
    const allowDirty = hasUnsavedChanges.value;
    persistedState.value = readPersistedState();
    syncSelectedGlobalPresetFromState();
    applyCrossCopyStateFromPersisted();

    const reloaded = await reloadWorldbookNames(selectedWorldbookName.value || undefined, {
      source: options.source ?? 'auto',
      reason: options.reason ?? '刷新后同步世界书',
      allowDirty,
      silentOnCancel: true,
    });
    if (!reloaded) {
      return;
    }

    // Always re-fetch current worldbook data so external changes are synced
    if (selectedWorldbookName.value) {
      await loadWorldbook(selectedWorldbookName.value);
      // Sync raw keyword refs after reload
      selectedKeysRaw.value = selectedKeysText.value;
      selectedSecondaryKeysRaw.value = selectedSecondaryKeysText.value;
    }

    await refreshBindings();
    refreshRoleBindingCandidates();
    refreshCurrentRoleContext();
    await autoApplyRoleBoundPreset();

    if (globalWorldbookMode.value) {
      ensureSelectionForGlobalMode({
        source: options.source ?? 'auto',
        reason: '刷新后同步全局模式选择',
        allowDirty,
        silentOnCancel: true,
      });
    } else {
      trySelectWorldbookByContext({
        preferWhenEmptyOnly: options.preferContextSelection !== true,
        source: options.source ?? 'auto',
      });
    }

    setStatus('已刷新世界书和绑定信息');
  }

  async function saveCurrentWorldbook(): Promise<void> {
    if (!selectedWorldbookName.value) {
      toastr.warning('请先选择世界书');
      return;
    }
    if (!hasUnsavedChanges.value) {
      setStatus('当前没有需要保存的修改');
      return;
    }

    isSaving.value = true;
    try {
      draftEntries.value = normalizeEntryList(draftEntries.value.map(entry => klona(entry)));
      const pendingEntrySnapshots = collectEntrySnapshotsBeforeSave();
      const savedEntrySnapshotCount = pushEntrySnapshotsBulk(pendingEntrySnapshots);
      await replaceWorldbook(selectedWorldbookName.value, klona(draftEntries.value), { render: 'immediate' });
      originalEntries.value = klona(draftEntries.value);
      syncEntriesDigestNow();
      pushSnapshot('保存后快照');
      await refreshBindings();
      toastr.success(`已保存: ${selectedWorldbookName.value}`);
      setStatus(`保存成功: ${selectedWorldbookName.value}（条目历史 +${savedEntrySnapshotCount}）`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`保存失败: ${message}`);
      setStatus(`保存失败: ${message}`);
    } finally {
      isSaving.value = false;
    }
  }

  return {
    loadWorldbook,
    reloadWorldbookNames,
    hardRefresh,
    saveCurrentWorldbook,
  };
}
