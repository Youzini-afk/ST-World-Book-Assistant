/**
 * Composable: worldbook mode actions
 * - Context/global worldbook selection synchronization
 * - Global mode toggle
 * - Focus worldbook menu actions
 */

import type { Ref, ComputedRef } from 'vue';
import { toStringSafe } from '../utils';
import type { SelectionSource, WorldbookSwitchOptions } from '../types';

export type FocusWorldbookAction = 'create' | 'duplicate' | 'delete' | 'export' | 'import';

export interface UseWorldbookModeActionsOptions {
  worldbookNames: Ref<string[]>;
  bindings: {
    global: string[];
    charPrimary: string | null;
    charAdditional: string[];
    chat: string | null;
  };
  globalWorldbookMode: Ref<boolean>;
  selectedWorldbookName: Ref<string>;
  selectableWorldbookNames: ComputedRef<string[]>;
  isAnyCineLocked: ComputedRef<boolean>;
  aiGeneratorMode: Ref<boolean>;
  tagEditorMode: Ref<boolean>;
  switchWorldbookSelection: (nextName: string, options?: WorldbookSwitchOptions) => boolean;
  setCrossCopyModeActive: (next: boolean) => void;
  setStatus: (msg: string) => void;
  closeFocusWorldbookMenu: () => void;
  createNewWorldbook: () => Promise<void>;
  duplicateWorldbook: () => Promise<void>;
  deleteCurrentWorldbook: () => Promise<void>;
  exportCurrentWorldbook: () => void;
  triggerImport: () => void;
}

export interface UseWorldbookModeActionsReturn {
  ensureSelectionForGlobalMode: (options?: WorldbookSwitchOptions) => boolean;
  trySelectWorldbookByContext: (options?: { preferWhenEmptyOnly?: boolean; source?: SelectionSource }) => boolean;
  toggleGlobalMode: () => void;
  runFocusWorldbookAction: (action: FocusWorldbookAction) => void;
}

export function useWorldbookModeActions(options: UseWorldbookModeActionsOptions): UseWorldbookModeActionsReturn {
  const {
    worldbookNames,
    bindings,
    globalWorldbookMode,
    selectedWorldbookName,
    selectableWorldbookNames,
    isAnyCineLocked,
    aiGeneratorMode,
    tagEditorMode,
    switchWorldbookSelection,
    setCrossCopyModeActive,
    setStatus,
    closeFocusWorldbookMenu,
    createNewWorldbook,
    duplicateWorldbook,
    deleteCurrentWorldbook,
    exportCurrentWorldbook,
    triggerImport,
  } = options;

  function resolveContextWorldbookCandidate(): string | null {
    const available = worldbookNames.value;
    if (!available.length) {
      return null;
    }
    const chatBound = toStringSafe(bindings.chat).trim();
    if (chatBound && available.includes(chatBound)) {
      return chatBound;
    }
    const charPrimary = toStringSafe(bindings.charPrimary).trim();
    if (charPrimary && available.includes(charPrimary)) {
      return charPrimary;
    }
    const charAdditional = bindings.charAdditional.find(name => available.includes(name));
    return charAdditional ?? null;
  }

  function ensureSelectionForGlobalMode(options: WorldbookSwitchOptions = {}): boolean {
    if (!globalWorldbookMode.value) {
      return true;
    }
    const globals = selectableWorldbookNames.value;
    if (!globals.length) {
      return switchWorldbookSelection('', {
        source: options.source ?? 'auto',
        reason: options.reason ?? '全局模式下无可用世界书',
        allowDirty: options.allowDirty,
        silentOnCancel: options.silentOnCancel,
      });
    }
    if (!globals.includes(selectedWorldbookName.value)) {
      return switchWorldbookSelection(globals[0], {
        source: options.source ?? 'auto',
        reason: options.reason ?? '全局模式同步当前选择',
        allowDirty: options.allowDirty,
        silentOnCancel: options.silentOnCancel,
      });
    }
    return true;
  }

  function trySelectWorldbookByContext(
    options: { preferWhenEmptyOnly?: boolean; source?: SelectionSource } = {},
  ): boolean {
    if (globalWorldbookMode.value) {
      return false;
    }
    if (options.preferWhenEmptyOnly && selectedWorldbookName.value) {
      return false;
    }
    const candidate = resolveContextWorldbookCandidate();
    if (!candidate || candidate === selectedWorldbookName.value) {
      return false;
    }
    const switched = switchWorldbookSelection(candidate, {
      source: options.source ?? 'auto',
      reason: '自动定位上下文世界书',
      silentOnCancel: true,
    });
    if (!switched) {
      setStatus('检测到上下文世界书变更，但当前有未保存修改，已取消自动切换');
      return false;
    }
    setStatus(`已自动定位到上下文世界书: ${candidate}`);
    return true;
  }

  function toggleGlobalMode(): void {
    if (isAnyCineLocked.value) {
      return;
    }
    globalWorldbookMode.value = !globalWorldbookMode.value;
    if (globalWorldbookMode.value) {
      aiGeneratorMode.value = false;
      tagEditorMode.value = false;
      setCrossCopyModeActive(false);
      const synced = ensureSelectionForGlobalMode({
        source: 'manual',
        reason: '切换到全局模式',
        silentOnCancel: true,
      });
      if (!synced) {
        globalWorldbookMode.value = false;
        setStatus('已取消切换到全局世界书模式');
        return;
      }
      setStatus('已切换到全局世界书模式');
      return;
    }
    if (!selectedWorldbookName.value) {
      trySelectWorldbookByContext({ source: 'manual' });
    }
    setStatus('已切换到上下文世界书模式');
  }

  const focusWorldbookActionHandlers: Record<FocusWorldbookAction, () => void> = {
    create: () => { void createNewWorldbook(); },
    duplicate: () => { void duplicateWorldbook(); },
    delete: () => { void deleteCurrentWorldbook(); },
    export: () => { exportCurrentWorldbook(); },
    import: () => { triggerImport(); },
  };

  function runFocusWorldbookAction(action: FocusWorldbookAction): void {
    closeFocusWorldbookMenu();
    focusWorldbookActionHandlers[action]();
  }

  return {
    ensureSelectionForGlobalMode,
    trySelectWorldbookByContext,
    toggleGlobalMode,
    runFocusWorldbookAction,
  };
}
