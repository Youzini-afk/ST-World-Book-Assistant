/**
 * Composable: UI picker/theme handlers
 * - Worldbook picker open/close/select
 * - Theme toggle/set handlers (including host custom event)
 * - Host pointer/keyboard outside-close handlers for floating menus
 * - Role preset quick bind helper
 */

import type { Ref, ComputedRef } from 'vue';
import { THEMES, type ThemeKey } from '../themes';
import type { RoleBindingCandidate, WorldbookSwitchOptions } from '../types';

export interface UseUIPickerThemeHandlersOptions {
  worldbookPickerOpen: Ref<boolean>;
  worldbookPickerSearchText: Ref<string>;
  worldbookPickerRef: Ref<HTMLElement | null>;
  rolePickerOpen: Ref<boolean>;
  rolePickerRef: Ref<HTMLElement | null>;
  themePickerOpen: Ref<boolean>;
  focusWorldbookMenuOpen: Ref<boolean>;
  focusWorldbookMenuRef: Ref<HTMLElement | null>;
  currentTheme: Ref<ThemeKey>;
  roleBindingCandidates: ComputedRef<RoleBindingCandidate[]>;
  closeRolePicker: () => void;
  closeFocusWorldbookMenu: () => void;
  switchWorldbookSelection: (nextName: string, options?: WorldbookSwitchOptions) => boolean;
  bindRoleCandidateToSelectedPreset: (candidate: RoleBindingCandidate) => void;
  setStatus: (msg: string) => void;
}

export interface UseUIPickerThemeHandlersReturn {
  closeWorldbookPicker: () => void;
  toggleWorldbookPicker: () => void;
  toggleTheme: () => void;
  setTheme: (key: ThemeKey) => void;
  onSetThemeEvent: (event: Event) => void;
  selectWorldbookFromPicker: (name: string) => void;
  bindFirstRoleCandidate: () => void;
  onHostPointerDownForWorldbookPicker: (event: PointerEvent) => void;
  onHostKeyDownForWorldbookPicker: (event: KeyboardEvent) => void;
}

export function useUIPickerThemeHandlers(options: UseUIPickerThemeHandlersOptions): UseUIPickerThemeHandlersReturn {
  const {
    worldbookPickerOpen,
    worldbookPickerSearchText,
    worldbookPickerRef,
    rolePickerOpen,
    rolePickerRef,
    themePickerOpen,
    focusWorldbookMenuOpen,
    focusWorldbookMenuRef,
    currentTheme,
    roleBindingCandidates,
    closeRolePicker,
    closeFocusWorldbookMenu,
    switchWorldbookSelection,
    bindRoleCandidateToSelectedPreset,
    setStatus,
  } = options;

  function closeWorldbookPicker(): void {
    worldbookPickerOpen.value = false;
  }

  function openWorldbookPicker(): void {
    worldbookPickerSearchText.value = '';
    worldbookPickerOpen.value = true;
  }

  function toggleWorldbookPicker(): void {
    if (worldbookPickerOpen.value) {
      closeWorldbookPicker();
      return;
    }
    openWorldbookPicker();
  }

  function toggleTheme(): void {
    const keys = Object.keys(THEMES) as ThemeKey[];
    const index = keys.indexOf(currentTheme.value);
    const nextIndex = (index + 1) % keys.length;
    currentTheme.value = keys[nextIndex];
    setStatus(`已切换主题: ${THEMES[currentTheme.value].name}`);
  }

  function setTheme(key: ThemeKey): void {
    currentTheme.value = key;
    themePickerOpen.value = false;
    setStatus(`已切换主题: ${THEMES[key].label}`);
  }

  function onSetThemeEvent(event: Event): void {
    const key = (event as CustomEvent<string>).detail;
    if (key && key in THEMES) {
      setTheme(key as ThemeKey);
    }
  }

  function selectWorldbookFromPicker(name: string): void {
    if (!name) {
      return;
    }
    const switched = switchWorldbookSelection(name, {
      source: 'manual',
      reason: '手动切换世界书',
    });
    if (switched) {
      closeWorldbookPicker();
    }
  }

  function bindFirstRoleCandidate(): void {
    const first = roleBindingCandidates.value.find(item => !item.bound);
    if (!first) {
      return;
    }
    bindRoleCandidateToSelectedPreset(first);
  }

  function onHostPointerDownForWorldbookPicker(event: PointerEvent): void {
    if (!worldbookPickerOpen.value && !rolePickerOpen.value && !themePickerOpen.value && !focusWorldbookMenuOpen.value) {
      return;
    }
    const target = event.target as Node | null;
    if (!target) {
      closeWorldbookPicker();
      closeRolePicker();
      closeFocusWorldbookMenu();
      themePickerOpen.value = false;
      return;
    }

    if (worldbookPickerOpen.value) {
      const worldbookRoot = worldbookPickerRef.value;
      if (!worldbookRoot || !worldbookRoot.contains(target)) {
        closeWorldbookPicker();
      }
    }

    if (rolePickerOpen.value) {
      const roleRoot = rolePickerRef.value;
      if (!roleRoot || !roleRoot.contains(target)) {
        closeRolePicker();
      }
    }

    if (themePickerOpen.value) {
      themePickerOpen.value = false;
    }

    if (focusWorldbookMenuOpen.value) {
      const focusMenuRoot = focusWorldbookMenuRef.value;
      if (!focusMenuRoot || !focusMenuRoot.contains(target)) {
        closeFocusWorldbookMenu();
      }
    }
  }

  function onHostKeyDownForWorldbookPicker(event: KeyboardEvent): void {
    if (!worldbookPickerOpen.value && !rolePickerOpen.value && !focusWorldbookMenuOpen.value) {
      return;
    }
    if (event.key === 'Escape') {
      closeWorldbookPicker();
      closeRolePicker();
      closeFocusWorldbookMenu();
    }
  }

  return {
    closeWorldbookPicker,
    toggleWorldbookPicker,
    toggleTheme,
    setTheme,
    onSetThemeEvent,
    selectWorldbookFromPicker,
    bindFirstRoleCandidate,
    onHostPointerDownForWorldbookPicker,
    onHostKeyDownForWorldbookPicker,
  };
}
