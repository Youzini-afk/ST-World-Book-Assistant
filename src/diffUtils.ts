/**
 * Shared diff utility functions used by both history snapshots and cross-copy.
 * Pure functions with no Vue reactivity dependency.
 */

declare function diffLines(oldStr: string, newStr: string): Array<{ value: string; added?: boolean; removed?: boolean }>;
import {
  toStringSafe,
  stringifyKeyword,
  getStrategyTypeLabel,
  getSecondaryLogicLabel,
  getPositionTypeLabel,
} from './utils';
import type {
  CrossCopyFieldDiffRow,
  CrossCopyTextDiffLine,
  CrossCopyTextDiffResult,
  EntryFieldDiffOptions,
  WorldbookHistoryCompareRow,
  WorldbookHistoryCompareStatus,
  WorldbookVersionView,
  EntryVersionView,
} from './types';

// ── Name / content normalization ────────────────────────────────────

export function normalizeCrossCopyNameKey(name: string): string {
  return toStringSafe(name).trim().toLowerCase();
}

export function normalizeCrossCopyContentKey(content: string): string {
  return toStringSafe(content).replace(/\s+/g, ' ').trim();
}

// ── Scalar formatters ───────────────────────────────────────────────

export function formatCrossCopyDiffScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? '是' : '否';
  const rendered = toStringSafe(value).trim();
  return rendered || '(空)';
}

export function formatCrossCopyDiffKeywords(list: unknown[]): string {
  if (!Array.isArray(list) || !list.length) return '(空)';
  return list.map(item => stringifyKeyword(item as any)).join(' , ');
}

export function formatCrossCopyDiffExtra(extra: WorldbookEntry['extra']): string {
  if (!extra || typeof extra !== 'object') return '无';
  const keys = Object.keys(extra);
  if (!keys.length) return '无';
  const preview = keys.slice(0, 6).join(', ');
  return keys.length > 6 ? `${keys.length} 项: ${preview} ...` : `${keys.length} 项: ${preview}`;
}

// ── Entry field diff rows ───────────────────────────────────────────

export function buildEntryFieldDiffRows(
  leftEntry: WorldbookEntry | null,
  rightEntry: WorldbookEntry | null,
  options: EntryFieldDiffOptions = {},
): CrossCopyFieldDiffRow[] {
  if (!leftEntry && !rightEntry) return [];
  const leftFallback = options.left_fallback ?? '（无命中）';
  const rightFallback = options.right_fallback ?? '（无命中）';
  const rows: CrossCopyFieldDiffRow[] = [];
  const pushRow = (key: string, label: string, left: string, right: string): void => {
    rows.push({ key, label, left, right, changed: left !== right });
  };

  pushRow('name', '名称', leftEntry ? (leftEntry.name || '(空)') : leftFallback, rightEntry ? (rightEntry.name || '(空)') : rightFallback);
  pushRow('enabled', '启用', leftEntry ? (leftEntry.enabled ? '启用' : '禁用') : leftFallback, rightEntry ? (rightEntry.enabled ? '启用' : '禁用') : rightFallback);
  pushRow('strategy_type', '触发模式', leftEntry ? getStrategyTypeLabel(leftEntry.strategy.type) : leftFallback, rightEntry ? getStrategyTypeLabel(rightEntry.strategy.type) : rightFallback);
  pushRow('probability', '概率', leftEntry ? `${leftEntry.probability}%` : leftFallback, rightEntry ? `${rightEntry.probability}%` : rightFallback);
  pushRow('keys', '主要关键词', leftEntry ? formatCrossCopyDiffKeywords(leftEntry.strategy.keys) : leftFallback, rightEntry ? formatCrossCopyDiffKeywords(rightEntry.strategy.keys) : rightFallback);
  pushRow('secondary_keys', '次要关键词', leftEntry ? formatCrossCopyDiffKeywords(leftEntry.strategy.keys_secondary.keys) : leftFallback, rightEntry ? formatCrossCopyDiffKeywords(rightEntry.strategy.keys_secondary.keys) : rightFallback);
  pushRow('secondary_logic', '次要逻辑', leftEntry ? getSecondaryLogicLabel(leftEntry.strategy.keys_secondary.logic) : leftFallback, rightEntry ? getSecondaryLogicLabel(rightEntry.strategy.keys_secondary.logic) : rightFallback);
  pushRow('position_type', '插入位置', leftEntry ? getPositionTypeLabel(leftEntry.position.type, leftEntry.position.role) : leftFallback, rightEntry ? getPositionTypeLabel(rightEntry.position.type, rightEntry.position.role) : rightFallback);
  pushRow('position_order', '插入权重', leftEntry ? String(leftEntry.position.order) : leftFallback, rightEntry ? String(rightEntry.position.order) : rightFallback);
  pushRow('at_depth_role', '深度角色', leftEntry ? (leftEntry.position.type === 'at_depth' ? leftEntry.position.role : '-') : leftFallback, rightEntry ? (rightEntry.position.type === 'at_depth' ? rightEntry.position.role : '-') : rightFallback);
  pushRow('at_depth_depth', '深度层级', leftEntry ? (leftEntry.position.type === 'at_depth' ? String(leftEntry.position.depth) : '-') : leftFallback, rightEntry ? (rightEntry.position.type === 'at_depth' ? String(rightEntry.position.depth) : '-') : rightFallback);
  pushRow('recursion_in', '不可递归命中', leftEntry ? (leftEntry.recursion.prevent_incoming ? '是' : '否') : leftFallback, rightEntry ? (rightEntry.recursion.prevent_incoming ? '是' : '否') : rightFallback);
  pushRow('recursion_out', '阻止后续递归', leftEntry ? (leftEntry.recursion.prevent_outgoing ? '是' : '否') : leftFallback, rightEntry ? (rightEntry.recursion.prevent_outgoing ? '是' : '否') : rightFallback);
  pushRow('recursion_delay_until', '递归 delay_until', leftEntry ? formatCrossCopyDiffScalar(leftEntry.recursion.delay_until) : leftFallback, rightEntry ? formatCrossCopyDiffScalar(rightEntry.recursion.delay_until) : rightFallback);
  pushRow('effect_sticky', 'sticky', leftEntry ? formatCrossCopyDiffScalar(leftEntry.effect.sticky) : leftFallback, rightEntry ? formatCrossCopyDiffScalar(rightEntry.effect.sticky) : rightFallback);
  pushRow('effect_cooldown', 'cooldown', leftEntry ? formatCrossCopyDiffScalar(leftEntry.effect.cooldown) : leftFallback, rightEntry ? formatCrossCopyDiffScalar(rightEntry.effect.cooldown) : rightFallback);
  pushRow('effect_delay', 'delay', leftEntry ? formatCrossCopyDiffScalar(leftEntry.effect.delay) : leftFallback, rightEntry ? formatCrossCopyDiffScalar(rightEntry.effect.delay) : rightFallback);
  pushRow('extra', 'extra 字段', leftEntry ? formatCrossCopyDiffExtra(leftEntry.extra) : leftFallback, rightEntry ? formatCrossCopyDiffExtra(rightEntry.extra) : rightFallback);
  return rows;
}

// ── Text diff ───────────────────────────────────────────────────────

export function buildCrossCopyTextDiff(leftText: string, rightText: string): CrossCopyTextDiffResult {
  const left: CrossCopyTextDiffLine[] = [];
  const right: CrossCopyTextDiffLine[] = [];
  let leftLineNo = 1;
  let rightLineNo = 1;
  let addLines = 0;
  let delLines = 0;
  const parts = diffLines(leftText, rightText);

  for (const part of parts as Array<{ value: string; added?: boolean; removed?: boolean }>) {
    const lines = part.value.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    if (!lines.length) continue;

    if (part.added) {
      for (const line of lines) {
        left.push({ type: 'empty', line_no: null, text: '' });
        right.push({ type: 'add', line_no: rightLineNo, text: line });
        rightLineNo += 1;
        addLines += 1;
      }
      continue;
    }
    if (part.removed) {
      for (const line of lines) {
        left.push({ type: 'del', line_no: leftLineNo, text: line });
        right.push({ type: 'empty', line_no: null, text: '' });
        leftLineNo += 1;
        delLines += 1;
      }
      continue;
    }
    for (const line of lines) {
      left.push({ type: 'same', line_no: leftLineNo, text: line });
      right.push({ type: 'same', line_no: rightLineNo, text: line });
      leftLineNo += 1;
      rightLineNo += 1;
    }
  }

  if (!left.length && !right.length) {
    left.push({ type: 'same', line_no: 1, text: '(空内容)' });
    right.push({ type: 'same', line_no: 1, text: '(空内容)' });
  }

  const changed = Math.min(addLines, delLines);
  return {
    left,
    right,
    added: Math.max(0, addLines - changed),
    removed: Math.max(0, delLines - changed),
    changed,
  };
}

// ── Entry serialization for diff ────────────────────────────────────

export function serializeWorldbookEntryForDiff(entry: WorldbookEntry | null): string {
  if (!entry) return '';
  const payload = {
    uid: entry.uid,
    name: entry.name,
    enabled: entry.enabled,
    strategy: entry.strategy,
    position: entry.position,
    probability: entry.probability,
    recursion: entry.recursion,
    effect: entry.effect,
    content: entry.content,
    extra: entry.extra ?? null,
  };
  return JSON.stringify(payload, null, 2);
}

export function areWorldbookEntriesEqual(left: WorldbookEntry | null, right: WorldbookEntry | null): boolean {
  return serializeWorldbookEntryForDiff(left) === serializeWorldbookEntryForDiff(right);
}

// ── Entry pair diff summary ─────────────────────────────────────────

export function getEntryPairDiffSummary(
  left: WorldbookEntry | null,
  right: WorldbookEntry | null,
  labels: { left: string; right: string } = { left: 'Left', right: 'Right' },
): string {
  if (!left && !right) return '无可比较条目';
  if (!left) return `仅${labels.right}存在`;
  if (!right) return `仅${labels.left}存在`;

  const diff: string[] = [];
  if (normalizeCrossCopyNameKey(left.name) !== normalizeCrossCopyNameKey(right.name)) diff.push('名称不同');
  if (normalizeCrossCopyContentKey(left.content) !== normalizeCrossCopyContentKey(right.content)) diff.push('内容不同');
  if (left.enabled !== right.enabled) diff.push('启用状态不同');
  if (left.strategy.type !== right.strategy.type) diff.push('策略不同');
  if (left.probability !== right.probability) diff.push('概率不同');
  if (
    left.position.type !== right.position.type ||
    left.position.order !== right.position.order ||
    left.position.role !== right.position.role ||
    left.position.depth !== right.position.depth
  ) diff.push('插入设置不同');
  if (
    left.recursion.prevent_incoming !== right.recursion.prevent_incoming ||
    left.recursion.prevent_outgoing !== right.recursion.prevent_outgoing ||
    left.recursion.delay_until !== right.recursion.delay_until
  ) diff.push('递归设置不同');
  if (
    left.effect.sticky !== right.effect.sticky ||
    left.effect.cooldown !== right.effect.cooldown ||
    left.effect.delay !== right.effect.delay
  ) diff.push('效果设置不同');
  if (left.strategy.keys.length !== right.strategy.keys.length) diff.push('主要关键词数量不同');
  if (left.strategy.keys_secondary.keys.length !== right.strategy.keys_secondary.keys.length) diff.push('次要关键词数量不同');

  if (!diff.length) return '主要字段一致';
  return diff.join(' / ');
}

// ── Worldbook history compare rows ──────────────────────────────────

export function buildWorldbookHistoryCompareRows(
  left: WorldbookVersionView | null,
  right: WorldbookVersionView | null,
): WorldbookHistoryCompareRow[] {
  if (!left || !right) return [];

  const rows: WorldbookHistoryCompareRow[] = [];
  const leftMap = new Map<number, WorldbookEntry>();
  const rightMap = new Map<number, WorldbookEntry>();
  for (const entry of left.entries) leftMap.set(entry.uid, entry);
  for (const entry of right.entries) rightMap.set(entry.uid, entry);

  for (const rightEntry of right.entries) {
    const leftEntry = leftMap.get(rightEntry.uid) ?? null;
    if (!leftEntry) {
      rows.push({
        key: `added:${rightEntry.uid}`,
        uid: rightEntry.uid,
        status: 'added',
        title: rightEntry.name || `条目 ${rightEntry.uid}`,
        note: '仅在 Right 版本存在',
        left_entry: null,
        right_entry: rightEntry,
      });
      continue;
    }
    if (!areWorldbookEntriesEqual(leftEntry, rightEntry)) {
      rows.push({
        key: `changed:${rightEntry.uid}`,
        uid: rightEntry.uid,
        status: 'changed',
        title: rightEntry.name || leftEntry.name || `条目 ${rightEntry.uid}`,
        note: getEntryPairDiffSummary(leftEntry, rightEntry),
        left_entry: leftEntry,
        right_entry: rightEntry,
      });
    }
  }

  for (const leftEntry of left.entries) {
    if (rightMap.has(leftEntry.uid)) continue;
    rows.push({
      key: `removed:${leftEntry.uid}`,
      uid: leftEntry.uid,
      status: 'removed',
      title: leftEntry.name || `条目 ${leftEntry.uid}`,
      note: '仅在 Left 版本存在',
      left_entry: leftEntry,
      right_entry: null,
    });
  }

  return rows;
}

// ── History status labels ───────────────────────────────────────────

export function getWorldbookHistoryVersionPreview(view: WorldbookVersionView | null): string {
  if (!view) return '';
  if (!view.entries.length) return '空世界书';
  const enabledCount = view.entries.filter(entry => entry.enabled).length;
  const sampleNames = view.entries.slice(0, 3).map(entry => entry.name || `#${entry.uid}`).join(' / ');
  const suffix = view.entries.length > 3 ? ' ...' : '';
  return `启用 ${enabledCount}/${view.entries.length} · ${sampleNames}${suffix}`;
}

export function getWorldbookHistoryStatusLabel(status: WorldbookHistoryCompareStatus): string {
  if (status === 'added') return '新增';
  if (status === 'removed') return '删除';
  return '修改';
}

export function getWorldbookHistoryStatusBadgeClass(status: WorldbookHistoryCompareStatus): string {
  if (status === 'added') return 'new';
  if (status === 'removed') return 'invalid';
  return 'changed';
}

export function getEntryVersionDiffSummary(left: EntryVersionView | null, right: EntryVersionView | null): string {
  if (!left || !right) return '请在左侧选择两个版本进行比对';
  const fieldRows = buildEntryFieldDiffRows(left.entry, right.entry, { left_fallback: '（不存在）', right_fallback: '（不存在）' });
  const fieldChanged = fieldRows.filter(row => row.changed).length;
  const content = buildCrossCopyTextDiff(toStringSafe(left.entry.content), toStringSafe(right.entry.content));
  return `字段 ${fieldChanged}/${fieldRows.length} 不同 · 新增行 ${content.added} / 修改行 ${content.changed} / 删除行 ${content.removed}`;
}

export function getWorldbookVersionDiffSummary(
  left: WorldbookVersionView | null,
  right: WorldbookVersionView | null,
): string {
  if (!left || !right) return '请选择左右版本进行对比';
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const row of buildWorldbookHistoryCompareRows(left, right)) {
    if (row.status === 'added') added += 1;
    else if (row.status === 'removed') removed += 1;
    else changed += 1;
  }
  return `新增 ${added} / 修改 ${changed} / 删除 ${removed}`;
}
