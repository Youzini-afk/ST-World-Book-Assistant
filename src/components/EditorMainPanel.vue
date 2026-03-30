<template>
  <main v-show="!isMobile || showMobileEditor" class="wb-editor">
    <template v-if="selectedEntry">
      <div :ref="setEditorShellRef" class="wb-editor-shell" :style="editorShellStyle">
        <section class="editor-center" :class="{ focus: isDesktopFocusMode }">
          <header class="editor-head" :class="{ focus: isDesktopFocusMode }">
            <div v-if="isMobile" class="editor-back-btn" @click="emit('go-back-to-list')">
              ← 返回
            </div>
            <template v-if="!isDesktopFocusMode">
              <label class="field editor-comment">
                <span>备注 (COMMENT)</span>
                <input v-model="selectedEntry.name" type="text" class="text-input" />
              </label>
            </template>
            <template v-else>
              <div class="focus-meta-summary-row">
                <button
                  class="focus-meta-chip"
                  type="button"
                  :class="{ active: focusMetaPanel.comment }"
                  @click="emit('toggle-focus-meta-panel', 'comment')"
                >
                  <span>备注</span>
                  <strong>{{ focusCommentSummary }}</strong>
                </button>
                <button
                  class="focus-meta-chip"
                  type="button"
                  :class="{ active: focusMetaPanel.keywords }"
                  @click="emit('toggle-focus-meta-panel', 'keywords')"
                >
                  <span>关键词</span>
                  <strong>{{ focusKeywordSummary }}</strong>
                </button>
              </div>
            </template>
            <div class="editor-badges">
              <span class="editor-badge" :class="selectedEntry.enabled ? 'on' : 'off'">
                {{ selectedEntry.enabled ? 'EN' : 'OFF' }}
              </span>
              <span class="editor-badge strategy" :data-status="getEntryVisualStatus(selectedEntry)">
                {{ getEntryStatusLabel(selectedEntry) }}
              </span>
              <span class="editor-badge mono">#{{ selectedEntry.uid }}</span>
              <span class="editor-badge mono">Chars {{ selectedContentChars }}</span>
              <span class="editor-badge mono">~{{ selectedTokenEstimate }}T</span>
            </div>
          </header>

          <Transition name="focus-meta-panel">
            <section v-if="isDesktopFocusMode && focusMetaPanel.comment" class="focus-meta-panel">
              <label class="field editor-comment">
                <span>备注 (COMMENT)</span>
                <input v-model="selectedEntry.name" type="text" class="text-input" />
              </label>
            </section>
          </Transition>

          <section v-if="!isDesktopFocusMode || focusMetaPanel.keywords" class="editor-grid two-cols editor-keyword-grid">
            <label class="field">
              <span>主要关键词 (KEYS)</span>
              <textarea
                :value="selectedKeysRaw"
                class="text-area compact"
                @input="onSelectedKeysRawInput"
                @blur="emit('commit-keys-from-raw')"
              ></textarea>
            </label>
            <label class="field">
              <span>次要关键词 (SECONDARY)</span>
              <textarea
                :value="selectedSecondaryKeysRaw"
                class="text-area compact"
                @input="onSelectedSecondaryKeysRawInput"
                @blur="emit('commit-secondary-keys-from-raw')"
              ></textarea>
            </label>
          </section>

          <section class="editor-content-block">
            <div class="editor-content-title">世界观设定 / 内容 (CONTENT)</div>
            <textarea
              :ref="setContentTextareaRef"
              v-model="selectedEntry.content"
              class="text-area large editor-content-area"
            ></textarea>
            <div class="content-resize-handle" @pointerdown="onStartContentResize">
              <span class="content-resize-grip">⋯</span>
            </div>
          </section>

          <details class="editor-advanced">
            <summary>高级字段 / extra JSON</summary>
            <label class="field">
              <span>extra JSON（未知字段）</span>
              <textarea v-model="selectedExtraTextModel" class="text-area compact" placeholder="{ ... }"></textarea>
            </label>
            <div class="field-actions">
              <button class="btn" type="button" @click="emit('apply-extra-json')">应用 extra</button>
              <button class="btn" type="button" @click="emit('clear-extra')">清空 extra</button>
            </div>
          </details>
        </section>

        <div
          v-show="!isMobile"
          class="wb-resize-handle editor"
          :class="{ dragging: paneResizeState?.key === 'editor' }"
          @pointerdown="onStartEditorPaneResize"
        ></div>

        <aside class="editor-side" :class="{ focus: isDesktopFocusMode }">
          <article class="editor-card focus-side-card" :class="{ open: focusSidePanelState.strategy }">
            <template v-if="isDesktopFocusMode">
              <button type="button" class="focus-side-summary" @click="emit('toggle-focus-side-panel', 'strategy')">
                <span class="focus-side-summary-title">触发策略</span>
                <span class="focus-side-summary-value">{{ focusStrategySummary }}</span>
                <span class="focus-side-summary-arrow">{{ focusSidePanelState.strategy ? '▾' : '▸' }}</span>
              </button>
            </template>
            <h4 v-else>触发策略 (STRATEGY)</h4>
            <div class="focus-side-content" :class="{ hidden: isDesktopFocusMode && !focusSidePanelState.strategy }">
              <label class="field checkbox-inline">
                <input v-model="selectedEntry.enabled" type="checkbox" />
                <span>启用条目</span>
              </label>
              <div class="strategy-switch">
                <button
                  type="button"
                  class="strategy-pill constant"
                  :class="{ active: selectedEntry.strategy.type === 'constant' }"
                  @click="selectedEntry.strategy.type = 'constant'"
                >
                  🔵 常驻 (Constant)
                </button>
                <button
                  type="button"
                  class="strategy-pill vector"
                  :class="{ active: selectedEntry.strategy.type === 'vectorized' }"
                  @click="selectedEntry.strategy.type = 'vectorized'"
                >
                  📎 向量化 (Vector)
                </button>
                <button
                  type="button"
                  class="strategy-pill selective"
                  :class="{ active: selectedEntry.strategy.type === 'selective' }"
                  @click="selectedEntry.strategy.type = 'selective'"
                >
                  🟢 关键词 (Selective)
                </button>
              </div>
              <details class="editor-advanced">
                <summary>高级设置</summary>
                <label class="field">
                  <span>次要逻辑 (LOGIC)</span>
                  <select v-model="selectedEntry.strategy.keys_secondary.logic" class="text-input">
                    <option v-for="item in secondaryLogicOptions" :key="item" :value="item">
                      {{ getSecondaryLogicLabel(item) }}
                    </option>
                  </select>
                </label>
                <label class="field">
                  <span>扫描深度</span>
                  <input
                    v-model="selectedScanDepthTextModel"
                    type="text"
                    class="text-input"
                    placeholder="留空或 same_as_global"
                  />
                </label>
                <label class="field">
                  <span>概率(0-100)</span>
                  <input
                    v-model.number="selectedEntry.probability"
                    type="number"
                    class="text-input"
                    min="0"
                    max="100"
                    step="1"
                  />
                </label>
              </details>
            </div>
          </article>

          <article class="editor-card focus-side-card" :class="{ open: focusSidePanelState.insertion }">
            <template v-if="isDesktopFocusMode">
              <button type="button" class="focus-side-summary" @click="emit('toggle-focus-side-panel', 'insertion')">
                <span class="focus-side-summary-title">插入设置</span>
                <span class="focus-side-summary-value">{{ focusInsertionSummary }}</span>
                <span class="focus-side-summary-arrow">{{ focusSidePanelState.insertion ? '▾' : '▸' }}</span>
              </button>
            </template>
            <h4 v-else>插入设置 (INSERTION)</h4>
            <div class="focus-side-content" :class="{ hidden: isDesktopFocusMode && !focusSidePanelState.insertion }">
              <label class="field">
                <span>位置 (Position)</span>
                <select v-model="selectedPositionSelectValueModel" class="text-input">
                  <option v-for="item in positionSelectOptions" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </option>
                </select>
              </label>
              <label class="field">
                <span>权重 (Order)</span>
                <input v-model.number="selectedEntry.position.order" type="number" class="text-input" step="1" />
              </label>
              <div class="editor-collapsible-group">
                <details class="editor-mini-collapse" :class="{ disabled: selectedEntry.position.type !== 'at_depth' }">
                  <summary>
                    <span>深度角色</span>
                    <span class="editor-mini-collapse-value">
                      {{ selectedEntry.position.type === 'at_depth' ? selectedEntry.position.role : '仅深度插入可用' }}
                    </span>
                  </summary>
                  <div class="editor-mini-collapse-body">
                    <select
                      v-model="selectedEntry.position.role"
                      class="text-input"
                      :disabled="selectedEntry.position.type !== 'at_depth'"
                    >
                      <option value="system">system</option>
                      <option value="assistant">assistant</option>
                      <option value="user">user</option>
                    </select>
                  </div>
                </details>
                <details class="editor-mini-collapse" :class="{ disabled: selectedEntry.position.type !== 'at_depth' }">
                  <summary>
                    <span>深度层级</span>
                    <span class="editor-mini-collapse-value">
                      {{ selectedEntry.position.type === 'at_depth' ? selectedEntry.position.depth : '仅深度插入可用' }}
                    </span>
                  </summary>
                  <div class="editor-mini-collapse-body">
                    <input
                      v-model.number="selectedEntry.position.depth"
                      type="number"
                      class="text-input"
                      min="0"
                      step="1"
                      :disabled="selectedEntry.position.type !== 'at_depth'"
                    />
                  </div>
                </details>
              </div>
            </div>
          </article>

          <article class="editor-card focus-side-card" :class="{ open: focusSidePanelState.recursion }">
            <template v-if="isDesktopFocusMode">
              <button type="button" class="focus-side-summary" @click="emit('toggle-focus-side-panel', 'recursion')">
                <span class="focus-side-summary-title">递归与效果</span>
                <span class="focus-side-summary-value">{{ focusRecursionSummary }}</span>
                <span class="focus-side-summary-arrow">{{ focusSidePanelState.recursion ? '▾' : '▸' }}</span>
              </button>
            </template>
            <h4 v-else>递归与效果 (RECURSION)</h4>
            <div class="focus-side-content" :class="{ hidden: isDesktopFocusMode && !focusSidePanelState.recursion }">
              <label class="field checkbox-inline">
                <input v-model="selectedEntry.recursion.prevent_incoming" type="checkbox" />
                <span>不可递归命中 (Exclude Incoming)</span>
              </label>
              <label class="field checkbox-inline">
                <input v-model="selectedEntry.recursion.prevent_outgoing" type="checkbox" />
                <span>阻止后续递归 (Prevent Outgoing)</span>
              </label>
              <div class="editor-collapsible-group">
                <details class="editor-mini-collapse">
                  <summary>
                    <span>递归延迟层级</span>
                    <span class="editor-mini-collapse-value">{{ selectedRecursionDelayTextModel || 'null' }}</span>
                  </summary>
                  <div class="editor-mini-collapse-body">
                    <input
                      v-model="selectedRecursionDelayTextModel"
                      type="text"
                      class="text-input"
                      placeholder="留空表示 null"
                    />
                  </div>
                </details>
                <details class="editor-mini-collapse">
                  <summary>
                    <span>sticky</span>
                    <span class="editor-mini-collapse-value">{{ selectedStickyTextModel || 'null' }}</span>
                  </summary>
                  <div class="editor-mini-collapse-body">
                    <input
                      v-model="selectedStickyTextModel"
                      type="text"
                      class="text-input"
                      placeholder="留空表示 null"
                    />
                  </div>
                </details>
                <details class="editor-mini-collapse">
                  <summary>
                    <span>cooldown</span>
                    <span class="editor-mini-collapse-value">{{ selectedCooldownTextModel || 'null' }}</span>
                  </summary>
                  <div class="editor-mini-collapse-body">
                    <input
                      v-model="selectedCooldownTextModel"
                      type="text"
                      class="text-input"
                      placeholder="留空表示 null"
                    />
                  </div>
                </details>
                <details class="editor-mini-collapse">
                  <summary>
                    <span>delay</span>
                    <span class="editor-mini-collapse-value">{{ selectedEffectDelayTextModel || 'null' }}</span>
                  </summary>
                  <div class="editor-mini-collapse-body">
                    <input
                      v-model="selectedEffectDelayTextModel"
                      type="text"
                      class="text-input"
                      placeholder="留空表示 null"
                    />
                  </div>
                </details>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </template>

    <template v-else>
      <div class="empty-block">请选择或新增一个条目后开始编辑。</div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue';

type FocusMetaPanelKey = 'comment' | 'keywords';
type FocusSidePanelKey = 'strategy' | 'insertion' | 'recursion';

interface EditorMainPanelProps {
  isMobile: boolean;
  showMobileEditor: boolean;
  selectedEntry: any | null;
  editorShellStyle: any;
  isDesktopFocusMode: boolean;
  focusMetaPanel: Record<FocusMetaPanelKey, boolean>;
  focusCommentSummary: string;
  focusKeywordSummary: string;
  selectedContentChars: number;
  selectedTokenEstimate: number;
  getEntryVisualStatus: (entry: any) => string;
  getEntryStatusLabel: (entry: any) => string;
  selectedKeysRaw: string;
  selectedSecondaryKeysRaw: string;
  selectedExtraText: string;
  paneResizeState: { key?: string } | null;
  focusSidePanelState: Record<FocusSidePanelKey, boolean>;
  focusStrategySummary: string;
  focusInsertionSummary: string;
  focusRecursionSummary: string;
  secondaryLogicOptions: string[];
  getSecondaryLogicLabel: (value: any) => string;
  selectedScanDepthText: string;
  positionSelectOptions: Array<{ value: string; label: string }>;
  selectedPositionSelectValue: string;
  selectedRecursionDelayText: string;
  selectedStickyText: string;
  selectedCooldownText: string;
  selectedEffectDelayText: string;
  setEditorShellElement: (element: HTMLElement | null) => void;
  setContentTextareaElement: (element: HTMLTextAreaElement | null) => void;
}

const props = defineProps<EditorMainPanelProps>();

const emit = defineEmits<{
  (eventName: 'go-back-to-list'): void;
  (eventName: 'toggle-focus-meta-panel', key: FocusMetaPanelKey): void;
  (eventName: 'update:selected-keys-raw', value: string): void;
  (eventName: 'commit-keys-from-raw'): void;
  (eventName: 'update:selected-secondary-keys-raw', value: string): void;
  (eventName: 'commit-secondary-keys-from-raw'): void;
  (eventName: 'start-content-resize', pointerEvent: PointerEvent): void;
  (eventName: 'apply-extra-json'): void;
  (eventName: 'clear-extra'): void;
  (eventName: 'update:selected-extra-text', value: string): void;
  (eventName: 'start-editor-pane-resize', pointerEvent: PointerEvent): void;
  (eventName: 'toggle-focus-side-panel', key: FocusSidePanelKey): void;
  (eventName: 'update:selected-scan-depth-text', value: string): void;
  (eventName: 'update:selected-position-select-value', value: string): void;
  (eventName: 'update:selected-recursion-delay-text', value: string): void;
  (eventName: 'update:selected-sticky-text', value: string): void;
  (eventName: 'update:selected-cooldown-text', value: string): void;
  (eventName: 'update:selected-effect-delay-text', value: string): void;
}>();

const selectedExtraTextModel = computed({
  get: () => props.selectedExtraText,
  set: (value: string) => emit('update:selected-extra-text', value),
});

const selectedScanDepthTextModel = computed({
  get: () => props.selectedScanDepthText,
  set: (value: string) => emit('update:selected-scan-depth-text', value),
});

const selectedPositionSelectValueModel = computed({
  get: () => props.selectedPositionSelectValue,
  set: (value: string) => emit('update:selected-position-select-value', value),
});

const selectedRecursionDelayTextModel = computed({
  get: () => props.selectedRecursionDelayText,
  set: (value: string) => emit('update:selected-recursion-delay-text', value),
});

const selectedStickyTextModel = computed({
  get: () => props.selectedStickyText,
  set: (value: string) => emit('update:selected-sticky-text', value),
});

const selectedCooldownTextModel = computed({
  get: () => props.selectedCooldownText,
  set: (value: string) => emit('update:selected-cooldown-text', value),
});

const selectedEffectDelayTextModel = computed({
  get: () => props.selectedEffectDelayText,
  set: (value: string) => emit('update:selected-effect-delay-text', value),
});

function setEditorShellRef(element: Element | ComponentPublicInstance | null): void {
  props.setEditorShellElement(element instanceof HTMLElement ? element : null);
}

function setContentTextareaRef(element: Element | ComponentPublicInstance | null): void {
  props.setContentTextareaElement(element instanceof HTMLTextAreaElement ? element : null);
}

function onSelectedKeysRawInput(event: Event): void {
  emit('update:selected-keys-raw', (event.target as HTMLTextAreaElement).value);
}

function onSelectedSecondaryKeysRawInput(event: Event): void {
  emit('update:selected-secondary-keys-raw', (event.target as HTMLTextAreaElement).value);
}

function onStartContentResize(event: Event): void {
  emit('start-content-resize', event as PointerEvent);
}

function onStartEditorPaneResize(event: Event): void {
  emit('start-editor-pane-resize', event as PointerEvent);
}
</script>
