<template>
  <div class="wb-status-bar">
    <span class="wb-status-dot" :class="statusClass"></span>
    <span class="wb-status-text">{{ statusLabel }}</span>
    <span v-if="entryCount !== undefined" class="wb-status-sep">·</span>
    <span v-if="entryCount !== undefined" class="wb-status-meta">{{ entryCount }} 条目</span>
    <span v-if="enabledCount !== undefined" class="wb-status-meta-dim">({{ enabledCount }} 启用)</span>
    <span class="wb-status-spacer"></span>
    <span v-if="lastSaveTime" class="wb-status-meta-dim">{{ lastSaveTime }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface StatusBarProps {
  hasUnsavedChanges?: boolean;
  entryCount?: number;
  enabledCount?: number;
  lastSaveTime?: string;
  isConnected?: boolean;
}

const props = withDefaults(defineProps<StatusBarProps>(), {
  hasUnsavedChanges: false,
  isConnected: true,
});

const statusClass = computed(() => ({
  'is-modified': props.hasUnsavedChanges,
  'is-ok': !props.hasUnsavedChanges && props.isConnected,
}));

const statusLabel = computed(() => {
  if (props.hasUnsavedChanges) return '未保存更改';
  return '就绪';
});
</script>

<style scoped>
.wb-status-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 11px;
  color: var(--wb-text-muted);
  background: var(--wb-bg-panel);
  border-radius: 8px;
  min-height: 24px;
}

.wb-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wb-text-muted);
  flex-shrink: 0;
}

.wb-status-dot.is-ok {
  background: var(--wb-success, #4EDEA3);
}

.wb-status-dot.is-modified {
  background: var(--wb-secondary, #FBBF24);
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.wb-status-text {
  font-weight: 500;
}

.wb-status-sep {
  opacity: 0.4;
}

.wb-status-meta {
  color: var(--wb-text-main);
}

.wb-status-meta-dim {
  opacity: 0.6;
}

.wb-status-spacer {
  flex: 1;
}
</style>
