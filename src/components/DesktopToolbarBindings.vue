<template>
  <div v-if="!isDesktopFocusMode && crossCopyMode" class="wb-copy-workspace-head">
    <div class="wb-copy-workspace-title">
      <strong>📚 跨书复制工作台</strong>
      <span>{{ crossCopyWorkspaceSummary }}</span>
    </div>
    <div class="wb-copy-workspace-actions">
      <span class="wb-copy-workspace-meta">{{ crossCopyWorkspaceComparedText }}</span>
      <div class="wb-copy-workspace-tool-anchor">
        <button class="btn mini utility-btn" type="button" :disabled="isAnyCineLocked" @click="emit('toggleCrossCopyWorkspaceTools')">
          {{ crossCopyWorkspaceToolsExpanded ? '收起工具' : '展开工具' }}
        </button>
        <div class="copy-cine-sink-cluster workspace" aria-hidden="true">
          <span class="copy-cine-sink" data-copy-sink="focus_toggle"></span>
          <span class="copy-cine-sink" data-copy-sink="save_btn"></span>
          <span class="copy-cine-sink" data-copy-sink="more_btn"></span>
          <span class="copy-cine-sink" data-copy-sink="tools_btn"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_global"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_entry_history"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_worldbook_history"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_activation"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_ai_generate"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_extract"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_tag"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_copy"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_settings"></span>
          <span class="copy-cine-sink" data-copy-sink="tool_ai_config"></span>
        </div>
      </div>
      <button class="btn mini utility-btn" type="button" :disabled="isAnyCineLocked" @click="emit('toggleCrossCopyMode')">退出模式</button>
    </div>
  </div>

  <Transition name="copy-workspace-tools">
    <div v-if="showHistoryShortcuts" class="wb-history-shortcuts" :class="{ 'copy-workspace-tools': crossCopyMode }">
      <button class="btn history-btn utility-btn" data-focus-hero="focus_toggle" data-copy-hero="focus_toggle" type="button" :disabled="isAnyCineLocked" @click="emit('toggleFocusEditing')">🎯 专注编辑</button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_global"
        data-copy-hero="tool_global"
        type="button"
        :class="{ active: globalWorldbookMode }"
        @click="emit('toggleGlobalMode')"
      >
        🌐 全局模式
      </button>
      <button class="btn history-btn" data-focus-hero="tool_entry_history" data-copy-hero="tool_entry_history" type="button" :disabled="!hasSelectedEntry" @click="emit('openEntryHistoryModal')">
        🕰️ 条目时光机
      </button>
      <button
        class="btn history-btn"
        data-focus-hero="tool_worldbook_history"
        data-copy-hero="tool_worldbook_history"
        type="button"
        :disabled="!hasSelectedWorldbook"
        @click="emit('openWorldbookHistoryModal')"
      >
        ⏪ 整本时光机
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="find_btn"
        data-copy-hero="find_btn"
        type="button"
        :class="{ active: findPanelVisible }"
        :disabled="!hasDraftEntries || isAnyCineLocked"
        @click="emit('toggleFindPanel')"
      >
        🔎 查找与替换
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_activation"
        data-copy-hero="tool_activation"
        type="button"
        :class="{ active: activationPanelVisible }"
        @click="emit('toggleActivationPanel')"
      >
        📡 激活监控
      </button>
      <button
        v-if="showAiChat"
        class="btn history-btn utility-btn"
        data-focus-hero="tool_ai_generate"
        data-copy-hero="tool_ai_generate"
        type="button"
        :class="{ active: aiGeneratorMode }"
        @click="emit('toggleAiGenerator')"
      >
        🤖 AI 生成
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_extract"
        data-copy-hero="tool_extract"
        type="button"
        @click="emit('extractFromChat')"
      >
        📥 从聊天提取
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_tag"
        data-copy-hero="tool_tag"
        type="button"
        :class="{ active: tagEditorMode }"
        @click="emit('toggleTagEditor')"
      >
        🏷️ 标签管理
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_copy"
        data-copy-hero="tool_copy"
        type="button"
        :class="{ active: crossCopyMode }"
        :disabled="isAnyCineLocked"
        @click="emit('toggleCrossCopyMode')"
      >
        📚 跨书复制
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_settings"
        data-copy-hero="tool_settings"
        type="button"
        @click="emit('openSettings')"
      >
        ⚙️ 设置
      </button>
      <button
        class="btn history-btn utility-btn"
        data-focus-hero="tool_ai_config"
        data-copy-hero="tool_ai_config"
        type="button"
        @click="emit('openAiConfig')"
      >
        🔧 AI配置
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface DesktopToolbarBindingsProps {
  isDesktopFocusMode: boolean;
  crossCopyMode: boolean;
  crossCopyWorkspaceSummary: string;
  crossCopyWorkspaceComparedText: string;
  isAnyCineLocked: boolean;
  crossCopyWorkspaceToolsExpanded: boolean;
  globalWorldbookMode: boolean;
  hasSelectedEntry: boolean;
  hasSelectedWorldbook: boolean;
  hasDraftEntries: boolean;
  findPanelVisible: boolean;
  activationPanelVisible: boolean;
  showAiChat: boolean;
  aiGeneratorMode: boolean;
  tagEditorMode: boolean;
}

const props = defineProps<DesktopToolbarBindingsProps>();

const emit = defineEmits<{
  (event: 'toggleCrossCopyWorkspaceTools'): void;
  (event: 'toggleCrossCopyMode'): void;
  (event: 'toggleFocusEditing'): void;
  (event: 'toggleGlobalMode'): void;
  (event: 'openEntryHistoryModal'): void;
  (event: 'openWorldbookHistoryModal'): void;
  (event: 'toggleFindPanel'): void;
  (event: 'toggleActivationPanel'): void;
  (event: 'toggleAiGenerator'): void;
  (event: 'extractFromChat'): void;
  (event: 'toggleTagEditor'): void;
  (event: 'openSettings'): void;
  (event: 'openAiConfig'): void;
}>();

const showHistoryShortcuts = computed(() => {
  return !props.isDesktopFocusMode
    && (!props.crossCopyMode || props.crossCopyWorkspaceToolsExpanded);
});
</script>

<style scoped>
.wb-copy-workspace-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.wb-copy-workspace-title {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.wb-copy-workspace-title strong {
  font-size: 14px;
  line-height: 1.2;
}

.wb-copy-workspace-title span {
  font-size: 12px;
  color: var(--wb-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wb-copy-workspace-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.wb-copy-workspace-tool-anchor {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.wb-copy-workspace-meta {
  font-size: 12px;
  color: var(--wb-text-muted);
}

.wb-history-shortcuts {
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.wb-history-shortcuts.copy-workspace-tools {
  padding-top: 2px;
}

.copy-workspace-tools-enter-active,
.copy-workspace-tools-leave-active {
  transition: opacity 180ms ease, transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

.copy-workspace-tools-enter-from,
.copy-workspace-tools-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
