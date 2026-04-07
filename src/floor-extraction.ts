// ═══════════════════════════════════════════════════════════════════════
// ── Floor Extraction Button System (standalone, no Vue dependency) ──
// ═══════════════════════════════════════════════════════════════════════

import { subscribeEventSource } from './eventSourceCompat';
import {
  createWorldbookEntries,
  getChatMessages,
  getWorldbook,
  getWorldbookNames,
} from './hostApi';

/** Panel element ID — needed for theme variable sync */
const PANEL_ID = 'wb-assistant-panel';

function getHostDocument(): Document { return document; }
function getHostWindow(): Window { return window; }

const FLOOR_BTN_CLASS = 'wb-extract-floor-btn';
const EXTRACT_MODAL_ID = 'wb-extract-modal';
const EXTRACT_STYLE_ID = 'wb-extract-style';
const DEFAULT_IGNORE_TAGS = new Set(['think', 'thinking', 'recap', 'content', 'details', 'summary']);
const LAST_EXTRACT_WB_KEY = '__WB_EXTRACT_LAST_WB__';
const FLOOR_BTN_VISIBLE_KEY = '__WB_FLOOR_BTN_VISIBLE__';

let floorEventSubscriptions: { stop: () => void }[] = [];
let floorBtnToggleHandler: ((e: Event) => void) | null = null;

function isFloorBtnsVisible(): boolean {
  try { return localStorage.getItem(FLOOR_BTN_VISIBLE_KEY) !== 'false'; } catch { return true; }
}

function hideAllFloorButtons(): void {
  const doc = getHostDocument();
  $(`.${FLOOR_BTN_CLASS}`, doc).remove();
}

function showAllFloorButtons(): void {
  hideAllFloorButtons();
  injectAllFloorButtons();
}

// ── Tag extraction logic (pure function) ───────────────────────────
interface ExtractedFloorTag {
  tag: string;
  content: string;
  selected: boolean;
  duplicate?: boolean;
  updated?: boolean;
}

function extractTagsFromText(text: string, ignoreTags = DEFAULT_IGNORE_TAGS): { tag: string; content: string }[] {
  const regex = /<([^/<>\s]+)>([\s\S]*?)<\/\1>/g;
  const results: { tag: string; content: string }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const tagName = match[1];
    const innerContent = match[2];
    if (ignoreTags.has(tagName.toLowerCase())) {
      // Skip ignored tags but scan inner content recursively
      results.push(...extractTagsFromText(innerContent, ignoreTags));
    } else {
      results.push({ tag: tagName, content: innerContent.trim() });
    }
  }
  return results;
}

// ── CSS for floor buttons & extraction modal ───────────────────────
function ensureExtractStyle(): void {
  const doc = getHostDocument();
  if (doc.getElementById(EXTRACT_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = EXTRACT_STYLE_ID;
  style.textContent = `
/* ── Floor extraction button ── */
.${FLOOR_BTN_CLASS} {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1em;
  opacity: 0.5;
  transition: opacity 0.2s ease, transform 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.${FLOOR_BTN_CLASS}:hover {
  opacity: 1;
  transform: scale(1.15);
}
.${FLOOR_BTN_CLASS}:active {
  transform: scale(0.95);
}

/* ── Extraction modal (inside SillyTavern Popup) ── */
#${EXTRACT_MODAL_ID}.wbex-modal {
  background: var(--wb-surface-highest, rgba(53, 52, 58, 1));
  border-radius: 16px;
  box-shadow: var(--wb-shadow-main, 0 16px 48px rgba(0, 0, 0, 0.4));
  width: min(100%, 580px);
  max-width: 580px;
  margin-inline: auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--wb-text-main, #e2e8f0);
  text-align: left;
}

#${EXTRACT_MODAL_ID} .wbex-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--wb-border-subtle, rgba(255,255,255,0.05));
  background: var(--wb-surface-high, rgba(42, 41, 47, 1));
}

#${EXTRACT_MODAL_ID} .wbex-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--wb-text-main, #e2e8f0);
}

#${EXTRACT_MODAL_ID} .wbex-close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--wb-border-main, rgba(255,255,255,0.1));
  background: var(--wb-input-bg, rgba(0,0,0,0.25));
  color: var(--wb-text-main, #e2e8f0);
  font-size: 1.1em;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease;
}
#${EXTRACT_MODAL_ID} .wbex-close:hover {
  border-color: #f43f5e;
  background: var(--wb-input-bg-hover, rgba(0,0,0,0.4));
}

#${EXTRACT_MODAL_ID} .wbex-target {
  padding: 14px 20px;
  border-bottom: 1px solid var(--wb-border-subtle, rgba(255,255,255,0.05));
}
#${EXTRACT_MODAL_ID} .wbex-target > span {
  font-size: 12px;
  color: var(--wb-text-muted, #94a3b8);
  margin-bottom: 4px;
  display: block;
}

/* Searchable dropdown */
#${EXTRACT_MODAL_ID} .wbex-dropdown {
  position: relative;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-trigger {
  width: 100%;
  padding: 7px 32px 7px 10px;
  border: 1px solid var(--wb-border-main, rgba(255,255,255,0.1));
  border-radius: 8px;
  background: var(--wb-input-bg, rgba(0,0,0,0.25));
  color: var(--wb-text-main, #e2e8f0);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  position: relative;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-trigger::after {
  content: '\u25be';
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--wb-text-muted, #64748b);
  pointer-events: none;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-trigger:hover {
  border-color: var(--wb-primary-light, #60a5fa);
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 10;
  background: var(--wb-dropdown-bg, rgba(31, 31, 36, 0.95));
  border: 1px solid var(--wb-border-main, rgba(255,255,255,0.1));
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  max-height: 220px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-search {
  padding: 8px 10px;
  border: none;
  border-bottom: 1px solid var(--wb-border-subtle, rgba(255,255,255,0.05));
  background: transparent;
  color: var(--wb-text-main, #e2e8f0);
  font-size: 13px;
  outline: none;
  flex-shrink: 0;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-search::placeholder {
  color: var(--wb-text-muted, #64748b);
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-options {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-opt {
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--wb-text-main, #e2e8f0);
  transition: background 0.1s ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-opt:hover,
#${EXTRACT_MODAL_ID} .wbex-dropdown-opt.highlight {
  background: var(--wb-primary-hover, rgba(96, 165, 250, 0.15));
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-opt.selected {
  background: var(--wb-primary-soft, rgba(96, 165, 250, 0.1));
  color: var(--wb-primary-light, #60a5fa);
}
#${EXTRACT_MODAL_ID} .wbex-dropdown-empty {
  padding: 12px 10px;
  color: var(--wb-text-muted, #64748b);
  font-size: 12px;
  text-align: center;
}

#${EXTRACT_MODAL_ID} .wbex-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
}

#${EXTRACT_MODAL_ID} .wbex-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--wb-border-subtle, rgba(255,255,255,0.05));
  cursor: pointer;
  transition: background 0.15s ease;
}
#${EXTRACT_MODAL_ID} .wbex-item:last-child {
  border-bottom: none;
}
#${EXTRACT_MODAL_ID} .wbex-item:hover {
  background: var(--wb-primary-hover, rgba(96, 165, 250, 0.08));
  border-radius: 8px;
  margin: 0 -8px;
  padding: 12px 8px;
}
#${EXTRACT_MODAL_ID} .wbex-item input[type="checkbox"] {
  margin-top: 3px;
  cursor: pointer;
}
#${EXTRACT_MODAL_ID} .wbex-item.duplicate {
  opacity: 0.5;
}

#${EXTRACT_MODAL_ID} .wbex-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}
#${EXTRACT_MODAL_ID} .wbex-tag-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--wb-primary-light, #60a5fa);
}
#${EXTRACT_MODAL_ID} .wbex-tag-status {
  font-size: 0.85em;
  margin-left: 6px;
}
#${EXTRACT_MODAL_ID} .wbex-tag-status.dup { color: #f59e0b; }
#${EXTRACT_MODAL_ID} .wbex-tag-status.upd { color: var(--wb-primary, #3b82f6); }
#${EXTRACT_MODAL_ID} .wbex-tag-name-input {
  background: var(--wb-input-bg, rgba(0,0,0,0.25));
  border: 1px solid var(--wb-primary-light, #60a5fa);
  border-radius: 4px;
  color: var(--wb-primary-light, #60a5fa);
  font-weight: 600;
  font-size: 13px;
  padding: 2px 6px;
  outline: none;
  width: auto;
  min-width: 60px;
  max-width: 100%;
}

#${EXTRACT_MODAL_ID} .wbex-preview {
  font-size: 12px;
  color: var(--wb-text-muted, #64748b);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
  max-height: 60px;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
#${EXTRACT_MODAL_ID} .wbex-item.expanded .wbex-preview {
  max-height: none;
}
#${EXTRACT_MODAL_ID} .wbex-expand-hint {
  font-size: 11px;
  color: var(--wb-text-muted, #475569);
  cursor: pointer;
  user-select: none;
  margin-top: 2px;
}
#${EXTRACT_MODAL_ID} .wbex-expand-hint:hover {
  color: var(--wb-primary-light, #60a5fa);
}

#${EXTRACT_MODAL_ID} .wbex-actions {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--wb-border-subtle, rgba(255,255,255,0.05));
  justify-content: flex-end;
  background: var(--wb-surface-high, rgba(42, 41, 47, 1));
}

#${EXTRACT_MODAL_ID} .wbex-btn {
  padding: 7px 16px;
  border: 1px solid var(--wb-border-main, rgba(255,255,255,0.1));
  border-radius: 8px;
  background: var(--wb-input-bg, rgba(0,0,0,0.25));
  color: var(--wb-text-main, #e2e8f0);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}
#${EXTRACT_MODAL_ID} .wbex-btn:hover {
  border-color: var(--wb-primary-light, #60a5fa);
  background: var(--wb-input-bg-hover, rgba(0,0,0,0.4));
}
#${EXTRACT_MODAL_ID} .wbex-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
#${EXTRACT_MODAL_ID} .wbex-btn.primary {
  background: var(--wb-primary, #3b82f6);
  border-color: var(--wb-primary, #3b82f6);
  color: #fff;
}
#${EXTRACT_MODAL_ID} .wbex-btn.primary:hover {
  filter: brightness(1.1);
}

#${EXTRACT_MODAL_ID} .wbex-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--wb-text-muted, #64748b);
  font-size: 14px;
}

/* ── Mobile adaptation ── */
@media (max-width: 768px), (orientation: portrait) {
  #${EXTRACT_MODAL_ID}.wbex-modal {
    width: 100%;
    max-width: 100% !important;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }
  #${EXTRACT_MODAL_ID} .wbex-head {
    padding: 12px 14px;
    flex-shrink: 0;
  }
  #${EXTRACT_MODAL_ID} .wbex-title { font-size: 13px; }
  #${EXTRACT_MODAL_ID} .wbex-close { width: 28px; height: 28px; font-size: 1em; }
  #${EXTRACT_MODAL_ID} .wbex-target {
    padding: 10px 14px;
    flex-shrink: 0;
  }
  #${EXTRACT_MODAL_ID} .wbex-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 14px;
  }
  #${EXTRACT_MODAL_ID} .wbex-item {
    padding: 10px 0;
    gap: 10px;
  }
  #${EXTRACT_MODAL_ID} .wbex-item:hover {
    margin: 0;
    padding: 10px 0;
    background: transparent;
  }
  #${EXTRACT_MODAL_ID} .wbex-actions {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px;
    flex-shrink: 0;
  }
  #${EXTRACT_MODAL_ID} .wbex-actions .wbex-btn {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    padding: 8px 10px;
  }
}
`;
  doc.head.append(style);
}

// ── Inject extraction button into a single chat floor ──────────────
function injectButtonToFloor(mesId: number): void {
  if (!isFloorBtnsVisible()) return;
  const doc = getHostDocument();
  const $mes = $(`#chat > .mes[mesid="${mesId}"]`, doc);
  if (!$mes.length || $mes.find(`.${FLOOR_BTN_CLASS}`).length) return;

  const $extraBtns = $mes.find('.extraMesButtons, .mes_buttons');
  if (!$extraBtns.length) return;

  const btn = doc.createElement('div');
  btn.className = FLOOR_BTN_CLASS;
  btn.textContent = '📥';
  btn.title = '提取世界书条目';
  btn.dataset.mesid = String(mesId);
  $extraBtns.first().append(btn);
}

// ── Scan all displayed floors and inject buttons ───────────────────
function injectAllFloorButtons(): void {
  const doc = getHostDocument();
  $(`#chat > .mes`, doc).each(function () {
    const mesId = parseInt($(this).attr('mesid') || '-1');
    if (mesId >= 0) injectButtonToFloor(mesId);
  });
}

// ── Handle extraction for a single floor ───────────────────────────
function handleFloorExtract(mesId: number): void {
  let messages: Array<{ message: string; [key: string]: unknown }>;
  try {
    messages = getChatMessages(mesId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`读取楼层消息失败: ${message}`);
    return;
  }
  if (!messages.length) {
    toastr.warning('无法读取该楼层消息');
    return;
  }

  const content = messages[0].message || '';
  if (!content.trim()) {
    toastr.info('该楼层消息为空');
    return;
  }

  const raw = extractTagsFromText(content);
  if (raw.length === 0) {
    toastr.info('该楼层未找到 <tag>content</tag> 格式的条目');
    return;
  }

  // Dedup by tag name (keep last)
  const byName = new Map<string, { tag: string; content: string }>();
  for (const t of raw) {
    byName.set(t.tag.toLowerCase(), t);
  }

  const tags: ExtractedFloorTag[] = [...byName.values()].map(t => ({
    tag: t.tag,
    content: t.content,
    selected: true,
  }));

  showExtractionModal(tags, mesId);
}

// ── Mark duplicates against existing worldbook ─────────────────────
async function markDuplicatesForTags(tags: ExtractedFloorTag[], worldbookName: string): Promise<void> {
  if (!worldbookName) {
    for (const t of tags) { t.duplicate = false; t.updated = false; }
    return;
  }
  try {
    const existing = await getWorldbook(worldbookName);
    const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
    const existingMap = new Map<string, string>();
    for (const e of existing) {
      existingMap.set(e.name.toLowerCase(), norm(e.content));
    }
    for (const tag of tags) {
      const key = tag.tag.toLowerCase();
      const existingNorm = existingMap.get(key);
      const tagNorm = norm(tag.content);
      if (existingNorm === undefined) {
        tag.duplicate = false;
        tag.updated = false;
      } else if (existingNorm === tagNorm) {
        tag.duplicate = true;
        tag.updated = false;
        tag.selected = false;
      } else {
        tag.duplicate = false;
        tag.updated = true;
      }
    }
  } catch {
    for (const t of tags) { t.duplicate = false; t.updated = false; }
  }
}

// ── Standalone extraction modal ────────────────────────────────────
let activeExtractionPopup: { completeCancelled: () => Promise<void> } | null = null;

function closeExtractionModal(): void {
  if (activeExtractionPopup) {
    activeExtractionPopup.completeCancelled();
    activeExtractionPopup = null;
  }
}

function showExtractionModal(tags: ExtractedFloorTag[], mesId: number): void {
  const doc = getHostDocument();
  ensureExtractStyle();

  // Remove any existing modal
  closeExtractionModal();

  let wbNames: string[] = [];
  try {
    wbNames = getWorldbookNames();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`读取世界书列表失败: ${message}`);
  }

  // Build modal content (SillyTavern's Popup provides the overlay)
  const modal = doc.createElement('div');
  modal.className = 'wbex-modal';
  modal.id = EXTRACT_MODAL_ID;

  // ── Head
  const head = doc.createElement('div');
  head.className = 'wbex-head';
  const title = doc.createElement('span');
  title.className = 'wbex-title';
  title.textContent = `📋 提取到的条目（${tags.length}） — 第 ${mesId} 楼`;
  const closeBtn = doc.createElement('button');
  closeBtn.className = 'wbex-close';
  closeBtn.textContent = '×';
  closeBtn.type = 'button';
  closeBtn.addEventListener('click', closeExtractionModal);
  head.append(title, closeBtn);

  // ── Target worldbook selector (searchable dropdown)
  let selectedWb = '';
  // Restore last selection from localStorage
  try {
    const last = localStorage.getItem(LAST_EXTRACT_WB_KEY);
    if (last && wbNames.includes(last)) selectedWb = last;
  } catch { /* ignore */ }

  const targetSection = doc.createElement('div');
  targetSection.className = 'wbex-target';
  const targetSpan = doc.createElement('span');
  targetSpan.textContent = '目标世界书';

  const dropdownWrap = doc.createElement('div');
  dropdownWrap.className = 'wbex-dropdown';

  const trigger = doc.createElement('button');
  trigger.className = 'wbex-dropdown-trigger';
  trigger.type = 'button';
  trigger.textContent = selectedWb || '请选择目标世界书';

  let panelOpen = false;
  let dropdownPanel: HTMLDivElement | null = null;

  function selectWorldbook(name: string): void {
    selectedWb = name;
    trigger.textContent = name || '请选择目标世界书';
    try { localStorage.setItem(LAST_EXTRACT_WB_KEY, name); } catch { /* ignore */ }
    closeDropdown();
    updateCreateBtn();
    // Mark duplicates
    markDuplicatesForTags(tags, name).then(rerenderTagList);
  }

  function closeDropdown(): void {
    if (dropdownPanel) { dropdownPanel.remove(); dropdownPanel = null; }
    panelOpen = false;
  }

  function openDropdown(): void {
    if (panelOpen) { closeDropdown(); return; }
    panelOpen = true;

    const panel = doc.createElement('div');
    panel.className = 'wbex-dropdown-panel';
    dropdownPanel = panel;

    const searchInput = doc.createElement('input');
    searchInput.className = 'wbex-dropdown-search';
    searchInput.type = 'text';
    searchInput.placeholder = '搜索世界书...';

    const optionsContainer = doc.createElement('div');
    optionsContainer.className = 'wbex-dropdown-options';

    function renderOptions(filter: string): void {
      optionsContainer.innerHTML = '';
      const q = filter.toLowerCase();
      const filtered = wbNames.filter(n => !q || n.toLowerCase().includes(q));
      if (filtered.length === 0) {
        const empty = doc.createElement('div');
        empty.className = 'wbex-dropdown-empty';
        empty.textContent = '无匹配结果';
        optionsContainer.append(empty);
        return;
      }
      for (const name of filtered) {
        const opt = doc.createElement('div');
        opt.className = 'wbex-dropdown-opt' + (name === selectedWb ? ' selected' : '');
        opt.textContent = name;
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          selectWorldbook(name);
        });
        optionsContainer.append(opt);
      }
    }
    renderOptions('');

    searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDropdown();
    });

    panel.append(searchInput, optionsContainer);
    dropdownWrap.append(panel);

    // Focus search
    requestAnimationFrame(() => searchInput.focus());
  }

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    openDropdown();
  });

  // Close dropdown when clicking outside
  modal.addEventListener('click', () => closeDropdown());

  dropdownWrap.append(trigger);
  targetSection.append(targetSpan, dropdownWrap);

  // Auto-select remembered worldbook and mark duplicates
  if (selectedWb) {
    markDuplicatesForTags(tags, selectedWb).then(rerenderTagList);
  }

  // ── Tag list
  const listContainer = doc.createElement('div');
  listContainer.className = 'wbex-list';

  function rerenderTagList(): void {
    listContainer.innerHTML = '';
    if (tags.length === 0) {
      const empty = doc.createElement('div');
      empty.className = 'wbex-empty';
      empty.textContent = '没有提取到任何条目';
      listContainer.append(empty);
      return;
    }
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      const item = doc.createElement('div');
      item.className = 'wbex-item' + (tag.duplicate ? ' duplicate' : '');

      const cb = doc.createElement('input');
      cb.type = 'checkbox';
      cb.checked = tag.selected;
      cb.addEventListener('change', () => { tag.selected = cb.checked; updateCreateBtn(); });

      const info = doc.createElement('div');
      info.className = 'wbex-info';

      const nameEl = doc.createElement('span');
      nameEl.className = 'wbex-tag-name';
      nameEl.textContent = tag.tag;
      nameEl.title = '点击重命名';
      nameEl.style.cursor = 'pointer';

      // Click tag name to rename inline
      nameEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const input = doc.createElement('input');
        input.className = 'wbex-tag-name-input';
        input.type = 'text';
        input.value = tag.tag;
        input.size = Math.max(tag.tag.length, 6);

        let renamed = false;
        const confirmRename = () => {
          if (renamed) return;
          renamed = true;
          const newName = input.value.trim();
          if (newName) {
            tag.tag = newName;
            nameEl.textContent = newName;
            nameEl.title = '点击重命名';
          }
          // Restore status badge
          if (tag.duplicate) {
            const s = doc.createElement('span');
            s.className = 'wbex-tag-status dup';
            s.textContent = '⚠️ 已存在';
            nameEl.append(s);
          } else if (tag.updated) {
            const s = doc.createElement('span');
            s.className = 'wbex-tag-status upd';
            s.textContent = '🔄 内容已更新';
            nameEl.append(s);
          }
        };

        input.addEventListener('blur', confirmRename);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { ke.preventDefault(); input.blur(); }
          if (ke.key === 'Escape') { input.value = tag.tag; input.blur(); }
        });

        nameEl.textContent = '';
        nameEl.append(input);
        input.focus();
        input.select();
      });

      if (tag.duplicate) {
        const status = doc.createElement('span');
        status.className = 'wbex-tag-status dup';
        status.textContent = '⚠️ 已存在';
        nameEl.append(status);
      } else if (tag.updated) {
        const status = doc.createElement('span');
        status.className = 'wbex-tag-status upd';
        status.textContent = '🔄 内容已更新';
        nameEl.append(status);
      }

      const preview = doc.createElement('span');
      preview.className = 'wbex-preview';
      const isLong = tag.content.length > 120;
      preview.textContent = isLong ? tag.content.slice(0, 120) + '...' : tag.content;

      const expandHint = doc.createElement('span');
      expandHint.className = 'wbex-expand-hint';
      expandHint.textContent = isLong ? '▶ 点击查看完整内容' : '';

      // Click info area to expand/collapse (skip if clicking tag name or input)
      info.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.wbex-tag-name') || (e.target as HTMLElement).tagName === 'INPUT') return;
        e.stopPropagation();
        const expanded = item.classList.toggle('expanded');
        if (expanded) {
          preview.textContent = tag.content;
          expandHint.textContent = '▼ 收起';
        } else {
          preview.textContent = isLong ? tag.content.slice(0, 120) + '...' : tag.content;
          expandHint.textContent = isLong ? '▶ 点击查看完整内容' : '';
        }
      });

      info.append(nameEl, preview, expandHint);
      item.append(cb, info);
      listContainer.append(item);
    }
  }
  rerenderTagList();

  // ── Actions
  const actions = doc.createElement('div');
  actions.className = 'wbex-actions';

  const selectAllBtn = doc.createElement('button');
  selectAllBtn.className = 'wbex-btn';
  selectAllBtn.type = 'button';
  selectAllBtn.textContent = '全选';
  selectAllBtn.addEventListener('click', () => {
    tags.forEach(t => t.selected = true);
    rerenderTagList();
    updateCreateBtn();
  });

  const selectNoneBtn = doc.createElement('button');
  selectNoneBtn.className = 'wbex-btn';
  selectNoneBtn.type = 'button';
  selectNoneBtn.textContent = '全不选';
  selectNoneBtn.addEventListener('click', () => {
    tags.forEach(t => t.selected = false);
    rerenderTagList();
    updateCreateBtn();
  });

  const createBtn = doc.createElement('button');
  createBtn.className = 'wbex-btn primary';
  createBtn.type = 'button';

  function updateCreateBtn(): void {
    const count = tags.filter(t => t.selected).length;
    createBtn.textContent = `创建选中条目（${count}）`;
    createBtn.disabled = count === 0 || !selectedWb;
  }
  updateCreateBtn();

  createBtn.addEventListener('click', async () => {
    const selected = tags.filter(t => t.selected);
    const targetName = selectedWb;
    if (!selected.length || !targetName) return;

    createBtn.disabled = true;
    createBtn.textContent = '创建中...';
    try {
      const newEntries = selected.map(t => ({
        name: t.tag,
        content: t.content,
      }));
      await createWorldbookEntries(targetName, newEntries);
      toastr.success(`已创建 ${selected.length} 个条目到 "${targetName}"`);
      closeExtractionModal();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toastr.error(`创建条目失败: ${msg}`);
      updateCreateBtn();
    }
  });


  actions.append(selectAllBtn, selectNoneBtn, createBtn);

  // ── Assemble modal content
  modal.append(head, targetSection, listContainer, actions);

  // ── Sync theme variables from Vue panel root to modal
  const panelBody = doc.getElementById(PANEL_ID);
  const vueRoot = panelBody?.querySelector('.wb-assistant-root') as HTMLElement | null;
  if (vueRoot) {
    const cs = getComputedStyle(vueRoot);
    const vars = [
      '--wb-bg-root', '--wb-bg-panel', '--wb-text-main', '--wb-text-muted',
      '--wb-primary', '--wb-primary-light', '--wb-primary-hover', '--wb-primary-soft',
      '--wb-primary-glow', '--wb-input-bg', '--wb-input-bg-hover', '--wb-input-bg-focus',
      '--wb-border-subtle', '--wb-border-main', '--wb-shadow-main',
      '--wb-surface-low', '--wb-surface-high', '--wb-surface-highest', '--wb-surface-bright',
      '--wb-overlay-bg', '--wb-dropdown-bg', '--wb-gradient-primary',
      '--wb-primary-container', '--wb-error', '--wb-error-container',
    ];
    for (const v of vars) {
      const val = cs.getPropertyValue(v);
      if (val) modal.style.setProperty(v, val);
    }
  }

  // ── Show via SillyTavern's native Popup API (works on mobile)
  const hostWindow = getHostWindow();
  const shouldUseWidePopup = hostWindow.innerWidth <= 900;
  const popup = new SillyTavern.Popup(
    modal,
    SillyTavern.POPUP_TYPE.DISPLAY,
    '',
    { wide: shouldUseWidePopup, allowVerticalScrolling: true },
  );
  activeExtractionPopup = popup;
  popup.show();
}

// ── Event listeners for floor button injection ─────────────────────
function startFloorButtonListeners(): void {
  const doc = getHostDocument();

  // ── Delegated click handler for floor extraction buttons (cross-iframe safe)
  const FLOOR_NS = '.wbFloorExtract';
  $(doc).off(`click${FLOOR_NS}`, `.${FLOOR_BTN_CLASS}`)
    .on(`click${FLOOR_NS}`, `.${FLOOR_BTN_CLASS}`, function (this: HTMLElement, e: JQuery.Event) {
      e.stopPropagation();
      e.preventDefault();
      const mesId = parseInt(this.dataset.mesid || '-1');
      if (mesId >= 0) handleFloorExtract(mesId);
    });

  // Inject into existing floors (if visible)
  if (isFloorBtnsVisible()) {
    injectAllFloorButtons();
  }

  // Listen for new floors being rendered
  const onCharRendered = (messageId: number) => {
    injectButtonToFloor(messageId);
  };
  const onUserRendered = (messageId: number) => {
    injectButtonToFloor(messageId);
  };
  const onChatChanged = () => {
    // Small delay to let DOM update
    setTimeout(() => {
      if (isFloorBtnsVisible()) injectAllFloorButtons();
    }, 300);
  };

  // Subscribe via SillyTavern global context eventSource
  const ctx = (window as any).SillyTavern?.getContext?.();
  if (ctx?.eventSource && ctx?.eventTypes) {
    const charRenderedSubscription = subscribeEventSource(ctx.eventSource, ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, onCharRendered);
    if (charRenderedSubscription) {
      floorEventSubscriptions.push(charRenderedSubscription);
    }
    const userRenderedSubscription = subscribeEventSource(ctx.eventSource, ctx.eventTypes.USER_MESSAGE_RENDERED, onUserRendered);
    if (userRenderedSubscription) {
      floorEventSubscriptions.push(userRenderedSubscription);
    }
    const chatChangedSubscription = subscribeEventSource(ctx.eventSource, ctx.eventTypes.CHAT_CHANGED, onChatChanged);
    if (chatChangedSubscription) {
      floorEventSubscriptions.push(chatChangedSubscription);
    }
  }

  // Listen for toggle event from App.vue
  floorBtnToggleHandler = (e: Event) => {
    const visible = (e as CustomEvent).detail;
    if (visible) {
      showAllFloorButtons();
    } else {
      hideAllFloorButtons();
    }
  };
  window.addEventListener('wb-helper:floor-btns-toggle', floorBtnToggleHandler);
}

function stopFloorButtonListeners(): void {
  for (const sub of floorEventSubscriptions) {
    sub.stop();
  }
  floorEventSubscriptions = [];
  if (floorBtnToggleHandler) {
    window.removeEventListener('wb-helper:floor-btns-toggle', floorBtnToggleHandler);
    floorBtnToggleHandler = null;
  }
  // Remove delegated click handler
  try {
    const doc = getHostDocument();
    $(doc).off('.wbFloorExtract');
  } catch { /* cleanup best-effort */ }
}

export {
  FLOOR_BTN_CLASS,
  EXTRACT_STYLE_ID,
  startFloorButtonListeners,
  stopFloorButtonListeners,
  closeExtractionModal,
};
