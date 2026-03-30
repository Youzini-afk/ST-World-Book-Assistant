<template>
  <section class="wb-bindings browse-global-mode">
    <div class="global-mode-panel">
      <div class="global-mode-grid">
        <div class="global-mode-column">
          <label class="field">
            <span>搜索并添加常驻世界书</span>
            <input
              v-model="globalAddSearchTextModel"
              type="text"
              class="text-input"
              placeholder="搜索并添加..."
              @keydown.enter.prevent="emit('addFirstGlobalCandidate')"
            />
          </label>
          <TransitionGroup name="list" tag="div" class="global-mode-list">
            <button
              v-for="name in globalAddCandidates"
              :key="`browse-add-${name}`"
              class="global-mode-item add"
              type="button"
              @click="emit('addGlobalWorldbook', name)"
            >
              <span class="global-mode-item-name">{{ name }}</span>
              <span class="global-mode-item-action">添加</span>
            </button>
            <div v-if="!globalAddCandidates.length" key="empty" class="empty-note">没有可添加的世界书</div>
          </TransitionGroup>
        </div>
        <div class="global-mode-column">
          <label class="field">
            <span>筛选常驻世界书</span>
            <input
              v-model="globalFilterTextModel"
              type="text"
              class="text-input"
              placeholder="筛选..."
            />
          </label>
          <TransitionGroup name="list" tag="div" class="global-mode-list">
            <button
              v-for="name in filteredGlobalWorldbooks"
              :key="`browse-global-${name}`"
              class="global-mode-item active"
              type="button"
              @click="emit('removeGlobalWorldbook', name)"
            >
              <span class="global-mode-item-name">{{ name }}</span>
              <span class="global-mode-item-action">移除</span>
            </button>
            <div v-if="!filteredGlobalWorldbooks.length" key="empty" class="empty-note">暂无常驻世界书</div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface GlobalModeBrowsePanelProps {
  globalAddSearchText: string;
  globalFilterText: string;
  globalAddCandidates: string[];
  filteredGlobalWorldbooks: string[];
}

const props = defineProps<GlobalModeBrowsePanelProps>();

const emit = defineEmits<{
  (event: 'update:globalAddSearchText', value: string): void;
  (event: 'update:globalFilterText', value: string): void;
  (event: 'addFirstGlobalCandidate'): void;
  (event: 'addGlobalWorldbook', name: string): void;
  (event: 'removeGlobalWorldbook', name: string): void;
}>();

const globalAddSearchTextModel = computed({
  get: () => props.globalAddSearchText,
  set: (value: string) => emit('update:globalAddSearchText', value),
});

const globalFilterTextModel = computed({
  get: () => props.globalFilterText,
  set: (value: string) => emit('update:globalFilterText', value),
});
</script>
