/**
 * Persisted state store for the Worldbook Assistant.
 * Handles reading/writing/normalizing the persistent configuration
 * stored in SillyTavern extension settings.
 */

import { ref } from 'vue';
import {
  createId,
  asRecord,
  toStringSafe,
  toNumberSafe,
  clampNumber,
  normalizePresetRoleBindings,
  normalizeEntry,
  normalizeEntryList,
} from '../utils';
import { DEFAULT_THEME_KEY, isThemeKey } from '../themes';
import type {
  PersistedState,
  WorldbookSnapshot,
  EntrySnapshot,
  GlobalWorldbookPreset,
  AIGeneratorState,
  AIChatMessage,
  AIChatSession,
  AIApiConfig,
  WorldbookTagDefinition,
  LayoutState,
  MultiEditPersistState,
  TagEditorPersistState,
  CrossCopyPersistState,
  TagFilterState,
} from '../types';

// ── Constants ──────────────────────────────────────────────────────

export const STORAGE_KEY = 'worldbook_assistant_state_v1';
export const HISTORY_LIMIT = 12;
export const ENTRY_HISTORY_LIMIT = 7;
export const GLOBAL_PRESET_LIMIT = 64;
export const TAG_LIMIT = 32;
export const TAG_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#6366f1', '#14b8a6', '#f43f5e', '#a855f7',
];
export const AI_CHAT_SESSION_LIMIT = 50;
export const AI_CHAT_MESSAGE_LIMIT = 200;

// ── Layout defaults (needed by normalizeLayoutState) ───────────────

export const MAIN_PANE_DEFAULT = 280;
export const MAIN_PANE_MIN = 220;
export const FOCUS_MAIN_PANE_DEFAULT = 176;
export const FOCUS_MAIN_PANE_MIN = 150;
export const EDITOR_SIDE_DEFAULT = 360;
export const EDITOR_SIDE_MIN = 280;
export const FOCUS_EDITOR_SIDE_DEFAULT = 220;
export const FOCUS_EDITOR_SIDE_MIN = 180;
export const CROSS_COPY_DESKTOP_LEFT_DEFAULT = 300;
export const CROSS_COPY_DESKTOP_LEFT_MIN = 240;
export const CROSS_COPY_DESKTOP_LEFT_MAX = 440;

// ── Default state creators ─────────────────────────────────────────

export function createDefaultLayoutState(): LayoutState {
  return {
    focus_mode: false,
    normal_left_width: MAIN_PANE_DEFAULT,
    normal_right_width: EDITOR_SIDE_DEFAULT,
    focus_left_width: FOCUS_MAIN_PANE_DEFAULT,
    focus_right_width: FOCUS_EDITOR_SIDE_DEFAULT,
  };
}

export function createDefaultMultiEditPersistState(): MultiEditPersistState {
  return {
    enabled: true,
    sync_extra_json: false,
  };
}

export function createDefaultTagEditorPersistState(): TagEditorPersistState {
  return {
    delete_parent_mode: 'promote',
  };
}

export function createDefaultCrossCopyPersistState(): CrossCopyPersistState {
  return {
    last_source_worldbook: '',
    last_target_worldbook: '',
    use_draft_source_when_current: true,
    snapshot_before_apply: true,
    desktop_left_width: CROSS_COPY_DESKTOP_LEFT_DEFAULT,
    controls_collapsed: true,
    workspace_tools_expanded: true,
  };
}

export function createDefaultTagFilterState(): TagFilterState {
  return {
    selected_ids: [],
    logic: 'or',
    match_mode: 'descendants',
  };
}

// ── Normalize helpers ──────────────────────────────────────────────

export function normalizeMultiEditPersistState(input: unknown): MultiEditPersistState {
  const fallback = createDefaultMultiEditPersistState();
  const raw = asRecord(input);
  if (!raw) {
    return fallback;
  }
  return {
    enabled: raw.enabled !== false,
    sync_extra_json: raw.sync_extra_json === true,
  };
}

export function normalizeCrossCopyPersistState(input: unknown): CrossCopyPersistState {
  const fallback = createDefaultCrossCopyPersistState();
  const raw = asRecord(input);
  if (!raw) {
    return fallback;
  }
  return {
    last_source_worldbook: toStringSafe(raw.last_source_worldbook).trim(),
    last_target_worldbook: toStringSafe(raw.last_target_worldbook).trim(),
    use_draft_source_when_current: raw.use_draft_source_when_current !== false,
    snapshot_before_apply: raw.snapshot_before_apply !== false,
    desktop_left_width: clampNumber(
      Math.floor(toNumberSafe(raw.desktop_left_width, fallback.desktop_left_width)),
      CROSS_COPY_DESKTOP_LEFT_MIN,
      CROSS_COPY_DESKTOP_LEFT_MAX,
    ),
    controls_collapsed: raw.controls_collapsed !== false,
    workspace_tools_expanded: raw.workspace_tools_expanded === undefined
      ? fallback.workspace_tools_expanded
      : raw.workspace_tools_expanded === true,
  };
}

export function normalizeTagEditorPersistState(input: unknown): TagEditorPersistState {
  const fallback = createDefaultTagEditorPersistState();
  const raw = asRecord(input);
  if (!raw) {
    return fallback;
  }
  return {
    delete_parent_mode: raw.delete_parent_mode === 'cascade' ? 'cascade' : fallback.delete_parent_mode,
  };
}

export function normalizeTagFilterState(input: unknown): TagFilterState {
  const fallback = createDefaultTagFilterState();
  const raw = asRecord(input);
  if (!raw) {
    return fallback;
  }
  const selected = Array.isArray(raw.selected_ids)
    ? raw.selected_ids.map(id => toStringSafe(id).trim()).filter(Boolean)
    : [];
  return {
    selected_ids: [...new Set(selected)],
    logic: raw.logic === 'and' ? 'and' : fallback.logic,
    match_mode: raw.match_mode === 'exact' ? 'exact' : fallback.match_mode,
  };
}

export function normalizeLayoutState(input: unknown): LayoutState {
  const fallback = createDefaultLayoutState();
  const raw = asRecord(input);
  if (!raw) {
    return fallback;
  }
  return {
    focus_mode: raw.focus_mode === true,
    normal_left_width: clampNumber(Math.floor(toNumberSafe(raw.normal_left_width, fallback.normal_left_width)), MAIN_PANE_MIN, 1200),
    normal_right_width: clampNumber(Math.floor(toNumberSafe(raw.normal_right_width, fallback.normal_right_width)), EDITOR_SIDE_MIN, 1200),
    focus_left_width: clampNumber(Math.floor(toNumberSafe(raw.focus_left_width, fallback.focus_left_width)), FOCUS_MAIN_PANE_MIN, 800),
    focus_right_width: clampNumber(Math.floor(toNumberSafe(raw.focus_right_width, fallback.focus_right_width)), FOCUS_EDITOR_SIDE_MIN, 800),
  };
}

// ── Main persisted state normalizer ────────────────────────────────

export function createDefaultPersistedState(): PersistedState {
  return {
    last_worldbook: '',
    history: {},
    entry_history: {},
    global_presets: [],
    last_global_preset_id: '',
    role_override_baseline: null,
    theme: DEFAULT_THEME_KEY,
    ai_chat: { sessions: [], activeSessionId: null },
    worldbook_tags: { definitions: [], assignments: {} },
    tag_filter: createDefaultTagFilterState(),
    extract_ignore_tags: ['think', 'thinking', 'recap', 'content', 'details', 'summary'],
    show_ai_chat: false,
    multi_edit: createDefaultMultiEditPersistState(),
    tag_editor: createDefaultTagEditorPersistState(),
    ai_api_config: {
      mode: 'tavern',
      use_main_api: true,
      apiurl: '',
      key: '',
      model: '',
      max_tokens: 4096,
      temperature: 1,
    },
    layout: createDefaultLayoutState(),
    cross_copy: createDefaultCrossCopyPersistState(),
    sort: { mode: 'mutate', reassign_uid: true },
    glass_mode: true,
    panel_mode: 'browse',
  };
}

export function normalizePersistedState(input: unknown): PersistedState {
  const root = asRecord(input);
  if (!root) {
    return createDefaultPersistedState();
  }

  // ── History snapshots ──
  const historyRoot = asRecord(root.history) ?? {};
  const history: Record<string, WorldbookSnapshot[]> = {};
  for (const [name, rawSnapshots] of Object.entries(historyRoot)) {
    if (!Array.isArray(rawSnapshots)) {
      continue;
    }
    history[name] = rawSnapshots
      .map(item => {
        const record = asRecord(item);
        if (!record) {
          return null;
        }
        const entriesRaw = Array.isArray(record.entries) ? record.entries : [];
        return {
          id: toStringSafe(record.id, createId('snapshot')),
          label: toStringSafe(record.label, '快照'),
          ts: toNumberSafe(record.ts, Date.now()),
          entries: normalizeEntryList(entriesRaw),
        } satisfies WorldbookSnapshot;
      })
      .filter((item): item is WorldbookSnapshot => item !== null)
      .slice(0, HISTORY_LIMIT);
  }

  // ── Entry history ──
  const entryHistoryRoot = asRecord(root.entry_history) ?? {};
  const entryHistory: Record<string, Record<string, EntrySnapshot[]>> = {};
  for (const [worldbookName, rawByUid] of Object.entries(entryHistoryRoot)) {
    const uidRecord = asRecord(rawByUid);
    if (!uidRecord) {
      continue;
    }
    const normalizedByUid: Record<string, EntrySnapshot[]> = {};
    for (const [uidKey, rawItems] of Object.entries(uidRecord)) {
      if (!Array.isArray(rawItems)) {
        continue;
      }
      const uidNumber = Math.max(0, Math.floor(toNumberSafe(uidKey, 0)));
      normalizedByUid[uidKey] = rawItems
        .map(item => {
          const record = asRecord(item);
          if (!record) {
            return null;
          }
          return {
            id: toStringSafe(record.id, createId('entry-snapshot')),
            label: toStringSafe(record.label, '条目快照'),
            ts: toNumberSafe(record.ts, Date.now()),
            uid: uidNumber,
            name: toStringSafe(record.name, `条目 ${uidNumber}`),
            entry: normalizeEntry(record.entry, uidNumber),
          } satisfies EntrySnapshot;
        })
        .filter((item): item is EntrySnapshot => item !== null)
        .slice(0, ENTRY_HISTORY_LIMIT);
    }
    if (Object.keys(normalizedByUid).length > 0) {
      entryHistory[worldbookName] = normalizedByUid;
    }
  }

  // ── Global presets ──
  const globalPresetsRaw = Array.isArray(root.global_presets) ? root.global_presets : [];
  const globalPresets = globalPresetsRaw
    .map(item => {
      const record = asRecord(item);
      if (!record) {
        return null;
      }
      const worldbooksRaw = Array.isArray(record.worldbooks) ? record.worldbooks : [];
      const worldbooks = [...new Set(worldbooksRaw.map(name => toStringSafe(name).trim()).filter(Boolean))];
      const roleBindings = normalizePresetRoleBindings(record.role_bindings);
      return {
        id: toStringSafe(record.id, createId('global-preset')),
        name: toStringSafe(record.name, '未命名预设'),
        worldbooks,
        role_bindings: roleBindings,
        updated_at: toNumberSafe(record.updated_at, Date.now()),
      } satisfies GlobalWorldbookPreset;
    })
    .filter((item): item is GlobalWorldbookPreset => item !== null)
    .slice(0, GLOBAL_PRESET_LIMIT);

  // ── Role override baseline ──
  const rawBaseline = asRecord(root.role_override_baseline);
  let roleOverrideBaseline: PersistedState['role_override_baseline'] = null;
  if (rawBaseline) {
    const baselineWorldbooks = Array.isArray(rawBaseline.worldbooks)
      ? rawBaseline.worldbooks.map(name => toStringSafe(name).trim()).filter(Boolean)
      : [];
    roleOverrideBaseline = {
      preset_id: toStringSafe(rawBaseline.preset_id),
      worldbooks: [...new Set(baselineWorldbooks)],
    };
  }

  // ── AI chat ──
  const aiChatRaw = asRecord(root.ai_chat);
  const aiChat: AIGeneratorState = { sessions: [], activeSessionId: null };
  if (aiChatRaw) {
    aiChat.activeSessionId = toStringSafe(aiChatRaw.activeSessionId) || null;
    if (Array.isArray(aiChatRaw.sessions)) {
      aiChat.sessions = aiChatRaw.sessions
        .map((s: unknown) => {
          const sr = asRecord(s);
          if (!sr) return null;
          const msgs = Array.isArray(sr.messages)
            ? sr.messages.map((m: unknown) => {
                const mr = asRecord(m);
                if (!mr) return null;
                return {
                  role: mr.role === 'assistant' ? 'assistant' : 'user',
                  content: toStringSafe(mr.content),
                  timestamp: toNumberSafe(mr.timestamp, Date.now()),
                } satisfies AIChatMessage;
              }).filter((m): m is AIChatMessage => m !== null)
            : [];
          return {
            id: toStringSafe(sr.id, createId('ai-chat')),
            title: toStringSafe(sr.title, '新对话'),
            createdAt: toNumberSafe(sr.createdAt, Date.now()),
            messages: msgs.slice(0, AI_CHAT_MESSAGE_LIMIT),
          } satisfies AIChatSession;
        })
        .filter((s): s is AIChatSession => s !== null)
        .slice(0, AI_CHAT_SESSION_LIMIT);
    }
  }

  // ── Tags ──
  const rawTags = asRecord(root.worldbook_tags);
  const tagDefs: WorldbookTagDefinition[] = [];
  const tagIdSet = new Set<string>();
  if (rawTags && Array.isArray(rawTags.definitions)) {
    rawTags.definitions.forEach((d, index) => {
      const dr = asRecord(d);
      if (!dr) return;
      const id = toStringSafe(dr.id).trim();
      const name = toStringSafe(dr.name).trim();
      if (!id || !name || tagIdSet.has(id)) return;
      const parentIdRaw = toStringSafe(dr.parent_id).trim();
      const parentId = parentIdRaw || null;
      tagDefs.push({
        id,
        name,
        color: toStringSafe(dr.color, TAG_COLORS[0]),
        parent_id: parentId,
        sort: Math.max(0, Math.floor(toNumberSafe(dr.sort, index))),
      });
      tagIdSet.add(id);
    });
  }
  const tagIdSetFromDefs = new Set(tagDefs.map(tag => tag.id));
  for (const def of tagDefs) {
    if (def.parent_id && !tagIdSetFromDefs.has(def.parent_id)) {
      def.parent_id = null;
    }
  }
  const tagAssignmentsRaw = asRecord(rawTags?.assignments);
  const tagAssignmentsNorm: Record<string, string[]> = {};
  if (tagAssignmentsRaw) {
    for (const [wbName, ids] of Object.entries(tagAssignmentsRaw)) {
      if (Array.isArray(ids)) {
        const normalizedIds = [...new Set(ids.map(id => toStringSafe(id)).filter(id => tagIdSetFromDefs.has(id)))];
        if (normalizedIds.length) {
          tagAssignmentsNorm[wbName] = normalizedIds;
        }
      }
    }
  }
  const normalizedTagFilter = normalizeTagFilterState(root.tag_filter);
  normalizedTagFilter.selected_ids = normalizedTagFilter.selected_ids.filter(id => tagIdSetFromDefs.has(id));

  return {
    last_worldbook: toStringSafe(root.last_worldbook),
    history,
    entry_history: entryHistory,
    global_presets: globalPresets,
    last_global_preset_id: toStringSafe(root.last_global_preset_id),
    role_override_baseline: roleOverrideBaseline,
    theme: (() => {
      const theme = toStringSafe(root.theme).trim();
      return isThemeKey(theme) ? theme : DEFAULT_THEME_KEY;
    })(),
    ai_chat: aiChat,
    worldbook_tags: { definitions: tagDefs.slice(0, TAG_LIMIT), assignments: tagAssignmentsNorm },
    tag_filter: normalizedTagFilter,
    extract_ignore_tags: Array.isArray(root.extract_ignore_tags)
      ? root.extract_ignore_tags.map((t: unknown) => toStringSafe(t).trim().toLowerCase()).filter(Boolean)
      : ['thinking', 'recap', 'content', 'details', 'summary'],
    show_ai_chat: root.show_ai_chat === true,
    multi_edit: normalizeMultiEditPersistState(root.multi_edit),
    tag_editor: normalizeTagEditorPersistState(root.tag_editor),
    ai_api_config: (() => {
      const raw = asRecord(root.ai_api_config);
      if (!raw) return createDefaultPersistedState().ai_api_config;
      return {
        mode: raw.mode === 'custom' ? 'custom' : 'tavern',
        use_main_api: raw.use_main_api !== false,
        apiurl: toStringSafe(raw.apiurl),
        key: toStringSafe(raw.key),
        model: toStringSafe(raw.model),
        max_tokens: toNumberSafe(raw.max_tokens, 4096),
        temperature: toNumberSafe(raw.temperature, 1),
      } as AIApiConfig;
    })(),
    layout: normalizeLayoutState(root.layout),
    cross_copy: normalizeCrossCopyPersistState(root.cross_copy),
    sort: (() => {
      const raw = asRecord(root.sort);
      return {
        mode: raw?.mode === 'view' ? 'view' as const : 'mutate' as const,
        reassign_uid: raw?.reassign_uid !== false,
      };
    })(),
    glass_mode: root.glass_mode === true,
    panel_mode: root.panel_mode === 'editor' ? 'editor' : 'browse',
  };
}

// ── Reactive store ─────────────────────────────────────────────────

export interface PersistedStateStore {
  persistedState: ReturnType<typeof ref<PersistedState>>;
  readPersistedState: () => PersistedState;
  writePersistedState: (state: PersistedState, onAfterWrite?: () => void) => void;
  updatePersistedState: (mutator: (state: PersistedState) => void, onAfterWrite?: () => void) => void;
}

export function createPersistedStateStore(): PersistedStateStore {
  const persistedState = ref<PersistedState>(createDefaultPersistedState());

  function readPersistedState(): PersistedState {
    const ctx = (window as any).SillyTavern?.getContext?.();
    if (!ctx) return createDefaultPersistedState();
    if (!ctx.extensionSettings.worldbookAssistant) {
      ctx.extensionSettings.worldbookAssistant = {};
    }
    return normalizePersistedState(ctx.extensionSettings.worldbookAssistant[STORAGE_KEY]);
  }

  function writePersistedState(state: PersistedState, onAfterWrite?: () => void): void {
    const ctx = (window as any).SillyTavern?.getContext?.();
    if (ctx) {
      if (!ctx.extensionSettings.worldbookAssistant) {
        ctx.extensionSettings.worldbookAssistant = {};
      }
      ctx.extensionSettings.worldbookAssistant[STORAGE_KEY] = state;
      ctx.saveSettingsDebounced?.();
    }
    persistedState.value = state;
    onAfterWrite?.();
  }

  function updatePersistedState(mutator: (state: PersistedState) => void, onAfterWrite?: () => void): void {
    const state = readPersistedState();
    mutator(state);
    writePersistedState(state, onAfterWrite);
  }

  return {
    persistedState,
    readPersistedState,
    writePersistedState,
    updatePersistedState,
  };
}
