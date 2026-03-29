/**
 * Composable: Multi-Edit (multi-select config sync)
 * - Extract/apply entry config patches
 * - Session state tracking
 * - Sync config fields across selected entries
 * - Auto-snapshot before first sync
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import {
  toNumberSafe,
  clampNumber,
  parseNullableInteger,
  normalizeEntry,
  normalizeSecondaryLogic,
  normalizeScanDepth,
  normalizePositionType,
  normalizeRole,
} from '../utils';
import type {
  PersistedState,
  EntryConfigPatch,
} from '../types';

declare const klona: <T>(val: T) => T;

export interface UseMultiEditOptions {
  persistedState: Ref<PersistedState>;
  selectedEntry: ComputedRef<WorldbookEntry | null>;
  selectedEntryUids: Ref<number[]>;
  draftEntries: Ref<WorldbookEntry[]>;
  isMobile: ComputedRef<boolean>;
  mobileMultiSelectMode: Ref<boolean>;
  setStatus: (msg: string) => void;
  getOrderedSelectedEntryUids: () => number[];
  pushEntrySnapshotsBulk: (items: Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }>) => number;
}

export interface UseMultiEditReturn {
  // State
  multiEditLastPatch: Ref<EntryConfigPatch | null>;
  multiEditSnapshotDone: Ref<boolean>;
  multiEditApplying: Ref<boolean>;

  // Computed
  multiEditEnabled: ComputedRef<boolean>;
  multiEditSyncExtraJson: ComputedRef<boolean>;
  isMultiEditSyncActive: ComputedRef<boolean>;
  multiEditSessionKey: ComputedRef<string>;
  multiEditHintText: ComputedRef<string>;

  // Functions
  extractEntryConfigPatch: (entry: WorldbookEntry, includeExtra: boolean) => EntryConfigPatch;
  applyEntryConfigPatch: (entry: WorldbookEntry, patch: EntryConfigPatch, includeExtra: boolean) => void;
  resetMultiEditSessionState: () => void;
  syncSelectedEntryConfigToMultiSelection: (nextPatch: EntryConfigPatch, previousPatch: EntryConfigPatch) => void;
}

export function useMultiEdit(options: UseMultiEditOptions): UseMultiEditReturn {
  const {
    persistedState, selectedEntry, selectedEntryUids,
    draftEntries, isMobile, mobileMultiSelectMode,
    setStatus, getOrderedSelectedEntryUids, pushEntrySnapshotsBulk,
  } = options;

  // ── State ──────────────────────────────────────────────────────────
  const multiEditLastPatch = ref<EntryConfigPatch | null>(null);
  const multiEditSnapshotDone = ref(false);
  const multiEditApplying = ref(false);

  // ── Computed ───────────────────────────────────────────────────────
  const multiEditEnabled = computed(() => persistedState.value.multi_edit.enabled !== false);
  const multiEditSyncExtraJson = computed(() => persistedState.value.multi_edit.sync_extra_json === true);

  const isMultiEditSyncActive = computed(() => {
    if (!multiEditEnabled.value) return false;
    if (!selectedEntry.value || selectedEntryUids.value.length <= 1) return false;
    if (!selectedEntryUids.value.includes(selectedEntry.value.uid)) return false;
    if (isMobile.value && !mobileMultiSelectMode.value) return false;
    return true;
  });

  const multiEditSessionKey = computed(() => {
    if (!isMultiEditSyncActive.value || !selectedEntry.value) return '';
    return `${persistedState.value.last_worldbook}::${selectedEntry.value.uid}::${getOrderedSelectedEntryUids().join(',')}`;
  });

  const multiEditHintText = computed(() => {
    if (!multiEditEnabled.value) return '多选联动已关闭（可在设置中心开启）';
    return '多选联动已开启：配置字段会同步到其余选中条目（名称/内容不同步）';
  });

  // ── Patch extract/apply ────────────────────────────────────────────
  function extractEntryConfigPatch(entry: WorldbookEntry, includeExtra: boolean): EntryConfigPatch {
    return {
      enabled: entry.enabled,
      strategy_type: entry.strategy.type,
      keys_secondary_logic: entry.strategy.keys_secondary.logic,
      scan_depth: entry.strategy.scan_depth,
      position_type: entry.position.type,
      position_order: Math.floor(toNumberSafe(entry.position.order, 100)),
      position_role: entry.position.role,
      position_depth: Math.max(0, Math.floor(toNumberSafe(entry.position.depth, 4))),
      probability: clampNumber(Math.floor(toNumberSafe(entry.probability, 100)), 0, 100),
      recursion_delay_until: parseNullableInteger(entry.recursion.delay_until),
      prevent_incoming: Boolean(entry.recursion.prevent_incoming),
      prevent_outgoing: Boolean(entry.recursion.prevent_outgoing),
      effect_sticky: parseNullableInteger(entry.effect.sticky),
      effect_cooldown: parseNullableInteger(entry.effect.cooldown),
      effect_delay: parseNullableInteger(entry.effect.delay),
      extra: includeExtra ? (entry.extra ? klona(entry.extra) : null) : null,
    };
  }

  function applyEntryConfigPatch(entry: WorldbookEntry, patch: EntryConfigPatch, includeExtra: boolean): void {
    entry.enabled = patch.enabled;
    entry.strategy.type = patch.strategy_type;
    entry.strategy.keys_secondary.logic = normalizeSecondaryLogic(patch.keys_secondary_logic);
    entry.strategy.scan_depth = normalizeScanDepth(patch.scan_depth);
    entry.position.type = normalizePositionType(patch.position_type);
    entry.position.order = Math.floor(toNumberSafe(patch.position_order, entry.position.order));
    if (entry.position.type === 'at_depth') {
      entry.position.role = normalizeRole(patch.position_role);
      entry.position.depth = Math.max(0, Math.floor(toNumberSafe(patch.position_depth, 4)));
    } else {
      entry.position.role = 'system';
      entry.position.depth = 4;
    }
    entry.probability = clampNumber(Math.floor(toNumberSafe(patch.probability, entry.probability)), 0, 100);
    entry.recursion.prevent_incoming = Boolean(patch.prevent_incoming);
    entry.recursion.prevent_outgoing = Boolean(patch.prevent_outgoing);
    entry.recursion.delay_until = parseNullableInteger(patch.recursion_delay_until);
    entry.effect.sticky = parseNullableInteger(patch.effect_sticky);
    entry.effect.cooldown = parseNullableInteger(patch.effect_cooldown);
    entry.effect.delay = parseNullableInteger(patch.effect_delay);
    if (includeExtra) {
      if (patch.extra && Object.keys(patch.extra).length > 0) {
        entry.extra = klona(patch.extra);
      } else {
        delete entry.extra;
      }
    }
  }

  // ── Session management ────────────────────────────────────────────
  function resetMultiEditSessionState(): void {
    if (!isMultiEditSyncActive.value || !selectedEntry.value) {
      multiEditLastPatch.value = null;
      multiEditSnapshotDone.value = false;
      return;
    }
    multiEditLastPatch.value = extractEntryConfigPatch(selectedEntry.value, multiEditSyncExtraJson.value);
    multiEditSnapshotDone.value = false;
  }

  function syncSelectedEntryConfigToMultiSelection(
    nextPatch: EntryConfigPatch,
    previousPatch: EntryConfigPatch,
  ): void {
    if (!selectedEntry.value || !isMultiEditSyncActive.value) return;
    const orderedSelected = getOrderedSelectedEntryUids();
    if (orderedSelected.length <= 1) return;
    const primaryUid = selectedEntry.value.uid;
    const includeExtra = multiEditSyncExtraJson.value;
    const entryByUid = new Map(draftEntries.value.map(entry => [entry.uid, entry] as const));

    if (!multiEditSnapshotDone.value) {
      const snapshotItems: Array<{ label: string; uid: number; name: string; entry: WorldbookEntry }> = [];
      for (const uid of orderedSelected) {
        const original = entryByUid.get(uid);
        if (!original) continue;
        const snapshotEntry = normalizeEntry(klona(original), uid);
        if (uid === primaryUid) {
          applyEntryConfigPatch(snapshotEntry, previousPatch, includeExtra);
        }
        snapshotItems.push({ label: '多选配置前快照', uid, name: original.name, entry: snapshotEntry });
      }
      if (snapshotItems.length) pushEntrySnapshotsBulk(snapshotItems);
      multiEditSnapshotDone.value = true;
    }

    let changedCount = 0;
    multiEditApplying.value = true;
    try {
      for (const uid of orderedSelected) {
        if (uid === primaryUid) continue;
        const target = entryByUid.get(uid);
        if (!target) continue;
        const beforeDigest = JSON.stringify(extractEntryConfigPatch(target, includeExtra));
        applyEntryConfigPatch(target, nextPatch, includeExtra);
        const afterDigest = JSON.stringify(extractEntryConfigPatch(target, includeExtra));
        if (beforeDigest !== afterDigest) changedCount += 1;
      }
    } finally {
      multiEditApplying.value = false;
    }

    if (changedCount > 0) {
      setStatus(`已同步配置到 ${changedCount} 个条目（名称/内容/关键词未同步）`);
    }
  }

  return {
    multiEditLastPatch,
    multiEditSnapshotDone,
    multiEditApplying,
    multiEditEnabled,
    multiEditSyncExtraJson,
    isMultiEditSyncActive,
    multiEditSessionKey,
    multiEditHintText,
    extractEntryConfigPatch,
    applyEntryConfigPatch,
    resetMultiEditSessionState,
    syncSelectedEntryConfigToMultiSelection,
  };
}
