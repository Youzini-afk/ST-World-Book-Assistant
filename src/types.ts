/**
 * Shared type definitions for the Worldbook Assistant.
 * Extracted from App.vue to enable composable extraction.
 */

import type { StrategyType, SecondaryLogic, PositionType, RoleType, PresetRoleBinding } from './utils';
import type { ThemeKey } from './themes';
export type { PresetRoleBinding } from './utils';

export type PositionSelectValue = PositionType | 'at_depth_as_system' | 'at_depth_as_assistant' | 'at_depth_as_user';

export type EntryVisualStatus = 'constant' | 'vector' | 'normal' | 'disabled';
export type FloatingPanelKey = 'find' | 'activation';
export type PaneResizeKey = 'main' | 'editor';
export type HistoryResizeTarget = 'entry' | 'worldbook';
export type BatchSearchScope = 'all' | 'current';
export type FindFieldKey = 'name' | 'content' | 'keys';
export type SelectionSource = 'manual' | 'auto';
export type FocusSidePanelKey = 'strategy' | 'insertion' | 'recursion';
export type FocusMetaPanelKey = 'comment' | 'keywords';
export type FocusCinePhase = 'idle' | 'prepare' | 'running' | 'settling';
export type FocusCineDirection = 'enter' | 'exit';
export type CopyCinePhase = 'idle' | 'prepare' | 'running' | 'settling';
export type CopyCineDirection = 'enter' | 'exit';
export type FocusHeroKey = string;
export type CrossCopyRowStatus =
  | 'new'
  | 'duplicate_exact'
  | 'same_name_changed'
  | 'content_duplicate_other_name'
  | 'invalid_same_source_target';
export type CrossCopyAction = 'skip' | 'overwrite' | 'rename_create' | 'create';
export type CrossCopyStatusFilter = 'all' | CrossCopyRowStatus;
export type WorldbookHistoryCompareStatus = 'added' | 'removed' | 'changed';
export type CrossCopyMobileStep = 1 | 2 | 3;

export interface MultiEditPersistState {
  enabled: boolean;
  sync_extra_json: boolean;
}

export type TagDeleteParentMode = 'promote' | 'cascade';

export interface TagEditorPersistState {
  delete_parent_mode: TagDeleteParentMode;
}

export interface CrossCopyPersistState {
  last_source_worldbook: string;
  last_target_worldbook: string;
  use_draft_source_when_current: boolean;
  snapshot_before_apply: boolean;
  desktop_left_width: number;
  controls_collapsed: boolean;
  workspace_tools_expanded: boolean;
}

export interface CrossCopyMatchSummary {
  same_name_matches: WorldbookEntry[];
  same_name_exact_count: number;
  content_duplicate_other_name_matches: WorldbookEntry[];
}

export interface CrossCopyRow {
  id: string;
  source_entry: WorldbookEntry;
  source_index: number;
  source_name_key: string;
  source_content_key: string;
  status: CrossCopyRowStatus;
  selected: boolean;
  action: CrossCopyAction;
  rename_name: string;
  note: string;
  details_open: boolean;
  target_summary: CrossCopyMatchSummary;
}

export interface CrossCopyFieldDiffRow {
  key: string;
  label: string;
  left: string;
  right: string;
  changed: boolean;
}

export interface CrossCopyTextDiffLine {
  type: 'same' | 'add' | 'del' | 'empty';
  line_no: number | null;
  text: string;
}

export interface CrossCopyTextDiffResult {
  left: CrossCopyTextDiffLine[];
  right: CrossCopyTextDiffLine[];
  added: number;
  removed: number;
  changed: number;
}

export interface EntryFieldDiffOptions {
  left_fallback?: string;
  right_fallback?: string;
}

export interface WorldbookHistoryCompareRow {
  key: string;
  uid: number | null;
  status: WorldbookHistoryCompareStatus;
  title: string;
  note: string;
  left_entry: WorldbookEntry | null;
  right_entry: WorldbookEntry | null;
}

export interface WorldbookSwitchOptions {
  source?: SelectionSource;
  reason?: string;
  allowDirty?: boolean;
  silentOnCancel?: boolean;
}

export interface HardRefreshOptions {
  source?: SelectionSource;
  reason?: string;
  preferContextSelection?: boolean;
}

export interface FloatingPanelState {
  visible: boolean;
  x: number;
  y: number;
  z: number;
  width: number;
}

export interface PaneResizeState {
  key: PaneResizeKey;
  pointerId: number;
  doc: Document;
  win: Window;
}

export interface HistorySectionResizeState {
  target: HistoryResizeTarget;
  handleIndex: 0 | 1;
  pointerId: number;
  startY: number;
  containerHeight: number;
  startRatios: [number, number, number];
  doc: Document;
  win: Window;
}

export interface CrossCopyPaneResizeState {
  pointerId: number;
  doc: Document;
  win: Window;
}

export interface FocusHeroSnapshot {
  key: FocusHeroKey;
  element: HTMLElement;
  rect: DOMRect;
}

export interface FocusSinkSnapshot {
  key: FocusHeroKey;
  element: HTMLElement;
  rect: DOMRect;
}

export interface WorldbookSnapshot {
  id: string;
  label: string;
  ts: number;
  entries: WorldbookEntry[];
}

export interface EntrySnapshot {
  id: string;
  label: string;
  ts: number;
  uid: number;
  name: string;
  entry: WorldbookEntry;
}

export interface EntryVersionView {
  id: string;
  label: string;
  ts: number;
  name: string;
  entry: WorldbookEntry;
  isCurrent: boolean;
}

export interface WorldbookVersionView {
  id: string;
  label: string;
  ts: number;
  entries: WorldbookEntry[];
  isCurrent: boolean;
}

export interface RoleBindingCandidate extends PresetRoleBinding {
  bound: boolean;
}

export interface GlobalWorldbookPreset {
  id: string;
  name: string;
  worldbooks: string[];
  role_bindings: PresetRoleBinding[];
  updated_at: number;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface AIChatSession {
  id: string;
  title: string;
  createdAt: number;
  messages: AIChatMessage[];
}

export interface AIGeneratorState {
  sessions: AIChatSession[];
  activeSessionId: string | null;
}

export interface ExtractedTag {
  tag: string;
  content: string;
  selected: boolean;
  duplicate?: boolean;
  updated?: boolean;
}

export interface WorldbookTagDefinition {
  id: string;
  name: string;
  color: string;
  parent_id: string | null;
  sort: number;
}

export interface WorldbookTagState {
  definitions: WorldbookTagDefinition[];
  assignments: Record<string, string[]>;
}

export type TagFilterLogic = 'or' | 'and';
export type TagFilterMatchMode = 'exact' | 'descendants';

export interface TagFilterState {
  selected_ids: string[];
  logic: TagFilterLogic;
  match_mode: TagFilterMatchMode;
}

export interface AIApiConfig {
  mode: 'custom' | 'tavern';
  use_main_api: boolean;
  apiurl: string;
  key: string;
  model: string;
  max_tokens: number;
  temperature: number;
}

export interface LayoutState {
  focus_mode: boolean;
  normal_left_width: number;
  normal_right_width: number;
  focus_left_width: number;
  focus_right_width: number;
}

export interface PersistedState {
  last_worldbook: string;
  history: Record<string, WorldbookSnapshot[]>;
  entry_history: Record<string, Record<string, EntrySnapshot[]>>;
  global_presets: GlobalWorldbookPreset[];
  last_global_preset_id: string;
  role_override_baseline: { preset_id: string; worldbooks: string[] } | null;
  theme: ThemeKey;
  ai_chat: AIGeneratorState;
  worldbook_tags: WorldbookTagState;
  tag_filter: TagFilterState;
  extract_ignore_tags: string[];
  ai_api_config: AIApiConfig;
  show_ai_chat: boolean;
  multi_edit: MultiEditPersistState;
  tag_editor: TagEditorPersistState;
  layout: LayoutState;
  cross_copy: CrossCopyPersistState;
  sort: { mode: 'mutate' | 'view'; reassign_uid: boolean };
  glass_mode: boolean;
  panel_mode: 'browse' | 'editor';
}

export interface ActivationLog {
  id: string;
  time: number;
  world: string;
  uid: number | string;
  name: string;
  contentPreview: string;
}

export interface ImportedPayload {
  name: string;
  entries: WorldbookEntry[];
}

export interface EventSubscription {
  stop: () => void;
}

export interface FindHit {
  entryUid: number;
  entryName: string;
  field: FindFieldKey;
  start: number;
  end: number;
  matchedText: string;
  preview: string;
}

export interface EntryConfigPatch {
  enabled: boolean;
  strategy_type: StrategyType;
  keys_secondary_logic: SecondaryLogic;
  scan_depth: WorldbookEntry['strategy']['scan_depth'];
  position_type: PositionType;
  position_order: number;
  position_role: RoleType;
  position_depth: number;
  probability: number;
  recursion_delay_until: number | null;
  prevent_incoming: boolean;
  prevent_outgoing: boolean;
  effect_sticky: number | null;
  effect_cooldown: number | null;
  effect_delay: number | null;
  extra: Record<string, unknown> | null;
}

export interface MobileEntryLongPressState {
  uid: number;
  pointerId: number;
  startX: number;
  startY: number;
  triggered: boolean;
  timerId: number | null;
  target: HTMLElement | null;
}

