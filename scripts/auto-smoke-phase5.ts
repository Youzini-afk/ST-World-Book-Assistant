import { computed, ref, type Ref } from 'vue';
import { THEMES, type ThemeKey } from '../src/themes';
import { useUIPickerThemeHandlers } from '../src/composables/useUIPickerThemeHandlers';
import { useWorldbookDataFlow } from '../src/composables/useWorldbookDataFlow';
import { useWorldbookFileOps } from '../src/composables/useWorldbookFileOps';
import { useWorldbookModeActions } from '../src/composables/useWorldbookModeActions';

/* eslint-disable @typescript-eslint/no-explicit-any */

type TestCase = {
  name: string;
  run: () => Promise<void> | void;
};

const tests: TestCase[] = [];
const toastLog: string[] = [];
const statusLog: string[] = [];

function test(name: string, run: () => Promise<void> | void): void {
  tests.push({ name, run });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function createSimpleEntry(uid: number, name: string, content = ''): Record<string, unknown> {
  return { uid, name, content };
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const g = globalThis as any;
const originalGlobals = {
  toastr: g.toastr,
  prompt: g.prompt,
  confirm: g.confirm,
  document: g.document,
  URL: g.URL,
  getWorldbook: g.getWorldbook,
  getWorldbookNames: g.getWorldbookNames,
  replaceWorldbook: g.replaceWorldbook,
};

function installToastrMock(): void {
  g.toastr = {
    success(message: string) {
      toastLog.push(`success:${message}`);
    },
    error(message: string) {
      toastLog.push(`error:${message}`);
    },
    warning(message: string) {
      toastLog.push(`warning:${message}`);
    },
    info(message: string) {
      toastLog.push(`info:${message}`);
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useWorldbookModeActions
// ─────────────────────────────────────────────────────────────────────────────

test('useWorldbookModeActions: 模式互斥与焦点动作分发', () => {
  const worldbookNames = ref(['CtxBook', 'GlobalBook']);
  const bindings = {
    global: ['GlobalBook'],
    charPrimary: 'CtxBook',
    charAdditional: [] as string[],
    chat: null as string | null,
  };
  const selectableSource = ref(['GlobalBook']);
  const selectableWorldbookNames = computed(() => [...selectableSource.value]);
  const globalWorldbookMode = ref(false);
  const selectedWorldbookName = ref('CtxBook');
  const cineLocked = ref(false);

  const switchCalls: string[] = [];
  const crossCopyCalls: boolean[] = [];
  let closeMenuCount = 0;
  let createCount = 0;
  let duplicateCount = 0;
  let deleteCount = 0;
  let exportCount = 0;
  let importCount = 0;

  const api = useWorldbookModeActions({
    worldbookNames,
    bindings,
    globalWorldbookMode,
    selectedWorldbookName,
    selectableWorldbookNames,
    isAnyCineLocked: computed(() => cineLocked.value),
    aiGeneratorMode: ref(true),
    tagEditorMode: ref(true),
    switchWorldbookSelection: name => {
      switchCalls.push(name);
      selectedWorldbookName.value = name;
      return true;
    },
    setCrossCopyModeActive: next => {
      crossCopyCalls.push(next);
    },
    setStatus: message => {
      statusLog.push(message);
    },
    closeFocusWorldbookMenu: () => {
      closeMenuCount += 1;
    },
    createNewWorldbook: async () => {
      createCount += 1;
    },
    duplicateWorldbook: async () => {
      duplicateCount += 1;
    },
    deleteCurrentWorldbook: async () => {
      deleteCount += 1;
    },
    exportCurrentWorldbook: () => {
      exportCount += 1;
    },
    triggerImport: () => {
      importCount += 1;
    },
  });

  api.toggleGlobalMode();
  assert(globalWorldbookMode.value === true, '切换全局模式失败');
  assert(selectedWorldbookName.value === 'GlobalBook', '全局模式下世界书同步失败');
  assert(crossCopyCalls.at(-1) === false, '全局模式未关闭跨书复制');

  api.toggleGlobalMode();
  assert(globalWorldbookMode.value === false, '切回上下文模式失败');

  cineLocked.value = true;
  api.toggleGlobalMode();
  assert(globalWorldbookMode.value === false, '锁定状态不应允许切换模式');
  cineLocked.value = false;

  selectableSource.value = [];
  globalWorldbookMode.value = true;
  const ensureResult = api.ensureSelectionForGlobalMode({ source: 'auto' });
  assert(ensureResult === true, '全局模式空列表同步失败');
  assert(switchCalls.at(-1) === '', '空全局列表应切换为空选择');

  api.runFocusWorldbookAction('create');
  api.runFocusWorldbookAction('duplicate');
  api.runFocusWorldbookAction('delete');
  api.runFocusWorldbookAction('export');
  api.runFocusWorldbookAction('import');
  assert(closeMenuCount === 5, 'focus 菜单动作前未统一关闭菜单');
  assert(createCount === 1 && duplicateCount === 1 && deleteCount === 1 && exportCount === 1 && importCount === 1, 'focus 菜单动作分发异常');

  globalWorldbookMode.value = false;
  selectedWorldbookName.value = '';
  bindings.chat = 'CtxBook';
  const byContext = api.trySelectWorldbookByContext({ source: 'auto' });
  assert(byContext === true, '上下文自动定位未命中');
  assert(selectedWorldbookName.value === 'CtxBook', '上下文定位结果错误');
});

// ─────────────────────────────────────────────────────────────────────────────
// useUIPickerThemeHandlers
// ─────────────────────────────────────────────────────────────────────────────

test('useUIPickerThemeHandlers: picker/主题/宿主关闭行为', () => {
  const worldbookPickerOpen = ref(false);
  const worldbookPickerSearchText = ref('dirty-keyword');
  const worldbookPickerRef = ref<HTMLElement | null>({ contains: () => false } as unknown as HTMLElement);
  const rolePickerOpen = ref(false);
  const rolePickerRef = ref<HTMLElement | null>({ contains: () => false } as unknown as HTMLElement);
  const themePickerOpen = ref(false);
  const focusWorldbookMenuOpen = ref(false);
  const focusWorldbookMenuRef = ref<HTMLElement | null>({ contains: () => false } as unknown as HTMLElement);
  const themeKeys = Object.keys(THEMES) as ThemeKey[];
  const currentTheme = ref(themeKeys[0]);

  let closeRoleCount = 0;
  let closeFocusCount = 0;
  let bindCount = 0;
  const switchCalls: string[] = [];

  const api = useUIPickerThemeHandlers({
    worldbookPickerOpen,
    worldbookPickerSearchText,
    worldbookPickerRef,
    rolePickerOpen,
    rolePickerRef,
    themePickerOpen,
    focusWorldbookMenuOpen,
    focusWorldbookMenuRef,
    currentTheme,
    roleBindingCandidates: computed(() => [
      { key: 'alpha', name: 'Alpha', avatar: '', updated_at: Date.now(), bound: false },
    ]),
    closeRolePicker: () => {
      closeRoleCount += 1;
      rolePickerOpen.value = false;
    },
    closeFocusWorldbookMenu: () => {
      closeFocusCount += 1;
      focusWorldbookMenuOpen.value = false;
    },
    switchWorldbookSelection: name => {
      switchCalls.push(name);
      return true;
    },
    bindRoleCandidateToSelectedPreset: () => {
      bindCount += 1;
    },
    setStatus: message => {
      statusLog.push(message);
    },
  });

  api.toggleWorldbookPicker();
  assert(worldbookPickerOpen.value === true, 'picker 未打开');
  assert(worldbookPickerSearchText.value === '', 'picker 打开时应清空搜索');

  api.selectWorldbookFromPicker('Book-X');
  assert(switchCalls.at(-1) === 'Book-X', 'picker 选择未触发切换');
  assert(worldbookPickerOpen.value === false, 'picker 选择后应关闭');

  const beforeTheme = currentTheme.value;
  api.toggleTheme();
  assert(currentTheme.value !== beforeTheme, '主题未轮换');

  worldbookPickerOpen.value = true;
  rolePickerOpen.value = true;
  themePickerOpen.value = true;
  focusWorldbookMenuOpen.value = true;
  api.onHostPointerDownForWorldbookPicker({ target: {} } as unknown as PointerEvent);
  assert(worldbookPickerOpen.value === false, '外部点击未关闭 worldbook picker');
  assert(rolePickerOpen.value === false, '外部点击未关闭 role picker');
  assert(themePickerOpen.value === false, '外部点击未关闭 theme picker');
  assert(focusWorldbookMenuOpen.value === false, '外部点击未关闭 focus menu');

  worldbookPickerOpen.value = true;
  rolePickerOpen.value = true;
  focusWorldbookMenuOpen.value = true;
  api.onHostKeyDownForWorldbookPicker({ key: 'Escape' } as KeyboardEvent);
  assert(worldbookPickerOpen.value === false, 'ESC 未关闭 worldbook picker');
  assert(rolePickerOpen.value === false, 'ESC 未关闭 role picker');
  assert(focusWorldbookMenuOpen.value === false, 'ESC 未关闭 focus menu');

  api.bindFirstRoleCandidate();
  assert(bindCount === 1, '首个角色候选绑定失败');
  assert(closeRoleCount > 0 && closeFocusCount > 0, '关闭回调未触发');
});

// ─────────────────────────────────────────────────────────────────────────────
// useWorldbookDataFlow
// ─────────────────────────────────────────────────────────────────────────────

test('useWorldbookDataFlow: load/reload/save/hardRefresh 主链路', async () => {
  const worldbookStore = new Map<string, Array<Record<string, unknown>>>([
    ['BookA', [createSimpleEntry(0, 'A-Entry', 'hello')]],
    ['BookB', [createSimpleEntry(0, 'B-Entry', 'world')]],
  ]);

  g.getWorldbook = async (name: string): Promise<Array<Record<string, unknown>>> => {
    const data = worldbookStore.get(name);
    if (!data) {
      throw new Error(`missing:${name}`);
    }
    return deepClone(data);
  };
  g.getWorldbookNames = (): string[] => Array.from(worldbookStore.keys());

  const replaceCalls: Array<{ name: string; entries: Array<Record<string, unknown>> }> = [];
  g.replaceWorldbook = async (name: string, entries: Array<Record<string, unknown>>): Promise<void> => {
    replaceCalls.push({ name, entries: deepClone(entries) });
    worldbookStore.set(name, deepClone(entries));
  };

  const selectedWorldbookName = ref(' BookA ');
  const worldbookNames = ref<string[]>([]);
  const draftEntries = ref<Array<Record<string, unknown>>>([]);
  const originalEntries = ref<Array<Record<string, unknown>>>([]);
  const selectedEntryUid = ref<number | null>(null);
  const selectedKeysRaw = ref('');
  const selectedSecondaryKeysRaw = ref('');
  const selectedKeysText = computed(() => 'keys-text-sync');
  const selectedSecondaryKeysText = computed(() => 'secondary-keys-text-sync');

  const persistedState = ref({ last_worldbook: 'BookA' } as any);
  const unsavedFlag = ref(true);
  const isBusy = ref(false);
  const isSaving = ref(false);

  let digestSyncCount = 0;
  let ensureEntryCount = 0;
  let normalizeCrossCopyCount = 0;
  let persistCrossCopyCount = 0;
  let readPersistedCount = 0;
  let syncGlobalPresetCount = 0;
  let applyCrossCopyCount = 0;
  let refreshBindingsCount = 0;
  let refreshRoleCandidatesCount = 0;
  let refreshRoleContextCount = 0;
  let autoApplyPresetCount = 0;
  let ensureGlobalSelectionCount = 0;
  let contextSelectionCount = 0;
  let snapshotAfterSaveCount = 0;

  const globalMode = ref(false);

  const api = useWorldbookDataFlow({
    selectedWorldbookName,
    worldbookNames,
    draftEntries: draftEntries as unknown as Ref<WorldbookEntry[]>,
    originalEntries: originalEntries as unknown as Ref<WorldbookEntry[]>,
    selectedEntryUid,
    selectedKeysRaw,
    selectedSecondaryKeysRaw,
    selectedKeysText,
    selectedSecondaryKeysText,
    persistedState,
    hasUnsavedChanges: computed(() => unsavedFlag.value),
    isBusy,
    isSaving,
    setStatus: message => {
      statusLog.push(message);
    },
    syncEntriesDigestNow: () => {
      digestSyncCount += 1;
    },
    ensureSelectedEntryExists: () => {
      ensureEntryCount += 1;
    },
    normalizeCrossCopyWorldbookSelection: () => {
      normalizeCrossCopyCount += 1;
    },
    persistCrossCopyState: () => {
      persistCrossCopyCount += 1;
    },
    switchWorldbookSelection: nextName => {
      selectedWorldbookName.value = nextName;
      return true;
    },
    ensureRefreshAllowed: () => true,
    readPersistedState: () => {
      readPersistedCount += 1;
      return persistedState.value;
    },
    syncSelectedGlobalPresetFromState: () => {
      syncGlobalPresetCount += 1;
    },
    applyCrossCopyStateFromPersisted: () => {
      applyCrossCopyCount += 1;
    },
    refreshBindings: async () => {
      refreshBindingsCount += 1;
    },
    refreshRoleBindingCandidates: () => {
      refreshRoleCandidatesCount += 1;
    },
    refreshCurrentRoleContext: () => {
      refreshRoleContextCount += 1;
    },
    autoApplyRoleBoundPreset: async () => {
      autoApplyPresetCount += 1;
    },
    globalWorldbookMode: globalMode,
    ensureSelectionForGlobalMode: () => {
      ensureGlobalSelectionCount += 1;
      return true;
    },
    trySelectWorldbookByContext: () => {
      contextSelectionCount += 1;
      return true;
    },
    collectEntrySnapshotsBeforeSave: () => [{ id: 1 }, { id: 2 }],
    pushEntrySnapshotsBulk: snapshots => snapshots.length,
    pushSnapshot: () => {
      snapshotAfterSaveCount += 1;
    },
  });

  await api.loadWorldbook(' BookA ');
  assert(draftEntries.value.length === 1, 'loadWorldbook 未加载条目');
  assert(String(draftEntries.value[0]?.name) === 'A-Entry', 'loadWorldbook trim fallback 异常');
  assert(isBusy.value === false, 'load 完成后 busy 应为 false');
  assert(digestSyncCount > 0 && ensureEntryCount > 0, 'load 后续同步未执行');

  await api.reloadWorldbookNames('BookB', { source: 'manual' });
  assert(worldbookNames.value.includes('BookA') && worldbookNames.value.includes('BookB'), 'reloadWorldbookNames 列表未刷新');
  assert(selectedWorldbookName.value === 'BookB', 'reloadWorldbookNames 未按 preferred 切换');
  assert(normalizeCrossCopyCount > 0 && persistCrossCopyCount > 0, 'reloadWorldbookNames 未同步跨书复制状态');

  selectedWorldbookName.value = 'BookA';
  draftEntries.value = [createSimpleEntry(1, 'A-Entry-Modified', 'new-content')];
  await api.saveCurrentWorldbook();
  assert(replaceCalls.length >= 1, 'saveCurrentWorldbook 未调用 replaceWorldbook');
  assert(isSaving.value === false, 'save 完成后 saving 应为 false');
  assert(snapshotAfterSaveCount >= 1, 'save 未推送保存后快照');

  globalMode.value = false;
  await api.hardRefresh({ source: 'auto' });
  assert(readPersistedCount > 0 && syncGlobalPresetCount > 0 && applyCrossCopyCount > 0, 'hardRefresh 预处理链路缺失');
  assert(refreshBindingsCount > 0 && refreshRoleCandidatesCount > 0 && refreshRoleContextCount > 0 && autoApplyPresetCount > 0, 'hardRefresh 绑定刷新链路缺失');
  assert(contextSelectionCount > 0, 'hardRefresh 非全局模式应尝试上下文选择');
  assert(selectedKeysRaw.value === 'keys-text-sync', 'hardRefresh keys raw 未同步');
  assert(selectedSecondaryKeysRaw.value === 'secondary-keys-text-sync', 'hardRefresh secondary keys raw 未同步');

  globalMode.value = true;
  await api.hardRefresh({ source: 'auto' });
  assert(ensureGlobalSelectionCount > 0, 'hardRefresh 全局模式应确保全局选择');
});

// ─────────────────────────────────────────────────────────────────────────────
// useWorldbookFileOps
// ─────────────────────────────────────────────────────────────────────────────

test('useWorldbookFileOps: 导出/导入/新建/复制/删除链路', async () => {
  const promptQueue: Array<string | null> = [];
  const confirmQueue: boolean[] = [];

  g.prompt = () => (promptQueue.length ? promptQueue.shift() ?? null : null);
  g.confirm = () => (confirmQueue.length ? Boolean(confirmQueue.shift()) : false);

  const anchors: Array<{ href: string; download: string; clicked: boolean }> = [];
  const appended: unknown[] = [];
  const removed: unknown[] = [];

  g.document = {
    createElement: (tag: string) => {
      if (tag !== 'a') {
        throw new Error(`unexpected tag: ${tag}`);
      }
      const anchor = {
        href: '',
        download: '',
        clicked: false,
        click() {
          this.clicked = true;
        },
      };
      anchors.push(anchor);
      return anchor;
    },
    body: {
      appendChild: (node: unknown) => {
        appended.push(node);
      },
      removeChild: (node: unknown) => {
        removed.push(node);
      },
    },
  };

  const revokedUrls: string[] = [];
  g.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    },
  };

  const selectedWorldbookName = ref('Src:Book?Name');
  const draftEntries = ref([createSimpleEntry(0, 'SrcEntry', 'content')]) as unknown as Ref<WorldbookEntry[]>;

  let fileInputClickCount = 0;
  const importFileInput = ref({
    click() {
      fileInputClickCount += 1;
    },
  } as unknown as HTMLInputElement | null);

  const createCalls: Array<{ name: string; entries: unknown[] }> = [];
  const reloadCalls: string[] = [];
  let refreshBindingsCount = 0;
  const importRawCalls: Array<{ fileName: string; fileText: string }> = [];
  let hardRefreshCount = 0;
  const deleteCalls: string[] = [];

  const persistedStateHolder = {
    history: { 'Src:Book?Name': [1] },
    entry_history: { 'Src:Book?Name': [2] },
  } as any;

  const api = useWorldbookFileOps({
    selectedWorldbookName,
    draftEntries,
    importFileInput,
    setStatus: message => {
      statusLog.push(message);
    },
    createOrReplaceWorldbook: async (name, entries) => {
      createCalls.push({ name, entries: deepClone(entries as unknown[]) });
    },
    reloadWorldbookNames: async preferred => {
      reloadCalls.push(preferred ?? '');
      if (preferred) {
        selectedWorldbookName.value = preferred;
      }
      return true;
    },
    refreshBindings: async () => {
      refreshBindingsCount += 1;
    },
    importRawWorldbook: async (fileName, fileText) => {
      importRawCalls.push({ fileName, fileText });
      return 'NativeImported';
    },
    hardRefresh: async () => {
      hardRefreshCount += 1;
    },
    deleteWorldbook: async name => {
      deleteCalls.push(name);
      return true;
    },
    updatePersistedState: mutator => {
      mutator(persistedStateHolder);
    },
  });

  api.exportCurrentWorldbook();
  assert(anchors.length === 1, 'export 未创建下载锚点');
  assert(anchors[0].download === 'Src_Book_Name.json', '导出文件名未清洗非法字符');
  assert(anchors[0].clicked === true, '导出未触发 click');
  assert(appended.length === 1 && removed.length === 1 && revokedUrls.includes('blob:mock-url'), '导出资源释放流程异常');

  api.triggerImport();
  assert(fileInputClickCount === 1, 'triggerImport 未触发 input.click');

  promptQueue.push('NewBook');
  await api.createNewWorldbook();
  assert(createCalls.some(call => call.name === 'NewBook' && call.entries.length === 0), 'createNewWorldbook 未创建空世界书');

  selectedWorldbookName.value = 'SrcBook';
  promptQueue.push('DupBook');
  await api.duplicateWorldbook();
  assert(createCalls.some(call => call.name === 'DupBook' && call.entries.length > 0), 'duplicateWorldbook 未复制条目');

  selectedWorldbookName.value = 'Src:Book?Name';
  confirmQueue.push(true);
  await api.deleteCurrentWorldbook();
  assert(deleteCalls.includes('Src:Book?Name'), 'deleteCurrentWorldbook 未调用 deleteWorldbook');
  assert(!('Src:Book?Name' in persistedStateHolder.history), '删除后未清理历史 history');
  assert(!('Src:Book?Name' in persistedStateHolder.entry_history), '删除后未清理 history entry_history');

  const importTargetSuccess: { files: Array<{ name: string; text: () => Promise<string> }>; value: string } = {
    files: [
      {
        name: 'import-success.json',
        text: async () => JSON.stringify([{ uid: 0, name: 'ImportedEntry', content: 'ok' }]),
      },
    ],
    value: 'selected-success',
  };
  promptQueue.push('ImportedBook');
  await api.onImportChange({ target: importTargetSuccess } as unknown as Event);
  assert(createCalls.some(call => call.name === 'ImportedBook'), '导入成功路径未创建新世界书');
  assert(importTargetSuccess.value === '', '导入成功路径后 input.value 未清空');

  const importTargetFallback: { files: Array<{ name: string; text: () => Promise<string> }>; value: string } = {
    files: [
      {
        name: 'import-fallback.json',
        text: async () => '{bad-json',
      },
    ],
    value: 'selected-fallback',
  };
  confirmQueue.push(true);
  await api.onImportChange({ target: importTargetFallback } as unknown as Event);
  assert(importRawCalls.some(call => call.fileName === 'import-fallback.json'), '导入 fallback 未调用原生导入');
  assert(hardRefreshCount > 0, '导入 fallback 未触发 hardRefresh');
  assert(statusLog.some(message => message.includes('原生导入成功')), '导入 fallback 未写状态提示');
  assert(importTargetFallback.value === '', '导入 fallback 后 input.value 未清空');

  assert(refreshBindingsCount >= 3, '文件操作链路 refreshBindings 次数异常');
  assert(reloadCalls.length >= 3, '文件操作链路 reloadWorldbookNames 次数异常');
});

async function run(): Promise<void> {
  installToastrMock();

  const passed: string[] = [];
  for (const item of tests) {
    await item.run();
    passed.push(item.name);
    console.log(`✅ ${item.name}`);
  }

  console.log('');
  console.log(`AUTONOMOUS_SMOKE_PASS: ${passed.length}/${tests.length}`);
  console.log(`STATUS_LOG_COUNT: ${statusLog.length}`);
  console.log(`TOAST_LOG_COUNT: ${toastLog.length}`);
}

async function main(): Promise<void> {
  try {
    await run();
  } finally {
    g.toastr = originalGlobals.toastr;
    g.prompt = originalGlobals.prompt;
    g.confirm = originalGlobals.confirm;
    g.document = originalGlobals.document;
    g.URL = originalGlobals.URL;
    g.getWorldbook = originalGlobals.getWorldbook;
    g.getWorldbookNames = originalGlobals.getWorldbookNames;
    g.replaceWorldbook = originalGlobals.replaceWorldbook;
  }
}

main().catch(error => {
  console.error('AUTONOMOUS_SMOKE_FAIL');
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
