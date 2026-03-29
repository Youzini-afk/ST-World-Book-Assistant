/**
 * Composable: Tag System
 * - Tag CRUD (create/delete/rename/color)
 * - Tag tree (definition map, children map, root ids, path map, descendants map)
 * - Tag filter state
 * - Tag assignment to worldbooks
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import { createId, toStringSafe, toNumberSafe } from '../utils';
import {
  TAG_LIMIT,
  TAG_COLORS,
  normalizeTagFilterState,
  createDefaultTagFilterState,
} from '../store/persistedState';
import type {
  PersistedState,
  WorldbookTagDefinition,
  TagFilterLogic,
  TagFilterMatchMode,
  TagDeleteParentMode,
} from '../types';

// ── Internal types ──────────────────────────────────────────────────
interface TagTreeRow {
  id: string;
  name: string;
  color: string;
  depth: number;
  hasChildren: boolean;
  parentId: string | null;
}

interface TagManagementRow {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  parentName: string;
  path: string;
  hasChildren: boolean;
  assignedCount: number;
}

export interface UseTagSystemOptions {
  persistedState: Ref<PersistedState>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
  setStatus: (msg: string) => void;
  worldbookNames: Ref<string[]>;
}

export interface UseTagSystemReturn {
  // State
  tagEditorMode: Ref<boolean>;
  tagFilterPanelOpen: Ref<boolean>;
  tagFilterSearchText: Ref<string>;
  tagNewName: Ref<string>;
  tagNewParentId: Ref<string>;
  tagAssignSearch: Ref<string>;
  tagAssignTargetId: Ref<string>;
  tagTreeExpandedIds: Ref<string[]>;

  // Computed
  tagDefinitions: ComputedRef<WorldbookTagDefinition[]>;
  tagAssignments: ComputedRef<Record<string, string[]>>;
  tagFilterState: ComputedRef<ReturnType<typeof normalizeTagFilterState>>;
  selectedTagFilterIds: ComputedRef<string[]>;
  selectedTagFilterIdSet: ComputedRef<Set<string>>;
  tagFilterLogic: ComputedRef<TagFilterLogic>;
  tagFilterMatchMode: ComputedRef<TagFilterMatchMode>;
  tagDefinitionMap: ComputedRef<Map<string, WorldbookTagDefinition>>;
  tagChildrenMap: ComputedRef<Map<string | null, WorldbookTagDefinition[]>>;
  tagRootIds: ComputedRef<string[]>;
  tagPathMap: ComputedRef<Map<string, string>>;
  tagDescendantsMap: ComputedRef<Map<string, Set<string>>>;
  tagFilterSummary: ComputedRef<string>;
  tagTreeRows: ComputedRef<TagTreeRow[]>;
  tagManagementRows: ComputedRef<TagManagementRow[]>;
  tagAssignOptions: ComputedRef<Array<{ id: string; name: string; path: string; color: string }>>;
  tagAssignWorldbooks: ComputedRef<Array<{ name: string; assigned: boolean }>>;

  // Functions
  getTagPathLabel: (tagId: string) => string;
  toggleTagFilterSelection: (tagId: string) => void;
  clearTagFilterSelection: () => void;
  toggleTagTreeExpanded: (tagId: string) => void;
  normalizeTagNameKey: (name: string) => string;
  ensureTagAssignTargetSelected: () => void;
  isTagDescendantOf: (targetId: string, potentialAncestorId: string) => boolean;
  collectTagSubtreeIds: (rootId: string) => string[];
  tagSetParent: (tagId: string, parentId: string | null) => void;
  isTagParentOptionDisabled: (tagId: string, parentId: string) => boolean;
  setTagDeleteParentMode: (modeRaw: string) => void;
  tagCreate: () => void;
  tagDelete: (tagId: string) => void;
  tagRename: (tagId: string, newName: string) => void;
  tagSetColor: (tagId: string, color: string) => void;
  tagToggleAssignment: (worldbookName: string, tagId: string) => void;
  tagToggleAssignmentForSelectedTag: (worldbookName: string) => void;
  tagResetAll: () => void;
}

export function useTagSystem(options: UseTagSystemOptions): UseTagSystemReturn {
  const { persistedState, updatePersistedState, setStatus, worldbookNames } = options;

  // ── State ──────────────────────────────────────────────────────────
  const tagEditorMode = ref(false);
  const tagFilterPanelOpen = ref(false);
  const tagFilterSearchText = ref('');
  const tagNewName = ref('');
  const tagNewParentId = ref('');
  const tagAssignSearch = ref('');
  const tagAssignTargetId = ref('');
  const tagTreeExpandedIds = ref<string[]>([]);

  // ── Computed: basic ───────────────────────────────────────────────
  const tagDefinitions = computed(() => persistedState.value.worldbook_tags.definitions);
  const tagAssignments = computed(() => persistedState.value.worldbook_tags.assignments);

  const tagFilterState = computed(() => normalizeTagFilterState(persistedState.value.tag_filter));
  const selectedTagFilterIds = computed<string[]>({
    get: () => tagFilterState.value.selected_ids,
    set: (ids: string[]) => {
      updatePersistedState(state => {
        state.tag_filter.selected_ids = ids;
      });
    },
  });
  const selectedTagFilterIdSet = computed(() => new Set(selectedTagFilterIds.value));

  const tagFilterLogic = computed<TagFilterLogic>({
    get: () => tagFilterState.value.logic,
    set: (logic: TagFilterLogic) => {
      updatePersistedState(state => {
        state.tag_filter.logic = logic;
      });
    },
  });
  const tagFilterMatchMode = computed<TagFilterMatchMode>({
    get: () => tagFilterState.value.match_mode,
    set: (mode: TagFilterMatchMode) => {
      updatePersistedState(state => {
        state.tag_filter.match_mode = mode;
      });
    },
  });

  // ── Computed: maps ────────────────────────────────────────────────
  const tagDefinitionMap = computed(() => {
    const map = new Map<string, WorldbookTagDefinition>();
    for (const def of tagDefinitions.value) {
      map.set(def.id, def);
    }
    return map;
  });

  const tagChildrenMap = computed(() => {
    const buckets = new Map<string | null, WorldbookTagDefinition[]>();
    for (const def of tagDefinitions.value) {
      const parentKey = def.parent_id ?? null;
      const list = buckets.get(parentKey) ?? [];
      list.push(def);
      buckets.set(parentKey, list);
    }
    for (const [key, children] of buckets.entries()) {
      buckets.set(
        key,
        [...children].sort((a, b) => {
          const sortDiff = (a.sort ?? 0) - (b.sort ?? 0);
          if (sortDiff !== 0) return sortDiff;
          return a.name.localeCompare(b.name);
        }),
      );
    }
    return buckets;
  });

  const tagRootIds = computed(() => (tagChildrenMap.value.get(null) ?? []).map(item => item.id));

  function getTagPathLabel(tagId: string): string {
    const map = tagDefinitionMap.value;
    const parts: string[] = [];
    let cursor = tagId;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const def = map.get(cursor);
      if (!def) break;
      parts.unshift(def.name);
      cursor = def.parent_id ?? '';
    }
    return parts.join(' / ') || '(未知)';
  }

  const tagPathMap = computed(() => {
    const map = new Map<string, string>();
    for (const def of tagDefinitions.value) {
      map.set(def.id, getTagPathLabel(def.id));
    }
    return map;
  });

  const tagDescendantsMap = computed(() => {
    const map = new Map<string, Set<string>>();
    for (const def of tagDefinitions.value) {
      const subtreeIds = collectTagSubtreeIds(def.id);
      map.set(def.id, new Set(subtreeIds.filter(id => id !== def.id)));
    }
    return map;
  });

  const tagFilterSummary = computed(() => {
    const ids = selectedTagFilterIds.value.filter(id => tagDefinitionMap.value.has(id));
    if (!ids.length) return '未选中';
    const names = ids.slice(0, 3).map(id => tagDefinitionMap.value.get(id)?.name ?? '?').join(', ');
    const suffix = ids.length > 3 ? ` +${ids.length - 3}` : '';
    return `${names}${suffix}`;
  });

  // ── Computed: tree rows ────────────────────────────────────────────
  const tagTreeRows = computed<TagTreeRow[]>(() => {
    const rows: TagTreeRow[] = [];
    const searchText = tagFilterSearchText.value.trim().toLowerCase();

    function walk(parentId: string | null, depth: number): void {
      const children = tagChildrenMap.value.get(parentId) ?? [];
      for (const def of children) {
        const hasChildren = (tagChildrenMap.value.get(def.id) ?? []).length > 0;
        const path = tagPathMap.value.get(def.id) ?? def.name;
        const matchesSearch = !searchText || path.toLowerCase().includes(searchText);

        const expanded = tagTreeExpandedIds.value.includes(def.id) || !!searchText;
        if (matchesSearch) {
          rows.push({
            id: def.id,
            name: def.name,
            color: def.color,
            depth,
            hasChildren,
            parentId: def.parent_id ?? null,
          });
        }
        if (hasChildren && expanded) {
          walk(def.id, depth + 1);
        }
      }
    }
    walk(null, 0);
    return rows;
  });

  // ── Computed: management rows ─────────────────────────────────────
  const tagManagementRows = computed<TagManagementRow[]>(() => {
    const rows: TagManagementRow[] = [];
    function walk(parentId: string | null): void {
      const children = tagChildrenMap.value.get(parentId) ?? [];
      for (const def of children) {
        const path = tagPathMap.value.get(def.id) ?? def.name;
        const hasChildren = (tagChildrenMap.value.get(def.id) ?? []).length > 0;
        const parentDef = def.parent_id ? tagDefinitionMap.value.get(def.parent_id) : null;
        let assignedCount = 0;
        for (const ids of Object.values(tagAssignments.value)) {
          if (ids.includes(def.id)) assignedCount += 1;
        }
        rows.push({
          id: def.id,
          name: def.name,
          color: def.color,
          parentId: def.parent_id ?? null,
          parentName: parentDef?.name ?? '(根)',
          path,
          hasChildren,
          assignedCount,
        });
        walk(def.id);
      }
    }
    walk(null);
    return rows;
  });

  const tagAssignOptions = computed(() => {
    return tagManagementRows.value.map(row => ({
      id: row.id,
      name: row.name,
      path: row.path,
      color: row.color,
    }));
  });

  const tagAssignWorldbooks = computed(() => {
    const keyword = tagAssignSearch.value.trim().toLowerCase();
    const targetId = tagAssignTargetId.value;
    return worldbookNames.value
      .filter(name => !keyword || name.toLowerCase().includes(keyword))
      .map(name => ({
        name,
        assigned: (tagAssignments.value[name] ?? []).includes(targetId),
      }));
  });

  // ── Tag filter actions ────────────────────────────────────────────
  function toggleTagFilterSelection(tagId: string): void {
    const current = new Set(selectedTagFilterIds.value);
    if (current.has(tagId)) {
      current.delete(tagId);
    } else {
      current.add(tagId);
    }
    selectedTagFilterIds.value = [...current];
  }

  function clearTagFilterSelection(): void {
    selectedTagFilterIds.value = [];
  }

  function toggleTagTreeExpanded(tagId: string): void {
    const set = new Set(tagTreeExpandedIds.value);
    if (set.has(tagId)) {
      set.delete(tagId);
    } else {
      set.add(tagId);
    }
    tagTreeExpandedIds.value = [...set];
  }

  // ── Tree utilities ────────────────────────────────────────────────
  function normalizeTagNameKey(name: string): string {
    return toStringSafe(name).trim().toLowerCase();
  }

  function ensureTagAssignTargetSelected(): void {
    if (tagAssignTargetId.value && tagDefinitionMap.value.has(tagAssignTargetId.value)) return;
    tagAssignTargetId.value = tagAssignOptions.value[0]?.id ?? '';
  }

  function isTagDescendantOf(targetId: string, potentialAncestorId: string): boolean {
    if (!targetId || !potentialAncestorId) return false;
    let cursor = tagDefinitionMap.value.get(targetId)?.parent_id ?? null;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor)) {
      if (cursor === potentialAncestorId) return true;
      seen.add(cursor);
      cursor = tagDefinitionMap.value.get(cursor)?.parent_id ?? null;
    }
    return false;
  }

  function collectTagSubtreeIds(rootId: string): string[] {
    const ids: string[] = [];
    const queue: string[] = [rootId];
    const seen = new Set<string>();
    while (queue.length) {
      const current = queue.shift()!;
      if (seen.has(current)) continue;
      seen.add(current);
      ids.push(current);
      const children = tagChildrenMap.value.get(current) ?? [];
      for (const child of children) {
        queue.push(child.id);
      }
    }
    return ids;
  }

  function tagSetParent(tagId: string, parentId: string | null): void {
    const normalizedParent = parentId && tagDefinitionMap.value.has(parentId) ? parentId : null;
    const current = tagDefinitionMap.value.get(tagId);
    if (!current) return;
    if (normalizedParent === tagId || (normalizedParent && isTagDescendantOf(normalizedParent, tagId))) {
      toastr.warning('不能将标签移动到自己或其子节点下');
      return;
    }
    const siblingExists = tagDefinitions.value.some(def => {
      if (def.id === tagId) return false;
      const parentSame = (def.parent_id ?? null) === normalizedParent;
      return parentSame && normalizeTagNameKey(def.name) === normalizeTagNameKey(current.name);
    });
    if (siblingExists) {
      toastr.warning('同一父节点下已存在同名标签');
      return;
    }
    updatePersistedState(state => {
      const defs = state.worldbook_tags.definitions;
      const target = defs.find(def => def.id === tagId);
      if (!target) return;
      target.parent_id = normalizedParent;
      const siblingSorts = defs
        .filter(def => def.id !== tagId && (def.parent_id ?? null) === normalizedParent)
        .map(def => Math.max(0, Math.floor(toNumberSafe(def.sort, 0))));
      target.sort = siblingSorts.length ? Math.max(...siblingSorts) + 1 : 0;
    });
  }

  function isTagParentOptionDisabled(tagId: string, parentId: string): boolean {
    if (!parentId) return false;
    if (parentId === tagId) return true;
    return isTagDescendantOf(parentId, tagId);
  }

  function setTagDeleteParentMode(modeRaw: string): void {
    const mode: TagDeleteParentMode = modeRaw === 'cascade' ? 'cascade' : 'promote';
    updatePersistedState(state => {
      state.tag_editor.delete_parent_mode = mode;
    });
  }

  // ── CRUD ───────────────────────────────────────────────────────────
  function tagCreate(): void {
    const name = tagNewName.value.trim();
    if (!name) return;
    const parentId = tagNewParentId.value && tagDefinitionMap.value.has(tagNewParentId.value) ? tagNewParentId.value : null;
    const currentDefs = persistedState.value.worldbook_tags.definitions;
    if (currentDefs.length >= TAG_LIMIT) {
      const message = `标签数量已达上限（${TAG_LIMIT}）`;
      toastr.warning(message);
      setStatus(message);
      return;
    }
    const siblingDup = currentDefs.some(def => {
      const sameParent = (def.parent_id ?? null) === parentId;
      return sameParent && normalizeTagNameKey(def.name) === normalizeTagNameKey(name);
    });
    if (siblingDup) {
      const message = '同一父节点下已存在同名标签';
      toastr.warning(message);
      setStatus(message);
      return;
    }
    let created = false;
    updatePersistedState(state => {
      const colorIndex = state.worldbook_tags.definitions.length % TAG_COLORS.length;
      const siblingSorts = state.worldbook_tags.definitions
        .filter(def => (def.parent_id ?? null) === parentId)
        .map(def => Math.max(0, Math.floor(toNumberSafe(def.sort, 0))));
      const nextSort = siblingSorts.length ? Math.max(...siblingSorts) + 1 : 0;
      state.worldbook_tags.definitions.push({
        id: createId('wbtag'),
        name,
        color: TAG_COLORS[colorIndex],
        parent_id: parentId,
        sort: nextSort,
      });
      created = true;
    });
    if (!created) {
      toastr.warning('创建标签失败，请重试');
      return;
    }
    tagNewName.value = '';
    ensureTagAssignTargetSelected();
    setStatus(`已创建标签：${name}`);
  }

  function tagDelete(tagId: string): void {
    const target = tagDefinitionMap.value.get(tagId);
    if (!target) return;
    const hasChildren = (tagChildrenMap.value.get(tagId) ?? []).length > 0;
    const cascadeDelete = hasChildren && persistedState.value.tag_editor.delete_parent_mode === 'cascade';
    const deleteIds = cascadeDelete ? collectTagSubtreeIds(tagId) : [tagId];
    const deleteSet = new Set(deleteIds);
    updatePersistedState(state => {
      if (!cascadeDelete) {
        const parent = state.worldbook_tags.definitions.find(def => def.id === tagId)?.parent_id ?? null;
        for (const def of state.worldbook_tags.definitions) {
          if (def.parent_id === tagId) {
            def.parent_id = parent;
          }
        }
      }
      state.worldbook_tags.definitions = state.worldbook_tags.definitions.filter(def => !deleteSet.has(def.id));
      for (const key of Object.keys(state.worldbook_tags.assignments)) {
        const remained = (state.worldbook_tags.assignments[key] ?? []).filter(id => !deleteSet.has(id));
        if (remained.length) {
          state.worldbook_tags.assignments[key] = remained;
        } else {
          delete state.worldbook_tags.assignments[key];
        }
      }
      state.tag_filter.selected_ids = (state.tag_filter.selected_ids ?? []).filter(id => !deleteSet.has(id));
    });
    if (tagAssignTargetId.value && deleteSet.has(tagAssignTargetId.value)) {
      tagAssignTargetId.value = '';
      ensureTagAssignTargetSelected();
    }
  }

  function tagRename(tagId: string, newName: string): void {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const target = tagDefinitionMap.value.get(tagId);
    if (!target) return;
    const hasConflict = tagDefinitions.value.some(def => {
      if (def.id === tagId) return false;
      return (def.parent_id ?? null) === (target.parent_id ?? null) && normalizeTagNameKey(def.name) === normalizeTagNameKey(trimmed);
    });
    if (hasConflict) {
      toastr.warning('同一父节点下已存在同名标签');
      return;
    }
    updatePersistedState(state => {
      const def = state.worldbook_tags.definitions.find(d => d.id === tagId);
      if (def) def.name = trimmed;
    });
  }

  function tagSetColor(tagId: string, color: string): void {
    updatePersistedState(state => {
      const def = state.worldbook_tags.definitions.find(d => d.id === tagId);
      if (def) def.color = color;
    });
  }

  function tagToggleAssignment(worldbookName: string, tagId: string): void {
    updatePersistedState(state => {
      const current = state.worldbook_tags.assignments[worldbookName] ?? [];
      if (current.includes(tagId)) {
        state.worldbook_tags.assignments[worldbookName] = current.filter(id => id !== tagId);
        if (!state.worldbook_tags.assignments[worldbookName].length) {
          delete state.worldbook_tags.assignments[worldbookName];
        }
      } else {
        state.worldbook_tags.assignments[worldbookName] = [...current, tagId];
      }
    });
  }

  function tagToggleAssignmentForSelectedTag(worldbookName: string): void {
    const tagId = tagAssignTargetId.value;
    if (!tagId) return;
    tagToggleAssignment(worldbookName, tagId);
  }

  function tagResetAll(): void {
    if (!confirm('确定要清除所有标签和分配吗？')) return;
    updatePersistedState(state => {
      state.worldbook_tags = { definitions: [], assignments: {} };
      state.tag_filter = createDefaultTagFilterState();
    });
    tagAssignTargetId.value = '';
    tagNewParentId.value = '';
  }

  return {
    tagEditorMode,
    tagFilterPanelOpen,
    tagFilterSearchText,
    tagNewName,
    tagNewParentId,
    tagAssignSearch,
    tagAssignTargetId,
    tagTreeExpandedIds,
    tagDefinitions,
    tagAssignments,
    tagFilterState,
    selectedTagFilterIds,
    selectedTagFilterIdSet,
    tagFilterLogic,
    tagFilterMatchMode,
    tagDefinitionMap,
    tagChildrenMap,
    tagRootIds,
    tagPathMap,
    tagDescendantsMap,
    tagFilterSummary,
    tagTreeRows,
    tagManagementRows,
    tagAssignOptions,
    tagAssignWorldbooks,
    getTagPathLabel,
    toggleTagFilterSelection,
    clearTagFilterSelection,
    toggleTagTreeExpanded,
    normalizeTagNameKey,
    ensureTagAssignTargetSelected,
    isTagDescendantOf,
    collectTagSubtreeIds,
    tagSetParent,
    isTagParentOptionDisabled,
    setTagDeleteParentMode,
    tagCreate,
    tagDelete,
    tagRename,
    tagSetColor,
    tagToggleAssignment,
    tagToggleAssignmentForSelectedTag,
    tagResetAll,
  };
}
