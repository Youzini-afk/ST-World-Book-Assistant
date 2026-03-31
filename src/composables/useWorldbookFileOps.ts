/**
 * Composable: worldbook file operations
 * - Export/import worldbooks
 * - Create/duplicate/delete worldbooks
 */

import { klona } from 'klona';
import type { Ref } from 'vue';
import { asRecord, normalizeEntryList, toStringSafe } from '../utils';
import type { HardRefreshOptions, ImportedPayload, PersistedState, WorldbookSwitchOptions } from '../types';

type ImportRawWorldbookResponse = string | { ok: boolean; status: number };

export interface UseWorldbookFileOpsOptions {
  selectedWorldbookName: Ref<string>;
  draftEntries: Ref<WorldbookEntry[]>;
  importFileInput: Ref<HTMLInputElement | null>;
  setStatus: (message: string) => void;
  createOrReplaceWorldbook: (
    name: string,
    entries: WorldbookEntry[],
    options?: Record<string, unknown>,
  ) => Promise<void>;
  reloadWorldbookNames: (preferred?: string, switchOptions?: WorldbookSwitchOptions) => Promise<boolean>;
  refreshBindings: () => Promise<void>;
  importRawWorldbook: (fileName: string, fileText: string) => Promise<ImportRawWorldbookResponse>;
  hardRefresh: (options?: HardRefreshOptions) => Promise<void>;
  deleteWorldbook: (name: string) => Promise<boolean>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
}

export interface UseWorldbookFileOpsReturn {
  exportCurrentWorldbook: () => void;
  triggerImport: () => void;
  onImportChange: (event: Event) => Promise<void>;
  createNewWorldbook: () => Promise<void>;
  duplicateWorldbook: () => Promise<void>;
  deleteCurrentWorldbook: () => Promise<void>;
}

export function useWorldbookFileOps(options: UseWorldbookFileOpsOptions): UseWorldbookFileOpsReturn {
  const {
    selectedWorldbookName,
    draftEntries,
    importFileInput,
    setStatus,
    createOrReplaceWorldbook,
    reloadWorldbookNames,
    refreshBindings,
    importRawWorldbook,
    hardRefresh,
    deleteWorldbook,
    updatePersistedState,
  } = options;

  function downloadJson(filename: string, payload: unknown): void {
    const text = JSON.stringify(payload, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  function exportCurrentWorldbook(): void {
    if (!selectedWorldbookName.value) {
      return;
    }
    const payload = {
      format: 'worldbook_assistant_v1',
      name: selectedWorldbookName.value,
      exported_at: new Date().toISOString(),
      entries: draftEntries.value,
    };
    const filename = `${selectedWorldbookName.value.replace(/[\\/:*?"<>|]/g, '_')}.json`;
    downloadJson(filename, payload);
  }

  function collectRawEntries(root: Record<string, unknown>): unknown[] {
    if (Array.isArray(root.entries)) {
      return root.entries;
    }
    const entriesMap = asRecord(root.entries);
    if (entriesMap) {
      return Object.values(entriesMap);
    }
    const dataRoot = asRecord(root.data);
    if (dataRoot) {
      if (Array.isArray(dataRoot.entries)) {
        return dataRoot.entries;
      }
      const dataEntriesMap = asRecord(dataRoot.entries);
      if (dataEntriesMap) {
        return Object.values(dataEntriesMap);
      }
    }
    return [];
  }

  function parseImportedPayload(fileName: string, text: string): ImportedPayload {
    const parsed = JSON.parse(text) as unknown;
    const fallbackName = fileName.replace(/\.[^/.]+$/, '') || '导入世界书';

    if (Array.isArray(parsed)) {
      return {
        name: fallbackName,
        entries: normalizeEntryList(parsed),
      };
    }

    const root = asRecord(parsed);
    if (!root) {
      throw new Error('导入内容必须是 JSON 对象或数组');
    }

    const entries = collectRawEntries(root);
    if (!entries.length) {
      throw new Error('未识别到有效的 entries');
    }

    const dataRoot = asRecord(root.data);
    const nameCandidate = toStringSafe(root.name ?? dataRoot?.name, fallbackName).trim();

    return {
      name: nameCandidate || fallbackName,
      entries: normalizeEntryList(entries),
    };
  }

  function triggerImport(): void {
    importFileInput.value?.click();
  }

  async function onImportChange(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement | null;
    const file = target?.files?.[0];
    if (!file) {
      return;
    }

    const fileText = await file.text();
    try {
      const payload = parseImportedPayload(file.name, fileText);
      const suggested = payload.name || file.name.replace(/\.[^/.]+$/, '');
      const newNameRaw = prompt('请输入新世界书名称', suggested);
      const newName = toStringSafe(newNameRaw).trim();
      if (!newName) {
        return;
      }
      await createOrReplaceWorldbook(newName, payload.entries, { render: 'immediate' });
      await reloadWorldbookNames(newName, {
        source: 'manual',
        reason: '导入后切换到新世界书',
      });
      await refreshBindings();
      toastr.success(`已导入为新世界书: ${newName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const shouldFallback = confirm(`解析导入文件失败: ${message}\n是否尝试按酒馆原生方式导入？`);
      if (!shouldFallback) {
        return;
      }
      const response = await importRawWorldbook(file.name, fileText);
      if (typeof response !== 'string' && !response.ok) {
        throw new Error(`原生导入失败: HTTP ${response.status}`);
      }
      const importedName = typeof response === 'string' ? response.trim() : '';
      await hardRefresh({ source: 'manual', reason: '导入后刷新' });
      if (importedName) {
        setStatus(`原生导入成功: ${importedName}`);
      }
      toastr.success('已按酒馆原生方式导入');
    } finally {
      if (target) {
        target.value = '';
      }
    }
  }

  async function createNewWorldbook(): Promise<void> {
    const nameRaw = prompt('请输入新世界书名称');
    const name = toStringSafe(nameRaw).trim();
    if (!name) {
      return;
    }
    try {
      await createOrReplaceWorldbook(name, [], { render: 'immediate' });
      await reloadWorldbookNames(name, {
        source: 'manual',
        reason: '创建世界书后切换',
      });
      await refreshBindings();
      toastr.success(`已创建世界书: ${name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`创建失败: ${message}`);
    }
  }

  async function duplicateWorldbook(): Promise<void> {
    if (!selectedWorldbookName.value) {
      return;
    }
    const suggested = `${selectedWorldbookName.value}_copy`;
    const newNameRaw = prompt('请输入复制后的名称', suggested);
    const newName = toStringSafe(newNameRaw).trim();
    if (!newName) {
      return;
    }
    try {
      await createOrReplaceWorldbook(newName, klona(draftEntries.value), { render: 'immediate' });
      await reloadWorldbookNames(newName, {
        source: 'manual',
        reason: '复制世界书后切换',
      });
      await refreshBindings();
      toastr.success(`已复制为: ${newName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`复制失败: ${message}`);
    }
  }

  async function deleteCurrentWorldbook(): Promise<void> {
    if (!selectedWorldbookName.value) {
      return;
    }
    const current = selectedWorldbookName.value;
    if (!confirm(`确定删除世界书 "${current}" ?`)) {
      return;
    }
    try {
      const success = await deleteWorldbook(current);
      if (!success) {
        throw new Error('返回 false');
      }
      updatePersistedState(state => {
        delete state.history[current];
        delete state.entry_history[current];
      });
      toastr.success(`已删除: ${current}`);
      await reloadWorldbookNames(undefined, {
        source: 'manual',
        reason: '删除世界书后同步选择',
        allowDirty: true,
      });
      await refreshBindings();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`删除失败: ${message}`);
    }
  }

  return {
    exportCurrentWorldbook,
    triggerImport,
    onImportChange,
    createNewWorldbook,
    duplicateWorldbook,
    deleteCurrentWorldbook,
  };
}
