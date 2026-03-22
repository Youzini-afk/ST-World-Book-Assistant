import { createApp, type App as VueApp } from 'vue';
import WorldbookAssistantApp from './App.vue';

const MENU_ID = 'wb-assistant-menu-item';
const PANEL_ID = 'wb-assistant-panel';
const FAB_ID = 'wb-assistant-fab';
const FAB_POS_KEY = '__WB_FAB_POS__';
const FAB_VISIBLE_KEY = '__WB_FAB_VISIBLE__';
const FAB_VISIBLE_SET_EVENT = 'wb-helper:set-fab-visible';
const FAB_VISIBLE_CHANGED_EVENT = 'wb-helper:fab-visible-changed';
const PANEL_STYLE_ID = 'wb-assistant-panel-style';
const PANEL_BODY_ID = 'wb-assistant-panel-body';
const EVENT_NS = '.wbAssistantMenu';
const SHIELD_EVENT_NS = '.wbAssistantShield';
const DIRTY_STATE_KEY = '__WB_ASSISTANT_HAS_UNSAVED_CHANGES__';
const NO_KEYBOARD_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

let app: VueApp<Element> | null = null;
let panelRoot: HTMLDivElement | null = null;
let menuObserver: MutationObserver | null = null;
let menuRetryTimer: number | null = null;
let isPanelVisible = false;
let fabViewportSyncScrollHandler: (() => void) | null = null;
let fabViewportSyncResizeHandler: (() => void) | null = null;
let fabViewportSyncRaf: number | null = null;
let fabVisibilitySetHandler: ((event: Event) => void) | null = null;

function getHostWindow(): Window {
  return window;
}

function getHostDocument(): Document {
  return document;
}

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  const inputLike = target.closest('textarea, select, input, [contenteditable], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]');
  if (!inputLike) {
    return false;
  }

  if (inputLike instanceof HTMLTextAreaElement) {
    return !inputLike.disabled && !inputLike.readOnly;
  }
  if (inputLike instanceof HTMLSelectElement) {
    return !inputLike.disabled;
  }
  if (inputLike instanceof HTMLInputElement) {
    if (inputLike.disabled || inputLike.readOnly) {
      return false;
    }
    return !NO_KEYBOARD_INPUT_TYPES.has(inputLike.type.toLowerCase());
  }

  return true;
}

function blurHostActiveInput(panel?: HTMLElement): void {
  const doc = getHostDocument();
  const active = doc.activeElement;
  if (!(active instanceof HTMLElement)) {
    return;
  }
  if (panel && panel.contains(active)) {
    return;
  }
  if (active.matches('input, textarea, select, [contenteditable], [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]')) {
    active.blur();
  }
}

function bindPanelInteractionShield($panel: JQuery): void {
  const handleStart = (event: JQuery.Event): void => {
    event.stopPropagation();
    const panel = $panel[0] as HTMLDivElement | undefined;
    if (!panel || isTextEntryTarget(event.target)) {
      return;
    }
    blurHostActiveInput(panel);
  };

  const handleClick = (event: JQuery.Event): void => {
    event.stopPropagation();
  };

  $panel.off(`pointerdown${SHIELD_EVENT_NS}`).on(`pointerdown${SHIELD_EVENT_NS}`, handleStart);
  $panel.off(`mousedown${SHIELD_EVENT_NS}`).on(`mousedown${SHIELD_EVENT_NS}`, handleStart);
  $panel.off(`touchstart${SHIELD_EVENT_NS}`).on(`touchstart${SHIELD_EVENT_NS}`, handleStart);
  $panel.off(`click${SHIELD_EVENT_NS}`).on(`click${SHIELD_EVENT_NS}`, handleClick);
}

function ensurePanelStyle(): void {
  const doc = getHostDocument();
  if (doc.getElementById(PANEL_STYLE_ID)) {
    return;
  }
  const style = doc.createElement('style');
  style.id = PANEL_STYLE_ID;
  style.textContent = `
#${PANEL_ID} {
  position: fixed;
  z-index: 10020;
  inset: 0;
  margin: auto;
  transform: scale(0.95);
  transform-origin: center center;
  width: min(1680px, 92vw);
  height: calc(100vh - 16px);
  min-width: 920px;
  min-height: 560px;
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  display: flex;
  flex-direction: column;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  border: 1px solid var(--wb-host-border, #334155);
  border-radius: 10px;
  background: var(--wb-host-bg, #0b1220);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
  overflow: hidden;
  resize: both;
  transition: opacity 0.25s cubic-bezier(0.19, 1, 0.22, 1), transform 0.25s cubic-bezier(0.19, 1, 0.22, 1), visibility 0.25s;
}

#${PANEL_ID}.active {
  opacity: 1;
  visibility: visible;
  pointer-events: auto;
  transform: none;
  transition: opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

#${PANEL_ID} .wb-assistant-header {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px 0 12px;
  background: var(--wb-host-header-bg, #111827);
  border-bottom: 1px solid var(--wb-host-border, #334155);
  cursor: move;
  user-select: none;
  position: relative;
  z-index: 10;
}

#${PANEL_ID} .wb-assistant-header-title {
  color: var(--wb-host-text, #e2e8f0);
  font-size: 14px;
  font-weight: 600;
}

#${PANEL_ID} .wb-assistant-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

#${PANEL_ID} .wb-assistant-tool {
  width: 30px;
  height: 30px;
  border: 1px solid var(--wb-host-tool-border, #475569);
  border-radius: 6px;
  background: var(--wb-host-tool-bg, #1f2937);
  color: var(--wb-host-text, #e2e8f0);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

#${PANEL_ID} .wb-assistant-tool:hover {
  border-color: #60a5fa;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0,0,0,0.25);
}

#${PANEL_ID} .wb-assistant-tool:active {
  transform: translateY(1px) scale(0.95);
  box-shadow: none;
}

#${PANEL_ID} .wb-assistant-theme:hover {
  border-color: #a78bfa;
}

#${PANEL_ID} .wb-assistant-save:hover {
  border-color: #34d399;
}

@keyframes wb-pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); border-color: rgba(52, 211, 153, 0.6); }
  70% { box-shadow: 0 0 0 6px rgba(52, 211, 153, 0); border-color: rgba(52, 211, 153, 1); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); border-color: rgba(52, 211, 153, 0.6); }
}

#${PANEL_ID} .wb-assistant-save.glow-pulse {
  animation: wb-pulse-glow 2s infinite ease-out;
  border-color: #34d399;
  color: #34d399;
}

#${PANEL_ID} .wb-assistant-close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--wb-host-tool-border, #475569);
  border-radius: 6px;
  background: var(--wb-host-tool-bg, #1f2937);
  color: var(--wb-host-text, #e2e8f0);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

#${PANEL_ID} .wb-assistant-close:hover {
  border-color: #f43f5e;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(244,63,94,0.25);
}

#${PANEL_ID} .wb-assistant-close:active {
  transform: translateY(1px) scale(0.95);
  box-shadow: none;
}

#${PANEL_BODY_ID} {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

#${PANEL_BODY_ID} > div {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

#${MENU_ID}.active {
  background-color: rgba(56, 189, 248, 0.18) !important;
}

#${PANEL_ID} .wb-theme-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10300;
  margin-top: 4px;
  border: 1px solid var(--wb-host-border, #334155);
  border-radius: 8px;
  background: var(--wb-host-dropdown-bg, var(--wb-host-header-bg, #111827));
  box-shadow: var(--wb-host-shadow, 0 8px 24px rgba(0,0,0,0.45));
  padding: 4px;
  min-width: 140px;
  opacity: 0;
  transform: translateY(-8px) scale(0.95);
  transform-origin: top right;
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
  pointer-events: none;
}

#${PANEL_ID} .wb-theme-dropdown.show {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
  transition: opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

#${PANEL_ID} .wb-theme-dropdown button {
  display: block;
  width: 100%;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--wb-host-text, #e2e8f0);
  padding: 6px 12px;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}

#${PANEL_ID} .wb-theme-dropdown button:hover {
  background: rgba(124, 58, 237, 0.15);
}

#${PANEL_ID} .wb-theme-dropdown button.active {
  background: rgba(124, 58, 237, 0.25);
  color: #c4b5fd;
}

@media (orientation: portrait) {
  #${PANEL_ID} {
    inset: 0 !important;
    margin: 0 !important;
    transform: none !important;
    width: 100vw !important;
    height: 100vh !important;
    height: 100lvh !important;
    min-width: unset;
    min-height: unset;
    max-width: none;
    max-height: none;
    border-radius: 0;
    border: none;
    box-shadow: none;
    resize: none;
    /* Mobile: use display:none to avoid blocking FAB behind the invisible panel */
    display: none;
    opacity: 1;
    visibility: visible;
    pointer-events: auto;
    transition: none;
  }

  #${PANEL_ID}.active {
    display: flex;
    flex-direction: column;
  }

  #${PANEL_ID} .wb-assistant-header {
    cursor: default;
  }

  #${PANEL_BODY_ID} {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  #${PANEL_BODY_ID} > div {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }
}

#${FAB_ID} {
  position: fixed;
  z-index: 10019;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(15, 23, 42, 0.88);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: #e2e8f0;
  font-size: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 0 1.5px rgba(96, 165, 250, 0.3), 0 4px 16px rgba(0,0,0,0.35);
  touch-action: none;
  user-select: none;
  -webkit-font-smoothing: antialiased;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
}

#${FAB_ID}:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.5), 0 8px 24px rgba(0,0,0,0.5);
}

#${FAB_ID}:active {
  transform: translateY(1px) scale(0.92);
  box-shadow: 0 0 0 1.5px rgba(96, 165, 250, 0.4), 0 2px 8px rgba(0,0,0,0.4);
}

#${FAB_ID}.dragging {
  transition: none !important;
  transform: scale(1.05);
  box-shadow: 0 0 0 2px rgba(96, 165, 250, 0.6), 0 12px 32px rgba(0,0,0,0.6);
  opacity: 0.9;
}

#${FAB_ID}.panel-open {
  box-shadow: 0 0 0 1.5px rgba(244, 63, 94, 0.5), 0 4px 16px rgba(0,0,0,0.35);
  font-size: 18px;
}

#${FAB_ID}.panel-open:hover {
  box-shadow: 0 0 0 1.5px #fb7185, 0 4px 20px rgba(244,63,94,0.3);
}

#${PANEL_ID} .wb-assistant-fab-toggle.fab-on {
  border-color: #34d399;
  color: #34d399;
}
`;
  doc.head.append(style);
}

function mountAppIntoPanel(): void {
  if (panelRoot) {
    return;
  }
  const body = document.getElementById(PANEL_BODY_ID);
  if (!body) {
    return;
  }

  panelRoot = document.createElement('div');
  panelRoot.id = 'wb-assistant-vue-root';
  body.appendChild(panelRoot);
  app = createApp(WorldbookAssistantApp);
  app.mount(panelRoot);
}

function ensurePanelElement(): JQuery {
  const doc = getHostDocument();
  let $panel = $(`#${PANEL_ID}`, doc);
  if ($panel.length) {
    bindPanelInteractionShield($panel);
    return $panel;
  }

  ensurePanelStyle();
  const panelHtml = `
<div id="${PANEL_ID}">
  <div class="wb-assistant-header">
    <div class="wb-assistant-header-title">世界书助手</div>
    <div class="wb-assistant-header-actions">
      <button type="button" class="wb-assistant-tool wb-assistant-refresh" title="刷新">↻</button>
      <button type="button" class="wb-assistant-tool wb-assistant-fab-toggle" title="悬浮按钮">📌</button>
      <button type="button" class="wb-assistant-tool wb-assistant-theme" title="切换主题">🎨</button>
      <button type="button" class="wb-assistant-tool wb-assistant-save" title="保存">💾</button>
      <button type="button" class="wb-assistant-close" title="关闭">×</button>
    </div>
  </div>
  <div id="${PANEL_BODY_ID}"></div>
</div>
`;
  $('body', doc).append(panelHtml);
  $panel = $(`#${PANEL_ID}`, doc);

  enablePanelDrag($panel[0] as HTMLDivElement);
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-refresh').on(`click${EVENT_NS}`, '.wb-assistant-refresh', () => {
    window.dispatchEvent(new Event('wb-helper:refresh'));
  });
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-save').on(`click${EVENT_NS}`, '.wb-assistant-save', () => {
    window.dispatchEvent(new Event('wb-helper:save'));
  });
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-theme').on(`click${EVENT_NS}`, '.wb-assistant-theme', (evt) => {
    evt.stopPropagation();
    toggleThemeDropdown($panel[0] as HTMLDivElement);
  });
  // Close theme dropdown on clicks elsewhere
  // Only register once — guard against duplicate registration
  getHostDocument().removeEventListener('pointerdown', closeThemeDropdownOnOutside, true);
  getHostDocument().addEventListener('pointerdown', closeThemeDropdownOnOutside, true);
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-close').on(`click${EVENT_NS}`, '.wb-assistant-close', () => {
    hidePanel();
  });
  $panel.off(`click${EVENT_NS}`, '.wb-assistant-fab-toggle').on(`click${EVENT_NS}`, '.wb-assistant-fab-toggle', () => {
    toggleFabVisibility();
  });
  // Sync FAB toggle button state
  syncFabToggleButton();
  bindPanelInteractionShield($panel);

  return $panel;
}

const THEME_ITEMS: { key: string; label: string }[] = [
  { key: 'ocean', label: '深海' },
  { key: 'nebula', label: '星云' },
  { key: 'forest', label: '森林' },
  { key: 'sunset', label: '日落' },
  { key: 'coffee', label: '咖啡' },
  { key: 'paper', label: '纸莎草' },
  { key: 'snow', label: '雪白' },
  { key: 'midnight', label: '黑黄' },
];

function toggleThemeDropdown(panel: HTMLDivElement): void {
  const existing = panel.querySelector('.wb-theme-dropdown');
  if (existing) {
    existing.classList.remove('show');
    // Cancel any previous pending remove timer
    const prevTimer = (existing as any).__removeTimer as number | undefined;
    if (prevTimer) clearTimeout(prevTimer);
    (existing as any).__removeTimer = setTimeout(() => existing.remove(), 200);
    return;
  }

  const themeBtn = panel.querySelector('.wb-assistant-theme') as HTMLElement;
  if (themeBtn) {
    themeBtn.style.position = 'relative';
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'wb-theme-dropdown';

  for (const item of THEME_ITEMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = item.label;
    btn.dataset.themeKey = item.key;
    btn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('wb-helper:set-theme', { detail: item.key }));
      dropdown.classList.remove('show');
      const timer = setTimeout(() => dropdown.remove(), 200);
      (dropdown as any).__removeTimer = timer;
    });
    dropdown.appendChild(btn);
  }

  if (themeBtn) {
    themeBtn.appendChild(dropdown);
  } else {
    panel.querySelector('.wb-assistant-header-actions')?.appendChild(dropdown);
  }

  // trigger animation
  requestAnimationFrame(() => dropdown.classList.add('show'));
}

function closeThemeDropdownOnOutside(event: PointerEvent): void {
  const target = event.target as HTMLElement | null;
  if (!target) {
    return;
  }
  if (target.closest('.wb-assistant-theme') || target.closest('.wb-theme-dropdown')) {
    return;
  }
  const doc = getHostDocument();
  const dropdown = doc.querySelector('.wb-theme-dropdown');
  if (dropdown) {
    dropdown.classList.remove('show');
    const timer = setTimeout(() => dropdown.remove(), 200);
    (dropdown as any).__removeTimer = timer;
  }
}

function enablePanelDrag(panel: HTMLDivElement): void {
  const hostWin = getHostWindow();
  const handle = panel.querySelector('.wb-assistant-header') as HTMLDivElement | null;
  if (!handle) {
    return;
  }

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const onPointerMove = (event: PointerEvent) => {
    if (!dragging) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(8, hostWin.innerWidth - rect.width - 8);
    const maxTop = Math.max(8, hostWin.innerHeight - rect.height - 8);
    const nextLeft = Math.min(maxLeft, Math.max(8, event.clientX - offsetX));
    const nextTop = Math.min(maxTop, Math.max(8, event.clientY - offsetY));
    panel.style.left = `${nextLeft}px`;
    panel.style.top = `${nextTop}px`;
  };

  const onPointerUp = () => {
    if (!dragging) {
      return;
    }
    dragging = false;
    // Restore transition so open/close animations work after drag
    panel.style.transition = '';
    hostWin.document.removeEventListener('pointermove', onPointerMove, true);
    hostWin.document.removeEventListener('pointerup', onPointerUp, true);
  };

  handle.addEventListener('pointerdown', event => {
    // Disable drag on mobile portrait mode
    if (window.matchMedia('(orientation: portrait)').matches) return;
    if (event.button !== 0) {
      return;
    }
    if ((event.target as HTMLElement).closest('button')) {
      return;
    }
    const rect = panel.getBoundingClientRect();
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    dragging = true;
    // Switch from inset centering to absolute left/top
    panel.style.inset = 'auto';
    panel.style.margin = '0';
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
    // Fast transition while dragging
    panel.style.transition = 'none';
    hostWin.document.addEventListener('pointermove', onPointerMove, true);
    hostWin.document.addEventListener('pointerup', onPointerUp, true);
    event.preventDefault();
  });
}

function centerPanel(panel: HTMLDivElement): void {
  panel.style.left = '';
  panel.style.top = '';
  panel.style.inset = '0';
  panel.style.margin = 'auto';
}

function setMenuActive(active: boolean): void {
  const doc = getHostDocument();
  const $menuItem = $(`#${MENU_ID}`, doc);
  if ($menuItem.length) {
    $menuItem.toggleClass('active', active);
  }
  // Sync FAB state
  const fab = doc.getElementById(FAB_ID);
  if (fab) {
    fab.classList.toggle('panel-open', active);
    fab.textContent = active ? '✕' : '📖';
  }
}


function showPanel(): void {
  const doc = getHostDocument();
  const $panel = ensurePanelElement();
  mountAppIntoPanel();
  const panelElement = $panel[0] as HTMLDivElement;

  // Clean up any pending inline styles from drag to re-center natively
  panelElement.style.transition = 'none';
  centerPanel(panelElement);
  // Force a reflow to apply the reset instantly before animating
  void panelElement.offsetHeight;
  panelElement.style.transition = '';

  $panel.addClass('active');
  blurHostActiveInput(panelElement);

  isPanelVisible = true;
  setMenuActive(true);
  // 打开面板后主动触发一次刷新
  window.dispatchEvent(new Event('wb-helper:refresh'));
  $(`#${MENU_ID}`, doc).blur();
}

function hasUnsavedChanges(): boolean {
  return (window as unknown as Record<string, unknown>)[DIRTY_STATE_KEY] === true;
}

function shouldClosePanel(): boolean {
  if (!hasUnsavedChanges()) {
    return true;
  }
  return confirm('当前有未保存修改，确认关闭世界书助手吗？');
}

function hidePanel(): boolean {
  const hadUnsavedChanges = hasUnsavedChanges();
  if (!shouldClosePanel()) {
    return false;
  }
  if (hadUnsavedChanges) {
    window.dispatchEvent(new Event('wb-helper:discard'));
    (window as unknown as Record<string, unknown>)[DIRTY_STATE_KEY] = false;
  }
  const doc = getHostDocument();
  $(`#${PANEL_ID}`, doc).removeClass('active');
  isPanelVisible = false;
  setMenuActive(false);
  return true;
}

function togglePanel(): void {
  if (isPanelVisible) {
    void hidePanel();
  } else {
    showPanel();
  }
}

let _insideMenuEnsure = false;

function ensureMenuItem(): boolean {
  if (_insideMenuEnsure) return true;
  _insideMenuEnsure = true;
  try {
    const doc = getHostDocument();
    const $menu = $('#extensionsMenu', doc);
    if (!$menu.length) {
      return false;
    }

    const $existing = $(`#${MENU_ID}`, doc);
    if ($existing.length && !$existing.closest('#extensionsMenu').length) {
      $existing.remove();
    }
    if (!$(`#${MENU_ID}`, doc).length) {
      const menuHtml = `
<div id="${MENU_ID}" class="list-group-item flex-container flexGap5 interactable" title="世界书助手" tabIndex="0">
  <i class="fa-solid fa-book-open"></i>
  <span>世界书助手</span>
</div>
`;
      $menu.append(menuHtml);
    }
    setMenuActive(isPanelVisible);
    return true;
  } finally {
    _insideMenuEnsure = false;
  }
}

let _menuObserverRaf: number | null = null;

function startMenuObserver(): void {
  const doc = getHostDocument();
  if (menuObserver) {
    return;
  }
  menuObserver = new MutationObserver(() => {
    // Debounce with rAF to avoid high-frequency re-entry
    if (_menuObserverRaf) return;
    _menuObserverRaf = requestAnimationFrame(() => {
      _menuObserverRaf = null;
      ensureMenuItem();
    });
  });
  // Only watch #extensionsMenu if it exists, else fall back to body
  const menu = doc.getElementById('extensionsMenu');
  menuObserver.observe(menu || doc.body, { childList: true, subtree: true });
}

function stopMenuObserver(): void {
  menuObserver?.disconnect();
  menuObserver = null;
  if (_menuObserverRaf) { cancelAnimationFrame(_menuObserverRaf); _menuObserverRaf = null; }
}

function ensureMenuRetry(): void {
  if (menuRetryTimer !== null) {
    return;
  }
  menuRetryTimer = window.setInterval(() => {
    if (ensureMenuItem()) {
      window.clearInterval(menuRetryTimer as number);
      menuRetryTimer = null;
    }
  }, 1000);
}

function stopMenuRetry(): void {
  if (menuRetryTimer === null) {
    return;
  }
  window.clearInterval(menuRetryTimer);
  menuRetryTimer = null;
}

function isFabVisible(): boolean {
  try {
    return localStorage.getItem(FAB_VISIBLE_KEY) !== 'false';
  } catch { return true; }
}

function syncFabToggleButton(): void {
  const doc = getHostDocument();
  const btn = doc.querySelector(`#${PANEL_ID} .wb-assistant-fab-toggle`);
  if (btn) {
    btn.classList.toggle('fab-on', isFabVisible());
  }
}

function notifyFabVisibilityChanged(visible: boolean): void {
  window.dispatchEvent(new CustomEvent(FAB_VISIBLE_CHANGED_EVENT, { detail: visible }));
}

function detachFabViewportSync(): void {
  const hostWin = getHostWindow();
  if (fabViewportSyncScrollHandler) {
    hostWin.removeEventListener('scroll', fabViewportSyncScrollHandler);
    fabViewportSyncScrollHandler = null;
  }
  if (fabViewportSyncResizeHandler) {
    hostWin.removeEventListener('resize', fabViewportSyncResizeHandler);
    fabViewportSyncResizeHandler = null;
  }
  if (fabViewportSyncRaf !== null) {
    cancelAnimationFrame(fabViewportSyncRaf);
    fabViewportSyncRaf = null;
  }
}

function setFabVisibility(visible: boolean): void {
  const doc = getHostDocument();
  const fab = doc.getElementById(FAB_ID);
  try { localStorage.setItem(FAB_VISIBLE_KEY, String(visible)); } catch { /* ignore */ }
  if (visible) {
    if (!fab) createFab();
  } else {
    detachFabViewportSync();
    fab?.remove();
  }
  syncFabToggleButton();
  notifyFabVisibilityChanged(visible);
}

function toggleFabVisibility(): void {
  setFabVisibility(!isFabVisible());
}

function createFab(): void {
  const doc = getHostDocument();
  if (doc.getElementById(FAB_ID)) return;
  if (!isFabVisible()) return;
  detachFabViewportSync();

  const isMobile = window.matchMedia('(max-width: 1000px)').matches;

  const fab = doc.createElement('div');
  fab.id = FAB_ID;
  fab.textContent = '📖';
  fab.title = '世界书助手';
  fab.setAttribute('tabindex', '-1');
  fab.setAttribute('inputmode', 'none');

  // On mobile, position:fixed breaks due to CSS transforms.
  // Use position:absolute on <html> + scroll listener to simulate fixed behavior.
  if (isMobile) {
    fab.style.position = 'absolute';
  }

  // Restore saved position or default to bottom-right
  const hostWin = getHostWindow();

  // "Desired" viewport-relative position (like fixed would use)
  let vpX: number | null = null;
  let vpY: number | null = null;

  try {
    const raw = localStorage.getItem(FAB_POS_KEY);
    if (raw) {
      const savedPos = JSON.parse(raw);
      vpX = Math.min(savedPos.x, hostWin.innerWidth - 56);
      vpY = Math.min(savedPos.y, hostWin.innerHeight - 56);
    }
  } catch { /* ignore */ }

  if (vpX !== null && vpY !== null) {
    if (isMobile) {
      fab.style.left = (vpX + hostWin.scrollX) + 'px';
      fab.style.top = (vpY + hostWin.scrollY) + 'px';
    } else {
      fab.style.left = vpX + 'px';
      fab.style.top = vpY + 'px';
    }
  } else {
    // Default: bottom-right
    vpX = hostWin.innerWidth - 16 - 48;
    vpY = hostWin.innerHeight - 80 - 48;
    if (isMobile) {
      fab.style.left = (vpX + hostWin.scrollX) + 'px';
      fab.style.top = (vpY + hostWin.scrollY) + 'px';
    } else {
      fab.style.right = '16px';
      fab.style.bottom = '80px';
    }
  }

  // Mobile: keep FAB in viewport-relative position on scroll
  if (isMobile) {
    const syncPosition = () => {
      fabViewportSyncRaf = null;
      if (!doc.getElementById(FAB_ID)) return; // FAB removed
      const curVpX = vpX ?? (hostWin.innerWidth - 64);
      const curVpY = vpY ?? (hostWin.innerHeight - 128);
      fab.style.left = (curVpX + hostWin.scrollX) + 'px';
      fab.style.top = (curVpY + hostWin.scrollY) + 'px';
    };
    fabViewportSyncScrollHandler = () => {
      if (!fabViewportSyncRaf) {
        fabViewportSyncRaf = requestAnimationFrame(syncPosition);
      }
    };
    fabViewportSyncResizeHandler = () => {
      if (!fabViewportSyncRaf) {
        fabViewportSyncRaf = requestAnimationFrame(syncPosition);
      }
    };
    hostWin.addEventListener('scroll', fabViewportSyncScrollHandler, { passive: true });
    hostWin.addEventListener('resize', fabViewportSyncResizeHandler, { passive: true });
  }

  // Drag support
  let dragging = false;
  let dragMoved = false;
  let startX = 0;
  let startY = 0;
  let fabStartX = 0;
  let fabStartY = 0;

  fab.addEventListener('pointerdown', (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragging = true;
    dragMoved = false;
    startX = e.clientX;
    startY = e.clientY;
    const rect = fab.getBoundingClientRect();
    fabStartX = rect.left;
    fabStartY = rect.top;
    fab.classList.add('dragging');
    fab.setPointerCapture(e.pointerId);
    e.stopPropagation();
    e.preventDefault();
  });

  fab.addEventListener('pointermove', (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved = true;
    const maxX = hostWin.innerWidth - 56;
    const maxY = hostWin.innerHeight - 56;
    const nx = Math.max(0, Math.min(maxX, fabStartX + dx));
    const ny = Math.max(0, Math.min(maxY, fabStartY + dy));
    // Update viewport-relative position
    vpX = nx;
    vpY = ny;
    if (isMobile) {
      fab.style.left = (nx + hostWin.scrollX) + 'px';
      fab.style.top = (ny + hostWin.scrollY) + 'px';
    } else {
      fab.style.left = nx + 'px';
      fab.style.top = ny + 'px';
    }
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  });

  fab.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    fab.classList.remove('dragging');
    // Save viewport-relative position
    try {
      if (vpX !== null && vpY !== null) {
        localStorage.setItem(FAB_POS_KEY, JSON.stringify({ x: vpX, y: vpY }));
      }
    } catch { /* ignore */ }
  });

  fab.addEventListener('click', (event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    if (dragMoved) { dragMoved = false; return; }
    blurHostActiveInput();
    togglePanel();
  });

  // Append to <html> to sit above all transformed containers
  doc.documentElement.appendChild(fab);
}

// ═══════════════════════════════════════════════════════════════════════
// ── Floor Extraction Button System (standalone, no Vue dependency) ──
// ═══════════════════════════════════════════════════════════════════════

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
  background: var(--wb-glass-bg, rgba(20, 20, 20, 0.85));
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--wb-border-subtle, rgba(255,255,255,0.05));
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
  background: var(--wb-glass-header, rgba(0, 0, 0, 0.2));
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
  background: var(--wb-dropdown-bg, var(--wb-glass-bg, rgba(15, 15, 15, 0.95)));
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
  background: var(--wb-glass-header, rgba(0, 0, 0, 0.2));
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
  const messages = getChatMessages(mesId);
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

  const wbNames = getWorldbookNames();

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
      '--wb-glass-bg', '--wb-glass-header', '--wb-overlay-bg', '--wb-dropdown-bg',
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
    ctx.eventSource.on(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, onCharRendered);
    floorEventSubscriptions.push({ stop: () => ctx.eventSource.off(ctx.eventTypes.CHARACTER_MESSAGE_RENDERED, onCharRendered) });
    ctx.eventSource.on(ctx.eventTypes.USER_MESSAGE_RENDERED, onUserRendered);
    floorEventSubscriptions.push({ stop: () => ctx.eventSource.off(ctx.eventTypes.USER_MESSAGE_RENDERED, onUserRendered) });
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, onChatChanged);
    floorEventSubscriptions.push({ stop: () => ctx.eventSource.off(ctx.eventTypes.CHAT_CHANGED, onChatChanged) });
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

// ═══════════════════════════════════════════════════════════════════════
// ── init / cleanup ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

function init(): void {

  if (!fabVisibilitySetHandler) {
    fabVisibilitySetHandler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (typeof detail !== 'boolean') {
        return;
      }
      setFabVisibility(detail);
    };
  }
  window.addEventListener(FAB_VISIBLE_SET_EVENT, fabVisibilitySetHandler);
  notifyFabVisibilityChanged(isFabVisible());

  const doc = getHostDocument();
  $(doc).off(`click${EVENT_NS}`, `#${MENU_ID}`).on(`click${EVENT_NS}`, `#${MENU_ID}`, event => {
    event.preventDefault();
    togglePanel();
  });

  ensurePanelElement();
  if (!ensureMenuItem()) {
    ensureMenuRetry();
  }
  startMenuObserver();
  try {
    createFab();
  } catch (e) {
    console.warn('[WB-FAB] createFab error:', e);
  }

  // Start floor extraction button injection
  try {
    startFloorButtonListeners();
  } catch (e) {
    console.warn('[WB-Extract] startFloorButtonListeners error:', e);
  }

  toastr.success('世界书助手已挂载到魔法棒菜单', 'Worldbook Assistant');
}

function cleanup(): void {
  const doc = getHostDocument();
  stopMenuRetry();
  stopMenuObserver();
  stopFloorButtonListeners();
  if (fabVisibilitySetHandler) {
    window.removeEventListener(FAB_VISIBLE_SET_EVENT, fabVisibilitySetHandler);
  }
  detachFabViewportSync();
  $(doc).off(EVENT_NS);
  doc.removeEventListener('pointerdown', closeThemeDropdownOnOutside, true);

  // Remove floor extraction elements
  closeExtractionModal();
  doc.getElementById(EXTRACT_STYLE_ID)?.remove();
  $(`.${FLOOR_BTN_CLASS}`, doc).remove();

  $(`#${MENU_ID}`, doc).remove();
  $(`#${PANEL_ID}`, doc).remove();
  doc.getElementById(PANEL_STYLE_ID)?.remove();
  doc.getElementById(FAB_ID)?.remove();

  app?.unmount();
  app = null;
  panelRoot?.remove();
  panelRoot = null;
}

$(() => {
  try {
    init();
  } catch (e) {
    console.error('[WorldbookAssistant] init error:', e);
  }
});

$(window).on('pagehide', () => {
  cleanup();
});
