<template>
  <div class="ai-tag-review-overlay" @click.self="emit('close')">
    <div class="ai-tag-review-modal" style="max-width:520px;">
      <div class="ai-tag-review-head">
        <span class="ai-tag-review-title">⚙️ 设置中心</span>
        <button class="ai-tag-review-close" type="button" @click="emit('close')">×</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;max-height:60vh;">
        <div style="border:1px solid var(--wb-border-subtle,#334155);border-radius:8px;padding:10px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">体验设置</div>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">
            <input type="checkbox" :checked="fabVisible" @change="emit('setFabVisible', ($event.target as HTMLInputElement).checked)" />
            <span>显示悬浮按钮（📖）</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">
            <input type="checkbox" :checked="floorBtnVisible" @change="emit('toggleFloorBtns', ($event.target as HTMLInputElement).checked)" />
            <span>显示楼层提取按钮</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" :checked="persistedState.show_ai_chat" @change="emit('updateField', 'show_ai_chat', ($event.target as HTMLInputElement).checked)" />
            <span>显示 AI 对话模块</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;">
            <input
              type="checkbox"
              :checked="persistedState.multi_edit.enabled"
              @change="emit('updateField', 'multi_edit.enabled', ($event.target as HTMLInputElement).checked)"
            />
            <span>启用多选配置联动</span>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input
              type="checkbox"
              :checked="persistedState.multi_edit.sync_extra_json"
              @change="emit('updateField', 'multi_edit.sync_extra_json', ($event.target as HTMLInputElement).checked)"
              :disabled="!persistedState.multi_edit.enabled"
            />
            <span>多选联动时同步高级字段 / extra JSON</span>
          </label>
          <label class="field" style="margin-top:8px;">
            <span>父标签删除策略</span>
            <select class="text-input" :value="persistedState.tag_editor.delete_parent_mode" @change="emit('setTagDeleteParentMode', ($event.target as HTMLSelectElement).value)">
              <option value="promote">删除父标签并上提子标签</option>
              <option value="cascade">级联删除整棵标签树</option>
            </select>
          </label>
          <div style="font-size:11px;color:var(--wb-text-muted,#64748b);margin-top:4px;">开启后将在工具栏和移动端 Tab 中显示 AI 对话入口</div>
          <label class="field" style="margin-top:8px;">
            <span>排序模式</span>
            <select class="text-input" :value="persistedState.sort.mode" @change="emit('updateField', 'sort.mode', ($event.target as HTMLSelectElement).value)">
              <option value="mutate">直接排序（修改条目顺序）</option>
              <option value="view">仅显示排序（不修改数据）</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;">
            <input
              type="checkbox"
              :checked="persistedState.sort.reassign_uid"
              @change="emit('updateField', 'sort.reassign_uid', ($event.target as HTMLInputElement).checked)"
            />
            <span>排序后重新分配 UID（仅直接排序模式）</span>
          </label>
          <label class="field" style="margin-top:8px;">
            <span>主题</span>
            <select class="text-input" :value="currentTheme" @change="emit('setTheme', ($event.target as HTMLSelectElement).value)">
              <option v-for="item in themeOptions" :key="`setting-theme-${item.key}`" :value="item.key">{{ item.label }}</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;">
            <input type="checkbox" :checked="persistedState.glass_mode" @change="emit('updateField', 'glass_mode', ($event.target as HTMLInputElement).checked)" />
            <span>启用毛玻璃特效 (Glassmorphism)</span>
          </label>
        </div>
        <div style="border-top:1px solid var(--wb-border-subtle,#334155);padding-top:10px;">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;">API 设置</div>
        </div>
        <div style="display:flex;gap:12px;align-items:center;">
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="radio" value="custom" :checked="persistedState.ai_api_config.mode === 'custom'" @change="emit('updateApiConfig', { mode: 'custom', use_main_api: false })" />
            <span>自定义API</span>
          </label>
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
            <input type="radio" value="tavern" :checked="persistedState.ai_api_config.mode === 'tavern'" @change="emit('updateApiConfig', { mode: 'tavern' })" />
            <span>使用酒馆连接预设</span>
          </label>
        </div>
        <template v-if="persistedState.ai_api_config.mode === 'custom'">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
            <input type="checkbox" :checked="persistedState.ai_api_config.use_main_api" @change="emit('updateApiConfig', { use_main_api: ($event.target as HTMLInputElement).checked })" />
            <span>使用主API（直接使用酒馆当前API和模型）</span>
          </label>
          <template v-if="!persistedState.ai_api_config.use_main_api">
            <div style="font-size:11px;color:#f59e0b;">⚠️ API密钥将保存在脚本本地存储中。</div>
            <label class="field">
              <span>API基础URL</span>
              <input class="text-input" type="text" :value="persistedState.ai_api_config.apiurl" @change="emit('updateApiConfig', { apiurl: ($event.target as HTMLInputElement).value })" placeholder="https://api.openai.com/v1" />
            </label>
            <label class="field">
              <span>API密钥（可选）</span>
              <input class="text-input" type="password" :value="persistedState.ai_api_config.key" @change="emit('updateApiConfig', { key: ($event.target as HTMLInputElement).value })" placeholder="sk-..." />
            </label>
            <div style="display:flex;gap:10px;">
              <label class="field" style="flex:1;">
                <span>最大Tokens</span>
                <input class="text-input" type="number" :value="persistedState.ai_api_config.max_tokens" @change="emit('updateApiConfig', { max_tokens: Number(($event.target as HTMLInputElement).value) || 4096 })" />
              </label>
              <label class="field" style="flex:1;">
                <span>温度</span>
                <input class="text-input" type="number" step="0.1" min="0" max="2" :value="persistedState.ai_api_config.temperature" @change="emit('updateApiConfig', { temperature: Number(($event.target as HTMLInputElement).value) || 1 })" />
              </label>
            </div>
            <button class="btn" type="button" :disabled="apiModelLoading || !persistedState.ai_api_config.apiurl" @click="emit('loadModelList')" style="width:100%;">
              {{ apiModelLoading ? '加载中...' : '加载模型列表' }}
            </button>
            <label class="field" v-if="apiModelList.length > 0">
              <span>选择模型</span>
              <select class="text-input" :value="persistedState.ai_api_config.model" @change="emit('updateApiConfig', { model: ($event.target as HTMLSelectElement).value })">
                <option value="">请选择模型</option>
                <option v-for="m in apiModelList" :key="m" :value="m">{{ m }}</option>
              </select>
            </label>
            <label class="field" v-else>
              <span>模型名称（手动输入）</span>
              <input class="text-input" type="text" :value="persistedState.ai_api_config.model" @change="emit('updateApiConfig', { model: ($event.target as HTMLInputElement).value })" placeholder="gpt-4o" />
            </label>
          </template>
        </template>
        <div v-if="persistedState.ai_api_config.mode === 'tavern'" style="font-size:12px;color:var(--wb-text-muted);padding:8px 0;">
          将直接使用酒馆当前启用的预设和API配置进行生成。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PersistedState } from '../types';

interface SettingsModalProps {
  persistedState: PersistedState;
  fabVisible: boolean;
  floorBtnVisible: boolean;
  currentTheme: string;
  themeOptions: Array<{ key: string; label: string }>;
  apiModelList: string[];
  apiModelLoading: boolean;
}

defineProps<SettingsModalProps>();

const emit = defineEmits<{
  (event: 'close'): void;
  (event: 'setFabVisible', value: boolean): void;
  (event: 'toggleFloorBtns', value: boolean): void;
  (event: 'updateField', path: string, value: unknown): void;
  (event: 'setTagDeleteParentMode', mode: string): void;
  (event: 'setTheme', key: string): void;
  (event: 'updateApiConfig', patch: Record<string, unknown>): void;
  (event: 'loadModelList'): void;
}>();
</script>
