/**
 * Composable: Focus Mode & Cinematic Transitions
 * - Focus editing state (panels, tools band, worldbook menu)
 * - Focus & Copy cinematic transitions (hero/sink/ghost animation)
 * - Cine lock state
 * - Focus summaries
 */

import { ref, reactive, computed, nextTick, type Ref, type ComputedRef } from 'vue';
import { clampNumber } from '../utils';
import type {
  FocusCinePhase,
  FocusCineDirection,
  CopyCinePhase,
  CopyCineDirection,
  FocusHeroKey,
  FocusMetaPanelKey,
  FocusSidePanelKey,
  FocusHeroSnapshot,
  FocusSinkSnapshot,
} from '../types';

// ── Constants ─────────────────────────────────────────────────────────
const FOCUS_CINE_DURATION = 1400;
const FOCUS_CINE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const FOCUS_CINE_STAGGER = 28;
const FOCUS_CINE_MAX_STAGGER_STEPS = 8;
const COPY_CINE_DURATION = 1100;
const COPY_CINE_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const COPY_CINE_STAGGER = 22;
const COPY_CINE_MAX_STAGGER_STEPS = 14;
const FOCUS_FALLBACK_PRIORITY: FocusHeroKey[] = [
  'focus_toggle', 'find_btn', 'save_btn', 'more_btn', 'tools_btn',
];
const COPY_FALLBACK_PRIORITY: FocusHeroKey[] = [
  'tool_copy', 'find_btn', 'focus_toggle', 'save_btn', 'more_btn',
  'tools_btn', 'tool_global', 'tool_entry_history', 'tool_worldbook_history',
  'tool_activation', 'tool_ai_generate', 'tool_extract', 'tool_tag',
  'tool_settings', 'tool_ai_config',
];

export interface UseFocusModeOptions {
  rootRef: Ref<HTMLElement | null>;
  isMobile: ComputedRef<boolean>;
  viewportWidth: Ref<number>;
  selectedEntry: ComputedRef<WorldbookEntry | null>;
  selectedEffectDelayText: ComputedRef<string>;
  clampPaneWidths: () => void;
  persistLayoutState: () => void;
  setCrossCopyModeActive: (next: boolean) => void;
  getEntryStatusLabel: (entry: WorldbookEntry) => string;
  getPositionTypeLabel: (type: string, role: string) => string;
}

export interface UseFocusModeReturn {
  // State
  isFocusEditing: Ref<boolean>;
  focusWorldbookMenuOpen: Ref<boolean>;
  focusToolsExpanded: Ref<boolean>;
  focusToolsTriggerVisible: Ref<boolean>;
  focusCinePhase: Ref<FocusCinePhase>;
  focusCineDirection: Ref<FocusCineDirection>;
  focusCineLocked: Ref<boolean>;
  focusCineOverlayRef: Ref<HTMLElement | null>;
  copyCinePhase: Ref<CopyCinePhase>;
  copyCineDirection: Ref<CopyCineDirection>;
  copyCineLocked: Ref<boolean>;
  copyCineOverlayRef: Ref<HTMLElement | null>;
  focusMetaPanel: Record<FocusMetaPanelKey, boolean>;
  focusSidePanelState: Record<FocusSidePanelKey, boolean>;

  // Computed
  focusCineEnabled: ComputedRef<boolean>;
  isFocusCineRunning: ComputedRef<boolean>;
  copyCineEnabled: ComputedRef<boolean>;
  isCopyCineRunning: ComputedRef<boolean>;
  isAnyCineLocked: ComputedRef<boolean>;
  focusCineRootClass: ComputedRef<Record<string, boolean>>;
  focusCommentSummary: ComputedRef<string>;
  focusKeywordSummary: ComputedRef<string>;
  focusStrategySummary: ComputedRef<string>;
  focusInsertionSummary: ComputedRef<string>;
  focusRecursionSummary: ComputedRef<string>;

  // Functions
  resetFocusPanels: () => void;
  toggleFocusMetaPanel: (panel: FocusMetaPanelKey) => void;
  toggleFocusSidePanel: (panel: FocusSidePanelKey) => void;
  closeFocusWorldbookMenu: () => void;
  toggleFocusWorldbookMenu: () => void;
  openFocusToolsBand: () => void;
  closeFocusToolsBand: () => void;
  onFocusToolsBandAfterLeave: () => void;
  applyFocusEditingState: (nextFocus: boolean) => void;
  toggleFocusEditing: () => void;
  runFocusCinematicTransition: (nextFocus: boolean) => Promise<void>;
  runCrossCopyCinematicTransition: (nextCrossCopy: boolean) => Promise<void>;
  cleanupAllCineArtifacts: () => void;
}

export function useFocusMode(options: UseFocusModeOptions): UseFocusModeReturn {
  const {
    rootRef, isMobile, viewportWidth, selectedEntry,
    selectedEffectDelayText,
    clampPaneWidths, persistLayoutState, setCrossCopyModeActive,
    getEntryStatusLabel, getPositionTypeLabel,
  } = options;

  // ── State ──────────────────────────────────────────────────────────
  const isFocusEditing = ref(false);
  const focusWorldbookMenuOpen = ref(false);
  const focusToolsExpanded = ref(false);
  const focusToolsTriggerVisible = ref(true);
  const focusCinePhase = ref<FocusCinePhase>('idle');
  const focusCineDirection = ref<FocusCineDirection>('enter');
  const focusCineLocked = ref(false);
  const focusCineOverlayRef = ref<HTMLElement | null>(null);
  let focusCineToken = 0;
  let focusCineGhostNodes: HTMLElement[] = [];
  let focusCineHiddenNodes: HTMLElement[] = [];

  const copyCinePhase = ref<CopyCinePhase>('idle');
  const copyCineDirection = ref<CopyCineDirection>('enter');
  const copyCineLocked = ref(false);
  const copyCineOverlayRef = ref<HTMLElement | null>(null);
  let copyCineToken = 0;
  let copyCineGhostNodes: HTMLElement[] = [];
  let copyCineHiddenNodes: HTMLElement[] = [];

  const focusMetaPanel = reactive<Record<FocusMetaPanelKey, boolean>>({
    comment: false,
    keywords: false,
  });
  const focusSidePanelState = reactive<Record<FocusSidePanelKey, boolean>>({
    strategy: true,
    insertion: true,
    recursion: true,
  });

  // ── Computed ───────────────────────────────────────────────────────
  const focusCineEnabled = computed(() => !isMobile.value && viewportWidth.value > 1100);
  const isFocusCineRunning = computed(() => focusCinePhase.value === 'running' || focusCinePhase.value === 'settling');
  const copyCineEnabled = computed(() => !isMobile.value && viewportWidth.value > 1100);
  const isCopyCineRunning = computed(() => copyCinePhase.value === 'running' || copyCinePhase.value === 'settling');
  const isAnyCineLocked = computed(() => focusCineLocked.value || copyCineLocked.value);
  const focusCineRootClass = computed(() => ({
    'focus-cine-running': isFocusCineRunning.value,
    'focus-cine-enter': isFocusCineRunning.value && focusCineDirection.value === 'enter',
    'focus-cine-exit': isFocusCineRunning.value && focusCineDirection.value === 'exit',
    'focus-cine-locked': focusCineLocked.value,
    'copy-cine-running': isCopyCineRunning.value,
    'copy-cine-enter': isCopyCineRunning.value && copyCineDirection.value === 'enter',
    'copy-cine-exit': isCopyCineRunning.value && copyCineDirection.value === 'exit',
    'copy-cine-locked': copyCineLocked.value,
  }));

  const focusCommentSummary = computed(() => {
    const name = selectedEntry.value?.name?.trim();
    if (!name) return '未命名';
    return name.length > 20 ? `${name.slice(0, 20)}...` : name;
  });
  const focusKeywordSummary = computed(() => {
    if (!selectedEntry.value) return '主0 / 次0';
    return `主${selectedEntry.value.strategy.keys.length} / 次${selectedEntry.value.strategy.keys_secondary.keys.length}`;
  });
  const focusStrategySummary = computed(() => {
    if (!selectedEntry.value) return '-';
    return `${getEntryStatusLabel(selectedEntry.value)} · ${selectedEntry.value.probability}%`;
  });
  const focusInsertionSummary = computed(() => {
    if (!selectedEntry.value) return '-';
    return `${getPositionTypeLabel(selectedEntry.value.position.type, selectedEntry.value.position.role)} · #${selectedEntry.value.position.order}`;
  });
  const focusRecursionSummary = computed(() => {
    if (!selectedEntry.value) return '-';
    const tags: string[] = [];
    tags.push(selectedEntry.value.recursion.prevent_incoming ? '🚫入' : '入✓');
    tags.push(selectedEntry.value.recursion.prevent_outgoing ? '🚫出' : '出✓');
    tags.push(`d:${selectedEffectDelayText.value || 'null'}`);
    return tags.join(' · ');
  });

  // ── Panel helpers ──────────────────────────────────────────────────
  function resetFocusPanels(): void {
    focusMetaPanel.comment = false;
    focusMetaPanel.keywords = false;
    focusSidePanelState.strategy = true;
    focusSidePanelState.insertion = true;
    focusSidePanelState.recursion = true;
    focusToolsExpanded.value = false;
    focusToolsTriggerVisible.value = true;
    focusWorldbookMenuOpen.value = false;
  }
  function toggleFocusMetaPanel(panel: FocusMetaPanelKey): void {
    focusMetaPanel[panel] = !focusMetaPanel[panel];
  }
  function toggleFocusSidePanel(panel: FocusSidePanelKey): void {
    focusSidePanelState[panel] = !focusSidePanelState[panel];
  }
  function closeFocusWorldbookMenu(): void {
    focusWorldbookMenuOpen.value = false;
  }
  function toggleFocusWorldbookMenu(): void {
    if (isAnyCineLocked.value) return;
    if (!focusWorldbookMenuOpen.value) closeFocusToolsBand();
    focusWorldbookMenuOpen.value = !focusWorldbookMenuOpen.value;
  }
  function openFocusToolsBand(): void {
    if (isAnyCineLocked.value) return;
    if (focusToolsExpanded.value || !focusToolsTriggerVisible.value) return;
    closeFocusWorldbookMenu();
    focusToolsTriggerVisible.value = false;
    focusToolsExpanded.value = true;
  }
  function closeFocusToolsBand(): void {
    if (!focusToolsExpanded.value) {
      focusToolsTriggerVisible.value = true;
      return;
    }
    focusToolsExpanded.value = false;
  }
  function onFocusToolsBandAfterLeave(): void {
    if (!focusToolsExpanded.value) focusToolsTriggerVisible.value = true;
  }
  function applyFocusEditingState(nextFocus: boolean): void {
    isFocusEditing.value = nextFocus;
    if (nextFocus) {
      resetFocusPanels();
    } else {
      closeFocusWorldbookMenu();
      closeFocusToolsBand();
    }
  }

  // ── Cine helpers ──────────────────────────────────────────────────
  function waitForFrame(): Promise<void> {
    return new Promise(r => { requestAnimationFrame(() => r()); });
  }
  function waitForDuration(ms: number): Promise<void> {
    return new Promise(r => { window.setTimeout(r, ms); });
  }

  function collectAnimatedKeys(
    root: HTMLElement,
    attribute: 'data-focus-hero' | 'data-focus-sink' | 'data-copy-hero' | 'data-copy-sink',
  ): Set<FocusHeroKey> {
    const keys = new Set<FocusHeroKey>();
    for (const node of Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}]`))) {
      const k = node.getAttribute(attribute)?.trim();
      if (k) keys.add(k);
    }
    return keys;
  }

  function findVisibleElement(nodes: HTMLElement[]): HTMLElement | null {
    return nodes.find(node => {
      if (!node.isConnected) return false;
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) <= 0) return false;
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    }) ?? null;
  }

  function collectSnapshots(
    attribute: 'data-focus-hero' | 'data-focus-sink' | 'data-copy-hero' | 'data-copy-sink',
    pickLast = false,
  ): Map<FocusHeroKey, FocusHeroSnapshot> {
    const snapshots = new Map<FocusHeroKey, FocusHeroSnapshot>();
    const root = rootRef.value;
    if (!root) return snapshots;
    const keys = collectAnimatedKeys(root, attribute);
    for (const key of keys) {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(`[${attribute}="${key}"]`));
      let element: HTMLElement | null;
      if (pickLast) {
        const visible = nodes.filter(n => n.isConnected && n.getBoundingClientRect().width > 1);
        element = visible[visible.length - 1] ?? nodes[nodes.length - 1] ?? null;
      } else {
        element = findVisibleElement(nodes) ?? nodes[0] ?? null;
      }
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) continue;
      snapshots.set(key, { key, element, rect });
    }
    return snapshots;
  }

  function resolveFallback(
    heroMap: Map<FocusHeroKey, FocusHeroSnapshot>,
    sinkMap: Map<FocusHeroKey, FocusSinkSnapshot>,
    priority: FocusHeroKey[],
  ): DOMRect | null {
    for (const key of priority) {
      const hero = heroMap.get(key);
      if (hero) return hero.rect;
    }
    for (const key of priority) {
      const sink = sinkMap.get(key);
      if (sink) return sink.rect;
    }
    for (const hero of heroMap.values()) return hero.rect;
    for (const sink of sinkMap.values()) return sink.rect;
    return null;
  }

  function buildGhostKeyOrder(
    sourceMap: Map<FocusHeroKey, FocusHeroSnapshot>,
    targetMap: Map<FocusHeroKey, FocusHeroSnapshot>,
    sourceSinkMap: Map<FocusHeroKey, FocusSinkSnapshot>,
    targetSinkMap: Map<FocusHeroKey, FocusSinkSnapshot>,
    priority: FocusHeroKey[],
  ): FocusHeroKey[] {
    const keySet = new Set<FocusHeroKey>();
    for (const key of sourceMap.keys()) keySet.add(key);
    for (const key of targetMap.keys()) keySet.add(key);
    for (const key of sourceSinkMap.keys()) keySet.add(key);
    for (const key of targetSinkMap.keys()) keySet.add(key);
    const ordered: FocusHeroKey[] = [];
    for (const key of priority) {
      if (keySet.delete(key)) ordered.push(key);
    }
    ordered.push(...Array.from(keySet).sort((a, b) => a.localeCompare(b)));
    return ordered;
  }

  function clearFocusCineArtifacts(): void {
    for (const node of focusCineGhostNodes) node.remove();
    focusCineGhostNodes = [];
    for (const node of focusCineHiddenNodes) node.classList.remove('focus-cine-real-hidden');
    focusCineHiddenNodes = [];
  }
  function clearCopyCineArtifacts(): void {
    for (const node of copyCineGhostNodes) node.remove();
    copyCineGhostNodes = [];
    for (const node of copyCineHiddenNodes) node.classList.remove('copy-cine-real-hidden');
    copyCineHiddenNodes = [];
  }
  function cleanupAllCineArtifacts(): void {
    clearFocusCineArtifacts();
    clearCopyCineArtifacts();
  }

  function mountGhosts(
    sourceMap: Map<FocusHeroKey, FocusHeroSnapshot>,
    targetMap: Map<FocusHeroKey, FocusHeroSnapshot>,
    sourceSinkMap: Map<FocusHeroKey, FocusSinkSnapshot>,
    targetSinkMap: Map<FocusHeroKey, FocusSinkSnapshot>,
    config: {
      overlay: HTMLElement;
      priority: FocusHeroKey[];
      fallbackKey: string;
      ghostClass: string;
      heroAttr: string;
      hiddenClass: string;
      ghostNodes: HTMLElement[];
      hiddenNodes: HTMLElement[];
      duration: number;
      ease: string;
      stagger: number;
      maxStagger: number;
      cssPrefix: string;
    },
  ): number {
    const sourceFallback = resolveFallback(sourceMap, sourceSinkMap, config.priority);
    const targetFallback = resolveFallback(targetMap, targetSinkMap, config.priority);
    const sourceElFallback = sourceMap.get(config.fallbackKey)?.element ?? targetMap.get(config.fallbackKey)?.element ?? null;
    const hidden = new Set<HTMLElement>();
    const orderedKeys = buildGhostKeyOrder(sourceMap, targetMap, sourceSinkMap, targetSinkMap, config.priority);
    let idx = 0;
    for (const key of orderedKeys) {
      const srcSelf = sourceMap.get(key) ?? null;
      const tgtSelf = targetMap.get(key) ?? null;
      const srcSink = sourceSinkMap.get(key) ?? null;
      const tgtSink = targetSinkMap.get(key) ?? null;
      if (!srcSelf && !tgtSelf && !srcSink && !tgtSink) continue;
      const startRect = srcSelf?.rect ?? srcSink?.rect ?? sourceFallback;
      const endRect = tgtSelf?.rect ?? tgtSink?.rect ?? targetFallback;
      if (!startRect || !endRect) continue;
      const srcEl = srcSelf?.element ?? tgtSelf?.element ?? sourceElFallback;
      if (!srcEl) continue;
      const ghost = srcEl.cloneNode(true) as HTMLElement;
      ghost.classList.add(config.ghostClass);
      ghost.removeAttribute('id');
      ghost.removeAttribute(config.heroAttr);
      ghost.setAttribute('aria-hidden', 'true');
      const sw = Math.max(1, startRect.width), sh = Math.max(1, startRect.height);
      const ew = Math.max(1, endRect.width), eh = Math.max(1, endRect.height);
      const dx = endRect.left - startRect.left, dy = endRect.top - startRect.top;
      const sx = clampNumber(ew / sw, 0.72, 1.42), sy = clampNumber(eh / sh, 0.72, 1.42);
      ghost.style.left = `${startRect.left}px`;
      ghost.style.top = `${startRect.top}px`;
      ghost.style.width = `${sw}px`;
      ghost.style.height = `${sh}px`;
      ghost.style.setProperty(`--${config.cssPrefix}-dx`, `${dx}px`);
      ghost.style.setProperty(`--${config.cssPrefix}-dy`, `${dy}px`);
      ghost.style.setProperty(`--${config.cssPrefix}-scale-x`, `${sx}`);
      ghost.style.setProperty(`--${config.cssPrefix}-scale-y`, `${sy}`);
      ghost.style.setProperty(`--${config.cssPrefix}-arc-y`, `${config.cssPrefix === 'cine' ? -14 : -10}px`);
      ghost.style.setProperty(`--${config.cssPrefix}-from-opacity`, srcSelf ? '1' : '0');
      ghost.style.setProperty(`--${config.cssPrefix}-to-opacity`, tgtSelf ? '1' : '0');
      ghost.style.animationDuration = `${config.duration}ms`;
      ghost.style.animationTimingFunction = config.ease;
      ghost.style.animationDelay = `${Math.min(idx, config.maxStagger) * config.stagger}ms`;
      config.overlay.appendChild(ghost);
      config.ghostNodes.push(ghost);
      if (tgtSelf && !hidden.has(tgtSelf.element)) {
        hidden.add(tgtSelf.element);
        tgtSelf.element.classList.add(config.hiddenClass);
        config.hiddenNodes.push(tgtSelf.element);
      }
      idx += 1;
    }
    return idx;
  }

  // ── Focus Cinematic Transition ────────────────────────────────────
  async function runFocusCinematicTransition(nextFocus: boolean): Promise<void> {
    if (isAnyCineLocked.value) return;
    const token = ++focusCineToken;
    focusCineLocked.value = true;
    focusCineDirection.value = nextFocus ? 'enter' : 'exit';
    focusCinePhase.value = 'prepare';
    try {
      await nextTick();
      const sourceMap = collectSnapshots('data-focus-hero');
      const sourceSinkMap = collectSnapshots('data-focus-sink');
      applyFocusEditingState(nextFocus);
      await nextTick();
      await waitForFrame();
      await waitForFrame();
      const targetMap = collectSnapshots('data-focus-hero');
      const targetSinkMap = collectSnapshots('data-focus-sink');
      clearFocusCineArtifacts();
      const overlay = focusCineOverlayRef.value;
      if (!overlay || token !== focusCineToken) {
        focusCinePhase.value = 'settling';
        await nextTick();
        clampPaneWidths();
        persistLayoutState();
        return;
      }
      const ghostCount = mountGhosts(sourceMap, targetMap, sourceSinkMap, targetSinkMap, {
        overlay,
        priority: FOCUS_FALLBACK_PRIORITY,
        fallbackKey: 'focus_toggle',
        ghostClass: 'focus-cine-ghost',
        heroAttr: 'data-focus-hero',
        hiddenClass: 'focus-cine-real-hidden',
        ghostNodes: focusCineGhostNodes,
        hiddenNodes: focusCineHiddenNodes,
        duration: FOCUS_CINE_DURATION,
        ease: FOCUS_CINE_EASE,
        stagger: FOCUS_CINE_STAGGER,
        maxStagger: FOCUS_CINE_MAX_STAGGER_STEPS,
        cssPrefix: 'cine',
      });
      if (ghostCount <= 0 || token !== focusCineToken) {
        focusCinePhase.value = 'settling';
        await nextTick();
        clampPaneWidths();
        persistLayoutState();
        return;
      }
      focusCinePhase.value = 'running';
      const tail = Math.min(Math.max(ghostCount - 1, 0), FOCUS_CINE_MAX_STAGGER_STEPS) * FOCUS_CINE_STAGGER;
      await waitForDuration(FOCUS_CINE_DURATION + tail + 40);
      if (token !== focusCineToken) return;
      focusCinePhase.value = 'settling';
      clearFocusCineArtifacts();
      await nextTick();
      clampPaneWidths();
      persistLayoutState();
    } catch (error) {
      console.error('[focus-cine] transition failed', error);
      await nextTick();
      clampPaneWidths();
      persistLayoutState();
    } finally {
      if (token === focusCineToken) {
        clearFocusCineArtifacts();
        focusCinePhase.value = 'idle';
        focusCineLocked.value = false;
      }
    }
  }

  // ── Copy Cinematic Transition ─────────────────────────────────────
  async function runCrossCopyCinematicTransition(nextCrossCopy: boolean): Promise<void> {
    if (isAnyCineLocked.value) return;
    const token = ++copyCineToken;
    copyCineLocked.value = true;
    copyCineDirection.value = nextCrossCopy ? 'enter' : 'exit';
    copyCinePhase.value = 'prepare';
    let switched = false;
    try {
      await nextTick();
      const sourceMap = collectSnapshots('data-copy-hero', true);
      const sourceSinkMap = collectSnapshots('data-copy-sink');
      setCrossCopyModeActive(nextCrossCopy);
      switched = true;
      await nextTick();
      await waitForFrame();
      await waitForFrame();
      const targetMap = collectSnapshots('data-copy-hero', true);
      const targetSinkMap = collectSnapshots('data-copy-sink');
      clearCopyCineArtifacts();
      const overlay = copyCineOverlayRef.value;
      if (!overlay || token !== copyCineToken) {
        copyCinePhase.value = 'settling';
        await nextTick();
        clampPaneWidths();
        persistLayoutState();
        return;
      }
      const ghostCount = mountGhosts(sourceMap, targetMap, sourceSinkMap, targetSinkMap, {
        overlay,
        priority: COPY_FALLBACK_PRIORITY,
        fallbackKey: 'tool_copy',
        ghostClass: 'copy-cine-ghost',
        heroAttr: 'data-copy-hero',
        hiddenClass: 'copy-cine-real-hidden',
        ghostNodes: copyCineGhostNodes,
        hiddenNodes: copyCineHiddenNodes,
        duration: COPY_CINE_DURATION,
        ease: COPY_CINE_EASE,
        stagger: COPY_CINE_STAGGER,
        maxStagger: COPY_CINE_MAX_STAGGER_STEPS,
        cssPrefix: 'copy-cine',
      });
      if (ghostCount <= 0 || token !== copyCineToken) {
        copyCinePhase.value = 'settling';
        await nextTick();
        clampPaneWidths();
        persistLayoutState();
        return;
      }
      copyCinePhase.value = 'running';
      const tail = Math.min(Math.max(ghostCount - 1, 0), COPY_CINE_MAX_STAGGER_STEPS) * COPY_CINE_STAGGER;
      await waitForDuration(COPY_CINE_DURATION + tail + 40);
      if (token !== copyCineToken) return;
      copyCinePhase.value = 'settling';
      clearCopyCineArtifacts();
      await nextTick();
      clampPaneWidths();
      persistLayoutState();
    } catch (error) {
      console.error('[copy-cine] transition failed', error);
      if (!switched) setCrossCopyModeActive(nextCrossCopy);
      await nextTick();
      clampPaneWidths();
      persistLayoutState();
    } finally {
      if (token === copyCineToken) {
        clearCopyCineArtifacts();
        copyCinePhase.value = 'idle';
        copyCineLocked.value = false;
      }
    }
  }

  // ── Toggle ────────────────────────────────────────────────────────
  function toggleFocusEditing(): void {
    if (isAnyCineLocked.value) return;
    const nextFocus = !isFocusEditing.value;
    if (!focusCineEnabled.value) {
      applyFocusEditingState(nextFocus);
      void nextTick(() => { clampPaneWidths(); persistLayoutState(); });
      return;
    }
    void runFocusCinematicTransition(nextFocus);
  }

  return {
    isFocusEditing, focusWorldbookMenuOpen, focusToolsExpanded,
    focusToolsTriggerVisible, focusCinePhase, focusCineDirection,
    focusCineLocked, focusCineOverlayRef, copyCinePhase, copyCineDirection,
    copyCineLocked, copyCineOverlayRef, focusMetaPanel, focusSidePanelState,
    focusCineEnabled, isFocusCineRunning, copyCineEnabled, isCopyCineRunning,
    isAnyCineLocked, focusCineRootClass,
    focusCommentSummary, focusKeywordSummary, focusStrategySummary,
    focusInsertionSummary, focusRecursionSummary,
    resetFocusPanels, toggleFocusMetaPanel, toggleFocusSidePanel,
    closeFocusWorldbookMenu, toggleFocusWorldbookMenu,
    openFocusToolsBand, closeFocusToolsBand, onFocusToolsBandAfterLeave,
    applyFocusEditingState, toggleFocusEditing,
    runFocusCinematicTransition, runCrossCopyCinematicTransition,
    cleanupAllCineArtifacts,
  };
}
