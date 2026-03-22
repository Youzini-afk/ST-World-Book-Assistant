/**
 * Pure utility functions extracted from App.vue.
 * These have zero dependencies on Vue reactive state.
 */

// ── Primitive helpers ──────────────────────────────────────────────

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export function toStringSafe(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

export function toNumberSafe(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function parseNullableInteger(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && !value.trim()) {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.max(0, Math.floor(parsed));
}

export function nullableNumberToText(value: number | null): string {
  return value === null ? '' : String(value);
}

// ── Keyword helpers ────────────────────────────────────────────────

export function stringifyKeyword(value: string | RegExp): string {
  return value instanceof RegExp ? value.toString() : value;
}

export function parseKeywordToken(token: string): string | RegExp {
  const trimmed = token.trim();
  if (!trimmed) {
    return '';
  }
  const regexMatch = trimmed.match(/^\/(.+)\/([dgimsuy]*)$/);
  if (!regexMatch) {
    return trimmed;
  }
  try {
    return new RegExp(regexMatch[1], regexMatch[2]);
  } catch {
    return trimmed;
  }
}

export function normalizeKeywordList(value: unknown): (string | RegExp)[] {
  const sourceList = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/g) : [];
  const normalized: (string | RegExp)[] = [];
  const seen = new Set<string>();

  for (const item of sourceList) {
    const token = item instanceof RegExp ? item : parseKeywordToken(toStringSafe(item).trim());
    const tokenString = stringifyKeyword(token);
    if (!tokenString) {
      continue;
    }
    const dedupeKey = tokenString.toLowerCase();
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    normalized.push(token);
  }

  return normalized;
}

export function parseKeywordsFromText(value: string): (string | RegExp)[] {
  return normalizeKeywordList(value.split(/[\n,]/g));
}

// ── DateTime ───────────────────────────────────────────────────────

export function formatDateTime(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return String(timestamp);
  }
}

// ── Label helpers ──────────────────────────────────────────────────

type StrategyType = WorldbookEntry['strategy']['type'];
type SecondaryLogic = WorldbookEntry['strategy']['keys_secondary']['logic'];
type PositionType = WorldbookEntry['position']['type'];
type RoleType = WorldbookEntry['position']['role'];

export function getStrategyTypeLabel(type: StrategyType): string {
  if (type === 'constant') {
    return '🔵 常驻 (constant)';
  }
  if (type === 'vectorized') {
    return '📎 向量化 (vectorized)';
  }
  return '🟢 关键词 (selective)';
}

export function getSecondaryLogicLabel(logic: SecondaryLogic): string {
  const map: Record<SecondaryLogic, string> = {
    and_any: '任一命中 (and_any)',
    and_all: '全部命中 (and_all)',
    not_all: '不全命中 (not_all)',
    not_any: '全部不命中 (not_any)',
  };
  return map[logic];
}

export function getPositionTypeLabelWithRole(type: PositionType, role: RoleType): string {
  const map: Record<Exclude<PositionType, 'at_depth'>, string> = {
    before_character_definition: '角色定义之前',
    after_character_definition: '角色定义之后',
    before_example_messages: '示例消息前（↑EM）',
    after_example_messages: '示例消息后（↓EM）',
    before_author_note: '作者注释之前',
    after_author_note: '作者注释之后',
  };
  if (type !== 'at_depth') {
    return map[type];
  }
  if (role === 'assistant') {
    return '@D 🤖 [AI]在深度';
  }
  if (role === 'user') {
    return '@D 👤 [用户]在深度';
  }
  return '@D ⚙ [系统]在深度';
}

export function getPositionTypeLabel(type: PositionType, role: RoleType = 'system'): string {
  return getPositionTypeLabelWithRole(type, role);
}

export function parseAtDepthRoleFromPositionValue(value: unknown): RoleType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const depthMatch = value.match(/^at_depth_as_(system|assistant|user)$/);
  if (!depthMatch) {
    return null;
  }
  return depthMatch[1] as RoleType;
}

// ── Entry helpers ──────────────────────────────────────────────────

export function getEntryVisualStatus(entry: WorldbookEntry): 'constant' | 'vector' | 'normal' | 'disabled' {
  if (!entry.enabled) {
    return 'disabled';
  }
  if (entry.strategy.type === 'constant') {
    return 'constant';
  }
  if (entry.strategy.type === 'vectorized') {
    return 'vector';
  }
  return 'normal';
}

export function getEntryStatusLabel(entry: WorldbookEntry): string {
  const status = getEntryVisualStatus(entry);
  if (status === 'disabled') {
    return '⚫ 禁用';
  }
  if (status === 'constant') {
    return '🔵 常驻';
  }
  if (status === 'vector') {
    return '📎 向量化';
  }
  return '🟢 关键词';
}

export function getEntryKeyPreview(entry: WorldbookEntry): string {
  const rendered = entry.strategy.keys
    .slice(0, 3)
    .map(key => stringifyKeyword(key))
    .join(' / ');
  if (!rendered) {
    return '无关键词';
  }
  if (entry.strategy.keys.length > 3) {
    return `${rendered} ...`;
  }
  return rendered;
}

// ── Normalize helpers ──────────────────────────────────────────────

const strategyTypeOptions: StrategyType[] = ['constant', 'selective', 'vectorized'];
const secondaryLogicOptions: SecondaryLogic[] = ['and_any', 'and_all', 'not_all', 'not_any'];
const positionTypeOptions: PositionType[] = [
  'before_character_definition', 'after_character_definition',
  'before_example_messages', 'after_example_messages',
  'before_author_note', 'after_author_note', 'at_depth',
];

export { strategyTypeOptions, secondaryLogicOptions, positionTypeOptions };

export function normalizeSecondaryLogic(value: unknown): SecondaryLogic {
  if (typeof value === 'string' && secondaryLogicOptions.includes(value as SecondaryLogic)) {
    return value as SecondaryLogic;
  }
  if (typeof value === 'number') {
    const map: SecondaryLogic[] = ['and_any', 'and_all', 'not_all', 'not_any'];
    return map[value] ?? 'and_any';
  }
  return 'and_any';
}

export function normalizeStrategyType(
  raw: Record<string, unknown>,
  strategyRecord: Record<string, unknown> | null,
): StrategyType {
  const directType = strategyRecord?.type;
  if (typeof directType === 'string' && strategyTypeOptions.includes(directType as StrategyType)) {
    return directType as StrategyType;
  }
  if (raw.constant) {
    return 'constant';
  }
  if (raw.vectorized) {
    return 'vectorized';
  }
  return 'selective';
}

export function normalizePositionType(value: unknown): PositionType {
  if (typeof value === 'string') {
    if (positionTypeOptions.includes(value as PositionType)) {
      return value as PositionType;
    }
    if (value.startsWith('at_depth')) {
      return 'at_depth';
    }
  }
  if (typeof value === 'number') {
    const map: PositionType[] = [
      'before_character_definition', 'after_character_definition',
      'before_example_messages', 'after_example_messages',
      'before_author_note', 'after_author_note', 'at_depth',
    ];
    return map[value] ?? 'at_depth';
  }
  return 'at_depth';
}

export function normalizeRole(value: unknown): RoleType {
  if (typeof value === 'string') {
    if (['system', 'user', 'assistant'].includes(value)) {
      return value as RoleType;
    }
  }
  if (typeof value === 'number') {
    const map: RoleType[] = ['system', 'user', 'assistant'];
    return map[value] ?? 'system';
  }
  return 'system';
}

export function normalizeScanDepth(value: unknown): 'same_as_global' | number {
  if (value === null || value === undefined || value === 'same_as_global') {
    return 'same_as_global';
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 'same_as_global';
  }
  return Math.floor(parsed);
}

export function createDefaultEntry(uid: number): WorldbookEntry {
  return {
    uid,
    name: `条目 ${uid}`,
    enabled: true,
    content: '',
    probability: 100,
    strategy: {
      type: 'selective',
      keys: [],
      keys_secondary: { logic: 'and_any', keys: [] },
      scan_depth: 'same_as_global',
    },
    position: {
      type: 'at_depth',
      role: 'system',
      depth: 4,
      order: 100,
    },
    recursion: {
      delay_until: null,
      prevent_incoming: false,
      prevent_outgoing: false,
    },
    effect: {
      sticky: null,
      cooldown: null,
      delay: null,
    },
  };
}

export function collectExtraFields(raw: Record<string, unknown>): Record<string, unknown> | undefined {
  const KNOWN_KEYS = new Set([
    'uid', 'id', 'name', 'comment', 'content', 'enabled', 'disable',
    'strategy', 'position', 'recursion', 'effect', 'probability',
    'keys', 'key', 'secondary_keys', 'keysecondary', 'filters',
    'logic', 'selectiveLogic', 'role', 'depth', 'order', 'insertion_order',
    'scan_depth', 'constant', 'vectorized', 'selective',
    'preventRecursion', 'excludeRecursion', 'delayUntilRecursion',
    'sticky', 'cooldown', 'delay', 'extra',
  ]);
  const extra: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(k) && v !== undefined && v !== null && v !== '') {
      extra[k] = v;
    }
  }
  if (Object.keys(extra).length === 0) {
    return undefined;
  }
  return extra;
}

export function normalizeEntry(rawInput: unknown, fallbackUid: number): WorldbookEntry {
  const raw = asRecord(rawInput) ?? {};
  const base = createDefaultEntry(fallbackUid);
  const strategyRecord = asRecord(raw.strategy);
  const positionRecord = asRecord(raw.position);
  const recursionRecord = asRecord(raw.recursion);
  const effectRecord = asRecord(raw.effect);
  const secondaryRecord = asRecord(strategyRecord?.keys_secondary);

  const uid = Math.max(0, Math.floor(toNumberSafe(raw.uid ?? raw.id, fallbackUid)));
  const name = toStringSafe(raw.name ?? raw.comment, `条目 ${uid}`).trim() || `条目 ${uid}`;
  const strategyType = normalizeStrategyType(raw, strategyRecord);
  const keys = normalizeKeywordList(strategyRecord?.keys ?? raw.keys ?? raw.key);
  const secondaryKeys = normalizeKeywordList(
    secondaryRecord?.keys ?? raw.secondary_keys ?? raw.keysecondary ?? raw.filters,
  );
  const secondaryLogic = normalizeSecondaryLogic(secondaryRecord?.logic ?? raw.logic ?? raw.selectiveLogic);
  const rawPositionType = positionRecord?.type ?? raw.position;
  const inferredDepthRole = parseAtDepthRoleFromPositionValue(rawPositionType);
  const positionType = normalizePositionType(rawPositionType);
  const role = normalizeRole(positionRecord?.role ?? raw.role ?? inferredDepthRole);
  const depth = Math.max(0, Math.floor(toNumberSafe(positionRecord?.depth ?? raw.depth, 4)));
  const order = Math.floor(toNumberSafe(positionRecord?.order ?? raw.insertion_order ?? raw.order, 100));
  const probability = clampNumber(toNumberSafe(raw.probability, 100), 0, 100);

  const preventIncoming = recursionRecord?.prevent_incoming ?? raw.preventRecursion;
  const preventOutgoing = recursionRecord?.prevent_outgoing ?? raw.excludeRecursion;

  const entry: WorldbookEntry = {
    ...base,
    uid,
    name,
    enabled: raw.enabled === undefined ? raw.disable !== true : Boolean(raw.enabled),
    strategy: {
      type: strategyType,
      keys,
      keys_secondary: {
        logic: secondaryLogic,
        keys: secondaryKeys,
      },
      scan_depth: normalizeScanDepth(strategyRecord?.scan_depth ?? raw.scan_depth),
    },
    position: {
      type: positionType,
      role: positionType === 'at_depth' ? role : 'system',
      depth: positionType === 'at_depth' ? depth : 4,
      order,
    },
    content: toStringSafe(raw.content),
    probability,
    recursion: {
      delay_until: parseNullableInteger(recursionRecord?.delay_until ?? raw.delayUntilRecursion),
      prevent_incoming: Boolean(preventIncoming),
      prevent_outgoing: Boolean(preventOutgoing),
    },
    effect: {
      sticky: parseNullableInteger(effectRecord?.sticky ?? raw.sticky),
      cooldown: parseNullableInteger(effectRecord?.cooldown ?? raw.cooldown),
      delay: parseNullableInteger(effectRecord?.delay ?? raw.delay),
    },
  };

  const directExtra = asRecord(raw.extra);
  if (directExtra && Object.keys(directExtra).length > 0) {
    entry.extra = { ...directExtra };
  } else {
    const extras = collectExtraFields(raw);
    if (extras) {
      entry.extra = { ...extras };
    }
  }

  return entry;
}

export function normalizeEntryList(rawEntries: unknown[]): WorldbookEntry[] {
  const result: WorldbookEntry[] = [];
  const uidSet = new Set<number>();

  for (let index = 0; index < rawEntries.length; index += 1) {
    const rawRecord = asRecord(rawEntries[index]);
    let uid = Math.max(0, Math.floor(toNumberSafe(rawRecord?.uid ?? rawRecord?.id, index)));
    while (uidSet.has(uid)) {
      uid += 1;
    }
    uidSet.add(uid);
    result.push(normalizeEntry(rawEntries[index], uid));
  }

  return result;
}

export function getNextUid(entries: WorldbookEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }
  return Math.max(...entries.map(entry => entry.uid)) + 1;
}

// ── Preset role binding helpers ────────────────────────────────────

interface PresetRoleBinding {
  key: string;
  name: string;
  avatar: string;
  updated_at: number;
}

export function normalizePresetRoleBindings(rawList: unknown): PresetRoleBinding[] {
  if (!Array.isArray(rawList)) {
    return [];
  }
  const normalized: PresetRoleBinding[] = [];
  const seen = new Set<string>();
  for (const item of rawList) {
    const record = asRecord(item);
    if (!record) {
      continue;
    }
    const key = toStringSafe(record.key).trim();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push({
      key,
      name: toStringSafe(record.name, key),
      avatar: toStringSafe(record.avatar),
      updated_at: toNumberSafe(record.updated_at, Date.now()),
    });
  }
  return normalized;
}

const POSITION_TYPE_SORT_ORDER: Record<string, number> = {
  before_character_definition: 0,
  after_character_definition: 1,
  before_example_messages: 2,
  after_example_messages: 3,
  before_author_note: 4,
  after_author_note: 5,
  at_depth: 6,
};

export function compareEntriesByPositionThenOrder(a: WorldbookEntry, b: WorldbookEntry): number {
  const posA = POSITION_TYPE_SORT_ORDER[a.position.type] ?? 99;
  const posB = POSITION_TYPE_SORT_ORDER[b.position.type] ?? 99;
  if (posA !== posB) return posA - posB;
  if (a.position.type === 'at_depth' && b.position.type === 'at_depth') {
    if (a.position.depth !== b.position.depth) return a.position.depth - b.position.depth;
  }
  return a.position.order - b.position.order;
}

// Re-export used types
export type { StrategyType, SecondaryLogic, PositionType, RoleType, PresetRoleBinding };
