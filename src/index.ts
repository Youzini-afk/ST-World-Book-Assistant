import { createApp, type App as VueApp } from 'vue';
import WorldbookAssistantApp from './App.vue';
import {
  FLOOR_BTN_CLASS,
  EXTRACT_STYLE_ID,
  startFloorButtonListeners,
  stopFloorButtonListeners,
  closeExtractionModal,
} from './floor-extraction';

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
let fatalAppErrorScheduled = false;
let fatalAppErrorHandling = false;

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
    const eventTarget = (event as unknown as { target?: EventTarget | null }).target ?? null;
    const panel = $panel[0] as HTMLDivElement | undefined;
    if (!panel || isTextEntryTarget(eventTarget)) {
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

#${PANEL_ID} .wb-assistant-error {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: #0f172a;
  color: #e2e8f0;
  overflow: auto;
}

#${PANEL_ID} .wb-assistant-error-title {
  font-size: 16px;
  font-weight: 700;
}

#${PANEL_ID} .wb-assistant-error-text {
  color: #cbd5e1;
  line-height: 1.6;
}

#${PANEL_ID} .wb-assistant-error-stack {
  margin: 0;
  padding: 12px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.9);
  border: 1px solid rgba(148, 163, 184, 0.35);
  color: #f8fafc;
  font: 12px/1.5 Consolas, 'Courier New', monospace;
  white-space: pre-wrap;
  word-break: break-word;
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
  background: #0f172a;
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

function formatErrorMessage(error: unknown, info?: string): string {
  const summary = error instanceof Error
    ? `${error.name}: ${error.message}`
    : String(error);
  const stack = error instanceof Error && error.stack ? `\n\n${error.stack}` : '';
  const context = info ? `[${info}] ` : '';
  return `${context}${summary}${stack}`.trim();
}

function renderPanelFatalError(error: unknown, info?: string): void {
  const body = document.getElementById(PANEL_BODY_ID);
  if (!body) {
    return;
  }

  const message = formatErrorMessage(error, info);
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  body.innerHTML = `
<div class="wb-assistant-error">
  <div class="wb-assistant-error-title">世界书助手启动失败</div>
  <div class="wb-assistant-error-text">面板内容区出现运行期异常。可以把下面的错误信息发给我继续定位。</div>
  <pre class="wb-assistant-error-stack">${escapedMessage}</pre>
</div>
`;
}

function scheduleFatalAppError(error: unknown, info?: string): void {
  console.error('[WorldbookAssistant] fatal app error:', error, info);
  if (fatalAppErrorScheduled || fatalAppErrorHandling) {
    return;
  }

  fatalAppErrorScheduled = true;
  window.setTimeout(() => {
    fatalAppErrorHandling = true;
    try {
      try {
        app?.unmount();
      } catch (unmountError) {
        console.error('[WorldbookAssistant] unmount after fatal error failed:', unmountError);
      }
      app = null;
      panelRoot?.remove();
      panelRoot = null;
      renderPanelFatalError(error, info);
    } finally {
      fatalAppErrorScheduled = false;
      fatalAppErrorHandling = false;
    }
  }, 0);
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
  const nextApp = createApp(WorldbookAssistantApp);
  nextApp.config.errorHandler = (error, _instance, info) => {
    if (fatalAppErrorScheduled || fatalAppErrorHandling) {
      console.error('[WorldbookAssistant] ignored nested app error during fatal handling:', error, info);
      return;
    }
    scheduleFatalAppError(error, info);
  };

  try {
    nextApp.mount(panelRoot);
    app = nextApp;
  } catch (error) {
    panelRoot.remove();
    panelRoot = null;
    renderPanelFatalError(error, 'app.mount');
  }
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
  { key: 'obsidian', label: '黑曜石' },
  { key: 'glacier', label: '冰川' },
  { key: 'ember', label: '余烬' },
  { key: 'verdant', label: '翠绿' },
  { key: 'paper', label: '纸莎草' },
  { key: 'snow', label: '雪白' },
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
