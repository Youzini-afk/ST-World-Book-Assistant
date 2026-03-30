<template>
  <section class="ai-generator-panel">
    <div class="ai-sidebar">
      <div class="ai-sidebar-head">
        <span class="ai-sidebar-title">对话列表</span>
        <button class="btn mini" type="button" @click="emit('createSession')">+ 新建</button>
      </div>
      <div class="ai-session-list">
        <div
          v-for="session in sessions"
          :key="session.id"
          class="ai-session-item"
          :class="{ active: session.id === activeSession?.id }"
          role="button"
          tabindex="0"
          @click="emit('switchSession', session.id)"
          @keydown.enter.prevent="emit('switchSession', session.id)"
          @keydown.space.prevent="emit('switchSession', session.id)"
        >
          <span class="ai-session-title">{{ session.title }}</span>
          <span class="ai-session-meta">{{ session.messages.length }} 条消息</span>
          <button
            class="ai-session-delete"
            type="button"
            title="删除对话"
            @click.stop="emit('deleteSession', session.id)"
          >×</button>
        </div>
        <div v-if="!sessions.length" class="empty-note">暂无对话，点击上方新建</div>
      </div>
    </div>
    <div class="ai-chat-area">
      <div v-if="!activeSession" class="ai-chat-empty">
        <div class="ai-chat-empty-icon">🤖</div>
        <div class="ai-chat-empty-text">选择或新建一个对话开始生成</div>
      </div>
      <template v-else>
        <div class="ai-chat-messages" :ref="setChatMessagesRef">
          <div
            v-for="(msg, idx) in activeMessages"
            :key="`msg-${idx}`"
            class="ai-chat-bubble"
            :class="msg.role"
          >
            <div class="ai-chat-bubble-role">{{ msg.role === 'user' ? '👤 你' : '🤖 AI' }}</div>
            <div class="ai-chat-bubble-content">{{ msg.content }}</div>
          </div>
          <div v-if="isGenerating && streamingText" class="ai-chat-bubble assistant streaming">
            <div class="ai-chat-bubble-role">🤖 AI</div>
            <div class="ai-chat-bubble-content">{{ streamingText }}<span class="ai-cursor">▌</span></div>
          </div>
          <div v-if="isGenerating && !streamingText" class="ai-chat-bubble assistant streaming">
            <div class="ai-chat-bubble-role">🤖 AI</div>
            <div class="ai-chat-bubble-content"><span class="ai-thinking">思考中...</span></div>
          </div>
        </div>
        <div class="ai-chat-input-bar">
          <label class="ai-context-toggle" title="开启后，AI 将能看到酒馆的预设、世界书和正则上下文">
            <input v-model="useContextModel" type="checkbox" />
            <span>{{ useContext ? '📖 附带上下文' : '🔒 纯净模式' }}</span>
          </label>
          <textarea
            v-model="chatInputTextModel"
            class="text-input ai-chat-input"
            placeholder="输入提示词，让 AI 生成世界书条目..."
            rows="2"
            :disabled="isGenerating"
            @keydown.enter.exact.prevent="emit('sendMessage')"
          ></textarea>
          <button
            v-if="!isGenerating"
            class="btn ai-send-btn"
            type="button"
            :disabled="!chatInputText.trim()"
            @click="emit('sendMessage')"
          >发送</button>
          <button
            v-else
            class="btn danger ai-stop-btn"
            type="button"
            @click="emit('stopGeneration')"
          >停止</button>
        </div>
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, type ComponentPublicInstance } from 'vue';
import type { AIChatMessage } from '../types';

interface AISession {
  id: string;
  title: string;
  messages: AIChatMessage[];
}

interface AIGeneratorPanelProps {
  sessions: AISession[];
  activeSession: AISession | null;
  activeMessages: AIChatMessage[];
  isGenerating: boolean;
  streamingText: string;
  chatInputText: string;
  useContext: boolean;
  setChatMessagesElement: (element: HTMLElement | null) => void;
}

const props = defineProps<AIGeneratorPanelProps>();

const emit = defineEmits<{
  (event: 'createSession'): void;
  (event: 'deleteSession', sessionId: string): void;
  (event: 'switchSession', sessionId: string): void;
  (event: 'sendMessage'): void;
  (event: 'stopGeneration'): void;
  (event: 'update:chatInputText', value: string): void;
  (event: 'update:useContext', value: boolean): void;
}>();

const chatInputTextModel = computed({
  get: () => props.chatInputText,
  set: (value: string) => emit('update:chatInputText', value),
});

const useContextModel = computed({
  get: () => props.useContext,
  set: (value: boolean) => emit('update:useContext', value),
});

function setChatMessagesRef(element: Element | ComponentPublicInstance | null): void {
  props.setChatMessagesElement(element instanceof HTMLElement ? element : null);
}
</script>
