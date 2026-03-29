import { klona } from 'klona';
import { computed, shallowRef, type Ref, type ComputedRef } from 'vue';

export interface CreateEditorSessionStoreOptions {
  isMobile: Ref<boolean>;
  createDefaultEntry: (uid: number) => WorldbookEntry;
  normalizeEntryList: (entries: unknown[]) => WorldbookEntry[];
  getNextUid: (entries: WorldbookEntry[]) => number;
}

export interface EditorSessionStore {
  selectedWorldbookName: Ref<string>;
  draftEntries: Ref<WorldbookEntry[]>;
  originalEntries: Ref<WorldbookEntry[]>;
  selectedEntryUid: Ref<number | null>;
  selectedEntryUids: Ref<number[]>;
  selectedEntry: ComputedRef<WorldbookEntry | null>;
  selectedEntryIndex: ComputedRef<number>;
  hasUnsavedChanges: ComputedRef<boolean>;
  selectWorldbook: (name: string) => void;
  setEntries: (entries: unknown[]) => void;
  resetForEmptyWorldbook: () => void;
  ensureSelectedEntryExists: () => void;
  selectEntry: (uid: number | null) => boolean;
  toggleSelectedEntry: (uid: number) => boolean;
  addEntry: () => WorldbookEntry;
  removeSelectedEntries: () => {
    removedEntries: WorldbookEntry[];
    removedUids: number[];
  };
  replaceDraftEntries: (entries: unknown[]) => void;
  markSaved: () => void;
  discardDraft: () => void;
}

export function createEditorSessionStore(
  options: CreateEditorSessionStoreOptions,
): EditorSessionStore {
  const selectedWorldbookName = shallowRef('');
  const draftEntries = shallowRef<WorldbookEntry[]>([]);
  const originalEntries = shallowRef<WorldbookEntry[]>([]);
  const selectedEntryUid = shallowRef<number | null>(null);
  const selectedEntryUids = shallowRef<number[]>([]);

  const selectedEntry = computed<WorldbookEntry | null>(() => {
    if (selectedEntryUid.value === null) {
      return null;
    }
    return (
      draftEntries.value.find(
        entry => entry.uid === selectedEntryUid.value,
      ) ?? null
    );
  });

  const selectedEntryIndex = computed(() => {
    if (!selectedEntry.value) {
      return -1;
    }
    return draftEntries.value.findIndex(
      entry => entry.uid === selectedEntry.value!.uid,
    );
  });

  const hasUnsavedChanges = computed(
    () =>
      JSON.stringify(draftEntries.value) !==
      JSON.stringify(originalEntries.value),
  );

  function normalizeSelection(): void {
    const uidSet = new Set(
      draftEntries.value.map(entry => entry.uid),
    );
    selectedEntryUids.value = selectedEntryUids.value.filter(uid =>
      uidSet.has(uid),
    );
    if (
      selectedEntryUid.value !== null &&
      !uidSet.has(selectedEntryUid.value)
    ) {
      selectedEntryUid.value = null;
    }
    if (
      selectedEntryUid.value !== null &&
      !selectedEntryUids.value.includes(selectedEntryUid.value)
    ) {
      selectedEntryUids.value = [selectedEntryUid.value];
    }
  }

  function ensureSelectedEntryExists(): void {
    if (!draftEntries.value.length) {
      selectedEntryUid.value = null;
      selectedEntryUids.value = [];
      return;
    }
    const exists =
      selectedEntryUid.value !== null &&
      draftEntries.value.some(
        entry => entry.uid === selectedEntryUid.value,
      );
    if (!exists) {
      selectedEntryUid.value = draftEntries.value[0].uid;
    }
    selectedEntryUids.value =
      selectedEntryUid.value === null ? [] : [selectedEntryUid.value];
  }

  function resetForEmptyWorldbook(): void {
    draftEntries.value = [];
    originalEntries.value = [];
    selectedEntryUid.value = null;
    selectedEntryUids.value = [];
  }

  function selectWorldbook(name: string): void {
    selectedWorldbookName.value = name;
  }

  function setEntries(entries: unknown[]): void {
    const normalized = options.normalizeEntryList(entries);
    draftEntries.value = klona(normalized);
    originalEntries.value = klona(normalized);
    ensureSelectedEntryExists();
  }

  function selectEntry(uid: number | null): boolean {
    if (uid === null) {
      selectedEntryUid.value = null;
      selectedEntryUids.value = [];
      return true;
    }
    const exists = draftEntries.value.some(
      entry => entry.uid === uid,
    );
    if (!exists) {
      return false;
    }
    selectedEntryUid.value = uid;
    selectedEntryUids.value = [uid];
    return true;
  }

  function toggleSelectedEntry(uid: number): boolean {
    const exists = draftEntries.value.some(
      entry => entry.uid === uid,
    );
    if (!exists) {
      return false;
    }
    if (selectedEntryUids.value.includes(uid)) {
      const next = selectedEntryUids.value.filter(
        item => item !== uid,
      );
      selectedEntryUids.value = next;
      selectedEntryUid.value = next[0] ?? null;
      return false;
    }
    selectedEntryUids.value = [...selectedEntryUids.value, uid];
    selectedEntryUid.value = uid;
    return true;
  }

  function addEntry(): WorldbookEntry {
    const uid = options.getNextUid(draftEntries.value);
    const entry = options.createDefaultEntry(uid);
    draftEntries.value = [...draftEntries.value, entry];
    selectedEntryUid.value = uid;
    selectedEntryUids.value = [uid];
    return entry;
  }

  function removeSelectedEntries(): {
    removedEntries: WorldbookEntry[];
    removedUids: number[];
  } {
    const targetUids = selectedEntryUids.value.length
      ? selectedEntryUids.value
      : selectedEntryUid.value === null
        ? []
        : [selectedEntryUid.value];
    if (!targetUids.length) {
      return { removedEntries: [], removedUids: [] };
    }
    const targetSet = new Set(targetUids);
    const removedEntries = draftEntries.value.filter(entry =>
      targetSet.has(entry.uid),
    );
    if (!removedEntries.length) {
      normalizeSelection();
      return { removedEntries: [], removedUids: [] };
    }
    draftEntries.value = draftEntries.value.filter(
      entry => !targetSet.has(entry.uid),
    );
    if (options.isMobile.value) {
      selectedEntryUid.value = null;
      selectedEntryUids.value = [];
    } else {
      ensureSelectedEntryExists();
    }
    return {
      removedEntries,
      removedUids: removedEntries.map(entry => entry.uid),
    };
  }

  function replaceDraftEntries(entries: unknown[]): void {
    draftEntries.value = options.normalizeEntryList(entries);
    normalizeSelection();
    ensureSelectedEntryExists();
  }

  function markSaved(): void {
    originalEntries.value = klona(draftEntries.value);
  }

  function discardDraft(): void {
    draftEntries.value = klona(originalEntries.value);
    ensureSelectedEntryExists();
  }

  return {
    selectedWorldbookName,
    draftEntries,
    originalEntries,
    selectedEntryUid,
    selectedEntryUids,
    selectedEntry,
    selectedEntryIndex,
    hasUnsavedChanges,
    selectWorldbook,
    setEntries,
    resetForEmptyWorldbook,
    ensureSelectedEntryExists,
    selectEntry,
    toggleSelectedEntry,
    addEntry,
    removeSelectedEntries,
    replaceDraftEntries,
    markSaved,
    discardDraft,
  };
}
