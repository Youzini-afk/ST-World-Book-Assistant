<template>
  <!-- AI 配置输入弹窗 -->
  <div
    v-if="targetWorldbookModel && !previewModel && !generating"
    class="ai-tag-review-overlay"
    @click.self="targetWorldbookModel = ''"
  >
    <div class="ai-tag-review-modal" style="max-width:600px;">
      <div class="ai-tag-review-head">
        <span class="ai-tag-review-title">🔧 AI 配置世界书</span>
        <button class="ai-tag-review-close" type="button" @click="targetWorldbookModel = ''">×</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;max-height:60vh;">
        <label class="field">
          <span>目标世界书</span>
          <select v-model="targetWorldbookModel" class="text-input">
            <option value="">请选择</option>
            <option v-for="name in worldbookNames" :key="`cfg-wb-${name}`" :value="name">{{ name }}</option>
          </select>
        </label>
        <label class="field">
          <span>配置指令（自然语言描述）</span>
          <textarea
            v-model="inputTextModel"
            class="text-input"
            rows="8"
            placeholder="例如：
将以下条目设为蓝灯常驻，位置设为角色定义前：
- 世界观设定（顺序1）
- 角色速览（顺序2）

所有条目启用不可递归和防止进一步递归"
          ></textarea>
        </label>
        <details style="margin-top:4px;">
          <summary style="cursor:pointer;color:var(--wb-text-dim);font-size:12px;user-select:none;">📝 查看/修改系统提示词</summary>
          <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
            <textarea
              v-model="customPromptModel"
              class="text-input"
              rows="10"
              :placeholder="'留空则使用默认提示词。\n当前默认提示词会在选择世界书后自动填入条目名。'"
              style="font-size:12px;font-family:monospace;"
            ></textarea>
            <div style="display:flex;gap:6px;">
              <button class="btn" type="button" style="font-size:12px;" @click="customPromptModel = ''">🔄 恢复默认</button>
              <button class="btn" type="button" style="font-size:12px;" @click="emit('loadDefaultPrompt')">📋 加载默认提示词</button>
            </div>
          </div>
        </details>
        <button
          class="btn primary"
          type="button"
          :disabled="!inputTextModel.trim() || !targetWorldbookModel || generating"
          @click="emit('generate')"
          style="width:100%;margin-top:8px;"
        >
          {{ generating ? '⏳ AI 分析中...' : '🤖 发送给 AI 分析' }}
        </button>
      </div>
    </div>
  </div>

  <!-- AI 配置生成中遮罩 -->
  <div v-if="generating" class="ai-tag-review-overlay">
    <div class="ai-tag-review-modal" style="max-width:400px;text-align:center;padding:40px;">
      <div style="font-size:24px;margin-bottom:12px;">⏳</div>
      <div style="color:var(--wb-text-main);">AI 正在分析配置指令...</div>
    </div>
  </div>

  <!-- AI 配置预览弹窗 -->
  <div v-if="previewModel" class="ai-tag-review-overlay" @click.self="previewModel = false">
    <div class="ai-tag-review-modal" style="max-width:700px;">
      <div class="ai-tag-review-head">
        <span class="ai-tag-review-title">📋 配置变更预览</span>
        <button class="ai-tag-review-close" type="button" @click="previewModel = false">×</button>
      </div>
      <div style="padding:16px;overflow-y:auto;max-height:55vh;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid var(--wb-border);">
              <th style="width:30px;padding:6px;"></th>
              <th style="text-align:left;padding:6px;">条目</th>
              <th style="text-align:left;padding:6px;">设置项</th>
              <th style="text-align:left;padding:6px;">旧值</th>
              <th style="text-align:center;padding:6px;">→</th>
              <th style="text-align:left;padding:6px;">新值</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, i) in changes"
              :key="i"
              style="border-bottom:1px solid var(--wb-border);"
              :style="{ opacity: c.selected ? 1 : 0.4 }"
            >
              <td style="padding:6px;"><input v-model="c.selected" type="checkbox" /></td>
              <td style="padding:6px;font-weight:600;">{{ c.name }}</td>
              <td style="padding:6px;">{{ c.label }}</td>
              <td style="padding:6px;color:#ef4444;">{{ c.oldValue }}</td>
              <td style="padding:6px;text-align:center;">→</td>
              <td style="padding:6px;color:#22c55e;">{{ c.newValue }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="ai-tag-review-actions">
        <button class="btn" type="button" @click="setAllSelected(true)">全选</button>
        <button class="btn" type="button" @click="setAllSelected(false)">全不选</button>
        <button class="btn primary" type="button" :disabled="!hasSelectedChanges" @click="emit('apply')">
          应用选中变更（{{ selectedChangeCount }}）
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ConfigChange } from '../composables/useAIConfig';

interface AIConfigModalsProps {
  worldbookNames: string[];
  targetWorldbook: string;
  preview: boolean;
  generating: boolean;
  inputText: string;
  customPrompt: string;
  changes: ConfigChange[];
}

const props = defineProps<AIConfigModalsProps>();

const emit = defineEmits<{
  (event: 'update:targetWorldbook', value: string): void;
  (event: 'update:preview', value: boolean): void;
  (event: 'update:inputText', value: string): void;
  (event: 'update:customPrompt', value: string): void;
  (event: 'loadDefaultPrompt'): void;
  (event: 'generate'): void;
  (event: 'apply'): void;
}>();

const targetWorldbookModel = computed({
  get: () => props.targetWorldbook,
  set: value => emit('update:targetWorldbook', value),
});

const previewModel = computed({
  get: () => props.preview,
  set: value => emit('update:preview', value),
});

const inputTextModel = computed({
  get: () => props.inputText,
  set: value => emit('update:inputText', value),
});

const customPromptModel = computed({
  get: () => props.customPrompt,
  set: value => emit('update:customPrompt', value),
});

const hasSelectedChanges = computed(() => props.changes.some(change => change.selected));
const selectedChangeCount = computed(() => props.changes.filter(change => change.selected).length);

function setAllSelected(selected: boolean): void {
  for (const change of props.changes) {
    change.selected = selected;
  }
}
</script>
