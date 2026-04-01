<template>
  <div ref="rootRef" class="wb-assistant-root" :class="[focusCineRootClass, { 'is-mobile': isMobile, 'is-glass-mode': persistedState.glass_mode }]" :style="themeStyles">

    <!-- ═══ Mobile Tab View ═══ -->
    <template v-if="isMobile">

      <!-- ═══ Mobile Browse Mode ═══ -->
      <template v-if="panelMode === 'browse'">
        <div class="mobile-browse-view">
          <!-- Mobile browse toolbar -->
          <section class="wb-toolbar browse-toolbar mobile-browse-toolbar">
            <WorldbookPicker
              :open="worldbookPickerOpen"
              v-model:search-text="worldbookPickerSearchText"
              :selected-worldbook-name="selectedWorldbookName"
              :filtered-names="filteredSelectableWorldbookNames"
              trigger-placeholder="请选择"
              title-placeholder="请选择世界书"
              search-placeholder="搜索..."
              empty-text="无匹配"
              list-key-prefix="mbrowse-wb"
              :show-open-state-arrow="false"
              :set-picker-element="setWorldbookPickerElement"
              :show-tag-filter="false"
              :tag-filter-panel-open="tagFilterPanelOpen"
              :tag-filter-summary="tagFilterSummary"
              :tag-filter-logic="tagFilterLogic"
              :tag-filter-match-mode="tagFilterMatchMode"
              :selected-tag-filter-ids="selectedTagFilterIds"
              :selected-tag-filter-id-set="selectedTagFilterIdSet"
              :tag-filter-search-text="tagFilterSearchText"
              :tag-assign-options="tagAssignOptions"
              :tag-tree-rows="tagTreeRows"
              :tag-tree-expanded-ids="tagTreeExpandedIds"
              :tag-path-map="tagPathMap"
              :is-mobile="isMobile"
              @toggle="toggleWorldbookPicker"
              @select="selectWorldbookFromPicker"
            />
            <input v-model="searchText" type="text" class="text-input browse-search" placeholder="🔍 搜索..." />
            <button class="btn" type="button" :class="{ 'glow-pulse': hasUnsavedChanges }" :disabled="!hasUnsavedChanges" @click="saveCurrentWorldbook">💾</button>
          </section>

          <!-- Mobile browse card list -->
          <div class="browse-scroll-area mobile-browse-scroll">
            <section class="browse-bindings mobile-browse-bindings">
              <span v-if="bindings.global.length" class="binding-tag global">🟢 全局</span>
              <span v-if="bindings.charPrimary" class="binding-tag char">🔵 角色</span>
              <span v-if="bindings.chat" class="binding-tag chat">🟡 聊天</span>
              <span class="browse-entry-count">{{ filteredEntries.length }} / {{ draftEntries.length }}</span>
              <button class="btn mini" type="button" :disabled="!selectedWorldbookName" @click="addEntry">+</button>
            </section>
            <div class="browse-grid mobile-browse-grid">
              <article
                v-for="entry in browseVisibleEntries"
                :key="`mbrowse-card-${entry.uid}`"
                class="browse-card"
                :class="{
                  expanded: expandedBrowseCardUids.has(entry.uid),
                  disabled: !entry.enabled,
                }"
                :data-status="getEntryVisualStatus(entry)"
              >
                <div class="browse-card-header" @click="toggleBrowseCard(entry.uid)">
                  <span class="entry-status-dot" :data-status="getEntryVisualStatus(entry)"></span>
                  <span class="browse-card-title">{{ entry.name || `条目 ${entry.uid}` }}</span>
                  <label class="browse-toggle-wrap" @click.stop>
                    <input type="checkbox" :checked="entry.enabled" @change="browseToggleEnabled(entry)" />
                    <span class="browse-toggle-label">{{ entry.enabled ? 'ON' : 'OFF' }}</span>
                  </label>
                </div>
                <div v-if="!expandedBrowseCardUids.has(entry.uid) && entry.strategy.keys.length" class="browse-card-keys" @click="toggleBrowseCard(entry.uid)">
                  <span v-for="(k, ki) in entry.strategy.keys.slice(0, 4)" :key="`mbk-${entry.uid}-${ki}`" class="browse-key-chip">{{ String(k) }}</span>
                  <span v-if="entry.strategy.keys.length > 4" class="browse-key-chip more">+{{ entry.strategy.keys.length - 4 }}</span>
                </div>
                <div v-if="!expandedBrowseCardUids.has(entry.uid)" class="browse-card-preview" @click="toggleBrowseCard(entry.uid)">
                  {{ browseGetContentPreview(entry) }}
                </div>
                <div v-if="!expandedBrowseCardUids.has(entry.uid)" class="browse-card-meta" @click="toggleBrowseCard(entry.uid)">
                  <span class="browse-meta-pill" :data-status="getEntryVisualStatus(entry)">{{ browseGetStrategyLabel(entry) }}</span>
                  <span class="browse-meta-pill">📍 {{ browseGetPositionLabel(entry) }}</span>
                </div>

                <!-- Mobile expanded inline editor -->
                <div v-if="expandedBrowseCardUids.has(entry.uid)" class="browse-card-expanded">
                  <label class="field">
                    <span>备注</span>
                    <input class="text-input" type="text" v-model="entry.name" placeholder="名称" />
                  </label>
                  <label class="field">
                    <span>主要关键词</span>
                    <textarea
                      class="text-input browse-keys-input"
                      :value="entry.strategy.keys.map(k => String(k)).join(', ')"
                      @change="entry.strategy.keys = ($event.target as HTMLTextAreaElement).value.split(',').map(s => s.trim()).filter(Boolean) as any"
                      placeholder="逗号分隔"
                      rows="1"
                    ></textarea>
                  </label>
                  <label class="field">
                    <span>内容</span>
                    <textarea
                      class="text-input browse-content-input"
                      v-model="entry.content"
                      placeholder="条目内容..."
                    ></textarea>
                  </label>
                  <div class="browse-config-grid mobile-config-grid">
                    <label class="field">
                      <span>策略</span>
                      <select class="text-input" v-model="entry.strategy.type">
                        <option value="constant">🔵 常驻</option>
                        <option value="selective">🟢 关键词</option>
                        <option value="vectorized">🔗 向量化</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>位置</span>
                      <select class="text-input" :value="(() => { const opt = positionSelectOptions.find(o => o.type === entry.position.type && (o.type !== 'at_depth' || o.role === entry.position.role)); return opt?.value ?? entry.position.type; })()" @change="(() => { const v = ($event.target as HTMLSelectElement).value as PositionSelectValue; const opt = positionSelectOptions.find(o => o.value === v); if (opt) { entry.position.type = opt.type; if (opt.role) entry.position.role = opt.role; } })()">
                        <option v-for="opt in positionSelectOptions" :key="`mbrowse-pos-${entry.uid}-${opt.value}`" :value="opt.value">{{ opt.label }}</option>
                      </select>
                    </label>
                    <label class="field">
                      <span>权重</span>
                      <input class="text-input" type="number" v-model.number="entry.position.order" />
                    </label>
                  </div>
                  <div class="browse-recursion-row">
                    <label class="checkbox-inline">
                      <input type="checkbox" v-model="entry.recursion.prevent_incoming" />
                      <span>🚫 不可递归命中</span>
                    </label>
                    <label class="checkbox-inline">
                      <input type="checkbox" v-model="entry.recursion.prevent_outgoing" />
                      <span>🚫 阻止后续递归</span>
                    </label>
                  </div>
                  <div class="browse-card-actions">
                    <button class="btn mini danger" type="button" @click="removeSelectedEntry" @mousedown="selectEntry(entry.uid)">🗑</button>
                    <button class="btn mini utility-btn" type="button" @click="switchToEditorForEntry(entry.uid)">✏️ 完整编辑</button>
                    <button class="btn mini" type="button" @click="toggleBrowseCard(entry.uid)">收起</button>
                  </div>
                </div>
              </article>
              <div v-if="browseHasMoreEntries" ref="browseLoadMoreSentinelRef" class="browse-load-more-sentinel">
                <span class="browse-load-more-text">已加载 {{ browseVisibleEntries.length }} / {{ filteredEntries.length }} …</span>
              </div>
              <div v-if="!filteredEntries.length" class="browse-empty">
                <div class="browse-empty-icon">📖</div>
                <div class="browse-empty-text">{{ selectedWorldbookName ? '无条目' : '请选择世界书' }}</div>
              </div>
            </div>
          </div>
        </div>
        <!-- Mobile browse bottom tabs -->
        <div class="mobile-tab-bar" style="display:flex !important;flex-shrink:0;">
          <button class="active">
            <span class="tab-icon">📖</span><span class="tab-label">浏览</span>
          </button>
          <button @click="switchPanelMode('editor')">
            <span class="tab-icon">✏️</span><span class="tab-label">编辑</span>
          </button>
        </div>
      </template>

      <!-- ═══ Mobile Editor Mode ═══ -->
      <template v-if="panelMode === 'editor'">
      <div class="mobile-tab-view">
        <div class="mobile-tab-content">

          <!-- Tab: 列表 -->
          <Transition name="mobile-tab">
            <div v-show="mobileTab === 'list'" class="mobile-pane">
              <section class="wb-toolbar">
                <label class="toolbar-label">
                <span>世界书</span>
                <WorldbookPicker
                  :open="worldbookPickerOpen"
                  v-model:search-text="worldbookPickerSearchText"
                  :selected-worldbook-name="selectedWorldbookName"
                  :filtered-names="filteredSelectableWorldbookNames"
                  trigger-placeholder="请选择世界书"
                  title-placeholder="请选择世界书"
                  search-placeholder="搜索世界书..."
                  empty-text="没有匹配的世界书"
                  list-key-prefix="wb-pick-m"
                  :show-open-state-arrow="false"
                  :set-picker-element="setWorldbookPickerElement"
                  :show-tag-filter="tagDefinitions.length > 0"
                  :tag-filter-panel-open="tagFilterPanelOpen"
                  :tag-filter-summary="tagFilterSummary"
                  v-model:tag-filter-logic="tagFilterLogic"
                  v-model:tag-filter-match-mode="tagFilterMatchMode"
                  :selected-tag-filter-ids="selectedTagFilterIds"
                  :selected-tag-filter-id-set="selectedTagFilterIdSet"
                  v-model:tag-filter-search-text="tagFilterSearchText"
                  :tag-assign-options="tagAssignOptions"
                  :tag-tree-rows="tagTreeRows"
                  :tag-tree-expanded-ids="tagTreeExpandedIds"
                  :tag-path-map="tagPathMap"
                  :is-mobile="isMobile"
                  @toggle="toggleWorldbookPicker"
                  @select="selectWorldbookFromPicker"
                  @toggle-tag-filter-panel="tagFilterPanelOpen = !tagFilterPanelOpen"
                  @clear-tag-filter-selection="clearTagFilterSelection"
                  @toggle-tag-filter-selection="toggleTagFilterSelection"
                  @toggle-tag-tree-expanded="toggleTagTreeExpanded"
                />
              </label>
              <div class="toolbar-btns" style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn" type="button" :class="{ 'glow-pulse': hasUnsavedChanges }" :disabled="!hasUnsavedChanges" @click="saveCurrentWorldbook" style="padding:8px 14px;font-size:13px;">💾 保存</button>
                <button class="btn" type="button" @click="addEntry" style="padding:8px 14px;font-size:13px;">+ 新条目</button>
                <button class="btn" type="button" @click="triggerImport" style="padding:8px 14px;font-size:13px;">📥 导入</button>
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="exportCurrentWorldbook" style="padding:8px 14px;font-size:13px;">📤 导出</button>
                <button class="btn" type="button" @click="toggleGlobalMode" :style="{ padding:'8px 14px', fontSize:'13px', background: globalWorldbookMode ? 'var(--wb-primary)' : '', color: globalWorldbookMode ? '#fff' : '' }">🌐 全局</button>
                <button class="btn" type="button" @click="extractFromChat" style="padding:8px 14px;font-size:13px;">📥 提取</button>
                <button class="btn" type="button" @click="showApiSettings = true" style="padding:8px 14px;font-size:13px;">⚙️ 设置</button>
                <button class="btn" type="button" @click="openAiConfigModal" style="padding:8px 14px;font-size:13px;">🔧 AI配置</button>
                <button class="btn" type="button" :disabled="!draftEntries.length" @click="sortEntries" :class="{ active: viewSortActive }" style="padding:8px 14px;font-size:13px;">🔢 排序</button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="openEntryHistoryModal" style="padding:8px 14px;font-size:13px;">🕰️ 条目时光机</button>
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="openWorldbookHistoryModal" style="padding:8px 14px;font-size:13px;">⏪ 整本时光机</button>
              </div>
            </section>
            <div class="wb-bindings" v-if="bindings.global.length || bindings.charPrimary || bindings.charAdditional.length || bindings.chat">
              <span v-for="name in bindings.global" :key="`bg-m-${name}`" class="binding-chip global" :title="name">{{ name }}</span>
              <span v-if="bindings.charPrimary" :key="`bc-m-${bindings.charPrimary}`" class="binding-chip char" :title="bindings.charPrimary">{{ bindings.charPrimary }}</span>
              <span v-for="name in bindings.charAdditional" :key="`bca-m-${name}`" class="binding-chip char" :title="name">{{ name }}</span>
              <span v-if="bindings.chat" :key="`bch-m-${bindings.chat}`" class="binding-chip chat" :title="bindings.chat">{{ bindings.chat }}</span>
            </div>
            <GlobalModeMobilePanel
              v-if="globalWorldbookMode"
              :bindings-global="bindings.global"
              v-model:selected-global-preset-id="selectedGlobalPresetId"
              :global-worldbook-presets="globalWorldbookPresets"
              :selected-global-preset="selectedGlobalPreset"
              v-model:global-add-search-text="globalAddSearchText"
              :global-add-candidates="globalAddCandidates"
              :filtered-global-worldbooks="filteredGlobalWorldbooks"
              :current-role-context="currentRoleContext"
              :is-current-role-bound-to-selected-preset="isCurrentRoleBoundToSelectedPreset"
              :role-picker-open="rolePickerOpen"
              v-model:role-bind-search-text="roleBindSearchText"
              :role-binding-candidates="roleBindingCandidates"
              :selected-global-preset-role-bindings="selectedGlobalPresetRoleBindings"
              @clear-global-worldbooks="clearGlobalWorldbooks"
              @global-preset-selection-changed="onGlobalPresetSelectionChanged"
              @save-current-as-global-preset="saveCurrentAsGlobalPreset"
              @overwrite-selected-global-preset="overwriteSelectedGlobalPreset"
              @delete-selected-global-preset="deleteSelectedGlobalPreset"
              @add-first-global-candidate="addFirstGlobalCandidate"
              @add-global-worldbook="addGlobalWorldbook"
              @remove-global-worldbook="removeGlobalWorldbook"
              @bind-current-role-to-selected-preset="bindCurrentRoleToSelectedPreset"
              @unbind-current-role-from-selected-preset="unbindCurrentRoleFromSelectedPreset"
              @toggle-role-picker="toggleRolePicker"
              @bind-first-role-candidate="bindFirstRoleCandidate"
              @bind-role-candidate-to-selected-preset="bindRoleCandidateToSelectedPreset"
              @remove-role-binding-from-selected-preset="removeRoleBindingFromSelectedPreset"
            />
            <div class="mobile-entry-list">
              <div v-if="mobileMultiSelectMode" class="mobile-multi-toolbar">
                <span class="mobile-multi-title">多选模式 · 已选 {{ selectedEntryCount }}</span>
                <div class="mobile-multi-actions">
                  <button class="btn mini" type="button" @click="selectAllVisibleForMobileMultiSelect">全选可见</button>
                  <button class="btn mini" type="button" @click="clearMobileMultiSelectSelection">清空</button>
                  <button class="btn mini" type="button" @click="finishMobileMultiSelectMode">完成</button>
                </div>
              </div>
              <button
                v-for="entry in filteredEntries"
                :key="`me-${entry.uid}`"
                type="button"
                class="entry-item"
                :data-status="getEntryVisualStatus(entry)"
                :class="{
                  selected: selectedEntryUidSet.has(entry.uid),
                  primary: entry.uid === selectedEntryUid,
                  disabled: !entry.enabled,
                  'mobile-multi-item': mobileMultiSelectMode,
                }"
                @click="selectEntry(entry.uid, $event)"
                @pointerdown="startMobileEntryLongPress(entry.uid, $event)"
                @pointermove="handleMobileEntryLongPressMove($event)"
                @pointerup="finishMobileEntryLongPress($event)"
                @pointercancel="finishMobileEntryLongPress($event)"
                @lostpointercapture="finishMobileEntryLongPress()"
                @contextmenu.prevent
                style="border: 1px solid var(--wb-border-subtle); border-radius: 8px; padding: 8px 10px; margin-bottom: 4px;"
              >
                <div class="entry-item-head">
                  <input
                    v-if="mobileMultiSelectMode"
                    type="checkbox"
                    class="mobile-multi-checkbox"
                    :checked="selectedEntryUidSet.has(entry.uid)"
                    @click.stop
                    @change="toggleMobileEntrySelection(entry.uid)"
                  />
                  <span class="entry-status-dot" :data-status="getEntryVisualStatus(entry)"></span>
                  <div class="entry-item-title">{{ entry.name || `条目 ${entry.uid}` }}</div>
                  <span v-if="mobileMultiSelectMode && selectedEntryUid === entry.uid && selectedEntryUidSet.has(entry.uid)" class="entry-chip mono">样板</span>
                  <span class="entry-chip uid">#{{ entry.uid }}</span>
                </div>
                <div class="entry-item-keys" v-if="entry.strategy.keys?.length">
                  {{ entry.strategy.keys.join(', ') }}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;font-size:10px;opacity:0.8;">
                  <span style="background:var(--wb-input-bg);padding:2px 6px;border-radius:4px;">📍 {{ getPositionTypeLabel(entry.position.type, entry.position.role) }}</span>
                  <span style="background:var(--wb-input-bg);padding:2px 6px;border-radius:4px;">⚖️ #{{ entry.position.order }}</span>
                  <span v-if="entry.recursion.prevent_incoming" style="background:var(--wb-input-bg);padding:2px 6px;border-radius:4px;color:#f59e0b;">🚫入</span>
                  <span v-if="entry.recursion.prevent_outgoing" style="background:var(--wb-input-bg);padding:2px 6px;border-radius:4px;color:#f59e0b;">🚫出</span>
                </div>
              </button>
              <div v-if="!filteredEntries.length" class="empty-note">暂无条目</div>
            </div>
            </div>
          </Transition>

          <!-- Tab: 编辑 -->
          <Transition name="mobile-tab">
            <div v-show="mobileTab === 'edit'" class="mobile-pane">
              <template v-if="selectedEntry">
              <header class="editor-head">
                <label class="field editor-comment">
                  <span>备注 (COMMENT)</span>
                  <input v-model="selectedEntry.name" type="text" class="text-input" tabindex="-1" />
                </label>
                <div class="editor-badges">
                  <span class="editor-badge" :class="selectedEntry.enabled ? 'on' : 'off'">{{ selectedEntry.enabled ? 'EN' : 'OFF' }}</span>
                  <span class="editor-badge mono">#{{ selectedEntry.uid }}</span>
                  <span class="editor-badge mono">~{{ selectedTokenEstimate }}T</span>
                </div>
              </header>
              <section class="editor-grid two-cols editor-keyword-grid">
                <label class="field">
                  <span>主要关键词 (KEYS)</span>
                  <textarea :value="selectedKeysRaw" @input="selectedKeysRaw = ($event.target as HTMLTextAreaElement).value" @blur="commitKeysFromRaw" class="text-area compact"></textarea>
                </label>
                <label class="field">
                  <span>次要关键词 (SECONDARY)</span>
                  <textarea :value="selectedSecondaryKeysRaw" @input="selectedSecondaryKeysRaw = ($event.target as HTMLTextAreaElement).value" @blur="commitSecondaryKeysFromRaw" class="text-area compact"></textarea>
                </label>
              </section>
              <section class="editor-content-block" ref="editorContentBlockRef">
                <div v-if="isMobile" class="content-top-drag-handle" @pointerdown="startContentTopDrag">
                  <span class="content-top-drag-grip">━━━</span>
                </div>
                <div v-if="mobileMultiSelectMode" class="mobile-multi-content-note">多选模式下仅支持配置联动，内容编辑已禁用</div>
                <div class="editor-content-title">世界观设定 / 内容 (CONTENT)</div>
                <textarea
                  ref="contentTextareaRef"
                  v-model="selectedEntry.content"
                  class="text-area large editor-content-area"
                  :disabled="mobileMultiSelectMode"
                  style="min-height: calc(100vh - 500px);"
                ></textarea>
                <div class="content-resize-handle" @pointerdown="startContentResize">
                  <span class="content-resize-grip">━━━</span>
                </div>
              </section>
            </template>
            <div v-else class="empty-block">请在列表中选择一个条目</div>
          </div>
          </Transition>

          <!-- Tab: 设置 -->
          <Transition name="mobile-tab">
          <div v-show="mobileTab === 'settings'" class="mobile-pane">
            <template v-if="selectedEntry">
              <article class="editor-card">
                <h4>触发策略 (STRATEGY)</h4>
                <label class="field checkbox-inline">
                  <input v-model="selectedEntry.enabled" type="checkbox" />
                  <span>启用条目</span>
                </label>
                <div class="strategy-switch">
                  <button type="button" class="strategy-pill constant" :class="{ active: selectedEntry.strategy.type === 'constant' }" @click="selectedEntry.strategy.type = 'constant'">🔵 常驻</button>
                  <button type="button" class="strategy-pill vector" :class="{ active: selectedEntry.strategy.type === 'vectorized' }" @click="selectedEntry.strategy.type = 'vectorized'">📎 向量化</button>
                  <button type="button" class="strategy-pill selective" :class="{ active: selectedEntry.strategy.type === 'selective' }" @click="selectedEntry.strategy.type = 'selective'">🟢 关键词</button>
                </div>
                <details class="editor-advanced">
                  <summary>高级策略设置</summary>
                  <label class="field">
                    <span>次要逻辑 (LOGIC)</span>
                    <select v-model="selectedEntry.strategy.keys_secondary.logic" class="text-input">
                      <option v-for="item in secondaryLogicOptions" :key="`ml-${item}`" :value="item">{{ getSecondaryLogicLabel(item) }}</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>扫描深度</span>
                    <input v-model="selectedScanDepthText" type="text" class="text-input" placeholder="留空或 same_as_global" />
                  </label>
                  <label class="field">
                    <span>概率(0-100)</span>
                    <input v-model.number="selectedEntry.probability" type="number" class="text-input" min="0" max="100" step="1" />
                  </label>
                </details>
              </article>
              <article class="editor-card">
                <h4>插入设置 (INSERTION)</h4>
                <label class="field">
                  <span>位置 (Position)</span>
                  <select v-model="selectedPositionSelectValue" class="text-input">
                    <option v-for="item in positionSelectOptions" :key="`mp-${item.value}`" :value="item.value">{{ item.label }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>权重 (Order)</span>
                  <input v-model.number="selectedEntry.position.order" type="number" class="text-input" step="1" />
                </label>
                <div class="editor-grid two-cols">
                  <label class="field" :class="{ disabled: selectedEntry.position.type !== 'at_depth' }">
                    <span>深度角色</span>
                    <select v-model="selectedEntry.position.role" class="text-input" :disabled="selectedEntry.position.type !== 'at_depth'">
                      <option value="system">system</option>
                      <option value="assistant">assistant</option>
                      <option value="user">user</option>
                    </select>
                  </label>
                  <label class="field" :class="{ disabled: selectedEntry.position.type !== 'at_depth' }">
                    <span>深度层级</span>
                    <input v-model.number="selectedEntry.position.depth" type="number" class="text-input" min="0" step="1" :disabled="selectedEntry.position.type !== 'at_depth'" />
                  </label>
                </div>
              </article>
              <article class="editor-card">
                <h4>递归与效果 (RECURSION)</h4>
                <label class="field checkbox-inline">
                  <input v-model="selectedEntry.recursion.prevent_incoming" type="checkbox" />
                  <span>不可递归命中</span>
                </label>
                <label class="field checkbox-inline">
                  <input v-model="selectedEntry.recursion.prevent_outgoing" type="checkbox" />
                  <span>阻止后续递归</span>
                </label>
              </article>
              <details class="editor-advanced">
                <summary>高级字段 / extra JSON</summary>
                <label class="field">
                  <span>extra JSON（未知字段）</span>
                  <textarea v-model="selectedExtraText" class="text-area compact" placeholder="{ ... }"></textarea>
                </label>
                <div class="field-actions">
                  <button class="btn" type="button" @click="applyExtraJson">应用 extra</button>
                  <button class="btn" type="button" @click="clearExtra">清空 extra</button>
                </div>
              </details>
              <div class="mobile-danger-zone">
                <button class="btn danger" type="button" @click="removeSelectedEntry">🗑 删除此条目</button>
                <button class="btn" type="button" @click="duplicateSelectedEntry">📋 复制条目</button>
              </div>
            </template>
            <div v-else class="empty-block">请在列表中选择一个条目</div>
          </div>
          </Transition>

          <!-- Tab: 复制 -->
          <Transition name="mobile-tab">
          <div v-show="mobileTab === 'copy'" class="mobile-pane">
            <CrossCopyMobilePanel
              :workspace-compared-text="crossCopyWorkspaceComparedText"
              :worldbook-names="worldbookNames"
              :status-priority="CROSS_COPY_STATUS_PRIORITY"
              :rows="crossCopyRows"
              :source-rows-filtered="crossCopySourceRowsFiltered"
              :rows-filtered="crossCopyRowsFiltered"
              :status-counts="crossCopyStatusCounts"
              :selected-count="crossCopySelectedCount"
              :can-compare="crossCopyCanCompare"
              :compare-loading="crossCopyCompareLoading"
              :apply-loading="crossCopyApplyLoading"
              v-model:source-worldbook="crossCopySourceWorldbook"
              v-model:target-worldbook="crossCopyTargetWorldbook"
              v-model:use-draft-source-when-current="crossCopyUseDraftSourceWhenCurrent"
              :source-is-current-worldbook="crossCopySourceIsCurrentWorldbook"
              :source-version-label="crossCopySourceVersionLabel"
              v-model:snapshot-before-apply="crossCopySnapshotBeforeApply"
              :source-target-invalid="crossCopySourceTargetInvalid"
              :compare-summary="crossCopyCompareSummary"
              :last-result-summary="crossCopyLastResultSummary"
              :controls-collapsed="crossCopyControlsCollapsed"
              v-model:status-filter="crossCopyStatusFilter"
              v-model:bulk-action="crossCopyBulkAction"
              v-model:search-text="crossCopySearchText"
              :mobile-step="crossCopyMobileStep"
              :mobile-can-go-step2="crossCopyMobileCanGoStep2"
              :mobile-can-go-step3="crossCopyMobileCanGoStep3"
              :mobile-next-disabled="crossCopyMobileNextDisabled"
              :get-status-label="getCrossCopyStatusLabel"
              :get-action-label="getCrossCopyActionLabel"
              :get-status-badge-class="getCrossCopyStatusBadgeClass"
              :get-row-diff-summary="getCrossCopyRowDiffSummary"
              @go-to-mobile-step="goToCrossCopyMobileStep"
              @go-to-previous-mobile-step="goToPreviousCrossCopyMobileStep"
              @go-to-next-mobile-step="goToNextCrossCopyMobileStep"
              @toggle-controls-collapsed="toggleCrossCopyControlsCollapsed"
              @refresh-comparison="refreshCrossCopyComparison"
              @set-selection-for-filtered="setCrossCopySelectionForFiltered"
              @set-selection-for-all="setCrossCopySelectionForAll"
              @apply-action-by-status="applyCrossCopyActionByStatus"
              @apply-bulk-action="applyCrossCopyBulkAction"
              @row-action-change="onCrossCopyRowActionChange"
              @row-rename-blur="onCrossCopyRowRenameBlur"
              @open-diff="openCrossCopyDiff"
              @apply-selection="applyCrossCopySelection"
            />
          </div>
          </Transition>

          <!-- Tab: AI -->
          <Transition name="mobile-tab">
          <div v-show="mobileTab === 'ai'" class="mobile-pane">
            <section class="ai-generator-panel mobile-ai-panel">
              <div class="ai-chat-area">
                <div v-if="!aiActiveSession" class="ai-chat-empty">
                  <div class="ai-chat-empty-icon">🤖</div>
                  <div class="ai-chat-empty-text">新建一个对话开始生成</div>
                  <button class="btn" type="button" @click="aiCreateSession">+ 新建对话</button>
                  <button class="btn" type="button" @click="extractFromChat" style="margin-top:6px;">📥 从聊天提取世界书</button>
                </div>
                <template v-else>
                  <div class="ai-chat-messages" ref="aiChatMessagesRef">
                    <div v-for="(msg, idx) in aiActiveMessages" :key="`mmsg-${idx}`" class="ai-chat-bubble" :class="msg.role">
                      <div class="ai-chat-bubble-role">{{ msg.role === 'user' ? '👤 你' : '🤖 AI' }}</div>
                      <div class="ai-chat-bubble-content">{{ msg.content }}</div>
                    </div>
                    <div v-if="aiIsGenerating && aiStreamingText" class="ai-chat-bubble assistant streaming">
                      <div class="ai-chat-bubble-role">🤖 AI</div>
                      <div class="ai-chat-bubble-content">{{ aiStreamingText }}<span class="ai-cursor">▌</span></div>
                    </div>
                    <div v-if="aiIsGenerating && !aiStreamingText" class="ai-chat-bubble assistant streaming">
                      <div class="ai-chat-bubble-role">🤖 AI</div>
                      <div class="ai-chat-bubble-content"><span class="ai-thinking">思考中...</span></div>
                    </div>
                  </div>
                  <div class="ai-chat-input-bar">
                    <label class="ai-context-toggle" title="开启后，AI 将能看到酒馆的预设、世界书和正则上下文">
                      <input v-model="aiUseContext" type="checkbox" />
                      <span>{{ aiUseContext ? '📖 附带上下文' : '🔒 纯净模式' }}</span>
                    </label>
                    <textarea v-model="aiChatInputText" class="text-input ai-chat-input" placeholder="输入提示词..." rows="2" :disabled="aiIsGenerating" @keydown.enter.exact.prevent="aiSendMessage"></textarea>
                    <button v-if="!aiIsGenerating" class="btn ai-send-btn" type="button" :disabled="!aiChatInputText.trim()" @click="aiSendMessage">发送</button>
                    <button v-else class="btn danger ai-stop-btn" type="button" @click="aiStopGeneration">停止</button>
                  </div>
                </template>
              </div>
            </section>
          </div>
          </Transition>

          <!-- Tab: 标签 -->
          <Transition name="mobile-tab">
          <div v-show="mobileTab === 'tags'" class="mobile-pane">
            <TagEditorMobilePanel
              :tag-definitions="tagDefinitions"
              v-model:tag-new-name="tagNewName"
              v-model:tag-new-parent-id="tagNewParentId"
              :tag-assign-options="tagAssignOptions"
              :tag-management-rows="tagManagementRows"
              :tag-definition-map="tagDefinitionMap"
              :tag-colors="TAG_COLORS"
              :is-tag-parent-option-disabled="isTagParentOptionDisabled"
              v-model:tag-assign-target-id="tagAssignTargetId"
              v-model:tag-assign-search="tagAssignSearch"
              :tag-assign-worldbooks="tagAssignWorldbooks"
              :tag-assignments="tagAssignments"
              :get-worldbook-tag-path-summary="getWorldbookTagPathSummary"
              @tag-create="tagCreate"
              @tag-reset-all="tagResetAll"
              @tag-rename="tagRename"
              @tag-set-parent="tagSetParent"
              @tag-set-color="tagSetColor"
              @tag-delete="tagDelete"
              @tag-toggle-assignment-for-selected-tag="tagToggleAssignmentForSelectedTag"
            />
          </div>
          </Transition>

        </div>
      </div>

      <!-- Tab Bar: bottom, direct child of wb-assistant-root via fragment -->
      <div class="mobile-tab-bar" style="display:flex !important;flex-shrink:0;">
        <button @click="switchPanelMode('browse')">
          <span class="tab-icon">📖</span><span class="tab-label">浏览</span>
        </button>
        <button @click="mobileTab = 'list'" :class="{ active: mobileTab === 'list' }">
          <span class="tab-icon">📋</span><span class="tab-label">列表</span>
        </button>
        <button @click="mobileTab = 'edit'" :class="{ active: mobileTab === 'edit' }">
          <span class="tab-icon">✏️</span><span class="tab-label">编辑</span>
        </button>
        <button @click="mobileTab = 'settings'" :class="{ active: mobileTab === 'settings' }">
          <span class="tab-icon">⚙️</span><span class="tab-label">设置</span>
        </button>
        <button @click="mobileTab = 'copy'" :class="{ active: mobileTab === 'copy' }">
          <span class="tab-icon">📚</span><span class="tab-label">复制</span>
        </button>
        <button v-if="persistedState.show_ai_chat" @click="mobileTab = 'ai'" :class="{ active: mobileTab === 'ai' }">
          <span class="tab-icon">🤖</span><span class="tab-label">AI</span>
        </button>
        <button @click="mobileTab = 'tags'" :class="{ active: mobileTab === 'tags' }">
          <span class="tab-icon">🏷️</span><span class="tab-label">标签</span>
        </button>
      </div>
      </template><!-- end mobile editor mode -->
    </template>

    <!-- ═══ Desktop Layout ═══ -->
    <template v-if="!isMobile">

    <!-- ═══ Desktop Browse Mode ═══ -->
    <template v-if="panelMode === 'browse'">
      <section class="wb-toolbar browse-toolbar">
        <label class="toolbar-label">
          <span>世界书</span>
          <WorldbookPicker
            :open="worldbookPickerOpen"
            v-model:search-text="worldbookPickerSearchText"
            :selected-worldbook-name="selectedWorldbookName"
            :filtered-names="filteredSelectableWorldbookNames"
            trigger-placeholder="请选择世界书"
            title-placeholder="请选择世界书"
            search-placeholder="搜索世界书..."
            empty-text="没有匹配的世界书"
            list-key-prefix="browse-wb"
            :show-open-state-arrow="true"
            :set-picker-element="setWorldbookPickerElement"
            :show-tag-filter="false"
            :tag-filter-panel-open="tagFilterPanelOpen"
            :tag-filter-summary="tagFilterSummary"
            :tag-filter-logic="tagFilterLogic"
            :tag-filter-match-mode="tagFilterMatchMode"
            :selected-tag-filter-ids="selectedTagFilterIds"
            :selected-tag-filter-id-set="selectedTagFilterIdSet"
            :tag-filter-search-text="tagFilterSearchText"
            :tag-assign-options="tagAssignOptions"
            :tag-tree-rows="tagTreeRows"
            :tag-tree-expanded-ids="tagTreeExpandedIds"
            :tag-path-map="tagPathMap"
            :is-mobile="isMobile"
            @toggle="toggleWorldbookPicker"
            @select="selectWorldbookFromPicker"
          />
        </label>
        <button class="btn" type="button" @click="createNewWorldbook">新建</button>
        <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="duplicateWorldbook">另存为</button>
        <button class="btn danger" type="button" :disabled="!selectedWorldbookName" @click="deleteCurrentWorldbook">删除</button>
        <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="exportCurrentWorldbook">导出</button>
        <button class="btn" type="button" @click="triggerImport">导入</button>
        <input
          ref="importFileInput"
          class="hidden-input"
          type="file"
          accept=".json,application/json"
          @change="onImportChange"
        />
        <button class="btn" type="button" :class="{ 'glow-pulse': hasUnsavedChanges }" :disabled="!hasUnsavedChanges" @click="saveCurrentWorldbook">💾 保存</button>
        <div class="browse-mode-switch">
          <button class="btn browse-mode-btn active" type="button">📖 浏览</button>
          <button class="btn browse-mode-btn" type="button" @click="switchPanelMode('editor')">✏️ 编辑</button>
        </div>
      </section>

      <!-- Action bar: search + bindings + new entry + global mode -->
      <section class="browse-action-bar">
        <input v-model="searchText" type="text" class="text-input browse-search" placeholder="🔍 搜索名称 / 内容 / 关键词" />
        <span v-if="bindings.global.length" class="binding-tag global">🟢 全局: {{ bindings.global.join(', ') }}</span>
        <span v-if="bindings.charPrimary" class="binding-tag char">🔵 角色: {{ bindings.charPrimary }}</span>
        <span v-if="bindings.chat" class="binding-tag chat">🟡 聊天: {{ bindings.chat }}</span>
        <span class="browse-action-spacer"></span>
        <span class="browse-entry-count">条目 {{ filteredEntries.length }} / {{ draftEntries.length }}</span>
        <button class="btn mini" type="button" :disabled="!selectedWorldbookName" @click="addEntry">+ 新条目</button>
        <button class="btn mini utility-btn" :class="{ active: globalWorldbookMode }" type="button" @click="toggleGlobalMode">🌐 全局模式</button>
      </section>

      <GlobalModeBrowsePanel
        v-if="globalWorldbookMode"
        v-model:global-add-search-text="globalAddSearchText"
        v-model:global-filter-text="globalFilterText"
        :global-add-candidates="globalAddCandidates"
        :filtered-global-worldbooks="filteredGlobalWorldbooks"
        @add-first-global-candidate="addFirstGlobalCandidate"
        @add-global-worldbook="addGlobalWorldbook"
        @remove-global-worldbook="removeGlobalWorldbook"
      />

      <!-- Card Grid -->
      <div class="browse-scroll-area">
        <div class="browse-grid">
          <article
            v-for="entry in browseVisibleEntries"
            :key="`browse-card-${entry.uid}`"
            class="browse-card"
            :class="{
              expanded: expandedBrowseCardUids.has(entry.uid),
              disabled: !entry.enabled,
            }"
            :data-status="getEntryVisualStatus(entry)"
          >
            <!-- Collapsed Header -->
            <div class="browse-card-header" @click="toggleBrowseCard(entry.uid)">
              <span class="entry-status-dot" :data-status="getEntryVisualStatus(entry)"></span>
              <span class="browse-card-title">{{ entry.name || `条目 ${entry.uid}` }}</span>
              <label class="browse-toggle-wrap" @click.stop>
                <input type="checkbox" :checked="entry.enabled" @change="browseToggleEnabled(entry)" />
                <span class="browse-toggle-label">{{ entry.enabled ? 'ON' : 'OFF' }}</span>
              </label>
            </div>

            <!-- Keywords preview (collapsed) -->
            <div v-if="!expandedBrowseCardUids.has(entry.uid) && entry.strategy.keys.length" class="browse-card-keys" @click="toggleBrowseCard(entry.uid)">
              <span v-for="(k, ki) in entry.strategy.keys.slice(0, 6)" :key="`bk-${entry.uid}-${ki}`" class="browse-key-chip">{{ String(k) }}</span>
              <span v-if="entry.strategy.keys.length > 6" class="browse-key-chip more">+{{ entry.strategy.keys.length - 6 }}</span>
            </div>

            <!-- Content preview (collapsed) -->
            <div v-if="!expandedBrowseCardUids.has(entry.uid)" class="browse-card-preview" @click="toggleBrowseCard(entry.uid)">
              {{ browseGetContentPreview(entry) }}
            </div>

            <!-- Meta row (collapsed) -->
            <div v-if="!expandedBrowseCardUids.has(entry.uid)" class="browse-card-meta" @click="toggleBrowseCard(entry.uid)">
              <span class="browse-meta-pill" :data-status="getEntryVisualStatus(entry)">{{ browseGetStrategyLabel(entry) }}</span>
              <span class="browse-meta-pill">📍 {{ browseGetPositionLabel(entry) }}</span>
              <span class="browse-meta-pill">⚖️ #{{ entry.position.order }}</span>
            </div>

            <!-- ═══ Expanded Inline Editor ═══ -->
            <div v-if="expandedBrowseCardUids.has(entry.uid)" class="browse-card-expanded">
              <label class="field">
                <span>备注 (Comment)</span>
                <input class="text-input" type="text" v-model="entry.name" placeholder="条目名称" />
              </label>
              <label class="field">
                <span>主要关键词</span>
                <textarea
                  class="text-input browse-keys-input"
                  :value="entry.strategy.keys.map(k => String(k)).join(', ')"
                  @change="entry.strategy.keys = ($event.target as HTMLTextAreaElement).value.split(',').map(s => s.trim()).filter(Boolean) as any"
                  placeholder="关键词, 用逗号分隔"
                  rows="1"
                ></textarea>
              </label>
              <label class="field">
                <span>次要关键词</span>
                <div class="browse-secondary-keys-row">
                  <select class="text-input" v-model="entry.strategy.keys_secondary.logic">
                    <option value="and_any">AND_ANY</option>
                    <option value="and_all">AND_ALL</option>
                    <option value="not_all">NOT_ALL</option>
                    <option value="not_any">NOT_ANY</option>
                  </select>
                  <textarea
                    class="text-input browse-keys-input"
                    :value="entry.strategy.keys_secondary.keys.map(k => String(k)).join(', ')"
                    @change="entry.strategy.keys_secondary.keys = ($event.target as HTMLTextAreaElement).value.split(',').map(s => s.trim()).filter(Boolean) as any"
                    placeholder="次要关键词, 用逗号分隔"
                    rows="1"
                  ></textarea>
                </div>
              </label>
              <label class="field">
                <span>内容 (Content)</span>
                <textarea
                  class="text-input browse-content-input"
                  v-model="entry.content"
                  placeholder="世界书条目内容..."
                ></textarea>
              </label>
              <div class="browse-config-grid">
                <label class="field">
                  <span>策略</span>
                  <select class="text-input" v-model="entry.strategy.type">
                    <option value="constant">🔵 常驻</option>
                    <option value="selective">🟢 关键词</option>
                    <option value="vectorized">🔗 向量化</option>
                  </select>
                </label>
                <label class="field">
                  <span>位置</span>
                  <select class="text-input" :value="(() => { const opt = positionSelectOptions.find(o => o.type === entry.position.type && (o.type !== 'at_depth' || o.role === entry.position.role)); return opt?.value ?? entry.position.type; })()" @change="(() => { const v = ($event.target as HTMLSelectElement).value as PositionSelectValue; const opt = positionSelectOptions.find(o => o.value === v); if (opt) { entry.position.type = opt.type; if (opt.role) entry.position.role = opt.role; } })()">
                    <option v-for="opt in positionSelectOptions" :key="`browse-pos-${entry.uid}-${opt.value}`" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </label>
                <label class="field">
                  <span>权重 (Order)</span>
                  <input class="text-input" type="number" v-model.number="entry.position.order" />
                </label>
                <label v-if="entry.position.type === 'at_depth'" class="field">
                  <span>深度 (Depth)</span>
                  <input class="text-input" type="number" v-model.number="entry.position.depth" min="0" />
                </label>
              </div>
              <div class="browse-recursion-row">
                <label class="checkbox-inline">
                  <input type="checkbox" v-model="entry.recursion.prevent_incoming" />
                  <span>🚫 不可递归命中</span>
                </label>
                <label class="checkbox-inline">
                  <input type="checkbox" v-model="entry.recursion.prevent_outgoing" />
                  <span>🚫 阻止后续递归</span>
                </label>
              </div>
              <div class="browse-card-actions">
                <button class="btn mini" type="button" @click="duplicateSelectedEntry" @mouseenter="selectEntry(entry.uid)">📋 复制</button>
                <button class="btn mini danger" type="button" @click="removeSelectedEntry" @mouseenter="selectEntry(entry.uid)">🗑 删除</button>
                <button class="btn mini utility-btn" type="button" @click="switchToEditorForEntry(entry.uid)">✏️ 完整编辑</button>
                <button class="btn mini" type="button" @click="toggleBrowseCard(entry.uid)">收起</button>
              </div>
            </div>
          </article>
          <div v-if="browseHasMoreEntries" ref="browseLoadMoreSentinelRef" class="browse-load-more-sentinel">
            <span class="browse-load-more-text">已加载 {{ browseVisibleEntries.length }} / {{ filteredEntries.length }} …</span>
          </div>
          <div v-if="!filteredEntries.length" class="browse-empty">
            <div class="browse-empty-icon">📖</div>
            <div class="browse-empty-text">{{ selectedWorldbookName ? '没有符合条件的条目' : '请选择一本世界书' }}</div>
          </div>
        </div>
      </div>
    </template>

    <!-- ═══ Desktop Editor Mode ═══ -->
    <template v-if="panelMode === 'editor'">
    <section class="wb-toolbar browse-toolbar" style="justify-content: flex-end; gap: 8px; padding: 6px 12px; min-height: 0;">
      <div class="browse-mode-switch">
        <button class="btn browse-mode-btn" type="button" @click="switchPanelMode('browse')">📖 浏览</button>
        <button class="btn browse-mode-btn active" type="button">✏️ 编辑</button>
      </div>
    </section>
    <section v-if="!isDesktopFocusMode" class="wb-toolbar">
            <label class="toolbar-label">
              <span>世界书</span>
              <WorldbookPicker
                :open="worldbookPickerOpen"
                v-model:search-text="worldbookPickerSearchText"
                :selected-worldbook-name="selectedWorldbookName"
                :filtered-names="filteredSelectableWorldbookNames"
                trigger-placeholder="请选择世界书"
                title-placeholder="请选择世界书"
                search-placeholder="搜索世界书..."
                empty-text="没有匹配的世界书"
                list-key-prefix="worldbook"
                :show-open-state-arrow="true"
                :set-picker-element="setWorldbookPickerElement"
                :show-tag-filter="tagDefinitions.length > 0"
                :tag-filter-panel-open="tagFilterPanelOpen"
                :tag-filter-summary="tagFilterSummary"
                v-model:tag-filter-logic="tagFilterLogic"
                v-model:tag-filter-match-mode="tagFilterMatchMode"
                :selected-tag-filter-ids="selectedTagFilterIds"
                :selected-tag-filter-id-set="selectedTagFilterIdSet"
                v-model:tag-filter-search-text="tagFilterSearchText"
                :tag-assign-options="tagAssignOptions"
                :tag-tree-rows="tagTreeRows"
                :tag-tree-expanded-ids="tagTreeExpandedIds"
                :tag-path-map="tagPathMap"
                :is-mobile="isMobile"
                @toggle="toggleWorldbookPicker"
                @select="selectWorldbookFromPicker"
                @toggle-tag-filter-panel="tagFilterPanelOpen = !tagFilterPanelOpen"
                @clear-tag-filter-selection="clearTagFilterSelection"
                @toggle-tag-filter-selection="toggleTagFilterSelection"
                @toggle-tag-tree-expanded="toggleTagTreeExpanded"
              />
            </label>
            <button class="btn" data-focus-hero="wb_new" type="button" @click="createNewWorldbook">新建</button>
            <button class="btn" data-focus-hero="wb_duplicate" type="button" :disabled="!selectedWorldbookName" @click="duplicateWorldbook">
              另存为
            </button>
            <button class="btn danger" data-focus-hero="wb_delete" type="button" :disabled="!selectedWorldbookName" @click="deleteCurrentWorldbook">
              删除
            </button>
            <button class="btn" data-focus-hero="wb_export" type="button" :disabled="!selectedWorldbookName" @click="exportCurrentWorldbook">
              导出
            </button>
            <button class="btn" data-focus-hero="wb_import" type="button" @click="triggerImport">导入</button>
            <div class="focus-cine-sink-row" aria-hidden="true">
              <span class="focus-cine-sink" data-focus-sink="save_btn"></span>
              <span class="focus-cine-sink" data-focus-sink="more_btn"></span>
              <span class="focus-cine-sink" data-focus-sink="tools_btn"></span>
            </div>
          </section>

          <section v-else  class="wb-focus-toolbar" :class="{ compact: isFocusToolbarCompact }">
            <div class="wb-focus-toolbar-row">
              <div class="wb-focus-core-group">
                <label class="toolbar-label focus-toolbar-label">
                  <span class="focus-toolbar-label-text">世界书</span>
                  <WorldbookPicker
                    :open="worldbookPickerOpen"
                    v-model:search-text="worldbookPickerSearchText"
                    :selected-worldbook-name="selectedWorldbookName"
                    :filtered-names="filteredSelectableWorldbookNames"
                    trigger-placeholder="请选择世界书"
                    title-placeholder="请选择世界书"
                    search-placeholder="搜索世界书..."
                    empty-text="没有匹配的世界书"
                    list-key-prefix="focus-worldbook"
                    :show-open-state-arrow="true"
                    :set-picker-element="setWorldbookPickerElement"
                    :show-tag-filter="tagDefinitions.length > 0"
                    :tag-filter-panel-open="tagFilterPanelOpen"
                    :tag-filter-summary="tagFilterSummary"
                    v-model:tag-filter-logic="tagFilterLogic"
                    v-model:tag-filter-match-mode="tagFilterMatchMode"
                    :selected-tag-filter-ids="selectedTagFilterIds"
                    :selected-tag-filter-id-set="selectedTagFilterIdSet"
                    v-model:tag-filter-search-text="tagFilterSearchText"
                    :tag-assign-options="tagAssignOptions"
                    :tag-tree-rows="tagTreeRows"
                    :tag-tree-expanded-ids="tagTreeExpandedIds"
                    :tag-path-map="tagPathMap"
                    :is-mobile="isMobile"
                    @toggle="toggleWorldbookPicker"
                    @select="selectWorldbookFromPicker"
                    @toggle-tag-filter-panel="tagFilterPanelOpen = !tagFilterPanelOpen"
                    @clear-tag-filter-selection="clearTagFilterSelection"
                    @toggle-tag-filter-selection="toggleTagFilterSelection"
                    @toggle-tag-tree-expanded="toggleTagTreeExpanded"
                  />
                </label>
                <button class="btn" data-focus-hero="save_btn" data-copy-hero="save_btn" type="button" :class="{ 'glow-pulse': hasUnsavedChanges }" :disabled="!hasUnsavedChanges || isAnyCineLocked" @click="saveCurrentWorldbook">
                  {{ isFocusToolbarCompact ? '💾' : '💾 保存' }}
                </button>
                <button class="btn utility-btn" data-focus-hero="focus_toggle" data-copy-hero="focus_toggle" type="button" :class="{ active: isDesktopFocusMode }" :disabled="isAnyCineLocked" @click="toggleFocusEditing">
                  {{ isFocusToolbarCompact ? '🎯' : '🎯 专注开关' }}
                </button>
                <div ref="focusWorldbookMenuRef" class="focus-menu-wrap">
                  <button class="btn utility-btn" data-focus-hero="more_btn" data-copy-hero="more_btn" type="button" :disabled="isAnyCineLocked" @click="toggleFocusWorldbookMenu">
                    {{ isFocusToolbarCompact ? '⋯' : '更多' }}
                  </button>
                  <div class="focus-cine-sink-cluster menu" aria-hidden="true">
                    <span class="focus-cine-sink" data-focus-sink="wb_new"></span>
                    <span class="focus-cine-sink" data-focus-sink="wb_duplicate"></span>
                    <span class="focus-cine-sink" data-focus-sink="wb_delete"></span>
                    <span class="focus-cine-sink" data-focus-sink="wb_export"></span>
                    <span class="focus-cine-sink" data-focus-sink="wb_import"></span>
                  </div>
                  <Transition name="focus-menu-pop">
                    <div v-if="focusWorldbookMenuOpen" class="focus-menu-panel">
                      <button class="btn mini" type="button" @click="runFocusWorldbookAction('create')">新建</button>
                      <button class="btn mini" type="button" :disabled="!selectedWorldbookName" @click="runFocusWorldbookAction('duplicate')">另存为</button>
                      <button class="btn mini danger" type="button" :disabled="!selectedWorldbookName" @click="runFocusWorldbookAction('delete')">删除</button>
                      <button class="btn mini" type="button" @click="runFocusWorldbookAction('import')">导入</button>
                      <button class="btn mini" type="button" :disabled="!selectedWorldbookName" @click="runFocusWorldbookAction('export')">导出</button>
                    </div>
                  </Transition>
                </div>
              </div>
              <div class="wb-focus-tool-entry">
                <button
                  class="btn history-btn utility-btn focus-search-btn"
                  data-focus-hero="find_btn"
                  data-copy-hero="find_btn"
                  type="button"
                  :class="{ active: floatingPanels.find.visible }"
                  :disabled="!draftEntries.length || isAnyCineLocked"
                  @click="toggleFloatingPanel('find')"
                >
                  {{ isFocusToolbarCompact ? '🔎' : '🔎 查找替换' }}
                </button>
                <Transition name="focus-tools-trigger">
                  <button v-if="focusToolsTriggerVisible" class="btn history-btn utility-btn" data-focus-hero="tools_btn" data-copy-hero="tools_btn" type="button" :disabled="focusToolsExpanded || isAnyCineLocked" @click="openFocusToolsBand">
                    {{ isFocusToolbarCompact ? '工具' : '更多工具' }}
                  </button>
                </Transition>
                <div class="focus-cine-sink-cluster tools" aria-hidden="true">
                  <span class="focus-cine-sink" data-focus-sink="tool_global"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_entry_history"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_worldbook_history"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_activation"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_ai_generate"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_extract"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_tag"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_copy"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_settings"></span>
                  <span class="focus-cine-sink" data-focus-sink="tool_ai_config"></span>
                </div>
              </div>
            </div>
            <Transition name="focus-tools-band" @after-leave="onFocusToolsBandAfterLeave">
              <div v-if="focusToolsExpanded" class="wb-focus-tools-band">
                <button class="btn history-btn utility-btn" data-focus-hero="tool_global" data-copy-hero="tool_global" type="button" :class="{ active: globalWorldbookMode }" @click="toggleGlobalMode">🌐 全局模式</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_entry_history" data-copy-hero="tool_entry_history" type="button" :disabled="!selectedEntry" @click="openEntryHistoryModal">🕰️ 条目时光机</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_worldbook_history" data-copy-hero="tool_worldbook_history" type="button" :disabled="!selectedWorldbookName" @click="openWorldbookHistoryModal">⏪ 整本时光机</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_activation" data-copy-hero="tool_activation" type="button" :class="{ active: floatingPanels.activation.visible }" @click="toggleFloatingPanel('activation')">📡 激活监控</button>
                <button v-if="persistedState.show_ai_chat" class="btn history-btn utility-btn" data-focus-hero="tool_ai_generate" data-copy-hero="tool_ai_generate" type="button" :class="{ active: aiGeneratorMode }" @click="aiToggleMode">🤖 AI 生成</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_extract" data-copy-hero="tool_extract" type="button" @click="extractFromChat">📥 从聊天提取</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_tag" data-copy-hero="tool_tag" type="button" :class="{ active: tagEditorMode }" @click="tagToggleMode">🏷️ 标签管理</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_copy" data-copy-hero="tool_copy" type="button" :class="{ active: crossCopyMode }" :disabled="isAnyCineLocked" @click="toggleCrossCopyMode">📚 跨书复制</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_settings" data-copy-hero="tool_settings" type="button" @click="showApiSettings = true">⚙️ 设置</button>
                <button class="btn history-btn utility-btn" data-focus-hero="tool_ai_config" data-copy-hero="tool_ai_config" type="button" @click="openAiConfigModal">🔧 AI配置</button>
                <button class="btn history-btn utility-btn focus-tools-collapse" type="button" @click="closeFocusToolsBand">收起工具</button>
              </div>
            </Transition>
          </section>

          <input
            ref="importFileInput"
            class="hidden-input"
            type="file"
            accept=".json,application/json"
            @change="onImportChange"
          />

          <div class="wb-scroll-area" :class="{ 'copy-workspace': crossCopyMode && !isMobile }">
          <section
            v-if="!isDesktopFocusMode || globalWorldbookMode"
            class="wb-bindings"
            :class="{
              'focus-bindings': isDesktopFocusMode,
              'copy-workspace': crossCopyMode && !globalWorldbookMode && !isDesktopFocusMode,
            }"
          >
            <DesktopToolbarBindings
              :is-desktop-focus-mode="isDesktopFocusMode"
              :cross-copy-mode="crossCopyMode"
              :cross-copy-workspace-summary="crossCopyWorkspaceSummary"
              :cross-copy-workspace-compared-text="crossCopyWorkspaceComparedText"
              :is-any-cine-locked="isAnyCineLocked"
              :cross-copy-workspace-tools-expanded="crossCopyWorkspaceToolsExpanded"
              :global-worldbook-mode="globalWorldbookMode"
              :has-selected-entry="!!selectedEntry"
              :has-selected-worldbook="!!selectedWorldbookName"
              :has-draft-entries="!!draftEntries.length"
              :find-panel-visible="floatingPanels.find.visible"
              :activation-panel-visible="floatingPanels.activation.visible"
              :show-ai-chat="persistedState.show_ai_chat"
              :ai-generator-mode="aiGeneratorMode"
              :tag-editor-mode="tagEditorMode"
              @toggle-cross-copy-workspace-tools="toggleCrossCopyWorkspaceTools"
              @toggle-cross-copy-mode="toggleCrossCopyMode"
              @toggle-focus-editing="toggleFocusEditing"
              @toggle-global-mode="toggleGlobalMode"
              @open-entry-history-modal="openEntryHistoryModal"
              @open-worldbook-history-modal="openWorldbookHistoryModal"
              @toggle-find-panel="toggleFloatingPanel('find')"
              @toggle-activation-panel="toggleFloatingPanel('activation')"
              @toggle-ai-generator="aiToggleMode"
              @extract-from-chat="extractFromChat"
              @toggle-tag-editor="tagToggleMode"
              @open-settings="showApiSettings = true"
              @open-ai-config="openAiConfigModal"
            />
            <GlobalModeDesktopPanel
              v-if="globalWorldbookMode"
              :bindings-global="bindings.global"
              :selected-worldbook-name="selectedWorldbookName"
              v-model:selected-global-preset-id="selectedGlobalPresetId"
              :global-worldbook-presets="globalWorldbookPresets"
              :selected-global-preset="selectedGlobalPreset"
              :current-role-context="currentRoleContext"
              :is-current-role-bound-to-selected-preset="isCurrentRoleBoundToSelectedPreset"
              :role-picker-open="rolePickerOpen"
              v-model:role-bind-search-text="roleBindSearchText"
              :role-binding-candidates="roleBindingCandidates"
              :selected-global-preset-role-bindings="selectedGlobalPresetRoleBindings"
              :is-global-bound="isGlobalBound"
              :set-role-picker-element="setRolePickerElement"
              :set-role-picker-search-input-element="setRolePickerSearchInputElement"
              v-model:global-add-search-text="globalAddSearchText"
              :global-add-candidates="globalAddCandidates"
              v-model:global-filter-text="globalFilterText"
              :filtered-global-worldbooks="filteredGlobalWorldbooks"
              @clear-global-worldbooks="clearGlobalWorldbooks"
              @global-preset-selection-changed="onGlobalPresetSelectionChanged"
              @save-current-as-global-preset="saveCurrentAsGlobalPreset"
              @overwrite-selected-global-preset="overwriteSelectedGlobalPreset"
              @delete-selected-global-preset="deleteSelectedGlobalPreset"
              @bind-current-role-to-selected-preset="bindCurrentRoleToSelectedPreset"
              @unbind-current-role-from-selected-preset="unbindCurrentRoleFromSelectedPreset"
              @toggle-role-picker="toggleRolePicker"
              @bind-first-role-candidate="bindFirstRoleCandidate"
              @bind-role-candidate-to-selected-preset="bindRoleCandidateToSelectedPreset"
              @remove-role-binding-from-selected-preset="removeRoleBindingFromSelectedPreset"
              @add-first-global-candidate="addFirstGlobalCandidate"
              @add-global-worldbook="addGlobalWorldbook"
              @remove-global-worldbook="removeGlobalWorldbook"
              @toggle-global-binding="toggleGlobalBinding"
            />
          </section>

          <!-- ═══ AI Generator Panel ═══ -->
          <AIGeneratorPanel
            v-if="aiGeneratorMode"
            :sessions="aiSessions"
            :active-session="aiActiveSession"
            :active-messages="aiActiveMessages"
            :is-generating="aiIsGenerating"
            :streaming-text="aiStreamingText"
            v-model:chat-input-text="aiChatInputText"
            v-model:use-context="aiUseContext"
            :set-chat-messages-element="setAiChatMessagesElement"
            @create-session="aiCreateSession"
            @delete-session="aiDeleteSession"
            @switch-session="aiSwitchSession"
            @send-message="aiSendMessage"
            @stop-generation="aiStopGeneration"
          />

          <!-- 标签编辑模式 -->
          <TagEditorDesktopPanel
            v-if="tagEditorMode"
            :tag-definitions="tagDefinitions"
            v-model:tag-new-name="tagNewName"
            v-model:tag-new-parent-id="tagNewParentId"
            :tag-assign-options="tagAssignOptions"
            :tag-management-rows="tagManagementRows"
            :tag-definition-map="tagDefinitionMap"
            :tag-colors="TAG_COLORS"
            :is-tag-parent-option-disabled="isTagParentOptionDisabled"
            v-model:tag-assign-target-id="tagAssignTargetId"
            v-model:tag-assign-search="tagAssignSearch"
            :tag-assign-worldbooks="tagAssignWorldbooks"
            :tag-assignments="tagAssignments"
            :get-worldbook-tag-path-summary="getWorldbookTagPathSummary"
            @tag-create="tagCreate"
            @tag-reset-all="tagResetAll"
            @tag-rename="tagRename"
            @tag-set-parent="tagSetParent"
            @tag-set-color="tagSetColor"
            @tag-delete="tagDelete"
            @tag-toggle-assignment-for-selected-tag="tagToggleAssignmentForSelectedTag"
          />

          <CrossCopyDesktopPanel
            v-if="crossCopyMode"
            :is-any-cine-locked="isAnyCineLocked"
            :workspace-summary="crossCopyWorkspaceSummary"
            :workspace-compared-text="crossCopyWorkspaceComparedText"
            :controls-collapsed="crossCopyControlsCollapsed"
            :can-compare="crossCopyCanCompare"
            :compare-loading="crossCopyCompareLoading"
            :apply-loading="crossCopyApplyLoading"
            v-model:source-worldbook="crossCopySourceWorldbook"
            v-model:target-worldbook="crossCopyTargetWorldbook"
            :worldbook-names="worldbookNames"
            v-model:use-draft-source-when-current="crossCopyUseDraftSourceWhenCurrent"
            :source-is-current-worldbook="crossCopySourceIsCurrentWorldbook"
            :source-version-label="crossCopySourceVersionLabel"
            v-model:snapshot-before-apply="crossCopySnapshotBeforeApply"
            :source-target-invalid="crossCopySourceTargetInvalid"
            :compare-summary="crossCopyCompareSummary"
            :last-result-summary="crossCopyLastResultSummary"
            :set-grid-element="setCrossCopyGridElement"
            :desktop-single-column="crossCopyDesktopSingleColumn"
            :cross-copy-grid-style="crossCopyGridStyle"
            :rows="crossCopyRows"
            v-model:search-text="crossCopySearchText"
            :source-rows-filtered="crossCopySourceRowsFiltered"
            :rows-filtered="crossCopyRowsFiltered"
            :selected-count="crossCopySelectedCount"
            v-model:status-filter="crossCopyStatusFilter"
            :status-counts="crossCopyStatusCounts"
            v-model:bulk-action="crossCopyBulkAction"
            :can-apply="crossCopyCanApply"
            :pane-resize-state="crossCopyPaneResizeState"
            :status-priority="CROSS_COPY_STATUS_PRIORITY"
            :get-status-label="getCrossCopyStatusLabel"
            :get-action-label="getCrossCopyActionLabel"
            :get-status-badge-class="getCrossCopyStatusBadgeClass"
            :get-row-diff-summary="getCrossCopyRowDiffSummary"
            @toggle-controls-collapsed="toggleCrossCopyControlsCollapsed"
            @toggle-mode="toggleCrossCopyMode"
            @refresh-comparison="refreshCrossCopyComparison"
            @start-pane-resize="startCrossCopyPaneResize"
            @set-selection-for-filtered="setCrossCopySelectionForFiltered"
            @set-selection-for-all="setCrossCopySelectionForAll"
            @row-action-change="onCrossCopyRowActionChange"
            @row-rename-blur="onCrossCopyRowRenameBlur"
            @open-diff="openCrossCopyDiff"
            @apply-action-by-status="applyCrossCopyActionByStatus"
            @apply-bulk-action="applyCrossCopyBulkAction"
            @apply-selection="applyCrossCopySelection"
          />

          <section v-show="!aiGeneratorMode && !tagEditorMode && !crossCopyMode" ref="mainLayoutRef" class="wb-main-layout" :class="{ 'focus-mode': isDesktopFocusMode, 'global-mode-visible': globalWorldbookMode }" :style="mainLayoutStyle">
            <EntryListSidebar
              :show-mobile-editor="showMobileEditor"
              :is-desktop-focus-mode="isDesktopFocusMode"
              v-model:search-text="searchText"
              v-model:only-enabled="onlyEnabled"
              :filtered-entries="filteredEntries"
              :draft-entries-count="draftEntries.length"
              :enabled-entry-count="enabledEntryCount"
              :selected-entry-count="selectedEntryCount"
              :view-sort-active="viewSortActive"
              :multi-edit-enabled="multiEditEnabled"
              :multi-edit-hint-text="multiEditHintText"
              :is-mobile="isMobile"
              :selected-entry-uid-set="selectedEntryUidSet"
              :selected-entry-uid="selectedEntryUid"
              :dragging-entry-uids="draggingEntryUids"
              :entry-drop-target-uid="entryDropTargetUid"
              :entry-drop-position="entryDropPosition"
              :selected-worldbook-name="selectedWorldbookName"
              :has-selected-entry="!!selectedEntry"
              :get-entry-visual-status="getEntryVisualStatus"
              :get-entry-status-label="getEntryStatusLabel"
              :get-entry-key-preview="getEntryKeyPreview"
              @sort-entries="sortEntries"
              @select-entry="selectEntry"
              @entry-drag-start="handleEntryDragStart"
              @entry-drag-over="handleEntryDragOver"
              @entry-drop="handleEntryDrop"
              @entry-drag-end="handleEntryDragEnd"
              @add-entry="addEntry"
              @duplicate-selected-entry="duplicateSelectedEntry"
              @remove-selected-entry="removeSelectedEntry"
              @move-selected-entry="moveSelectedEntry"
            />
            <div
              v-show="!isMobile"
              class="wb-resize-handle main"
              :class="{ dragging: paneResizeState?.key === 'main' }"
              @pointerdown="startPaneResize('main', $event)"
            ></div>

            <EditorMainPanel
              :is-mobile="isMobile"
              :show-mobile-editor="showMobileEditor"
              :selected-entry="selectedEntry"
              :editor-shell-style="editorShellStyle"
              :is-desktop-focus-mode="isDesktopFocusMode"
              :focus-meta-panel="focusMetaPanel"
              :focus-comment-summary="focusCommentSummary"
              :focus-keyword-summary="focusKeywordSummary"
              :selected-content-chars="selectedContentChars"
              :selected-token-estimate="selectedTokenEstimate"
              :get-entry-visual-status="getEntryVisualStatus"
              :get-entry-status-label="getEntryStatusLabel"
              v-model:selected-keys-raw="selectedKeysRaw"
              v-model:selected-secondary-keys-raw="selectedSecondaryKeysRaw"
              v-model:selected-extra-text="selectedExtraText"
              :pane-resize-state="paneResizeState"
              :focus-side-panel-state="focusSidePanelState"
              :focus-strategy-summary="focusStrategySummary"
              :focus-insertion-summary="focusInsertionSummary"
              :focus-recursion-summary="focusRecursionSummary"
              :secondary-logic-options="secondaryLogicOptions"
              :get-secondary-logic-label="getSecondaryLogicLabel"
              v-model:selected-scan-depth-text="selectedScanDepthText"
              :position-select-options="positionSelectOptions"
              v-model:selected-position-select-value="selectedPositionSelectValue"
              v-model:selected-recursion-delay-text="selectedRecursionDelayText"
              v-model:selected-sticky-text="selectedStickyText"
              v-model:selected-cooldown-text="selectedCooldownText"
              v-model:selected-effect-delay-text="selectedEffectDelayText"
              :set-editor-shell-element="setEditorShellElement"
              :set-content-textarea-element="setContentTextareaElement"
              @go-back-to-list="goBackToList"
              @toggle-focus-meta-panel="toggleFocusMetaPanel"
              @commit-keys-from-raw="commitKeysFromRaw"
              @commit-secondary-keys-from-raw="commitSecondaryKeysFromRaw"
              @start-content-resize="startContentResize"
              @apply-extra-json="applyExtraJson"
              @clear-extra="clearExtra"
              @start-editor-pane-resize="startPaneResize('editor', $event)"
              @toggle-focus-side-panel="toggleFocusSidePanel"
            />
          </section>
          </div>

          <footer class="wb-status" :class="{ 'has-unsaved': hasUnsavedChanges }">
            <span>{{ isBusy ? '加载中...' : statusMessage }}</span>
            <span>
              当前条目: {{ draftEntries.length }} | 内容字符: {{ totalContentChars }} |
              {{ hasUnsavedChanges ? '存在未保存修改' : '已同步' }}
            </span>
          </footer>
    </template>
    <!-- ═══ End Desktop Layout ═══ -->

    <div
      v-if="focusCinePhase !== 'idle'"
      ref="focusCineOverlayRef"
      class="focus-cine-overlay"
      aria-hidden="true"
    ></div>
    <div
      v-if="copyCinePhase !== 'idle'"
      ref="copyCineOverlayRef"
      class="copy-cine-overlay"
      aria-hidden="true"
    ></div>

    <!-- ═══ Shared Modals (both mobile & desktop) ═══ -->
    <SettingsModal
      v-if="showApiSettings"
      :persisted-state="persistedState"
      :fab-visible="fabVisible"
      :floor-btn-visible="floorBtnVisible"
      :current-theme="currentTheme"
      :theme-options="themeOptions"
      :api-model-list="apiModelList"
      :api-model-loading="apiModelLoading"
      @close="showApiSettings = false"
      @set-fab-visible="setFabVisible"
      @toggle-floor-btns="toggleFloorBtns"
      @update-field="onSettingsUpdateField"
      @set-tag-delete-parent-mode="setTagDeleteParentMode"
      @set-theme="setTheme($event as ThemeKey)"
      @update-api-config="updateApiConfig"
      @load-model-list="loadModelList"
    />

    <AIConfigModals
      :worldbook-names="worldbookNames"
      v-model:target-worldbook="aiConfigTargetWorldbook"
      v-model:preview="aiConfigPreview"
      :generating="aiConfigGenerating"
      v-model:input-text="aiConfigInput"
      :changes="aiConfigChanges"
      v-model:custom-prompt="aiConfigCustomPrompt"
      @load-default-prompt="loadDefaultConfigPrompt"
      @generate="aiConfigGenerate"
      @apply="aiConfigApply"
    />

    <AITagReviewModal
      v-model:visible="aiShowTagReview"
      v-model:target-worldbook="aiTargetWorldbook"
      :worldbook-names="worldbookNames"
      :extracted-tags="aiExtractedTags"
      :ignore-tags="persistedState.extract_ignore_tags"
      @mark-duplicates="markDuplicatesInTags"
      @update-ignore-tags="updateIgnoreTags"
      @reset-ignore-tags="resetIgnoreTags"
      @create-selected-entries="aiCreateSelectedEntries"
    />

          <CrossCopyDiffModal
            :visible="showCrossCopyDiffModal"
            :row="crossCopyDiffRow"
            :header-text="crossCopyDiffHeaderText"
            :diff-summary="crossCopyDiffSummary"
            :content-diff-summary="crossCopyContentDiffSummary"
            :target-entry="crossCopyDiffTargetEntry"
            :field-diff-rows="crossCopyFieldDiffRows"
            :content-diff="crossCopyContentDiff"
            :get-status-badge-class="getCrossCopyStatusBadgeClass"
            :get-status-label="getCrossCopyStatusLabel"
            :get-entry-profile="getCrossCopyEntryProfile"
            :get-preview-text="getCrossCopyPreviewText"
            @close="closeCrossCopyDiff"
          />

          <EntryHistoryModal
            v-model:visible="showEntryHistoryModal"
            v-model:entry-history-left-id="entryHistoryLeftId"
            v-model:entry-history-right-id="entryHistoryRightId"
            :entry-history-summary="entryHistorySummary"
            :has-selected-entry="!!selectedEntry"
            :has-entry-snapshots="!!entrySnapshotsForSelected.length"
            :entry-version-views="entryVersionViews"
            :selected-entry-history-left="selectedEntryHistoryLeft"
            :selected-entry-history-right="selectedEntryHistoryRight"
            :can-restore-entry-from-left="canRestoreEntryFromLeft"
            :can-resize-history-sections="canResizeHistorySections"
            :set-layout-element="setEntryHistoryLayoutElement"
            :entry-history-field-diff-rows="entryHistoryFieldDiffRows"
            :entry-history-field-diff-summary="entryHistoryFieldDiffSummary"
            :entry-history-content-diff="entryHistoryContentDiff"
            :entry-history-content-diff-summary="entryHistoryContentDiffSummary"
            :format-history-option-label="formatHistoryOptionLabel"
            :get-history-section-style="sectionIndex => getHistorySectionStyle('entry', sectionIndex)"
            :get-cross-copy-entry-profile="getCrossCopyEntryProfile"
            :get-entry-version-preview="getEntryVersionPreview"
            @create-manual-entry-snapshot="createManualEntrySnapshot"
            @clear-current-entry-snapshots="clearCurrentEntrySnapshots"
            @restore-entry-from-left-history="restoreEntryFromLeftHistory"
            @start-history-section-resize="(handleIndex, event) => startHistorySectionResize('entry', handleIndex, event)"
          />

          <WorldbookHistoryModal
            v-model:visible="showWorldbookHistoryModal"
            v-model:worldbook-history-left-id="worldbookHistoryLeftId"
            v-model:worldbook-history-right-id="worldbookHistoryRightId"
            v-model:worldbook-history-active-row-key="worldbookHistoryActiveRowKey"
            :worldbook-version-diff-summary="getWorldbookVersionDiffSummary(selectedWorldbookHistoryLeft, selectedWorldbookHistoryRight)"
            :has-selected-worldbook="!!selectedWorldbookName"
            :has-snapshots="!!snapshotsForCurrent.length"
            :worldbook-version-views="worldbookVersionViews"
            :selected-worldbook-history-left="selectedWorldbookHistoryLeft"
            :selected-worldbook-history-right="selectedWorldbookHistoryRight"
            :can-restore-worldbook-from-left="canRestoreWorldbookFromLeft"
            :worldbook-history-compare-rows="worldbookHistoryCompareRows"
            :worldbook-history-compare-summary="worldbookHistoryCompareSummary"
            :worldbook-history-active-row="worldbookHistoryActiveRow"
            :can-resize-history-sections="canResizeHistorySections"
            :set-layout-element="setWorldbookHistoryLayoutElement"
            :worldbook-history-field-diff-rows="worldbookHistoryFieldDiffRows"
            :worldbook-history-field-diff-summary="worldbookHistoryFieldDiffSummary"
            :worldbook-history-content-diff="worldbookHistoryContentDiff"
            :worldbook-history-content-diff-summary="worldbookHistoryContentDiffSummary"
            :format-history-option-label="formatHistoryOptionLabel"
            :get-history-section-style="sectionIndex => getHistorySectionStyle('worldbook', sectionIndex)"
            :get-cross-copy-entry-profile="getCrossCopyEntryProfile"
            :get-cross-copy-preview-text="getCrossCopyPreviewText"
            :get-worldbook-history-version-preview="getWorldbookHistoryVersionPreview"
            :get-worldbook-history-status-label="getWorldbookHistoryStatusLabel"
            :get-worldbook-history-status-badge-class="getWorldbookHistoryStatusBadgeClass"
            @create-manual-snapshot="createManualSnapshot"
            @clear-current-snapshots="clearCurrentSnapshots"
            @restore-worldbook-from-left-history="restoreWorldbookFromLeftHistory"
            @start-history-section-resize="(handleIndex, event) => startHistorySectionResize('worldbook', handleIndex, event)"
          />



          <FloatingFindWindow
            v-if="floatingPanels.find.visible"
            v-model:batch-find-text="batchFindText"
            v-model:batch-replace-text="batchReplaceText"
            v-model:batch-exclude-text="batchExcludeText"
            v-model:batch-use-regex="batchUseRegex"
            v-model:batch-in-name="batchInName"
            v-model:batch-in-content="batchInContent"
            v-model:batch-in-keys="batchInKeys"
            v-model:batch-search-scope="batchSearchScope"
            :panel-style="getFloatingPanelStyle('find')"
            :has-entries="!!draftEntries.length"
            :has-selected-entry="!!selectedEntry"
            :find-hit-summary-text="findHitSummaryText"
            :active-find-hit="activeFindHit"
            :batch-exclude-tokens-preview="batchExcludeTokensPreview"
            :get-find-field-label="getFindFieldLabel"
            @bring-to-front="bringFloatingToFront('find')"
            @start-drag="startFloatingDrag('find', $event)"
            @find-first="findFirstMatch"
            @find-previous="findPreviousMatch"
            @find-next="findNextMatch"
            @replace-all="applyBatchReplace"
            @close="closeFloatingPanel('find')"
            @normalize-all-entries="normalizeAllEntries"
            @sort-entries-by-order-desc="sortEntriesByOrderDesc"
            @set-enabled-for-all="setEnabledForAll"
          />

          <FloatingActivationWindow
            v-if="floatingPanels.activation.visible"
            :panel-style="getFloatingPanelStyle('activation')"
            :activation-logs="activationLogs"
            :format-date-time="formatDateTime"
            @bring-to-front="bringFloatingToFront('activation')"
            @start-drag="startFloatingDrag('activation', $event)"
            @clear="clearActivationLogs"
            @close="closeFloatingPanel('activation')"
          />
    </template><!-- end editor mode -->
  </div>
</template>

<script setup lang="ts">
import { klona } from 'klona';
import { useFindReplace, useMultiEdit, useAIChat, useAIConfig, useTagSystem, useGlobalWorldbooks, useHistorySnapshots, useFocusMode, useEditorLayout, useCrossCopy, useUIPickerThemeHandlers, useWorldbookModeActions, useWorldbookFileOps, useWorldbookDataFlow } from './composables';
import FloatingFindWindow from './components/FloatingFindWindow.vue';
import FloatingActivationWindow from './components/FloatingActivationWindow.vue';
import EntryHistoryModal from './components/EntryHistoryModal.vue';
import WorldbookHistoryModal from './components/WorldbookHistoryModal.vue';
import CrossCopyMobilePanel from './components/CrossCopyMobilePanel.vue';
import CrossCopyDesktopPanel from './components/CrossCopyDesktopPanel.vue';
import CrossCopyDiffModal from './components/CrossCopyDiffModal.vue';
import AIConfigModals from './components/AIConfigModals.vue';
import AITagReviewModal from './components/AITagReviewModal.vue';
import GlobalModeBrowsePanel from './components/GlobalModeBrowsePanel.vue';
import AIGeneratorPanel from './components/AIGeneratorPanel.vue';
import SettingsModal from './components/SettingsModal.vue';
import WorldbookPicker from './components/WorldbookPicker.vue';
import GlobalModeMobilePanel from './components/GlobalModeMobilePanel.vue';
import DesktopToolbarBindings from './components/DesktopToolbarBindings.vue';
import GlobalModeDesktopPanel from './components/GlobalModeDesktopPanel.vue';
import TagEditorMobilePanel from './components/TagEditorMobilePanel.vue';
import TagEditorDesktopPanel from './components/TagEditorDesktopPanel.vue';
import EntryListSidebar from './components/EntryListSidebar.vue';
import EditorMainPanel from './components/EditorMainPanel.vue';
import './components/browseModeShared.css';
import './components/appShellShared.css';
import './components/crossCopyShared.css';
import './components/globalModeDesktopShared.css';
import './components/tagEditorShared.css';
import './components/aiChatShared.css';
import './components/settingsModalShared.css';
import './components/entryListSidebarShared.css';
import './components/editorMainPanelShared.css';
import './components/worldbookPickerShared.css';
import './components/mobileTabShared.css';
import './components/mobileRootOverride.css';
import {
  createId,
  asRecord,
  toStringSafe,
  parseNullableInteger,
  nullableNumberToText,
  stringifyKeyword,
  parseKeywordsFromText,
  formatDateTime,
  getSecondaryLogicLabel,
  getPositionTypeLabel,
  getEntryVisualStatus,
  getEntryStatusLabel,
  getEntryKeyPreview,
  secondaryLogicOptions,
  normalizeScanDepth,
  createDefaultEntry,
  normalizeEntry,
  normalizeEntryList,
  getNextUid,
  compareEntriesByPositionThenOrder,
  type PositionType,
  type RoleType,
} from './utils';
import { DEFAULT_THEME_KEY, THEMES, isThemeKey, type ThemeKey } from './themes';
import {
  getWorldbookHistoryVersionPreview,
  getWorldbookHistoryStatusLabel,
  getWorldbookHistoryStatusBadgeClass,
  getWorldbookVersionDiffSummary,
} from './diffUtils';
import {
  createDefaultPersistedState,
  normalizePersistedState,
  TAG_COLORS,
  STORAGE_KEY,
  MAIN_PANE_MIN,
  FOCUS_MAIN_PANE_MIN,
  EDITOR_SIDE_MIN,
  FOCUS_EDITOR_SIDE_MIN,
} from './store/persistedState';
import type {
  PositionSelectValue,
  SelectionSource,
  CrossCopyRowStatus,
  WorldbookSwitchOptions,
  HardRefreshOptions,
  EntryVersionView,
  RoleBindingCandidate,
  PersistedState,
  ActivationLog,
  EventSubscription,
  MobileEntryLongPressState,
} from './types';


const DIRTY_STATE_KEY = '__WB_ASSISTANT_HAS_UNSAVED_CHANGES__';
const ACTIVATION_LOG_LIMIT = 120;
const RESIZE_HANDLE_SIZE = 10;
const MAIN_EDITOR_MIN = 540;
const EDITOR_CENTER_MIN = 420;
const CROSS_COPY_STATUS_PRIORITY: CrossCopyRowStatus[] = [
  'same_name_changed',
  'content_duplicate_other_name',
  'duplicate_exact',
  'new',
  'invalid_same_source_target',
];
const CROSS_COPY_SPLITTER_SIZE = 8;
const ENTRIES_DIGEST_DEBOUNCE_MS = 120;
const MOBILE_MULTI_LONG_PRESS_MS = 420;
const MOBILE_MULTI_LONG_PRESS_MOVE_PX = 12;

const worldbookNames = ref<string[]>([]);
const selectedWorldbookName = ref('');
const worldbookPickerOpen = ref(false);
const worldbookPickerSearchText = ref('');
const worldbookPickerRef = ref<HTMLElement | null>(null);
const roleBindSearchText = ref('');
const focusWorldbookMenuRef = ref<HTMLElement | null>(null);
const rolePickerRef = ref<HTMLElement | null>(null);
const rolePickerSearchInputRef = ref<HTMLInputElement | null>(null);
const currentTheme = ref<ThemeKey>('ocean');
const themePickerOpen = ref(false);
const positionSelectOptions: Array<{
  value: PositionSelectValue;
  type: PositionType;
  role?: RoleType;
  label: string;
}> = [
  { value: 'before_character_definition', type: 'before_character_definition', label: '角色定义之前' },
  { value: 'after_character_definition', type: 'after_character_definition', label: '角色定义之后' },
  { value: 'before_example_messages', type: 'before_example_messages', label: '示例消息前（↑EM）' },
  { value: 'after_example_messages', type: 'after_example_messages', label: '示例消息后（↓EM）' },
  { value: 'before_author_note', type: 'before_author_note', label: '作者注释之前' },
  { value: 'after_author_note', type: 'after_author_note', label: '作者注释之后' },
  { value: 'at_depth_as_system', type: 'at_depth', role: 'system', label: '@D ⚙ [系统]在深度' },
  { value: 'at_depth_as_user', type: 'at_depth', role: 'user', label: '@D 👤 [用户]在深度' },
  { value: 'at_depth_as_assistant', type: 'at_depth', role: 'assistant', label: '@D 🤖 [AI]在深度' },
];
const aiGeneratorMode = ref(false);
const panelMode = ref<'browse' | 'editor'>('browse');
const expandedBrowseCardUids = ref<Set<number>>(new Set());
const BROWSE_RENDER_BATCH = 30;
const browseRenderLimit = ref(BROWSE_RENDER_BATCH);
const browseLoadMoreSentinelRef = ref<HTMLElement | null>(null);
let _browseIntersectionObserver: IntersectionObserver | null = null;

// Floor extraction button visibility (synced via localStorage + custom event)
const FAB_VISIBLE_KEY = '__WB_FAB_VISIBLE__';
const FAB_VISIBLE_SET_EVENT = 'wb-helper:set-fab-visible';
const FAB_VISIBLE_CHANGED_EVENT = 'wb-helper:fab-visible-changed';
const FLOOR_BTN_KEY = '__WB_FLOOR_BTN_VISIBLE__';
const fabVisible = ref((() => {
  try { return localStorage.getItem(FAB_VISIBLE_KEY) !== 'false'; } catch { return true; }
})());
const floorBtnVisible = ref((() => {
  try { return localStorage.getItem(FLOOR_BTN_KEY) !== 'false'; } catch { return true; }
})());
function setFabVisible(val: boolean): void {
  fabVisible.value = val;
  try { localStorage.setItem(FAB_VISIBLE_KEY, String(val)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(FAB_VISIBLE_SET_EVENT, { detail: val }));
}
function onFabVisibleChanged(event: Event): void {
  const detail = (event as CustomEvent).detail;
  if (typeof detail === 'boolean') {
    fabVisible.value = detail;
    return;
  }
  try {
    fabVisible.value = localStorage.getItem(FAB_VISIBLE_KEY) !== 'false';
  } catch {
    fabVisible.value = true;
  }
}
function toggleFloorBtns(val: boolean): void {
  floorBtnVisible.value = val;
  try { localStorage.setItem(FLOOR_BTN_KEY, String(val)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent('wb-helper:floor-btns-toggle', { detail: val }));
}

const originalEntries = ref<WorldbookEntry[]>([]);
const draftEntries = ref<WorldbookEntry[]>([]);
const selectedEntryUid = ref<number | null>(null);
const selectedEntryUids = ref<number[]>([]);
const selectedEntryAnchorUid = ref<number | null>(null);
const mobileMultiSelectMode = ref(false);
const mobileLongPressState = ref<MobileEntryLongPressState | null>(null);
const mobileSuppressNextTap = ref(false);
const draggingEntryUids = ref<number[]>([]);
const entryDropTargetUid = ref<number | null>(null);
const entryDropPosition = ref<'before' | 'after' | null>(null);
const suppressNextEntryClick = ref(false);
const draftEntriesDigest = ref('[]');
const originalEntriesDigest = ref('[]');

const searchText = ref('');
const onlyEnabled = ref(false);
const importFileInput = ref<HTMLInputElement | null>(null);
const selectedExtraText = ref('');
const selectedKeysRaw = ref('');
const selectedSecondaryKeysRaw = ref('');
let keysDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let secondaryKeysDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let entriesDigestTimer: ReturnType<typeof setTimeout> | null = null;

let _loadWorldbook: (name: string) => Promise<void> = async () => {};
let _reloadWorldbookNames: (preferred?: string, switchOptions?: WorldbookSwitchOptions) => Promise<boolean> = async () => true;
let _hardRefresh: (options?: HardRefreshOptions) => Promise<void> = async () => {};
let _saveCurrentWorldbook: () => Promise<void> = async () => {};

const statusMessage = ref('就绪');
const isBusy = ref(false);
const isSaving = ref(false);
const mainLayoutRef = ref<HTMLElement | null>(null);
const editorShellRef = ref<HTMLElement | null>(null);
const rootRef = ref<HTMLElement | null>(null);
const hostResizeWindow = ref<Window | null>(null);

const screenWidth = ref(typeof window !== 'undefined' ? window.screen.width : 1440);
const screenHeight = ref(typeof window !== 'undefined' ? window.screen.height : 900);

const isMobile = computed(() => screenWidth.value < screenHeight.value);

// Keep screen dimensions in sync on orientation change
let _screenSyncCleanup: (() => void) | null = null;
if (typeof window !== 'undefined') {
  const syncScreenDims = () => {
    screenWidth.value = window.screen.width;
    screenHeight.value = window.screen.height;
  };
  const orientHandler = () => setTimeout(syncScreenDims, 150);
  window.addEventListener('orientationchange', orientHandler);
  window.addEventListener('resize', syncScreenDims);
  _screenSyncCleanup = () => {
    window.removeEventListener('orientationchange', orientHandler);
    window.removeEventListener('resize', syncScreenDims);
  };
}
const showMobileEditor = computed(() => isMobile.value && selectedEntryUid.value !== null);
const mobileTab = ref<'list' | 'edit' | 'settings' | 'copy' | 'ai' | 'tags'>('list');

const bindings = reactive({
  global: [] as string[],
  charPrimary: null as string | null,
  charAdditional: [] as string[],
  chat: null as string | null,
});

const activationLogs = ref<ActivationLog[]>([]);
const persistedState = ref<PersistedState>(createDefaultPersistedState());

const subscriptions: EventSubscription[] = [];

const selectedEntry = computed(() => {
  if (selectedEntryUid.value === null) {
    return null;
  }
  return draftEntries.value.find(entry => entry.uid === selectedEntryUid.value) ?? null;
});

const selectedEntryIndex = computed(() => {
  if (!selectedEntry.value) {
    return -1;
  }
  return draftEntries.value.findIndex(entry => entry.uid === selectedEntry.value?.uid);
});

// ── useFindReplace composable ────────────────────────────────────────
const {
  batchFindText, batchReplaceText, batchExcludeText,
  batchUseRegex, batchInName, batchInContent, batchInKeys,
  batchSearchScope,
  activeFindHit, findHitSummaryText, batchExcludeTokensPreview,
  getFindFieldLabel, findFirstMatch, findNextMatch, findPreviousMatch,
  applyBatchReplace, resetFindState,
} = useFindReplace({
  draftEntries,
  selectedEntry,
  selectedEntryUid,
  editorShellRef,
  setStatus,
});
// ── end useFindReplace ───────────────────────────────────────────────

// ── useAIConfig composable ───────────────────────────────────────────
// (depends on buildCustomApiForGenerate from useAIChat)

// ── useAIChat composable ─────────────────────────────────────────────
const {
  aiIsGenerating, aiCurrentGenerationId, aiStreamingText,
  aiExtractedTags, aiShowTagReview, aiTargetWorldbook,
  aiChatInputText, aiUseContext, aiChatMessagesRef,
  showApiSettings, apiModelList, apiModelLoading,
  aiSessions, aiActiveSession, aiActiveMessages,
  aiCreateSession, aiDeleteSession, aiSwitchSession,
  updateApiConfig, loadModelList, buildCustomApiForGenerate,
  aiSendMessage, aiStopGeneration,
  updateIgnoreTags, resetIgnoreTags,
  markDuplicatesInTags, extractFromChat, aiCreateSelectedEntries,
} = useAIChat({
  persistedState,
  updatePersistedState,
  setStatus,
  selectedWorldbookName,
});
// ── end useAIChat ────────────────────────────────────────────────────
const {
  aiConfigInput, aiConfigChanges, aiConfigPreview,
  aiConfigGenerating, aiConfigTargetWorldbook, aiConfigCustomPrompt,
  loadDefaultConfigPrompt,
  aiConfigGenerate, aiConfigApply,
} = useAIConfig({
  persistedState, buildCustomApiForGenerate, loadWorldbook, setStatus,
});
// ── end useAIConfig ──────────────────────────────────────────────────

// ── useTagSystem composable ──────────────────────────────────────────
const {
  tagEditorMode, tagFilterPanelOpen, tagFilterSearchText,
  tagNewName, tagNewParentId, tagAssignSearch, tagAssignTargetId,
  tagTreeExpandedIds,
  tagDefinitions, tagAssignments,
  selectedTagFilterIds, selectedTagFilterIdSet,
  tagFilterLogic, tagFilterMatchMode,
  tagDefinitionMap, tagRootIds,
  tagPathMap, tagDescendantsMap, tagFilterSummary,
  tagTreeRows, tagManagementRows,
  tagAssignOptions, tagAssignWorldbooks,
  getWorldbookTagPathSummary, toggleTagFilterSelection, clearTagFilterSelection,
  toggleTagTreeExpanded, ensureTagAssignTargetSelected,
  tagSetParent,
  isTagParentOptionDisabled, setTagDeleteParentMode,
  tagCreate, tagDelete, tagRename, tagSetColor,
  tagToggleAssignmentForSelectedTag, tagResetAll,
} = useTagSystem({
  persistedState, updatePersistedState, setStatus, worldbookNames,
});
// ── end useTagSystem ─────────────────────────────────────────────────

// ── useGlobalWorldbooks composable ───────────────────────────────────
let _ensureSelectionForGlobalMode: (options?: WorldbookSwitchOptions) => boolean = () => true;

const {
  globalWorldbookMode, selectedGlobalPresetId,
  currentRoleContext, roleBindingSourceCandidates,
  rolePickerOpen, globalAddSearchText, globalFilterText,
  globalWorldbookPresets, selectedGlobalPreset,
  selectedGlobalPresetRoleBindings, isCurrentRoleBoundToSelectedPreset,
  isGlobalBound, globalAddCandidates, filteredGlobalWorldbooks,
  syncSelectedGlobalPresetFromState,
  addFirstGlobalCandidate, addGlobalWorldbook, removeGlobalWorldbook,
  clearGlobalWorldbooks, toggleGlobalBinding,
  onGlobalPresetSelectionChanged, saveCurrentAsGlobalPreset,
  overwriteSelectedGlobalPreset, deleteSelectedGlobalPreset,
  bindCurrentRoleToSelectedPreset, bindRoleCandidateToSelectedPreset,
  unbindCurrentRoleFromSelectedPreset, removeRoleBindingFromSelectedPreset,
  refreshRoleBindingCandidates, refreshCurrentRoleContext,
  autoApplyRoleBoundPreset, toggleRolePicker, closeRolePicker,
} = useGlobalWorldbooks({
  persistedState, updatePersistedState, setStatus,
  worldbookNames, bindings, refreshBindings, ensureSelectionForGlobalMode: options => _ensureSelectionForGlobalMode(options),
});
// ── end useGlobalWorldbooks ──────────────────────────────────────────

const roleBindingCandidates = computed<RoleBindingCandidate[]>(() => {
  const keyword = roleBindSearchText.value.trim().toLowerCase();
  const boundSet = new Set(selectedGlobalPresetRoleBindings.value.map(item => item.key));
  const list = roleBindingSourceCandidates.value;
  const filtered = keyword
    ? list.filter(item => {
      return (
        item.name.toLowerCase().includes(keyword)
        || item.avatar.toLowerCase().includes(keyword)
        || item.key.toLowerCase().includes(keyword)
      );
    })
    : list;
  return filtered.map(item => ({
    ...item,
    bound: boundSet.has(item.key),
  }));
});

// ── useFocusMode + useEditorLayout (forward refs) ─────────────────────
let _layoutViewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1440);
let _focusClampPaneWidths: () => void = () => {};
let _focusPersistLayoutState: () => void = () => {};
let _setCrossCopyModeActive: (next: boolean) => void = () => {};
const isCompactLayout = computed(() => _layoutViewportWidth.value <= 1100);
const canResizeHistorySections = computed(() => !isMobile.value && _layoutViewportWidth.value > 1380);

// ── useHistorySnapshots ───────────────────────────────────────────────
const {
  showEntryHistoryModal, showWorldbookHistoryModal,
  entryHistoryLeftId, entryHistoryRightId,
  worldbookHistoryLeftId, worldbookHistoryRightId,
  entryHistoryLayoutRef, worldbookHistoryLayoutRef,
  worldbookHistoryActiveRowKey,
  snapshotsForCurrent, entrySnapshotsForSelected,
  entryVersionViews, worldbookVersionViews,
  selectedEntryHistoryLeft, selectedEntryHistoryRight,
  selectedWorldbookHistoryLeft, selectedWorldbookHistoryRight,
  canRestoreEntryFromLeft, canRestoreWorldbookFromLeft,
  entryHistoryFieldDiffRows, entryHistoryContentDiff,
  entryHistoryFieldDiffSummary, entryHistoryContentDiffSummary,
  worldbookHistoryCompareRows, worldbookHistoryCompareSummary,
  worldbookHistoryActiveRow,
  worldbookHistoryFieldDiffRows, worldbookHistoryFieldDiffSummary,
  worldbookHistoryContentDiff, worldbookHistoryContentDiffSummary,
  entryHistorySummary,
  pushSnapshotForWorldbook, pushSnapshot, createManualSnapshot,
  pushEntrySnapshotsBulk,
  collectEntrySnapshotsBeforeSave,
  restoreWorldbookFromLeftHistory, clearCurrentSnapshots,
  restoreEntryFromLeftHistory, clearCurrentEntrySnapshots,
  createManualEntrySnapshot,
  openEntryHistoryModal, openWorldbookHistoryModal,
  getHistorySectionStyle, startHistorySectionResize, stopHistorySectionResize,
} = useHistorySnapshots({
  persistedState, updatePersistedState, setStatus,
  selectedWorldbookName, draftEntries, originalEntries,
  selectedEntry, selectedEntryIndex, selectedEntryUid,
  ensureSelectedEntryExists,
  canResizeHistorySections,
});
// ── end useHistorySnapshots ───────────────────────────────────────────

// ── useMultiEdit composable ──────────────────────────────────────────
const {
  multiEditLastPatch, multiEditApplying,
  multiEditEnabled, multiEditSyncExtraJson, isMultiEditSyncActive,
  multiEditSessionKey, multiEditHintText,
  extractEntryConfigPatch,
  resetMultiEditSessionState, syncSelectedEntryConfigToMultiSelection,
} = useMultiEdit({
  persistedState,
  selectedEntry,
  selectedEntryUids,
  draftEntries,
  isMobile,
  mobileMultiSelectMode,
  setStatus,
  getOrderedSelectedEntryUids,
  pushEntrySnapshotsBulk,
});
// ── end useMultiEdit ─────────────────────────────────────────────────

const {
  isFocusEditing,
  focusWorldbookMenuOpen,
  focusToolsExpanded,
  focusToolsTriggerVisible,
  focusCinePhase,
  focusCineLocked,
  focusCineOverlayRef,
  copyCinePhase,
  copyCineOverlayRef,
  focusMetaPanel,
  focusSidePanelState,
  copyCineEnabled,
  isAnyCineLocked,
  focusCineRootClass,
  focusCommentSummary,
  focusKeywordSummary,
  focusStrategySummary,
  focusInsertionSummary,
  focusRecursionSummary,
  resetFocusPanels,
  toggleFocusMetaPanel,
  toggleFocusSidePanel,
  closeFocusWorldbookMenu,
  toggleFocusWorldbookMenu,
  openFocusToolsBand,
  closeFocusToolsBand,
  onFocusToolsBandAfterLeave,
  toggleFocusEditing,
  runCrossCopyCinematicTransition,
  cleanupAllCineArtifacts,
} = useFocusMode({
  rootRef,
  isMobile,
  viewportWidth: _layoutViewportWidth,
  selectedEntry,
  selectedEffectDelayText: computed(() => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.delay) : '')),
  clampPaneWidths: () => _focusClampPaneWidths(),
  persistLayoutState: () => _focusPersistLayoutState(),
  setCrossCopyModeActive: (next: boolean) => _setCrossCopyModeActive(next),
  getEntryStatusLabel,
  getPositionTypeLabel: (type, role) => getPositionTypeLabel(type as PositionType, role as RoleType),
});
void focusCineOverlayRef;
void copyCineOverlayRef;
const isDesktopFocusMode = computed(() => !isMobile.value && !isCompactLayout.value && isFocusEditing.value);

const {
  viewportWidth,
  mainPaneWidth, editorSideWidth,
  focusMainPaneWidth, focusEditorSideWidth,
  paneResizeState, contentTextareaRef, editorContentBlockRef,
  floatingPanels,
  clampPaneWidths, startPaneResize, startContentResize, startContentTopDrag,
  stopPaneResize,
  applyLayoutStateFromPersisted, persistLayoutState,
  handleFloatingWindowResize, bringFloatingToFront,
  closeFloatingPanel, toggleFloatingPanel,
  startFloatingDrag, stopFloatingDrag, resolveHostWindow,
} = useEditorLayout({
  persistedState, updatePersistedState,
  isCompactLayout,
  isDesktopFocusMode,
  isFocusEditing,
  focusCineLocked: computed(() => focusCineLocked.value),
  mainLayoutRef,
  editorShellRef,
});
_layoutViewportWidth = viewportWidth;
void editorContentBlockRef;

_focusClampPaneWidths = clampPaneWidths;
_focusPersistLayoutState = persistLayoutState;
// ── end useFocusMode + useEditorLayout ───────────────────────────────
function getFloatingPanelStyle(key: 'find' | 'activation'): Record<string, string> {
  const panel = floatingPanels[key];
  return {
    left: `${panel.x}px`,
    top: `${panel.y}px`,
    zIndex: String(panel.z),
    width: `${panel.width}px`,
  };
}



const selectedEntryUidSet = computed(() => new Set(selectedEntryUids.value));
const selectedEntryCount = computed(() => selectedEntryUids.value.length);

function parseAtDepthRoleFromPositionValue(value: unknown): RoleType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const depthMatch = value.match(/^at_depth_as_(system|assistant|user)$/);
  if (!depthMatch) {
    return null;
  }
  return depthMatch[1] as RoleType;
}

function applySelectedPositionSelectValue(value: PositionSelectValue): void {
  if (!selectedEntry.value) {
    return;
  }
  const depthRole = parseAtDepthRoleFromPositionValue(value);
  if (depthRole) {
    selectedEntry.value.position.type = 'at_depth';
    selectedEntry.value.position.role = depthRole;
    selectedEntry.value.position.depth = Math.max(0, Math.floor(Number(selectedEntry.value.position.depth || 0)));
    return;
  }
  selectedEntry.value.position.type = value as PositionType;
  selectedEntry.value.position.role = 'system';
  selectedEntry.value.position.depth = 4;
}

const selectedPositionSelectValue = computed<PositionSelectValue>({
  get() {
    if (!selectedEntry.value) {
      return 'before_character_definition';
    }
    if (selectedEntry.value.position.type === 'at_depth') {
      return `at_depth_as_${selectedEntry.value.position.role}` as PositionSelectValue;
    }
    return selectedEntry.value.position.type;
  },
  set(value) {
    applySelectedPositionSelectValue(value);
  },
});

const viewSortActive = ref(false);

const filteredEntries = computed(() => {
  const keyword = searchText.value.trim().toLowerCase();
  const result = draftEntries.value.filter(entry => {
    if (onlyEnabled.value && !entry.enabled) {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const keysJoined = entry.strategy.keys.map(stringifyKeyword).join(' ').toLowerCase();
    return (
      entry.name.toLowerCase().includes(keyword) ||
      entry.content.toLowerCase().includes(keyword) ||
      keysJoined.includes(keyword)
    );
  });
  if (viewSortActive.value) {
    return [...result].sort(compareEntriesByPositionThenOrder);
  }
  return result;
});

const enabledEntryCount = computed(() => draftEntries.value.filter(entry => entry.enabled).length);

function sortEntries(): void {
  const mode = persistedState.value.sort.mode;
  if (mode === 'view') {
    viewSortActive.value = !viewSortActive.value;
    return;
  }
  // mutate mode
  if (!draftEntries.value.length) return;
  // Save reference to the currently selected entry BEFORE any UID mutation
  const currentSelectedRef = selectedEntry.value;
  draftEntries.value.sort(compareEntriesByPositionThenOrder);
  if (persistedState.value.sort.reassign_uid) {
    for (let i = 0; i < draftEntries.value.length; i++) {
      draftEntries.value[i].uid = i;
    }
    // Re-select using saved reference (since UIDs have changed)
    if (currentSelectedRef) {
      const newUid = currentSelectedRef.uid; // already reassigned above
      selectedEntryUid.value = newUid;
      selectedEntryUids.value = [newUid];
      selectedEntryAnchorUid.value = newUid;
    }
  }
  toastr.success(`已按位置→权重排序 ${draftEntries.value.length} 个条目${persistedState.value.sort.reassign_uid ? '（UID 已重新分配）' : ''}`);
}

const totalContentChars = computed(() =>
  draftEntries.value.reduce((sum, entry) => {
    return sum + entry.content.length;
  }, 0),
);

const hasUnsavedChanges = computed(() => draftEntriesDigest.value !== originalEntriesDigest.value);

const {
  crossCopyMode,
  crossCopySourceWorldbook,
  crossCopyTargetWorldbook,
  crossCopyUseDraftSourceWhenCurrent,
  crossCopySnapshotBeforeApply,
  crossCopyControlsCollapsed,
  crossCopyWorkspaceToolsExpanded,
  crossCopyRows,
  crossCopySourceBaselineEntries,
  crossCopyTargetBaselineEntries,
  crossCopyCompareLoading,
  crossCopyApplyLoading,
  crossCopySearchText,
  crossCopyStatusFilter,
  crossCopyBulkAction,
  crossCopyCompareSummary,
  crossCopyLastResultSummary,
  crossCopyLastComparedAt,
  crossCopyPaneResizeState,
  crossCopyGridRef,
  crossCopyMobileStep,
  showCrossCopyDiffModal,
  crossCopyDesktopLeftWidthClamped,
  crossCopySourceIsCurrentWorldbook,
  crossCopySourceVersionLabel,
  crossCopyHasCompared,
  crossCopyWorkspaceSummary,
  crossCopySourceTargetInvalid,
  crossCopySourceRowsFiltered,
  crossCopyRowsFiltered,
  crossCopyStatusCounts,
  crossCopySelectedCount,
  crossCopyCanCompare,
  crossCopyMobileCanGoStep2,
  crossCopyMobileCanGoStep3,
  crossCopyDiffActiveRow: crossCopyDiffRow,
  crossCopyDiffFieldRows: crossCopyFieldDiffRows,
  crossCopyDiffTextResult: crossCopyContentDiff,
  normalizeCrossCopyWorldbookSelection,
  applyCrossCopyStateFromPersisted,
  persistCrossCopyState,
  getCrossCopyStatusLabel,
  getCrossCopyActionLabel,
  getCrossCopyStatusBadgeClass,
  getCrossCopyEntryProfile,
  getCrossCopyPrimaryTargetMatch,
  getCrossCopyRowDiffSummary,
  getCrossCopyPreviewText,
  refreshCrossCopyComparison,
  setCrossCopySelectionForFiltered,
  setCrossCopySelectionForAll,
  applyCrossCopyBulkAction,
  applyCrossCopyActionByStatus,
  onCrossCopyRowActionChange,
  onCrossCopyRowRenameBlur,
  applyCrossCopySelection,
  openCrossCopyDiff,
  closeCrossCopyDiff,
  toggleCrossCopyWorkspaceTools,
  toggleCrossCopyControlsCollapsed,
  setCrossCopyModeActive: setCrossCopyModeActiveRaw,
  startCrossCopyPaneResize,
  stopCrossCopyPaneResize,
  goToCrossCopyMobileStep,
  goToPreviousCrossCopyMobileStep,
  goToNextCrossCopyMobileStep,
} = useCrossCopy({
  persistedState,
  updatePersistedState,
  setStatus,
  worldbookNames,
  selectedWorldbookName,
  draftEntries,
  hasUnsavedChanges,
  isAnyCineLocked,
  isMobile,
  saveCurrentWorldbook,
  loadWorldbook,
  pushSnapshotForWorldbook,
});

function createRefSetter<T>(target: { value: T }): (value: T) => void {
  return (value: T) => {
    target.value = value;
  };
}

const setWorldbookPickerElement = createRefSetter(worldbookPickerRef);

function openAiConfigModal(): void {
  aiConfigPreview.value = false;
  aiConfigChanges.value = [];
  aiConfigTargetWorldbook.value = selectedWorldbookName.value || '';
}

const setRolePickerElement = createRefSetter(rolePickerRef);

const setAiChatMessagesElement = (element: HTMLElement | null): void => {
  aiChatMessagesRef.value = element as HTMLDivElement | null;
};

const setEditorShellElement = createRefSetter(editorShellRef);

const setContentTextareaElement = createRefSetter(contentTextareaRef);

const settingsFieldUpdaters: Record<string, (state: PersistedState, value: unknown) => void> = {
  show_ai_chat: (state, value) => { state.show_ai_chat = value as boolean; },
  'multi_edit.enabled': (state, value) => { state.multi_edit.enabled = value as boolean; },
  'multi_edit.sync_extra_json': (state, value) => { state.multi_edit.sync_extra_json = value as boolean; },
  'sort.mode': (state, value) => { state.sort.mode = value as 'mutate' | 'view'; },
  'sort.reassign_uid': (state, value) => { state.sort.reassign_uid = value as boolean; },
  glass_mode: (state, value) => { state.glass_mode = value as boolean; },
};


function onSettingsUpdateField(path: string, value: unknown): void {
  const updater = settingsFieldUpdaters[path];
  if (!updater) return;
  updatePersistedState(state => { updater(state, value); });
}

const {
  exportCurrentWorldbook,
  triggerImport,
  onImportChange,
  createNewWorldbook,
  duplicateWorldbook,
  deleteCurrentWorldbook,
} = useWorldbookFileOps({
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
});

const setRolePickerSearchInputElement = createRefSetter(rolePickerSearchInputRef);

const setCrossCopyGridElement = createRefSetter(crossCopyGridRef);

const setEntryHistoryLayoutElement = createRefSetter(entryHistoryLayoutRef);

const setWorldbookHistoryLayoutElement = createRefSetter(worldbookHistoryLayoutRef);

function setCrossCopyModeActive(next: boolean): void {
  if (!next) {
    closeCrossCopyDiff();
    stopCrossCopyPaneResize();
    crossCopyMobileStep.value = 1;
    setCrossCopyModeActiveRaw(false);
    closeFocusWorldbookMenu();
    closeFocusToolsBand();
    return;
  }
  crossCopyWorkspaceToolsExpanded.value = true;
  aiGeneratorMode.value = false;
  tagEditorMode.value = false;
  globalWorldbookMode.value = false;
  crossCopyMobileStep.value = 1;
  closeFocusWorldbookMenu();
  closeFocusToolsBand();
  setCrossCopyModeActiveRaw(true);
  persistCrossCopyState();
}
_setCrossCopyModeActive = setCrossCopyModeActive;

function toggleCrossCopyMode(): void {
  if (isAnyCineLocked.value) {
    return;
  }
  const nextCrossCopy = !crossCopyMode.value;
  if (!copyCineEnabled.value) {
    setCrossCopyModeActive(nextCrossCopy);
    return;
  }
  void runCrossCopyCinematicTransition(nextCrossCopy);
}

function resetCrossCopyCompare(reason = ''): void {
  closeCrossCopyDiff();
  crossCopyRows.value = [];
  crossCopySourceBaselineEntries.value = [];
  crossCopyTargetBaselineEntries.value = [];
  crossCopyCompareSummary.value = '';
  crossCopyLastComparedAt.value = 0;
  if (reason) {
    crossCopyLastResultSummary.value = reason;
  }
}

const isFocusToolbarCompact = computed(() => isDesktopFocusMode.value && viewportWidth.value < 1360);
const activeMainPaneMin = computed(() => (isDesktopFocusMode.value ? FOCUS_MAIN_PANE_MIN : MAIN_PANE_MIN));
const activeEditorSideMin = computed(() => (isDesktopFocusMode.value ? FOCUS_EDITOR_SIDE_MIN : EDITOR_SIDE_MIN));
const activeMainPaneWidth = computed(() => (isDesktopFocusMode.value ? focusMainPaneWidth.value : mainPaneWidth.value));
const activeEditorSideWidth = computed(() => (isDesktopFocusMode.value ? focusEditorSideWidth.value : editorSideWidth.value));

const mainLayoutStyle = computed(() => {
  if (isMobile.value) {
    return {
      display: 'block',
      height: 'auto',
      overflow: 'visible',
    };
  }
  if (isCompactLayout.value) {
    return undefined;
  }
  return {
    gridTemplateColumns: `minmax(${activeMainPaneMin.value}px, min(${activeMainPaneWidth.value}px, calc(100% - ${MAIN_EDITOR_MIN + RESIZE_HANDLE_SIZE}px))) ${RESIZE_HANDLE_SIZE}px minmax(0, 1fr)`,
  };
});

const editorShellStyle = computed(() => {
  if (isCompactLayout.value) {
    return undefined;
  }
  return {
    gridTemplateColumns: `minmax(0, 1fr) ${RESIZE_HANDLE_SIZE}px minmax(${activeEditorSideMin.value}px, min(${activeEditorSideWidth.value}px, calc(100% - ${EDITOR_CENTER_MIN + RESIZE_HANDLE_SIZE}px)))`,
  };
});

const themeStyles = computed(() => {
  const themeKey = isThemeKey(currentTheme.value) ? currentTheme.value : DEFAULT_THEME_KEY;
  const baseColors = THEMES[themeKey].colors;
  if (!persistedState.value.glass_mode) {
    return baseColors;
  }

  // Glassmorphism mode: convert specific hex backgrounds to rgba
  const glassColors: Record<string, string> = { ...baseColors };

  const hexToRgb = (hex: string): string | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : null;
  };

  const rootHex = baseColors['--wb-bg-root'];
  if (rootHex && rootHex.startsWith('#')) {
    const rgb = hexToRgb(rootHex);
    if (rgb) glassColors['--wb-bg-root'] = `rgba(${rgb}, 0.25)`;
  }

  const panelHex = baseColors['--wb-bg-panel'];
  if (panelHex && panelHex.startsWith('#')) {
    const rgb = hexToRgb(panelHex);
    if (rgb) {
      glassColors['--wb-bg-panel'] = `rgba(${rgb}, 0.45)`;
      // Override dropdown and glass-bg for better contrast in glass mode
      glassColors['--wb-dropdown-bg'] = `rgba(${rgb}, 0.65)`;
      glassColors['--wb-glass-bg'] = `rgba(${rgb}, 0.75)`;
    }
  }

  return glassColors;
});

const themeOptions = computed(() => {
  return Object.entries(THEMES).map(([key, item]) => ({
    key: key as ThemeKey,
    label: item.label,
  }));
});

const selectableWorldbookNames = computed(() => {
  if (!globalWorldbookMode.value) {
    return worldbookNames.value;
  }
  return bindings.global.filter(name => worldbookNames.value.includes(name));
});

const {
  ensureSelectionForGlobalMode,
  trySelectWorldbookByContext,
  toggleGlobalMode,
  runFocusWorldbookAction,
} = useWorldbookModeActions({
  worldbookNames,
  bindings,
  globalWorldbookMode,
  selectedWorldbookName,
  selectableWorldbookNames,
  isAnyCineLocked,
  aiGeneratorMode,
  tagEditorMode,
  switchWorldbookSelection,
  setCrossCopyModeActive,
  setStatus,
  closeFocusWorldbookMenu,
  createNewWorldbook,
  duplicateWorldbook,
  deleteCurrentWorldbook,
  exportCurrentWorldbook,
  triggerImport,
});
_ensureSelectionForGlobalMode = ensureSelectionForGlobalMode;

function isWorldbookMatchedByTagFilter(worldbookName: string): boolean {
  const selected = selectedTagFilterIds.value.filter(id => tagDefinitionMap.value.has(id));
  if (!selected.length) {
    return true;
  }
  const assigned = new Set(tagAssignments.value[worldbookName] ?? []);
  const candidateSets = selected.map(id => {
    if (tagFilterMatchMode.value === 'exact') {
      return new Set<string>([id]);
    }
    return tagDescendantsMap.value.get(id) ?? new Set<string>([id]);
  });
  const hasIntersection = (candidate: Set<string>) => {
    for (const id of candidate) {
      if (assigned.has(id)) {
        return true;
      }
    }
    return false;
  };
  if (tagFilterLogic.value === 'and') {
    return candidateSets.every(set => hasIntersection(set));
  }
  return candidateSets.some(set => hasIntersection(set));
}

const filteredSelectableWorldbookNames = computed(() => {
  let names = selectableWorldbookNames.value;
  if (selectedTagFilterIds.value.length) {
    names = names.filter(name => isWorldbookMatchedByTagFilter(name));
  }
  const keyword = worldbookPickerSearchText.value.trim().toLowerCase();
  if (keyword) {
    names = names.filter(name => name.toLowerCase().includes(keyword));
  }
  return names;
});

const crossCopyWorkspaceComparedText = computed(() => {
  if (!crossCopyHasCompared.value) {
    return '尚未比较';
  }
  return `上次比较：${formatDateTime(crossCopyLastComparedAt.value)}`;
});

const crossCopyCanApply = computed(() =>
  crossCopyCanCompare.value && crossCopySelectedCount.value > 0 && !crossCopyApplyLoading.value,
);

const crossCopyDesktopSingleColumn = computed(() => viewportWidth.value <= 1200);
const crossCopyGridStyle = computed((): Record<string, string> | undefined => {
  if (crossCopyDesktopSingleColumn.value) {
    return undefined;
  }
  return {
    gridTemplateColumns: `${crossCopyDesktopLeftWidthClamped.value}px ${CROSS_COPY_SPLITTER_SIZE}px minmax(0, 1fr)`,
  };
});

const crossCopyMobileNextDisabled = computed(() => {
  if (crossCopyMobileStep.value === 1) {
    return !crossCopyMobileCanGoStep2.value || crossCopyCompareLoading.value;
  }
  if (crossCopyMobileStep.value === 2) {
    return !crossCopyMobileCanGoStep3.value;
  }
  return !crossCopyCanApply.value;
});

const crossCopyDiffTargetEntry = computed(() => {
  if (!crossCopyDiffRow.value) {
    return null;
  }
  return getCrossCopyPrimaryTargetMatch(crossCopyDiffRow.value);
});

const crossCopyContentDiffSummary = computed(() => {
  const result = crossCopyContentDiff.value;
  return `新增行 ${result.added} / 修改行 ${result.changed} / 删除行 ${result.removed}`;
});

const crossCopyDiffSummary = computed(() => {
  if (!crossCopyDiffRow.value) {
    return '未选择对比条目';
  }
  if (!crossCopyDiffTargetEntry.value) {
    return '目标无直接命中，右侧为空';
  }
  return getCrossCopyRowDiffSummary(crossCopyDiffRow.value);
});

const crossCopyDiffHeaderText = computed(() => {
  if (!crossCopyDiffRow.value) {
    return '-';
  }
  const sourceName = crossCopyDiffRow.value.source_entry.name || `条目 ${crossCopyDiffRow.value.source_entry.uid}`;
  const targetName = crossCopyDiffTargetEntry.value
    ? (crossCopyDiffTargetEntry.value.name || `条目 ${crossCopyDiffTargetEntry.value.uid}`)
    : '无命中条目';
  return `${sourceName}  ↔  ${targetName}`;
});

const selectedKeysText = computed(() => {
  if (!selectedEntry.value) {
    return '';
  }
  return selectedEntry.value.strategy.keys.map(stringifyKeyword).join(', ');
});

const selectedSecondaryKeysText = computed(() => {
  if (!selectedEntry.value) {
    return '';
  }
  return selectedEntry.value.strategy.keys_secondary.keys.map(stringifyKeyword).join(', ');
});

const selectedEntryConfigDigest = computed(() => {
  if (!selectedEntry.value) {
    return '';
  }
  return JSON.stringify(extractEntryConfigPatch(selectedEntry.value, multiEditSyncExtraJson.value));
});

function commitKeysFromRaw(): void {
  if (keysDebounceTimer) { clearTimeout(keysDebounceTimer); keysDebounceTimer = null; }
  if (!selectedEntry.value) return;
  selectedEntry.value.strategy.keys = parseKeywordsFromText(selectedKeysRaw.value);
  selectedKeysRaw.value = selectedEntry.value.strategy.keys.map(stringifyKeyword).join(', ');
}

function commitSecondaryKeysFromRaw(): void {
  if (secondaryKeysDebounceTimer) { clearTimeout(secondaryKeysDebounceTimer); secondaryKeysDebounceTimer = null; }
  if (!selectedEntry.value) return;
  selectedEntry.value.strategy.keys_secondary.keys = parseKeywordsFromText(selectedSecondaryKeysRaw.value);
  selectedSecondaryKeysRaw.value = selectedEntry.value.strategy.keys_secondary.keys.map(stringifyKeyword).join(', ');
}

const selectedScanDepthText = computed({
  get: () => {
    if (!selectedEntry.value) {
      return '';
    }
    const depth = selectedEntry.value.strategy.scan_depth;
    return typeof depth === 'number' ? String(depth) : 'same_as_global';
  },
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.strategy.scan_depth = normalizeScanDepth(value);
  },
});

const selectedRecursionDelayText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.recursion.delay_until) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.recursion.delay_until = parseNullableInteger(value);
  },
});

const selectedStickyText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.sticky) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.effect.sticky = parseNullableInteger(value);
  },
});

const selectedCooldownText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.cooldown) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.effect.cooldown = parseNullableInteger(value);
  },
});

const selectedEffectDelayText = computed({
  get: () => (selectedEntry.value ? nullableNumberToText(selectedEntry.value.effect.delay) : ''),
  set: (value: string) => {
    if (!selectedEntry.value) {
      return;
    }
    selectedEntry.value.effect.delay = parseNullableInteger(value);
  },
});

const selectedContentChars = computed(() => {
  return selectedEntry.value?.content.length ?? 0;
});

const selectedTokenEstimate = computed(() => {
  const chars = selectedContentChars.value;
  if (chars <= 0) {
    return 0;
  }
  return Math.max(1, Math.round(chars / 3.6));
});

function confirmDiscardUnsavedChanges(options: { source?: SelectionSource; reason?: string } = {}): boolean {
  if (!hasUnsavedChanges.value) {
    return true;
  }
  const sourceLabel = options.source === 'auto' ? '自动操作' : '当前操作';
  const reasonLabel = options.reason ? `（${options.reason}）` : '';
  return confirm(`${sourceLabel}${reasonLabel}会覆盖当前未保存草稿，是否继续？`);
}

function switchWorldbookSelection(nextName: string, options: WorldbookSwitchOptions = {}): boolean {
  const next = toStringSafe(nextName).trim();
  const current = selectedWorldbookName.value;
  if (next === current) {
    return true;
  }
  if (!options.allowDirty && !confirmDiscardUnsavedChanges({ source: options.source, reason: options.reason })) {
    if (!options.silentOnCancel) {
      const action = options.source === 'auto' ? '自动切换' : '切换';
      setStatus(`已取消${action}世界书`);
    }
    return false;
  }
  selectedWorldbookName.value = next;
  return true;
}

function ensureRefreshAllowed(options: HardRefreshOptions = {}): boolean {
  const ok = confirmDiscardUnsavedChanges({ source: options.source, reason: options.reason ?? '刷新数据' });
  if (!ok) {
    setStatus(options.source === 'auto' ? '已取消自动刷新，保留未保存修改' : '已取消刷新，保留未保存修改');
  }
  return ok;
}

function syncEntriesDigestNow(): void {
  if (entriesDigestTimer) {
    clearTimeout(entriesDigestTimer);
    entriesDigestTimer = null;
  }
  draftEntriesDigest.value = JSON.stringify(draftEntries.value);
  originalEntriesDigest.value = JSON.stringify(originalEntries.value);
}

function scheduleEntriesDigestSync(delay = ENTRIES_DIGEST_DEBOUNCE_MS): void {
  if (delay <= 0) {
    syncEntriesDigestNow();
    return;
  }
  if (entriesDigestTimer) {
    clearTimeout(entriesDigestTimer);
  }
  entriesDigestTimer = setTimeout(() => {
    entriesDigestTimer = null;
    syncEntriesDigestNow();
  }, delay);
}

watch([draftEntries, originalEntries], () => {
  scheduleEntriesDigestSync();
}, { deep: true, immediate: true, flush: 'post' });

watch(selectedWorldbookName, name => {
  closeWorldbookPicker();
  mobileMultiSelectMode.value = false;
  clearMobileLongPressState();
  mobileSuppressNextTap.value = false;
  if (!name) {
    draftEntries.value = [];
    originalEntries.value = [];
    selectedEntryUid.value = null;
    return;
  }
  updatePersistedState(state => {
    state.last_worldbook = name;
  });
  normalizeCrossCopyWorldbookSelection();
  if (crossCopyHasCompared.value) {
    if (crossCopySourceWorldbook.value === name && crossCopyUseDraftSourceWhenCurrent.value) {
      resetCrossCopyCompare('当前世界书已切换，来源草稿基线已变化，请刷新比较');
    } else if (crossCopyTargetWorldbook.value === name) {
      resetCrossCopyCompare('当前世界书已切换，目标基线可能变化，请刷新比较');
    }
  }
  void loadWorldbook(name);
});

watch(
  () => selectedEntryUid.value,
  uid => {
    if (uid === null) {
      selectedEntryUids.value = [];
      selectedEntryAnchorUid.value = null;
      syncExtraTextWithSelection();
      selectedKeysRaw.value = selectedKeysText.value;
      selectedSecondaryKeysRaw.value = selectedSecondaryKeysText.value;
      return;
    }

    const exists = draftEntries.value.some(entry => entry.uid === uid);
    if (!exists) {
      selectedEntryUids.value = [];
      selectedEntryAnchorUid.value = null;
      return;
    }
    if (!selectedEntryUids.value.includes(uid)) {
      selectedEntryUids.value = [uid];
    }
    if (selectedEntryAnchorUid.value === null || !draftEntries.value.some(entry => entry.uid === selectedEntryAnchorUid.value)) {
      selectedEntryAnchorUid.value = uid;
    }

    syncExtraTextWithSelection();
    // Sync raw keyword text when entry selection changes
    selectedKeysRaw.value = selectedKeysText.value;
    selectedSecondaryKeysRaw.value = selectedSecondaryKeysText.value;
    if (isDesktopFocusMode.value) {
      focusMetaPanel.comment = false;
      focusMetaPanel.keywords = false;
      focusSidePanelState.strategy = true;
      focusSidePanelState.insertion = true;
      focusSidePanelState.recursion = true;
    }
  },
);

watch(multiEditSessionKey, () => {
  resetMultiEditSessionState();
});

watch(multiEditSyncExtraJson, () => {
  resetMultiEditSessionState();
});

watch(selectedEntryConfigDigest, digest => {
  if (!digest || multiEditApplying.value || !selectedEntry.value || !isMultiEditSyncActive.value) {
    return;
  }
  const currentPatch = extractEntryConfigPatch(selectedEntry.value, multiEditSyncExtraJson.value);
  if (!multiEditLastPatch.value) {
    multiEditLastPatch.value = klona(currentPatch);
    return;
  }
  if (JSON.stringify(currentPatch) === JSON.stringify(multiEditLastPatch.value)) {
    return;
  }
  const previousPatch = klona(multiEditLastPatch.value);
  syncSelectedEntryConfigToMultiSelection(currentPatch, previousPatch);
  multiEditLastPatch.value = klona(currentPatch);
});

// Debounced watcher: parse keywords 600ms after user stops typing
watch(selectedKeysRaw, () => {
  if (keysDebounceTimer) clearTimeout(keysDebounceTimer);
  keysDebounceTimer = setTimeout(commitKeysFromRaw, 600);
});

watch(selectedSecondaryKeysRaw, () => {
  if (secondaryKeysDebounceTimer) clearTimeout(secondaryKeysDebounceTimer);
  secondaryKeysDebounceTimer = setTimeout(commitSecondaryKeysFromRaw, 600);
});

watch(
  [
    batchFindText,
    batchReplaceText,
    batchExcludeText,
    batchUseRegex,
    batchInName,
    batchInContent,
    batchInKeys,
    batchSearchScope,
  ],
  () => {
    resetFindState();
  },
);

watch(
  [crossCopySourceWorldbook, crossCopyTargetWorldbook, crossCopyUseDraftSourceWhenCurrent],
  () => {
    persistCrossCopyState();
    if (crossCopyHasCompared.value) {
      resetCrossCopyCompare('来源或目标已变更，请先刷新比较');
    }
  },
);

watch(crossCopySnapshotBeforeApply, () => {
  persistCrossCopyState();
});

watch([crossCopyControlsCollapsed, crossCopyWorkspaceToolsExpanded], () => {
  persistCrossCopyState();
});

watch(crossCopyHasCompared, hasCompared => {
  if (!hasCompared && crossCopyMobileStep.value > 1) {
    crossCopyMobileStep.value = 1;
  }
});

watch(crossCopyDesktopSingleColumn, isSingleColumn => {
  if (isSingleColumn) {
    stopCrossCopyPaneResize();
  }
});

watch(crossCopyMode, enabled => {
  if (!enabled) {
    stopCrossCopyPaneResize();
    closeCrossCopyDiff();
    crossCopyMobileStep.value = 1;
  }
});

watch(crossCopyDiffRow, row => {
  if (!row && showCrossCopyDiffModal.value) {
    closeCrossCopyDiff();
  }
});

watch(mobileTab, tab => {
  if (tab !== 'copy') {
    return;
  }
  globalWorldbookMode.value = false;
  aiGeneratorMode.value = false;
  tagEditorMode.value = false;
  normalizeCrossCopyWorldbookSelection();
  crossCopyMobileStep.value = 1;
});

watch(worldbookPickerOpen, opened => {
  if (opened) {
    if (!tagTreeExpandedIds.value.length) {
      tagTreeExpandedIds.value = [...tagRootIds.value];
    }
    return;
  }
  tagFilterPanelOpen.value = false;
  tagFilterSearchText.value = '';
});

watch(rolePickerOpen, opened => {
  if (!opened) {
    return;
  }
  roleBindSearchText.value = '';
  refreshRoleBindingCandidates();
  void nextTick(() => { rolePickerSearchInputRef.value?.focus(); });
});

watch(tagDefinitions, () => {
  ensureTagAssignTargetSelected();
  if (tagNewParentId.value && !tagDefinitionMap.value.has(tagNewParentId.value)) {
    tagNewParentId.value = '';
  }
  const selectedFiltered = selectedTagFilterIds.value.filter(id => tagDefinitionMap.value.has(id));
  const selectedChanged = selectedFiltered.length !== selectedTagFilterIds.value.length || selectedFiltered.some((id, index) => id !== selectedTagFilterIds.value[index]);
  if (selectedChanged) {
    selectedTagFilterIds.value = selectedFiltered;
  }
  const expandedFiltered = tagTreeExpandedIds.value.filter(id => tagDefinitionMap.value.has(id));
  const expandedChanged = expandedFiltered.length !== tagTreeExpandedIds.value.length || expandedFiltered.some((id, index) => id !== tagTreeExpandedIds.value[index]);
  if (expandedChanged) {
    tagTreeExpandedIds.value = expandedFiltered;
  }
  if (!tagTreeExpandedIds.value.length) {
    tagTreeExpandedIds.value = [...tagRootIds.value];
  }
}, { deep: true, immediate: true });

watch(isMobile, mobile => {
  if (mobile) {
    return;
  }
  mobileMultiSelectMode.value = false;
  mobileLongPressState.value = null;
  mobileSuppressNextTap.value = false;
});

watch(
  entryVersionViews,
  views => {
    if (!views.length) {
      entryHistoryLeftId.value = '';
      entryHistoryRightId.value = '';
      return;
    }

    const ids = new Set(views.map(item => item.id));
    if (!ids.has(entryHistoryRightId.value)) {
      entryHistoryRightId.value = '__current__';
    }
    if (!ids.has(entryHistoryLeftId.value)) {
      const fallback = views.find(item => !item.isCurrent) ?? views[0];
      entryHistoryLeftId.value = fallback.id;
    }
    if (entryHistoryLeftId.value === entryHistoryRightId.value && views.length > 1) {
      const fallback = views.find(item => item.id !== entryHistoryRightId.value);
      if (fallback) {
        entryHistoryLeftId.value = fallback.id;
      }
    }
  },
  { immediate: true },
);

watch(
  worldbookVersionViews,
  views => {
    if (!views.length) {
      worldbookHistoryLeftId.value = '';
      worldbookHistoryRightId.value = '';
      worldbookHistoryActiveRowKey.value = '';
      return;
    }

    const ids = new Set(views.map(item => item.id));
    if (!ids.has(worldbookHistoryRightId.value)) {
      worldbookHistoryRightId.value = '__current__';
    }
    if (!ids.has(worldbookHistoryLeftId.value)) {
      const fallback = views.find(item => !item.isCurrent) ?? views[0];
      worldbookHistoryLeftId.value = fallback.id;
    }
    if (worldbookHistoryLeftId.value === worldbookHistoryRightId.value && views.length > 1) {
      const fallback = views.find(item => item.id !== worldbookHistoryRightId.value);
      if (fallback) {
        worldbookHistoryLeftId.value = fallback.id;
      }
    }
  },
  { immediate: true },
);

watch(
  worldbookHistoryCompareRows,
  rows => {
    if (!rows.length) {
      worldbookHistoryActiveRowKey.value = '';
      return;
    }
    if (!rows.some(row => row.key === worldbookHistoryActiveRowKey.value)) {
      worldbookHistoryActiveRowKey.value = rows[0].key;
    }
  },
  { immediate: true },
);

watch(canResizeHistorySections, enabled => {
  if (!enabled) {
    stopHistorySectionResize();
  }
});

watch(
  () => selectedEntry.value?.position.type,
  () => {
    if (!selectedEntry.value) {
      return;
    }
    if (selectedEntry.value.position.type !== 'at_depth') {
      selectedEntry.value.position.role = 'system';
      selectedEntry.value.position.depth = 4;
    }
  },
);

watch(
  hasUnsavedChanges,
  dirty => {
    const target = window as unknown as Record<string, unknown>;
    target[DIRTY_STATE_KEY] = dirty;
  },
  { immediate: true },
);

function readPersistedState(): PersistedState {
  const ctx = (window as any).SillyTavern?.getContext?.();
  if (!ctx) return createDefaultPersistedState();
  if (!ctx.extensionSettings.worldbookAssistant) {
    ctx.extensionSettings.worldbookAssistant = {};
  }
  return normalizePersistedState(ctx.extensionSettings.worldbookAssistant[STORAGE_KEY]);
}

function writePersistedState(state: PersistedState): void {
  const ctx = (window as any).SillyTavern?.getContext?.();
  if (ctx) {
    if (!ctx.extensionSettings.worldbookAssistant) {
      ctx.extensionSettings.worldbookAssistant = {};
    }
    ctx.extensionSettings.worldbookAssistant[STORAGE_KEY] = state;
    ctx.saveSettingsDebounced?.();
  }
  persistedState.value = state;
  syncSelectedGlobalPresetFromState();
}

function updatePersistedState(mutator: (state: PersistedState) => void): void {
  const state = readPersistedState();
  mutator(state);
  writePersistedState(state);
}

// ═══ Browse Mode Helpers ═══

function toggleBrowseCard(uid: number): void {
  const set = expandedBrowseCardUids.value;
  if (set.has(uid)) {
    set.delete(uid);
  } else {
    set.add(uid);
  }
}

function switchToEditorForEntry(uid: number): void {
  panelMode.value = 'editor';
  updatePersistedState(s => { s.panel_mode = 'editor'; });
  selectEntry(uid);
}

function switchPanelMode(mode: 'browse' | 'editor'): void {
  panelMode.value = mode;
  updatePersistedState(s => { s.panel_mode = mode; });
}

function browseToggleEnabled(entry: WorldbookEntry): void {
  entry.enabled = !entry.enabled;
}

function browseGetPositionLabel(entry: WorldbookEntry): string {
  const opt = positionSelectOptions.find(o => {
    if (o.type !== entry.position.type) return false;
    if (o.type === 'at_depth' && o.role && o.role !== entry.position.role) return false;
    return true;
  });
  return opt?.label ?? entry.position.type;
}

function browseGetStrategyLabel(entry: WorldbookEntry): string {
  switch (entry.strategy.type) {
    case 'constant': return '🔵 常驻';
    case 'selective': return '🟢 关键词';
    case 'vectorized': return '🔗 向量化';
    default: return entry.strategy.type;
  }
}

function browseGetContentPreview(entry: WorldbookEntry): string {
  return entry.content?.trim() || '(无内容)';
}

function applyPanelModeFromPersisted(): void {
  panelMode.value = persistedState.value.panel_mode || 'browse';
}

const browseVisibleEntries = computed(() => filteredEntries.value.slice(0, browseRenderLimit.value));
const browseHasMoreEntries = computed(() => browseRenderLimit.value < filteredEntries.value.length);

function browseLoadMore(): void {
  browseRenderLimit.value = Math.min(browseRenderLimit.value + BROWSE_RENDER_BATCH, filteredEntries.value.length);
}

function setupBrowseIntersectionObserver(): void {
  teardownBrowseIntersectionObserver();
  const sentinel = browseLoadMoreSentinelRef.value;
  if (!sentinel) return;
  _browseIntersectionObserver = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && browseHasMoreEntries.value) {
        browseLoadMore();
      }
    },
    { rootMargin: '200px' },
  );
  _browseIntersectionObserver.observe(sentinel);
}

function teardownBrowseIntersectionObserver(): void {
  _browseIntersectionObserver?.disconnect();
  _browseIntersectionObserver = null;
}

watch(
  () => filteredEntries.value.length,
  () => { browseRenderLimit.value = BROWSE_RENDER_BATCH; },
);

watch(browseLoadMoreSentinelRef, (el) => {
  if (el) setupBrowseIntersectionObserver();
  else teardownBrowseIntersectionObserver();
});

function aiToggleMode(): void {
  if (isAnyCineLocked.value) {
    return;
  }
  aiGeneratorMode.value = !aiGeneratorMode.value;
  if (aiGeneratorMode.value) {
    globalWorldbookMode.value = false;
    tagEditorMode.value = false;
    setCrossCopyModeActive(false);
  }
}

function tagToggleMode(): void {
  if (isAnyCineLocked.value) {
    return;
  }
  tagEditorMode.value = !tagEditorMode.value;
  if (tagEditorMode.value) {
    aiGeneratorMode.value = false;
    globalWorldbookMode.value = false;
    setCrossCopyModeActive(false);
  }
}

function setStatus(message: string): void {
  statusMessage.value = message;
}

function syncExtraTextWithSelection(): void {
  if (!selectedEntry.value || !selectedEntry.value.extra) {
    selectedExtraText.value = '';
    return;
  }
  selectedExtraText.value = JSON.stringify(selectedEntry.value.extra, null, 2);
}

function formatHistoryOptionLabel(label: string, ts: number, isCurrent: boolean): string {
  if (isCurrent) {
    return 'Current（当前）';
  }
  if (label === '加载基线' || ts <= 0) {
    return label;
  }
  return `${label} · ${formatDateTime(ts)}`;
}

function getEntryVersionPreview(view: EntryVersionView | null): string {
  if (!view) {
    return '';
  }
  const content = toStringSafe(view.entry.content).replace(/\s+/g, ' ').trim();
  if (!content) {
    return '(空内容)';
  }
  return content.slice(0, 160);
}


function getOrderedSelectedEntryUids(): number[] {
  if (!selectedEntryUids.value.length) {
    return [];
  }
  const selected = new Set(selectedEntryUids.value);
  return draftEntries.value
    .filter(entry => selected.has(entry.uid))
    .map(entry => entry.uid);
}

function ensureSelectedEntryExists(): void {
  if (!draftEntries.value.length) {
    selectedEntryUid.value = null;
    selectedEntryUids.value = [];
    selectedEntryAnchorUid.value = null;
    return;
  }

  const validUidSet = new Set(draftEntries.value.map(entry => entry.uid));
  selectedEntryUids.value = selectedEntryUids.value.filter((uid, index, list) => {
    return validUidSet.has(uid) && list.indexOf(uid) === index;
  });

  if (selectedEntryUid.value === null) {
    selectedEntryUid.value = draftEntries.value[0].uid;
  } else if (!validUidSet.has(selectedEntryUid.value)) {
    selectedEntryUid.value = draftEntries.value[0].uid;
  }

  if (selectedEntryUid.value !== null && !selectedEntryUids.value.includes(selectedEntryUid.value)) {
    selectedEntryUids.value.unshift(selectedEntryUid.value);
  }

  if (selectedEntryAnchorUid.value === null || !validUidSet.has(selectedEntryAnchorUid.value)) {
    selectedEntryAnchorUid.value = selectedEntryUid.value;
  }
}

function enterMobileMultiSelectMode(initialUid: number): void {
  if (!isMobile.value) {
    return;
  }
  mobileMultiSelectMode.value = true;
  if (draftEntries.value.some(entry => entry.uid === initialUid)) {
    selectedEntryUids.value = [initialUid];
    selectedEntryUid.value = initialUid;
    selectedEntryAnchorUid.value = initialUid;
  }
  setStatus('已进入多选模式');
}

function finishMobileMultiSelectMode(): void {
  if (!mobileMultiSelectMode.value) {
    return;
  }
  mobileMultiSelectMode.value = false;
  if (selectedEntryUids.value.length > 0) {
    const primaryUid = selectedEntryUids.value[0];
    selectedEntryUid.value = primaryUid;
    selectedEntryUids.value = [primaryUid];
    selectedEntryAnchorUid.value = primaryUid;
  } else {
    selectedEntryUid.value = null;
    selectedEntryUids.value = [];
    selectedEntryAnchorUid.value = null;
  }
  setStatus('已退出多选模式');
}

function toggleMobileEntrySelection(uid: number): void {
  if (!isMobile.value || !mobileMultiSelectMode.value) {
    return;
  }
  if (!draftEntries.value.some(entry => entry.uid === uid)) {
    return;
  }
  const next = [...selectedEntryUids.value];
  const index = next.indexOf(uid);
  if (index >= 0) {
    next.splice(index, 1);
  } else {
    next.push(uid);
  }
  selectedEntryUids.value = next;
  if (!next.length) {
    selectedEntryUid.value = null;
    selectedEntryAnchorUid.value = null;
    return;
  }
  if (!selectedEntryUid.value || !next.includes(selectedEntryUid.value)) {
    selectedEntryUid.value = next[0];
    selectedEntryAnchorUid.value = next[0];
  }
}

function selectAllVisibleForMobileMultiSelect(): void {
  if (!isMobile.value || !mobileMultiSelectMode.value) {
    return;
  }
  const visibleUids = filteredEntries.value.map(entry => entry.uid);
  selectedEntryUids.value = visibleUids;
  if (visibleUids.length > 0) {
    selectedEntryUid.value = visibleUids[0];
    selectedEntryAnchorUid.value = visibleUids[0];
  } else {
    selectedEntryUid.value = null;
    selectedEntryAnchorUid.value = null;
  }
}

function clearMobileMultiSelectSelection(): void {
  if (!isMobile.value || !mobileMultiSelectMode.value) {
    return;
  }
  selectedEntryUids.value = [];
  selectedEntryUid.value = null;
  selectedEntryAnchorUid.value = null;
}

function clearMobileLongPressState(): void {
  const state = mobileLongPressState.value;
  if (!state) {
    return;
  }
  if (state.timerId !== null) {
    clearTimeout(state.timerId);
  }
  if (state.target) {
    try {
      if (state.target.hasPointerCapture(state.pointerId)) {
        state.target.releasePointerCapture(state.pointerId);
      }
    } catch {
      // ignore pointer capture release failures
    }
  }
  mobileLongPressState.value = null;
}

function startMobileEntryLongPress(uid: number, event: PointerEvent): void {
  if (!isMobile.value || mobileTab.value !== 'list' || mobileMultiSelectMode.value) {
    return;
  }
  if (event.pointerType === 'mouse' && event.button !== 0) {
    return;
  }
  clearMobileLongPressState();
  const target = event.currentTarget as HTMLElement | null;
  const state: MobileEntryLongPressState = {
    uid,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    triggered: false,
    timerId: null,
    target,
  };
  if (target) {
    try {
      target.setPointerCapture(event.pointerId);
    } catch {
      // ignore pointer capture failures
    }
  }
  state.timerId = window.setTimeout(() => {
    if (!mobileLongPressState.value || mobileLongPressState.value.pointerId !== state.pointerId) {
      return;
    }
    mobileLongPressState.value.triggered = true;
    mobileSuppressNextTap.value = true;
    enterMobileMultiSelectMode(uid);
  }, MOBILE_MULTI_LONG_PRESS_MS);
  mobileLongPressState.value = state;
}

function handleMobileEntryLongPressMove(event: PointerEvent): void {
  const state = mobileLongPressState.value;
  if (!state || state.pointerId !== event.pointerId || state.triggered) {
    return;
  }
  const offsetX = event.clientX - state.startX;
  const offsetY = event.clientY - state.startY;
  if (Math.hypot(offsetX, offsetY) > MOBILE_MULTI_LONG_PRESS_MOVE_PX) {
    clearMobileLongPressState();
  }
}

function finishMobileEntryLongPress(event?: PointerEvent): void {
  const state = mobileLongPressState.value;
  if (!state) {
    return;
  }
  if (event && state.pointerId !== event.pointerId) {
    return;
  }
  const triggered = state.triggered;
  clearMobileLongPressState();
  if (triggered) {
    mobileSuppressNextTap.value = true;
  }
}

function selectEntry(uid: number, event?: MouseEvent): void {
  if (suppressNextEntryClick.value) {
    suppressNextEntryClick.value = false;
    return;
  }

  const entryExists = draftEntries.value.some(entry => entry.uid === uid);
  if (!entryExists) {
    return;
  }

  if (isMobile.value) {
    if (mobileSuppressNextTap.value) {
      mobileSuppressNextTap.value = false;
      return;
    }
    if (mobileMultiSelectMode.value) {
      toggleMobileEntrySelection(uid);
      return;
    }
    selectedEntryUid.value = uid;
    selectedEntryUids.value = [uid];
    selectedEntryAnchorUid.value = uid;
    // Blur active input to prevent keyboard auto-popup on tab switch
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
    nextTick(() => {
      mobileTab.value = 'edit';
    });
    return;
  }

  const ctrlLike = Boolean(event && (event.ctrlKey || event.metaKey));
  const shiftLike = Boolean(event && event.shiftKey);

  if (shiftLike && selectedEntryAnchorUid.value !== null) {
    const from = filteredEntries.value.findIndex(entry => entry.uid === selectedEntryAnchorUid.value);
    const to = filteredEntries.value.findIndex(entry => entry.uid === uid);
    if (from >= 0 && to >= 0) {
      const start = Math.min(from, to);
      const end = Math.max(from, to);
      const rangeUids = filteredEntries.value.slice(start, end + 1).map(entry => entry.uid);
      if (ctrlLike) {
        const merged = [...selectedEntryUids.value];
        for (const currentUid of rangeUids) {
          if (!merged.includes(currentUid)) {
            merged.push(currentUid);
          }
        }
        selectedEntryUids.value = merged;
      } else {
        selectedEntryUids.value = rangeUids;
      }
    } else {
      selectedEntryUids.value = [uid];
    }
    selectedEntryUid.value = uid;
    return;
  }

  if (ctrlLike) {
    const current = [...selectedEntryUids.value];
    const index = current.indexOf(uid);
    if (index >= 0) {
      if (current.length > 1) {
        current.splice(index, 1);
        selectedEntryUids.value = current;
        if (selectedEntryUid.value === uid) {
          selectedEntryUid.value = current[Math.max(0, index - 1)] ?? current[0] ?? uid;
        }
      } else {
        selectedEntryUid.value = uid;
        selectedEntryUids.value = [uid];
      }
    } else {
      current.push(uid);
      selectedEntryUids.value = current;
      selectedEntryUid.value = uid;
    }
    selectedEntryAnchorUid.value = uid;
    return;
  }

  selectedEntryUid.value = uid;
  selectedEntryUids.value = [uid];
  selectedEntryAnchorUid.value = uid;
}

function clearEntryDragState(): void {
  draggingEntryUids.value = [];
  entryDropTargetUid.value = null;
  entryDropPosition.value = null;
}

function reorderEntriesByDrop(targetUid: number, position: 'before' | 'after'): boolean {
  if (!draggingEntryUids.value.length) {
    return false;
  }
  const movingSet = new Set(draggingEntryUids.value);
  if (movingSet.has(targetUid)) {
    return false;
  }
  const movingEntries = draftEntries.value.filter(entry => movingSet.has(entry.uid));
  if (!movingEntries.length) {
    return false;
  }
  const remaining = draftEntries.value.filter(entry => !movingSet.has(entry.uid));
  let insertIndex = remaining.findIndex(entry => entry.uid === targetUid);
  if (insertIndex < 0) {
    insertIndex = remaining.length;
  } else if (position === 'after') {
    insertIndex += 1;
  }
  const next = [...remaining.slice(0, insertIndex), ...movingEntries, ...remaining.slice(insertIndex)];
  const unchanged = next.every((entry, index) => entry.uid === draftEntries.value[index]?.uid);
  if (unchanged) {
    return false;
  }

  draftEntries.value = next;
  selectedEntryUids.value = movingEntries.map(entry => entry.uid);
  if (!selectedEntryUid.value || !selectedEntryUids.value.includes(selectedEntryUid.value)) {
    selectedEntryUid.value = selectedEntryUids.value[0] ?? null;
  }
  if (selectedEntryUid.value !== null) {
    selectedEntryAnchorUid.value = selectedEntryUid.value;
  }
  return true;
}

function handleEntryDragStart(uid: number, event: DragEvent): void {
  if (isMobile.value) {
    return;
  }
  const orderedSelected = getOrderedSelectedEntryUids();
  if (orderedSelected.includes(uid) && orderedSelected.length > 1) {
    draggingEntryUids.value = orderedSelected;
  } else {
    selectedEntryUid.value = uid;
    selectedEntryUids.value = [uid];
    selectedEntryAnchorUid.value = uid;
    draggingEntryUids.value = [uid];
  }
  entryDropTargetUid.value = null;
  entryDropPosition.value = null;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(uid));
  }
}

function handleEntryDragOver(uid: number, event: DragEvent): void {
  if (!draggingEntryUids.value.length) {
    return;
  }
  event.preventDefault();
  const element = event.currentTarget as HTMLElement | null;
  if (!element) {
    return;
  }
  const rect = element.getBoundingClientRect();
  const offsetY = event.clientY - rect.top;
  entryDropTargetUid.value = uid;
  entryDropPosition.value = offsetY > rect.height / 2 ? 'after' : 'before';
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move';
  }
}

function handleEntryDrop(uid: number, event: DragEvent): void {
  event.preventDefault();
  if (!draggingEntryUids.value.length) {
    return;
  }
  const changed = reorderEntriesByDrop(uid, entryDropPosition.value ?? 'after');
  clearEntryDragState();
  if (changed) {
    setStatus(`已拖拽排序 ${selectedEntryUids.value.length || 1} 个条目`);
  }
  suppressNextEntryClick.value = true;
  setTimeout(() => {
    suppressNextEntryClick.value = false;
  }, 0);
}

function handleEntryDragEnd(): void {
  clearEntryDragState();
  suppressNextEntryClick.value = true;
  setTimeout(() => {
    suppressNextEntryClick.value = false;
  }, 0);
}

function goBackToList(): void {
  selectedEntryUid.value = null;
  selectedEntryUids.value = [];
  selectedEntryAnchorUid.value = null;
  if (isMobile.value) {
    mobileTab.value = 'list';
  }
}

function applyExtraJson(): void {
  if (!selectedEntry.value) {
    return;
  }
  const text = selectedExtraText.value.trim();
  if (!text) {
    selectedEntry.value.extra = undefined;
    return;
  }
  try {
    const parsed = JSON.parse(text);
    const parsedRecord = asRecord(parsed);
    if (!parsedRecord) {
      throw new Error('extra 必须是 JSON 对象');
    }
    selectedEntry.value.extra = klona(parsedRecord);
    toastr.success('extra 已应用');
  } catch (error) {
    toastr.error(`extra JSON 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function clearExtra(): void {
  if (!selectedEntry.value) {
    return;
  }
  selectedEntry.value.extra = undefined;
  selectedExtraText.value = '';
}

function addEntry(): void {
  const uid = getNextUid(draftEntries.value);
  const entry = createDefaultEntry(uid);
  draftEntries.value.push(entry);
  selectedEntryUid.value = uid;
  setStatus(`已新增条目 #${uid}`);
}

function duplicateSelectedEntry(): void {
  if (!selectedEntry.value || selectedEntryIndex.value < 0) {
    return;
  }
  const uid = getNextUid(draftEntries.value);
  const duplicated = normalizeEntry(klona(selectedEntry.value), uid);
  duplicated.uid = uid;
  duplicated.name = `${duplicated.name} (副本)`;
  draftEntries.value.splice(selectedEntryIndex.value + 1, 0, duplicated);
  selectedEntryUid.value = uid;
  setStatus(`已复制条目 #${selectedEntry.value.uid}`);
}

function removeSelectedEntry(): void {
  const selectedUids = getOrderedSelectedEntryUids();
  if (!selectedUids.length) {
    return;
  }
  const entriesByUid = new Map(draftEntries.value.map(entry => [entry.uid, entry] as const));
  const selectedEntries = selectedUids
    .map(uid => entriesByUid.get(uid))
    .filter((entry): entry is WorldbookEntry => Boolean(entry));
  if (!selectedEntries.length) {
    return;
  }

  const confirmText = selectedEntries.length === 1
    ? `确定删除条目 "${selectedEntries[0].name}" ?`
    : `确定删除选中的 ${selectedEntries.length} 个条目？`;
  if (!confirm(confirmText)) {
    return;
  }

  pushEntrySnapshotsBulk(
    selectedEntries.map(entry => ({
      label: '删除前快照',
      uid: entry.uid,
      name: entry.name,
      entry,
    })),
  );

  const removeSet = new Set(selectedUids);
  draftEntries.value = draftEntries.value.filter(entry => !removeSet.has(entry.uid));
  selectedEntryUids.value = [];

  if (isMobile.value) {
    selectedEntryUid.value = null;
    selectedEntryAnchorUid.value = null;
  } else {
    ensureSelectedEntryExists();
  }
  setStatus(selectedEntries.length === 1 ? '已删除条目' : `已删除 ${selectedEntries.length} 个条目`);
}

function moveSelectedEntry(direction: -1 | 1): void {
  const selectedUids = getOrderedSelectedEntryUids();
  if (!selectedUids.length) {
    return;
  }
  const selectedSet = new Set(selectedUids);
  let moved = false;

  if (direction < 0) {
    for (const uid of selectedUids) {
      const index = draftEntries.value.findIndex(entry => entry.uid === uid);
      if (index <= 0) {
        continue;
      }
      const prev = draftEntries.value[index - 1];
      if (selectedSet.has(prev.uid)) {
        continue;
      }
      const [entry] = draftEntries.value.splice(index, 1);
      draftEntries.value.splice(index - 1, 0, entry);
      moved = true;
    }
  } else {
    for (let i = selectedUids.length - 1; i >= 0; i -= 1) {
      const uid = selectedUids[i];
      const index = draftEntries.value.findIndex(entry => entry.uid === uid);
      if (index < 0 || index >= draftEntries.value.length - 1) {
        continue;
      }
      const next = draftEntries.value[index + 1];
      if (selectedSet.has(next.uid)) {
        continue;
      }
      const [entry] = draftEntries.value.splice(index, 1);
      draftEntries.value.splice(index + 1, 0, entry);
      moved = true;
    }
  }

  if (!moved) {
    return;
  }

  selectedEntryUids.value = getOrderedSelectedEntryUids();
  if (!selectedEntryUid.value || !selectedEntryUids.value.includes(selectedEntryUid.value)) {
    selectedEntryUid.value = selectedEntryUids.value[0] ?? null;
  }
  setStatus(selectedUids.length > 1 ? `已移动 ${selectedUids.length} 个条目` : '已移动条目');
}

function normalizeAllEntries(): void {
  draftEntries.value = normalizeEntryList(draftEntries.value.map(entry => klona(entry)));
  ensureSelectedEntryExists();
  setStatus('已完成条目标准化');
}

function sortEntriesByOrderDesc(): void {
  draftEntries.value.sort((left, right) => right.position.order - left.position.order);
  ensureSelectedEntryExists();
  setStatus('已按 order 降序排列');
}

function setEnabledForAll(enabled: boolean): void {
  draftEntries.value.forEach(entry => {
    entry.enabled = enabled;
  });
  setStatus(enabled ? '已启用全部条目' : '已禁用全部条目');
}

async function refreshBindings(): Promise<void> {
  bindings.global = [...getGlobalWorldbookNames()];
  try {
    const charBindings = getCharWorldbookNames('current');
    bindings.charPrimary = charBindings.primary;
    bindings.charAdditional = [...charBindings.additional];
  } catch {
    bindings.charPrimary = null;
    bindings.charAdditional = [];
  }

  try {
    bindings.chat = getChatWorldbookName('current');
  } catch {
    bindings.chat = null;
  }
  if (globalWorldbookMode.value) {
    ensureSelectionForGlobalMode({
      source: 'auto',
      reason: '全局模式同步当前选择',
      silentOnCancel: true,
    });
  }
}

const {
  closeWorldbookPicker,
  toggleWorldbookPicker,
  toggleTheme,
  setTheme,
  onSetThemeEvent,
  selectWorldbookFromPicker,
  bindFirstRoleCandidate,
  onHostPointerDownForWorldbookPicker,
  onHostKeyDownForWorldbookPicker,
} = useUIPickerThemeHandlers({
  worldbookPickerOpen,
  worldbookPickerSearchText,
  worldbookPickerRef,
  rolePickerOpen,
  rolePickerRef,
  themePickerOpen,
  focusWorldbookMenuOpen,
  focusWorldbookMenuRef,
  currentTheme,
  roleBindingCandidates,
  closeRolePicker,
  closeFocusWorldbookMenu,
  switchWorldbookSelection,
  bindRoleCandidateToSelectedPreset,
  setStatus,
});

function loadWorldbook(name: string): Promise<void> {
  return _loadWorldbook(name);
}

function reloadWorldbookNames(preferred?: string, switchOptions: WorldbookSwitchOptions = {}): Promise<boolean> {
  return _reloadWorldbookNames(preferred, switchOptions);
}

function hardRefresh(options: HardRefreshOptions = {}): Promise<void> {
  return _hardRefresh(options);
}

function saveCurrentWorldbook(): Promise<void> {
  return _saveCurrentWorldbook();
}

const {
  loadWorldbook: loadWorldbookImpl,
  reloadWorldbookNames: reloadWorldbookNamesImpl,
  hardRefresh: hardRefreshImpl,
  saveCurrentWorldbook: saveCurrentWorldbookImpl,
} = useWorldbookDataFlow({
  selectedWorldbookName,
  worldbookNames,
  draftEntries,
  originalEntries,
  selectedEntryUid,
  selectedKeysRaw,
  selectedSecondaryKeysRaw,
  selectedKeysText,
  selectedSecondaryKeysText,
  persistedState,
  hasUnsavedChanges,
  isBusy,
  isSaving,
  setStatus,
  syncEntriesDigestNow,
  ensureSelectedEntryExists,
  normalizeCrossCopyWorldbookSelection,
  persistCrossCopyState,
  switchWorldbookSelection,
  ensureRefreshAllowed,
  readPersistedState,
  syncSelectedGlobalPresetFromState,
  applyCrossCopyStateFromPersisted,
  refreshBindings,
  refreshRoleBindingCandidates,
  refreshCurrentRoleContext,
  autoApplyRoleBoundPreset,
  globalWorldbookMode,
  ensureSelectionForGlobalMode,
  trySelectWorldbookByContext,
  collectEntrySnapshotsBeforeSave,
  pushEntrySnapshotsBulk,
  pushSnapshot,
});

_loadWorldbook = loadWorldbookImpl;
_reloadWorldbookNames = reloadWorldbookNamesImpl;
_hardRefresh = hardRefreshImpl;
_saveCurrentWorldbook = saveCurrentWorldbookImpl;

function pushActivationLogs(entries: Array<{ world: string } & Record<string, unknown>>): void {
  const logs = entries.map(item => {
    const uid = item.uid ?? item.displayIndex ?? '?';
    const name = toStringSafe(item.name ?? item.comment, `UID ${uid}`);
    const content = toStringSafe(item.content).replace(/\s+/g, ' ').trim().slice(0, 80);
    return {
      id: createId('activation'),
      time: Date.now(),
      world: toStringSafe(item.world, 'unknown'),
      uid: typeof uid === 'number' || typeof uid === 'string' ? uid : '?',
      name,
      contentPreview: content || '(空内容)',
    } satisfies ActivationLog;
  });
  activationLogs.value.unshift(...logs);
  if (activationLogs.value.length > ACTIVATION_LOG_LIMIT) {
    activationLogs.value.length = ACTIVATION_LOG_LIMIT;
  }
}

function clearActivationLogs(): void {
  activationLogs.value = [];
}


function onPanelRefresh(): void {
  void hardRefresh({ source: 'manual', reason: '手动刷新' });
}

function onPanelSave(): void {
  void saveCurrentWorldbook();
}

function discardUnsavedDraft(): void {
  if (!hasUnsavedChanges.value) {
    const target = window as unknown as Record<string, unknown>;
    target[DIRTY_STATE_KEY] = false;
    return;
  }
  draftEntries.value = klona(originalEntries.value);
  syncEntriesDigestNow();
  ensureSelectedEntryExists();
  resetFindState();
  setStatus('已放弃未保存修改');
}

function onPanelDiscard(): void {
  discardUnsavedDraft();
}

let _mobileResizeHandler: (() => void) | null = null;

onMounted(() => {
  // Fix mobile height: compute exact pixel height based on viewport position
  if (isMobile.value && rootRef.value) {
    const hostWin = (() => { try { return window.parent || window; } catch { return window; } })();
    const el = rootRef.value;

    const syncHeight = () => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = hostWin.innerHeight || window.innerHeight || 0;
      const available = vh - rect.top;
      if (available > 0) {
        el.style.height = available + 'px';
        el.style.maxHeight = available + 'px';
        el.style.overflow = 'hidden';
      }
    };

    // Initial + delayed (wait for layout)
    syncHeight();
    requestAnimationFrame(syncHeight);
    setTimeout(syncHeight, 300);

    // Only recalculate on orientation change (screen rotation),
    // NOT on resize (keyboard open/close triggers resize and would compress the panel)
    _mobileResizeHandler = () => setTimeout(syncHeight, 300);
    hostWin.addEventListener('orientationchange', _mobileResizeHandler);
  }
  persistedState.value = readPersistedState();
  syncSelectedGlobalPresetFromState();
  applyLayoutStateFromPersisted();
  applyCrossCopyStateFromPersisted();
  applyPanelModeFromPersisted();
  currentTheme.value = isThemeKey(persistedState.value.theme) ? persistedState.value.theme : DEFAULT_THEME_KEY;
  if (isFocusEditing.value) {
    resetFocusPanels();
  }

  // SillyTavern event subscriptions via global context
  const ctx = (window as any).SillyTavern?.getContext?.();
  if (ctx?.eventSource && ctx?.eventTypes) {
    const handler1 = (entries: any) => {
      pushActivationLogs(entries as Array<{ world: string } & Record<string, unknown>>);
    };
    ctx.eventSource.on(ctx.eventTypes.WORLD_INFO_ACTIVATED, handler1);
    subscriptions.push({ stop: () => ctx.eventSource.off(ctx.eventTypes.WORLD_INFO_ACTIVATED, handler1) });

    const handler2 = () => {
      void hardRefresh({ source: 'auto', reason: '世界书数据已更新' });
    };
    ctx.eventSource.on(ctx.eventTypes.WORLDINFO_UPDATED, handler2);
    subscriptions.push({ stop: () => ctx.eventSource.off(ctx.eventTypes.WORLDINFO_UPDATED, handler2) });

    const handler3 = () => {
      void (async () => {
        await refreshBindings();
        refreshRoleBindingCandidates();
        refreshCurrentRoleContext();
        await autoApplyRoleBoundPreset();
        if (globalWorldbookMode.value) {
          ensureSelectionForGlobalMode({
            source: 'auto',
            reason: '聊天切换后同步全局模式选择',
            silentOnCancel: true,
          });
          return;
        }
        trySelectWorldbookByContext({ source: 'auto' });
      })();
    };
    ctx.eventSource.on(ctx.eventTypes.CHAT_CHANGED, handler3);
    subscriptions.push({ stop: () => ctx.eventSource.off(ctx.eventTypes.CHAT_CHANGED, handler3) });
  }

  window.addEventListener('wb-helper:refresh', onPanelRefresh);
  window.addEventListener('wb-helper:save', onPanelSave);
  window.addEventListener('wb-helper:discard', onPanelDiscard);
  window.addEventListener('wb-helper:toggle-theme', toggleTheme);
  window.addEventListener('wb-helper:set-theme', onSetThemeEvent);
  window.addEventListener(FAB_VISIBLE_CHANGED_EVENT, onFabVisibleChanged);
  window.dispatchEvent(new CustomEvent(FAB_VISIBLE_SET_EVENT, { detail: fabVisible.value }));
  const hostWindow = resolveHostWindow();
  hostResizeWindow.value = hostWindow;
  const hostDoc = hostWindow.document;
  hostDoc.addEventListener('pointerdown', onHostPointerDownForWorldbookPicker, true);
  hostDoc.addEventListener('keydown', onHostKeyDownForWorldbookPicker, true);
  hostWindow.addEventListener('resize', handleFloatingWindowResize);

  handleFloatingWindowResize();
  updateHostPanelTheme();
  void hardRefresh({
    source: 'manual',
    reason: '初始化加载',
    preferContextSelection: true,
  });
});

onUnmounted(() => {
  cleanupAllCineArtifacts();
  if (entriesDigestTimer) {
    clearTimeout(entriesDigestTimer);
    entriesDigestTimer = null;
  }
  if (keysDebounceTimer) {
    clearTimeout(keysDebounceTimer);
    keysDebounceTimer = null;
  }
  if (secondaryKeysDebounceTimer) {
    clearTimeout(secondaryKeysDebounceTimer);
    secondaryKeysDebounceTimer = null;
  }
  aiIsGenerating.value = false;
  aiCurrentGenerationId.value = null;
  if (_mobileResizeHandler) {
    try { (window.parent || window).removeEventListener('orientationchange', _mobileResizeHandler); } catch { /* ignore */ }
    _mobileResizeHandler = null;
  }
  const target = window as unknown as Record<string, unknown>;
  target[DIRTY_STATE_KEY] = false;
  subscriptions.forEach(subscription => {
    subscription.stop();
  });
  clearMobileLongPressState();
  stopFloatingDrag();
  stopPaneResize();
  stopCrossCopyPaneResize();
  stopHistorySectionResize();
  window.removeEventListener('wb-helper:refresh', onPanelRefresh);
  window.removeEventListener('wb-helper:save', onPanelSave);
  window.removeEventListener('wb-helper:discard', onPanelDiscard);
  window.removeEventListener('wb-helper:toggle-theme', toggleTheme);
  window.removeEventListener('wb-helper:set-theme', onSetThemeEvent);
  window.removeEventListener(FAB_VISIBLE_CHANGED_EVENT, onFabVisibleChanged);
  hostResizeWindow.value?.document.removeEventListener('pointerdown', onHostPointerDownForWorldbookPicker, true);
  hostResizeWindow.value?.document.removeEventListener('keydown', onHostKeyDownForWorldbookPicker, true);
  hostResizeWindow.value?.removeEventListener('resize', handleFloatingWindowResize);
  hostResizeWindow.value = null;
  _screenSyncCleanup?.();
  _screenSyncCleanup = null;
});

function updateHostPanelTheme() {
  // The panel may live in the parent document (host) — try both
  let panel = document.getElementById('wb-assistant-panel');
  if (!panel) {
    try { panel = window.parent?.document?.getElementById('wb-assistant-panel') ?? null; } catch { /* cross-origin */ }
  }
  if (!panel) return;
  const themeKey = isThemeKey(currentTheme.value) ? currentTheme.value : DEFAULT_THEME_KEY;
  const theme = THEMES[themeKey];
  const colors = theme.colors;

  panel.style.setProperty('--wb-host-bg', colors['--wb-bg-root']);
  panel.style.setProperty('--wb-host-header-bg', colors['--wb-bg-panel']);
  panel.style.setProperty('--wb-host-border', colors['--wb-border-main']);
  panel.style.setProperty('--wb-host-text', colors['--wb-text-main']);
  panel.style.setProperty('--wb-host-tool-bg', colors['--wb-input-bg']);
  panel.style.setProperty('--wb-host-tool-border', colors['--wb-border-subtle']);
  // Glass/dropdown variables for theme dropdown & host shadows
  panel.style.setProperty('--wb-host-dropdown-bg', colors['--wb-dropdown-bg'] || 'rgba(15,15,15,0.7)');
  panel.style.setProperty('--wb-host-shadow', colors['--wb-shadow-main'] || '0 12px 32px rgba(0,0,0,0.5)');
}

watch(currentTheme, (newTheme) => {
  updateHostPanelTheme();
  updatePersistedState(s => { s.theme = newTheme; });
});

watch(hasUnsavedChanges, (val) => {
  const panel = document.getElementById('wb-assistant-panel');
  if (panel) {
    const saveBtn = panel.querySelector('.wb-assistant-save');
    if (saveBtn) {
      if (val) {
        saveBtn.classList.add('glow-pulse');
      } else {
        saveBtn.classList.remove('glow-pulse');
      }
    }
  }
}, { immediate: true });
</script>

