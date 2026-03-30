/**
 * Composable: Editor Layout
 * - Pane resize (main / editor-side)
 * - Floating panel drag/toggle
 * - Viewport tracking
 * - Content textarea resize
 * - Layout persistence
 */

import { ref, reactive, type Ref, type ComputedRef } from 'vue';
import { clampNumber } from '../utils';
import {
  MAIN_PANE_DEFAULT, MAIN_PANE_MIN,
  EDITOR_SIDE_DEFAULT, EDITOR_SIDE_MIN,
  FOCUS_MAIN_PANE_DEFAULT, FOCUS_MAIN_PANE_MIN,
  FOCUS_EDITOR_SIDE_DEFAULT, FOCUS_EDITOR_SIDE_MIN,
  normalizeLayoutState,
} from '../store/persistedState';
import type {
  PersistedState,
  PaneResizeState,
  PaneResizeKey,
  FloatingPanelState,
  FloatingPanelKey,
} from '../types';

const RESIZE_HANDLE_SIZE = 10;
const MAIN_EDITOR_MIN = 540;
const EDITOR_CENTER_MIN = 420;

export interface UseEditorLayoutOptions {
  persistedState: Ref<PersistedState>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
  isCompactLayout: ComputedRef<boolean>;
  isDesktopFocusMode: ComputedRef<boolean>;
  isFocusEditing: Ref<boolean>;
  focusCineLocked: ComputedRef<boolean>;
  mainLayoutRef: Ref<HTMLElement | null>;
  editorShellRef: Ref<HTMLElement | null>;
}

export interface UseEditorLayoutReturn {
  // State
  viewportWidth: Ref<number>;
  mainPaneWidth: Ref<number>;
  editorSideWidth: Ref<number>;
  focusMainPaneWidth: Ref<number>;
  focusEditorSideWidth: Ref<number>;
  paneResizeState: Ref<PaneResizeState | null>;
  contentTextareaRef: Ref<HTMLTextAreaElement | null>;
  editorContentBlockRef: Ref<HTMLElement | null>;
  floatingPanels: Record<FloatingPanelKey, FloatingPanelState>;
  floatingPanelKeys: FloatingPanelKey[];
  floatingZCounter: Ref<number>;

  // Functions
  clampPaneWidths: () => void;
  startPaneResize: (key: PaneResizeKey, event: PointerEvent) => void;
  startContentResize: (e: PointerEvent) => void;
  startContentTopDrag: (e: PointerEvent) => void;
  stopPaneResize: () => void;
  applyLayoutStateFromPersisted: () => void;
  persistLayoutState: () => void;
  handleFloatingWindowResize: () => void;
  bringFloatingToFront: (key: FloatingPanelKey) => void;
  openFloatingPanel: (key: FloatingPanelKey) => void;
  closeFloatingPanel: (key: FloatingPanelKey) => void;
  toggleFloatingPanel: (key: FloatingPanelKey) => void;
  startFloatingDrag: (key: FloatingPanelKey, event: PointerEvent) => void;
  stopFloatingDrag: () => void;
  resolveHostWindow: () => Window;
  clampFloatingPanelToViewport: (panel: FloatingPanelState) => void;
}

export function useEditorLayout(options: UseEditorLayoutOptions): UseEditorLayoutReturn {
  const {
    persistedState,
    updatePersistedState,
    isCompactLayout,
    isDesktopFocusMode,
    isFocusEditing,
    focusCineLocked,
    mainLayoutRef,
    editorShellRef,
  } = options;

  // ── State ──────────────────────────────────────────────────────────
  const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);
  const mainPaneWidth = ref(MAIN_PANE_DEFAULT);
  const editorSideWidth = ref(EDITOR_SIDE_DEFAULT);
  const focusMainPaneWidth = ref(FOCUS_MAIN_PANE_DEFAULT);
  const focusEditorSideWidth = ref(FOCUS_EDITOR_SIDE_DEFAULT);
  const paneResizeState = ref<PaneResizeState | null>(null);
  const contentTextareaRef = ref<HTMLTextAreaElement | null>(null);
  const editorContentBlockRef = ref<HTMLElement | null>(null);
  const floatingZCounter = ref(10005);
  const floatingPanelKeys: FloatingPanelKey[] = ['find', 'activation'];
  const floatingPanels = reactive<Record<FloatingPanelKey, FloatingPanelState>>({
    find: { visible: false, x: 420, y: 170, z: 10006, width: 500 },
    activation: { visible: false, x: 200, y: 200, z: 10007, width: 500 },
  });
  const activeFloatingDrag = ref<{
    key: FloatingPanelKey;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    doc: Document;
    win: Window;
  } | null>(null);
  let contentTopDragOffset = 0;

  // ── Pane resize ───────────────────────────────────────────────────
  function clampPaneWidths(): void {
    if (isCompactLayout.value) return;
    const mainMin = isDesktopFocusMode.value ? FOCUS_MAIN_PANE_MIN : MAIN_PANE_MIN;
    const sideMin = isDesktopFocusMode.value ? FOCUS_EDITOR_SIDE_MIN : EDITOR_SIDE_MIN;

    const mainRect = mainLayoutRef.value?.getBoundingClientRect();
    if (mainRect) {
      const maxLeft = Math.max(mainMin, Math.floor(mainRect.width - MAIN_EDITOR_MIN - RESIZE_HANDLE_SIZE));
      if (isDesktopFocusMode.value) {
        focusMainPaneWidth.value = clampNumber(focusMainPaneWidth.value, mainMin, maxLeft);
      } else {
        mainPaneWidth.value = clampNumber(mainPaneWidth.value, mainMin, maxLeft);
      }
    }

    const editorRect = editorShellRef.value?.getBoundingClientRect();
    if (editorRect) {
      const maxSide = Math.max(sideMin, Math.floor(editorRect.width - EDITOR_CENTER_MIN - RESIZE_HANDLE_SIZE));
      if (isDesktopFocusMode.value) {
        focusEditorSideWidth.value = clampNumber(focusEditorSideWidth.value, sideMin, maxSide);
      } else {
        editorSideWidth.value = clampNumber(editorSideWidth.value, sideMin, maxSide);
      }
    }
  }

  function onPaneResizeMove(event: PointerEvent): void {
    const state = paneResizeState.value;
    if (!state || event.pointerId !== state.pointerId) return;
    if (state.key === 'main') {
      const rect = mainLayoutRef.value?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.floor(event.clientX - rect.left);
      const minLeft = isDesktopFocusMode.value ? FOCUS_MAIN_PANE_MIN : MAIN_PANE_MIN;
      const maxLeft = Math.max(minLeft, Math.floor(rect.width - MAIN_EDITOR_MIN - RESIZE_HANDLE_SIZE));
      if (isDesktopFocusMode.value) {
        focusMainPaneWidth.value = clampNumber(left, minLeft, maxLeft);
      } else {
        mainPaneWidth.value = clampNumber(left, minLeft, maxLeft);
      }
      return;
    }
    const rect = editorShellRef.value?.getBoundingClientRect();
    if (!rect) return;
    const side = Math.floor(rect.right - event.clientX);
    const minSide = isDesktopFocusMode.value ? FOCUS_EDITOR_SIDE_MIN : EDITOR_SIDE_MIN;
    const maxSide = Math.max(minSide, Math.floor(rect.width - EDITOR_CENTER_MIN - RESIZE_HANDLE_SIZE));
    if (isDesktopFocusMode.value) {
      focusEditorSideWidth.value = clampNumber(side, minSide, maxSide);
    } else {
      editorSideWidth.value = clampNumber(side, minSide, maxSide);
    }
  }

  function stopPaneResize(): void {
    const state = paneResizeState.value;
    if (state) {
      state.doc.removeEventListener('pointermove', onPaneResizeMove);
      state.doc.removeEventListener('pointerup', stopPaneResize);
      state.doc.removeEventListener('pointercancel', stopPaneResize);
      state.win.removeEventListener('blur', stopPaneResize);
    }
    paneResizeState.value = null;
    if (!isCompactLayout.value) {
      persistLayoutState();
    }
  }

  function startPaneResize(key: PaneResizeKey, event: PointerEvent): void {
    if (focusCineLocked.value || isCompactLayout.value) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const target = event.currentTarget as HTMLElement | null;
    const hostDoc = target?.ownerDocument ?? document;
    const hostWin = hostDoc.defaultView ?? window;
    paneResizeState.value = { key, pointerId: event.pointerId, doc: hostDoc, win: hostWin };
    target?.setPointerCapture?.(event.pointerId);
    hostDoc.addEventListener('pointermove', onPaneResizeMove);
    hostDoc.addEventListener('pointerup', stopPaneResize);
    hostDoc.addEventListener('pointercancel', stopPaneResize);
    hostWin.addEventListener('blur', stopPaneResize);
    event.preventDefault();
  }

  // ── Content textarea resize ───────────────────────────────────────
  function startContentResize(e: PointerEvent): void {
    if (focusCineLocked.value) return;
    e.preventDefault();
    const textarea = contentTextareaRef.value;
    if (!textarea) return;
    const startY = e.clientY;
    const startHeight = textarea.offsetHeight;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    textarea.style.pointerEvents = 'none';
    textarea.style.willChange = 'height';
    let rafId = 0;
    let pendingHeight = startHeight;
    const applyHeight = () => {
      textarea.style.height = `${pendingHeight}px`;
      textarea.style.minHeight = `${pendingHeight}px`;
      rafId = 0;
    };
    const onMove = (ev: PointerEvent) => {
      pendingHeight = Math.max(120, startHeight + (ev.clientY - startY));
      if (!rafId) rafId = requestAnimationFrame(applyHeight);
    };
    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      applyHeight();
      textarea.style.pointerEvents = '';
      textarea.style.willChange = '';
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  function startContentTopDrag(e: PointerEvent): void {
    if (focusCineLocked.value) return;
    e.preventDefault();
    const block = editorContentBlockRef.value;
    if (!block) return;
    const startY = e.clientY;
    const startOffset = contentTopDragOffset;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    let rafId = 0;
    let pendingOffset = startOffset;
    const apply = () => {
      block.style.marginTop = `${-pendingOffset}px`;
      rafId = 0;
    };
    const onMove = (ev: PointerEvent) => {
      const delta = startY - ev.clientY;
      pendingOffset = Math.max(0, Math.min(400, startOffset + delta));
      if (!rafId) rafId = requestAnimationFrame(apply);
    };
    const onUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      contentTopDragOffset = pendingOffset;
      apply();
      target.removeEventListener('pointermove', onMove);
      target.removeEventListener('pointerup', onUp);
    };
    target.addEventListener('pointermove', onMove);
    target.addEventListener('pointerup', onUp);
  }

  // ── Layout persistence ────────────────────────────────────────────
  function applyLayoutStateFromPersisted(): void {
    const layout = normalizeLayoutState(persistedState.value.layout);
    isFocusEditing.value = layout.focus_mode;
    mainPaneWidth.value = layout.normal_left_width;
    editorSideWidth.value = layout.normal_right_width;
    focusMainPaneWidth.value = layout.focus_left_width;
    focusEditorSideWidth.value = layout.focus_right_width;
  }

  function persistLayoutState(): void {
    updatePersistedState(state => {
      state.layout = {
        focus_mode: isFocusEditing.value,
        normal_left_width: mainPaneWidth.value,
        normal_right_width: editorSideWidth.value,
        focus_left_width: focusMainPaneWidth.value,
        focus_right_width: focusEditorSideWidth.value,
      };
    });
  }

  // ── Floating panels ───────────────────────────────────────────────
  function resolveHostWindow(): Window {
    return mainLayoutRef.value?.ownerDocument?.defaultView ?? editorShellRef.value?.ownerDocument?.defaultView ?? window;
  }

  function clampFloatingPanelToViewport(panel: FloatingPanelState): void {
    const hostWin = resolveHostWindow();
    const vw = hostWin.innerWidth;
    const vh = hostWin.innerHeight;
    const maxX = Math.max(8, vw - panel.width - 8);
    const maxY = Math.max(8, vh - 68);
    panel.x = clampNumber(panel.x, 8, maxX);
    panel.y = clampNumber(panel.y, 8, maxY);
  }

  function handleFloatingWindowResize(): void {
    const hostWin = resolveHostWindow();
    viewportWidth.value = hostWin.innerWidth;
    clampPaneWidths();
    for (const key of floatingPanelKeys) {
      if (!floatingPanels[key].visible) continue;
      clampFloatingPanelToViewport(floatingPanels[key]);
    }
  }

  function bringFloatingToFront(key: FloatingPanelKey): void {
    floatingZCounter.value += 1;
    floatingPanels[key].z = floatingZCounter.value;
  }

  function openFloatingPanel(key: FloatingPanelKey): void {
    const panel = floatingPanels[key];
    panel.visible = true;
    bringFloatingToFront(key);
    clampFloatingPanelToViewport(panel);
  }

  function closeFloatingPanel(key: FloatingPanelKey): void {
    floatingPanels[key].visible = false;
  }

  function toggleFloatingPanel(key: FloatingPanelKey): void {
    if (focusCineLocked.value) return;
    if (floatingPanels[key].visible) {
      closeFloatingPanel(key);
    } else {
      openFloatingPanel(key);
    }
  }

  function startFloatingDrag(key: FloatingPanelKey, event: PointerEvent): void {
    if (focusCineLocked.value) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const panel = floatingPanels[key];
    bringFloatingToFront(key);
    const target = event.currentTarget as HTMLElement | null;
    const hostDoc = target?.ownerDocument ?? document;
    const hostWin = hostDoc.defaultView ?? window;
    activeFloatingDrag.value = {
      key,
      pointerId: event.pointerId,
      offsetX: event.clientX - panel.x,
      offsetY: event.clientY - panel.y,
      doc: hostDoc,
      win: hostWin,
    };
    target?.setPointerCapture?.(event.pointerId);
    hostDoc.addEventListener('pointermove', onFloatingDragMove);
    hostDoc.addEventListener('pointerup', stopFloatingDrag);
    hostDoc.addEventListener('pointercancel', stopFloatingDrag);
    hostWin.addEventListener('blur', stopFloatingDrag);
    event.preventDefault();
  }

  function onFloatingDragMove(event: PointerEvent): void {
    const drag = activeFloatingDrag.value;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const panel = floatingPanels[drag.key];
    panel.x = event.clientX - drag.offsetX;
    panel.y = event.clientY - drag.offsetY;
    clampFloatingPanelToViewport(panel);
  }

  function stopFloatingDrag(): void {
    const drag = activeFloatingDrag.value;
    if (drag) {
      drag.doc.removeEventListener('pointermove', onFloatingDragMove);
      drag.doc.removeEventListener('pointerup', stopFloatingDrag);
      drag.doc.removeEventListener('pointercancel', stopFloatingDrag);
      drag.win.removeEventListener('blur', stopFloatingDrag);
    }
    activeFloatingDrag.value = null;
  }

  return {
    viewportWidth,
    mainPaneWidth,
    editorSideWidth,
    focusMainPaneWidth,
    focusEditorSideWidth,
    paneResizeState,
    contentTextareaRef,
    editorContentBlockRef,
    floatingPanels,
    floatingPanelKeys,
    floatingZCounter,
    clampPaneWidths,
    startPaneResize,
    startContentResize,
    startContentTopDrag,
    stopPaneResize,
    applyLayoutStateFromPersisted,
    persistLayoutState,
    handleFloatingWindowResize,
    bringFloatingToFront,
    openFloatingPanel,
    closeFloatingPanel,
    toggleFloatingPanel,
    startFloatingDrag,
    stopFloatingDrag,
    resolveHostWindow,
    clampFloatingPanelToViewport,
  };
}
