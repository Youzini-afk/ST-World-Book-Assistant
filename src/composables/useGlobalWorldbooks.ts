/**
 * Composable: Global Worldbooks
 * - Global worldbook preset CRUD
 * - Preset selection & application
 * - Role-based preset auto-switch
 * - Global binding toggle
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import {
  getCharacterNames,
  getCurrentCharacterName,
  getGlobalWorldbookNames,
  rebindGlobalWorldbooks,
} from '../hostApi';
import { createId, toStringSafe, normalizePresetRoleBindings } from '../utils';
import { GLOBAL_PRESET_LIMIT } from '../store/persistedState';
import type {
  PersistedState,
  GlobalWorldbookPreset,
  PresetRoleBinding,
  RoleBindingCandidate,
  WorldbookSwitchOptions,
} from '../types';

export interface UseGlobalWorldbooksOptions {
  persistedState: Ref<PersistedState>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
  setStatus: (msg: string) => void;
  worldbookNames: Ref<string[]>;
  bindings: { global: string[]; charPrimary: string | null; charAdditional: string[]; chat: string | null };
  refreshBindings: () => Promise<void>;
  ensureSelectionForGlobalMode: (options: WorldbookSwitchOptions) => void;
}

export interface UseGlobalWorldbooksReturn {
  // State
  globalWorldbookMode: Ref<boolean>;
  selectedGlobalPresetId: Ref<string>;
  currentRoleContext: Ref<PresetRoleBinding | null>;
  roleBindingSourceCandidates: Ref<PresetRoleBinding[]>;
  rolePickerOpen: Ref<boolean>;
  globalAddSearchText: Ref<string>;
  globalFilterText: Ref<string>;

  // Computed
  globalWorldbookPresets: ComputedRef<GlobalWorldbookPreset[]>;
  selectedGlobalPreset: ComputedRef<GlobalWorldbookPreset | null>;
  selectedGlobalPresetRoleBindings: ComputedRef<PresetRoleBinding[]>;
  isCurrentRoleBoundToSelectedPreset: ComputedRef<boolean>;
  isGlobalBound: ComputedRef<boolean>;
  globalAddCandidates: ComputedRef<string[]>;
  filteredGlobalWorldbooks: ComputedRef<string[]>;

  // Functions
  syncSelectedGlobalPresetFromState: () => void;
  applyGlobalWorldbooks: (nextGlobal: string[], statusLabel?: string) => Promise<boolean>;
  addFirstGlobalCandidate: () => Promise<void>;
  addGlobalWorldbook: (name: string) => Promise<void>;
  removeGlobalWorldbook: (name: string) => Promise<void>;
  clearGlobalWorldbooks: () => Promise<void>;
  toggleGlobalBinding: () => Promise<void>;
  getCurrentGlobalWorldbookSet: () => string[];
  onGlobalPresetSelectionChanged: () => void;
  saveCurrentAsGlobalPreset: () => void;
  overwriteSelectedGlobalPreset: () => void;
  deleteSelectedGlobalPreset: () => void;
  bindCurrentRoleToSelectedPreset: () => void;
  bindRoleCandidateToSelectedPreset: (candidate: RoleBindingCandidate) => void;
  unbindCurrentRoleFromSelectedPreset: () => void;
  removeRoleBindingFromSelectedPreset: (bindingKey: string) => void;
  refreshRoleBindingCandidates: () => void;
  refreshCurrentRoleContext: () => void;
  autoApplyRoleBoundPreset: () => Promise<void>;
  toggleRolePicker: () => void;
  closeRolePicker: () => void;
}

export function useGlobalWorldbooks(options: UseGlobalWorldbooksOptions): UseGlobalWorldbooksReturn {
  const {
    persistedState,
    updatePersistedState,
    setStatus,
    worldbookNames,
    bindings,
    refreshBindings,
    ensureSelectionForGlobalMode,
  } = options;

  // ── State ──────────────────────────────────────────────────────────
  const globalWorldbookMode = ref(false);
  const selectedGlobalPresetId = ref('');
  const currentRoleContext = ref<PresetRoleBinding | null>(null);
  const roleBindingSourceCandidates = ref<PresetRoleBinding[]>([]);
  const rolePickerOpen = ref(false);
  const globalAddSearchText = ref('');
  const globalFilterText = ref('');

  // ── Computed ───────────────────────────────────────────────────────
  const globalWorldbookPresets = computed(() => persistedState.value.global_presets ?? []);

  const selectedGlobalPreset = computed(() => {
    return globalWorldbookPresets.value.find(item => item.id === selectedGlobalPresetId.value) ?? null;
  });

  const selectedGlobalPresetRoleBindings = computed(() => selectedGlobalPreset.value?.role_bindings ?? []);

  const isCurrentRoleBoundToSelectedPreset = computed(() => {
    const role = currentRoleContext.value;
    if (!role || !selectedGlobalPreset.value) return false;
    return selectedGlobalPreset.value.role_bindings.some(binding => binding.key === role.key);
  });

  const isGlobalBound = computed(() => {
    const name = persistedState.value.last_worldbook;
    if (!name) return false;
    return bindings.global.includes(name);
  });

  const globalAddCandidates = computed(() => {
    const keyword = globalAddSearchText.value.trim().toLowerCase();
    return worldbookNames.value
      .filter(name => !bindings.global.includes(name))
      .filter(name => !keyword || name.toLowerCase().includes(keyword));
  });

  const filteredGlobalWorldbooks = computed(() => {
    const keyword = globalFilterText.value.trim().toLowerCase();
    return bindings.global
      .filter(name => !keyword || name.toLowerCase().includes(keyword));
  });

  // ── Sync ───────────────────────────────────────────────────────────
  function syncSelectedGlobalPresetFromState(): void {
    const presets = persistedState.value.global_presets;
    const byId = new Set(presets.map(item => item.id));
    const preferredId = persistedState.value.last_global_preset_id;
    if (preferredId && byId.has(preferredId)) {
      selectedGlobalPresetId.value = preferredId;
      return;
    }
    if (selectedGlobalPresetId.value && byId.has(selectedGlobalPresetId.value)) {
      return;
    }
    selectedGlobalPresetId.value = '';
  }

  // ── Global binding ────────────────────────────────────────────────
  async function applyGlobalWorldbooks(nextGlobal: string[], statusLabel = '已更新全局世界书'): Promise<boolean> {
    const normalized = [...new Set(nextGlobal.map(name => name.trim()).filter(Boolean))].filter(name =>
      worldbookNames.value.includes(name),
    );
    try {
      await rebindGlobalWorldbooks(normalized);
      await refreshBindings();
      ensureSelectionForGlobalMode({
        source: 'manual',
        reason: '更新全局世界书后同步当前选择',
      });
      setStatus(`${statusLabel}（${normalized.length} 本）`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`更新全局世界书失败: ${message}`);
      return false;
    }
  }

  async function addFirstGlobalCandidate(): Promise<void> {
    const first = globalAddCandidates.value[0];
    if (!first) {
      return;
    }
    await addGlobalWorldbook(first);
  }

  async function addGlobalWorldbook(name: string): Promise<void> {
    if (!name || bindings.global.includes(name)) return;
    const success = await applyGlobalWorldbooks([...bindings.global, name], `已添加到全局: ${name}`);
    if (success) {
      globalAddSearchText.value = '';
      updatePersistedState(state => { state.role_override_baseline = null; });
    }
  }

  async function removeGlobalWorldbook(name: string): Promise<void> {
    if (!name || !bindings.global.includes(name)) return;
    const success = await applyGlobalWorldbooks(
      bindings.global.filter(item => item !== name),
      `已移出全局: ${name}`,
    );
    if (success) {
      updatePersistedState(state => { state.role_override_baseline = null; });
    }
  }

  async function clearGlobalWorldbooks(): Promise<void> {
    if (!bindings.global.length) return;
    if (!confirm('确定清空所有全局世界书吗？')) return;
    const success = await applyGlobalWorldbooks([], '已清空全局世界书');
    if (success) {
      updatePersistedState(state => { state.role_override_baseline = null; });
    }
  }

  async function toggleGlobalBinding(): Promise<void> {
    const selectedName = persistedState.value.last_worldbook;
    if (!selectedName) return;
    const next = new Set(getGlobalWorldbookNames());
    if (next.has(selectedName)) {
      next.delete(selectedName);
    } else {
      next.add(selectedName);
    }
    await applyGlobalWorldbooks([...next], '已更新全局绑定');
  }

  function getCurrentGlobalWorldbookSet(): string[] {
    return [...new Set(bindings.global.map(name => name.trim()).filter(Boolean))];
  }

  function normalizeWorldbookSet(input: string[]): string[] {
    return [...new Set(input.map(name => name.trim()).filter(Boolean))];
  }

  function isSameWorldbookSet(left: string[], right: string[]): boolean {
    const leftSorted = [...normalizeWorldbookSet(left)].sort();
    const rightSorted = [...normalizeWorldbookSet(right)].sort();
    if (leftSorted.length !== rightSorted.length) return false;
    for (let index = 0; index < leftSorted.length; index += 1) {
      if (leftSorted[index] !== rightSorted[index]) return false;
    }
    return true;
  }

  // ── Preset CRUD ───────────────────────────────────────────────────
  function onGlobalPresetSelectionChanged(): void {
    closeRolePicker();
    if (!selectedGlobalPresetId.value) {
      updatePersistedState(state => {
        state.last_global_preset_id = '';
        state.role_override_baseline = null;
      });
      if (bindings.global.length) {
        void applyGlobalWorldbooks([], '已切换到默认预设（清空全局世界书）');
      } else {
        setStatus('已切换到默认预设');
      }
      return;
    }
    void applySelectedGlobalPreset();
  }

  function saveCurrentAsGlobalPreset(): void {
    const current = getCurrentGlobalWorldbookSet();
    if (!current.length) {
      toastr.warning('当前全局世界书为空，无法保存预设');
      return;
    }
    const defaultName = selectedGlobalPreset.value?.name || `全局预设 ${globalWorldbookPresets.value.length + 1}`;
    const nameRaw = prompt('请输入预设名称', defaultName);
    const name = toStringSafe(nameRaw).trim();
    if (!name) return;
    const sameNamePreset = globalWorldbookPresets.value.find(item => item.name === name);
    if (sameNamePreset && !confirm(`预设 "${name}" 已存在，是否覆盖？`)) return;
    const presetId = sameNamePreset?.id || createId('global-preset');
    const nextPreset: GlobalWorldbookPreset = {
      id: presetId,
      name,
      worldbooks: current,
      role_bindings: sameNamePreset?.role_bindings ?? [],
      updated_at: Date.now(),
    };
    updatePersistedState(state => {
      const list = (state.global_presets ?? []).filter(item => item.id !== presetId);
      list.unshift(nextPreset);
      state.global_presets = list.slice(0, GLOBAL_PRESET_LIMIT);
      state.last_global_preset_id = presetId;
    });
    selectedGlobalPresetId.value = presetId;
    setStatus(`已保存预设: ${name}（${current.length} 本）`);
    toastr.success(`已保存预设: ${name}`);
  }

  function overwriteSelectedGlobalPreset(): void {
    const preset = selectedGlobalPreset.value;
    if (!preset) return;
    const current = getCurrentGlobalWorldbookSet();
    if (!current.length) {
      toastr.warning('当前全局世界书为空，无法覆盖预设');
      return;
    }
    if (!confirm(`确定用当前全局世界书覆盖预设 "${preset.name}" 吗？`)) return;
    updatePersistedState(state => {
      state.global_presets = (state.global_presets ?? []).map(item => {
        if (item.id !== preset.id) return item;
        return { ...item, worldbooks: current, updated_at: Date.now() };
      });
      state.last_global_preset_id = preset.id;
    });
    setStatus(`已覆盖预设: ${preset.name}（${current.length} 本）`);
    toastr.success(`已覆盖预设: ${preset.name}`);
  }

  function deleteSelectedGlobalPreset(): void {
    const preset = selectedGlobalPreset.value;
    if (!preset) return;
    if (!confirm(`确定删除预设 "${preset.name}" 吗？`)) return;
    updatePersistedState(state => {
      state.global_presets = (state.global_presets ?? []).filter(item => item.id !== preset.id);
      if (state.last_global_preset_id === preset.id) {
        state.last_global_preset_id = '';
      }
    });
    selectedGlobalPresetId.value = '';
    setStatus(`已删除预设: ${preset.name}`);
  }

  // ── Role binding ──────────────────────────────────────────────────
  function bindRoleToSelectedPreset(role: PresetRoleBinding): void {
    const preset = selectedGlobalPreset.value;
    if (!preset) {
      toastr.warning('请先选择预设');
      return;
    }
    updatePersistedState(state => {
      state.global_presets = (state.global_presets ?? []).map(item => {
        if (item.id !== preset.id) return item;
        const nextBindings = normalizePresetRoleBindings([
          ...item.role_bindings.filter(binding => binding.key !== role.key),
          { key: role.key, name: role.name, avatar: role.avatar, updated_at: Date.now() } satisfies PresetRoleBinding,
        ]);
        return { ...item, role_bindings: nextBindings, updated_at: Date.now() };
      });
      state.last_global_preset_id = preset.id;
    });
    setStatus(`已绑定角色到预设: ${role.name} → ${preset.name}`);
  }

  function bindCurrentRoleToSelectedPreset(): void {
    const role = currentRoleContext.value;
    if (!role) {
      toastr.warning('当前没有可绑定的角色');
      return;
    }
    bindRoleToSelectedPreset(role);
  }

  function bindRoleCandidateToSelectedPreset(candidate: RoleBindingCandidate): void {
    if (candidate.bound) return;
    bindRoleToSelectedPreset(candidate);
    closeRolePicker();
  }

  function removeRoleBindingFromSelectedPreset(bindingKey: string): void {
    const preset = selectedGlobalPreset.value;
    if (!preset || !bindingKey) return;
    updatePersistedState(state => {
      state.global_presets = (state.global_presets ?? []).map(item => {
        if (item.id !== preset.id) return item;
        return { ...item, role_bindings: item.role_bindings.filter(binding => binding.key !== bindingKey), updated_at: Date.now() };
      });
    });
  }

  function unbindCurrentRoleFromSelectedPreset(): void {
    const role = currentRoleContext.value;
    if (!role) {
      toastr.warning('当前没有可解绑的角色');
      return;
    }
    removeRoleBindingFromSelectedPreset(role.key);
    setStatus(`已解绑角色: ${role.name}`);
  }

  function refreshRoleBindingCandidates(): void {
    let names: string[] = [];
    try {
      names = typeof getCharacterNames === 'function' ? getCharacterNames() : [];
    } catch (error) {
      console.warn('[WorldbookAssistant] getCharacterNames failed:', error);
    }
    const dedupe = new Set<string>();
    const result: PresetRoleBinding[] = [];
    for (const charName of names) {
      const trimmed = charName.trim();
      if (!trimmed) continue;
      const key = `char:${trimmed}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);
      result.push({ key, name: trimmed, avatar: '', updated_at: Date.now() });
    }
    result.sort((left, right) => left.name.localeCompare(right.name, 'zh-Hans-CN'));
    const current = resolveCurrentRoleContext();
    if (current && !result.some(item => item.key === current.key)) {
      result.unshift(current);
    }
    roleBindingSourceCandidates.value = result;
  }

  function resolveCurrentRoleContext(): PresetRoleBinding | null {
    let name: string | null = null;
    try {
      name = typeof getCurrentCharacterName === 'function' ? getCurrentCharacterName() : null;
    } catch (error) {
      console.warn('[WorldbookAssistant] getCurrentCharacterName failed:', error);
    }
    if (!name) return null;
    const trimmed = name.trim();
    if (!trimmed) return null;
    return { key: `char:${trimmed}`, name: trimmed, avatar: '', updated_at: Date.now() };
  }

  function refreshCurrentRoleContext(): void {
    currentRoleContext.value = resolveCurrentRoleContext();
  }

  // ── Preset application ────────────────────────────────────────────
  async function applyPresetWorldbooks(
    preset: GlobalWorldbookPreset,
    opts: { statusPrefix?: string; silentWhenSame?: boolean } = {},
  ): Promise<boolean> {
    const normalized = normalizeWorldbookSet(preset.worldbooks);
    const missing = normalized.filter(name => !worldbookNames.value.includes(name));
    const matched = normalized.filter(name => worldbookNames.value.includes(name));
    if (opts.silentWhenSame && isSameWorldbookSet(getCurrentGlobalWorldbookSet(), matched)) {
      updatePersistedState(state => { state.last_global_preset_id = preset.id; });
      return true;
    }
    const statusPrefix = opts.statusPrefix ?? '已应用预设';
    const success = await applyGlobalWorldbooks(matched, `${statusPrefix}: ${preset.name}`);
    if (!success) return false;
    updatePersistedState(state => { state.last_global_preset_id = preset.id; });
    if (missing.length) {
      toastr.warning(`预设内有 ${missing.length} 本世界书在当前环境不存在，已自动忽略`);
    }
    return true;
  }

  async function applySelectedGlobalPreset(): Promise<void> {
    const preset = selectedGlobalPreset.value;
    if (!preset) return;
    const success = await applyPresetWorldbooks(preset);
    if (success) {
      updatePersistedState(state => { state.role_override_baseline = null; });
    }
  }

  function getRoleBoundPresetForCurrentContext(): GlobalWorldbookPreset | null {
    const role = currentRoleContext.value;
    if (!role) return null;
    return globalWorldbookPresets.value.find(item => item.role_bindings.some(binding => binding.key === role.key)) ?? null;
  }

  async function autoApplyRoleBoundPreset(): Promise<void> {
    const rolePreset = getRoleBoundPresetForCurrentContext();
    if (!rolePreset) {
      const baseline = persistedState.value.role_override_baseline;
      if (baseline) {
        updatePersistedState(state => {
          state.role_override_baseline = null;
          state.last_global_preset_id = baseline.preset_id;
        });
        selectedGlobalPresetId.value = baseline.preset_id;
        if (baseline.preset_id) {
          const baselinePreset = globalWorldbookPresets.value.find(item => item.id === baseline.preset_id);
          if (baselinePreset) {
            await applyPresetWorldbooks(baselinePreset, { statusPrefix: '已恢复角色切换前的预设', silentWhenSame: true });
          } else {
            await applyGlobalWorldbooks(baseline.worldbooks, '已恢复角色切换前的全局世界书');
          }
        } else {
          await applyGlobalWorldbooks(baseline.worldbooks, '已恢复角色切换前的全局世界书');
        }
      }
      return;
    }
    if (!persistedState.value.role_override_baseline) {
      updatePersistedState(state => {
        state.role_override_baseline = {
          preset_id: selectedGlobalPresetId.value,
          worldbooks: getCurrentGlobalWorldbookSet(),
        };
      });
    }
    selectedGlobalPresetId.value = rolePreset.id;
    await applyPresetWorldbooks(rolePreset, {
      statusPrefix: `已按角色自动切换预设（${currentRoleContext.value?.name ?? '当前角色'}）`,
      silentWhenSame: true,
    });
  }

  function toggleRolePicker(): void {
    rolePickerOpen.value = !rolePickerOpen.value;
    if (rolePickerOpen.value) {
      refreshRoleBindingCandidates();
    }
  }

  function closeRolePicker(): void {
    rolePickerOpen.value = false;
  }

  return {
    globalWorldbookMode,
    selectedGlobalPresetId,
    currentRoleContext,
    roleBindingSourceCandidates,
    rolePickerOpen,
    globalAddSearchText,
    globalFilterText,
    globalWorldbookPresets,
    selectedGlobalPreset,
    selectedGlobalPresetRoleBindings,
    isCurrentRoleBoundToSelectedPreset,
    isGlobalBound,
    globalAddCandidates,
    filteredGlobalWorldbooks,
    syncSelectedGlobalPresetFromState,
    addFirstGlobalCandidate,
    applyGlobalWorldbooks,
    addGlobalWorldbook,
    removeGlobalWorldbook,
    clearGlobalWorldbooks,
    toggleGlobalBinding,
    getCurrentGlobalWorldbookSet,
    onGlobalPresetSelectionChanged,
    saveCurrentAsGlobalPreset,
    overwriteSelectedGlobalPreset,
    deleteSelectedGlobalPreset,
    bindCurrentRoleToSelectedPreset,
    bindRoleCandidateToSelectedPreset,
    unbindCurrentRoleFromSelectedPreset,
    removeRoleBindingFromSelectedPreset,
    refreshRoleBindingCandidates,
    refreshCurrentRoleContext,
    autoApplyRoleBoundPreset,
    toggleRolePicker,
    closeRolePicker,
  };
}
