<template>
  <div class="wb-floating-window activation-window" :style="panelStyle" @pointerdown="emit('bringToFront')">
    <div class="wb-floating-header" @pointerdown="onStartDrag">
      <strong>📡 激活监控（WORLD_INFO_ACTIVATED）</strong>
      <div class="wb-floating-header-actions">
        <button
          class="btn mini danger"
          type="button"
          :disabled="!activationLogs.length"
          @pointerdown.stop
          @click="emit('clear')"
        >
          清空
        </button>
        <button class="btn mini danger" type="button" @pointerdown.stop @click="emit('close')">
          关闭
        </button>
      </div>
    </div>

    <div class="wb-floating-body">
      <div class="tool-scroll">
        <div v-for="log in activationLogs" :key="log.id" class="activation-item">
          <div class="activation-main">
            <strong>{{ log.world }}</strong>
            <span>#{{ log.uid }} · {{ log.name }}</span>
          </div>
          <div class="activation-sub">
            <span>{{ formatDateTime(log.time) }}</span>
            <span>{{ log.contentPreview }}</span>
          </div>
        </div>
        <div v-if="!activationLogs.length" class="empty-note">暂无激活记录</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActivationLog } from '../types';

interface FloatingActivationWindowProps {
  panelStyle?: Record<string, string>;
  activationLogs: ActivationLog[];
  formatDateTime: (timestamp: number) => string;
}

defineProps<FloatingActivationWindowProps>();

const emit = defineEmits<{
  (event: 'bringToFront'): void;
  (event: 'startDrag', payload: PointerEvent): void;
  (event: 'clear'): void;
  (event: 'close'): void;
}>();

function onStartDrag(event: PointerEvent): void {
  emit('startDrag', event);
}
</script>

<style scoped>
.wb-floating-window {
  position: fixed;
  max-width: calc(100vw - 16px);
  max-height: min(74vh, 760px);
  border: 1px solid var(--wb-border-subtle);
  border-radius: 12px;
  background: var(--wb-glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.wb-floating-header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--wb-border-subtle);
  background: var(--wb-glass-header);
  cursor: move;
  user-select: none;
  touch-action: none;
}

.wb-floating-header strong {
  font-size: 12px;
  color: var(--wb-text-main);
}

.wb-floating-header-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-floating-body {
  min-height: 0;
  padding: 12px;
  display: grid;
  gap: 10px;
  overflow: auto;
}

.tool-scroll {
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.activation-window .tool-scroll {
  max-height: min(58vh, 520px);
}

.activation-item {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 4px;
  background: var(--wb-input-bg);
  transition: background 0.2s ease, border-color 0.2s ease;
}

.activation-item:hover {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
}

.activation-main,
.activation-sub {
  display: flex;
  justify-content: space-between;
  gap: 6px;
}

.activation-main strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activation-main span,
.activation-sub {
  color: var(--wb-text-muted);
  font-size: 12px;
}

.activation-sub span:last-child {
  flex: 1;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty-note {
  color: var(--wb-text-dim);
  font-size: 13px;
  text-align: center;
  letter-spacing: 0.02em;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  background: var(--wb-input-bg);
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  color: var(--wb-text-main);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: background 0.25s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.25s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s cubic-bezier(0.25, 1, 0.5, 1), transform 0.25s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  transform: translateZ(0);
}

.btn:hover:not(:disabled) {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.97);
  box-shadow: 0 0 0 0 transparent;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn.danger {
  background: rgba(225, 29, 72, 0.1);
  border-color: rgba(225, 29, 72, 0.4);
  color: #f43f5e;
}

.btn.danger:hover:not(:disabled) {
  background: #e11d48;
  color: #fff;
  border-color: #be123c;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
}

.btn.mini {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
}

@media (max-width: 1100px) {
  .wb-floating-window {
    width: calc(100vw - 16px) !important;
    left: 8px !important;
    right: 8px;
  }
}

@media (max-width: 760px) {
  .wb-floating-window {
    position: absolute;
    left: 8px !important;
    right: 8px !important;
    width: auto !important;
    max-width: none !important;
  }
}
</style>
