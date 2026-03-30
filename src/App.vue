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
              :search-text="searchText"
              :only-enabled="onlyEnabled"
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
              @update:search-text="searchText = $event"
              @update:only-enabled="onlyEnabled = $event"
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

            <main v-show="!isMobile || showMobileEditor" class="wb-editor">
              <template v-if="selectedEntry">
                <div ref="editorShellRef" class="wb-editor-shell" :style="editorShellStyle">
                  <section class="editor-center" :class="{ focus: isDesktopFocusMode }">
                    <header class="editor-head" :class="{ focus: isDesktopFocusMode }">
                      <div v-if="isMobile" class="editor-back-btn" @click="goBackToList">
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
                          <button class="focus-meta-chip" type="button" :class="{ active: focusMetaPanel.comment }" @click="toggleFocusMetaPanel('comment')">
                            <span>备注</span>
                            <strong>{{ focusCommentSummary }}</strong>
                          </button>
                          <button class="focus-meta-chip" type="button" :class="{ active: focusMetaPanel.keywords }" @click="toggleFocusMetaPanel('keywords')">
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
                        <textarea :value="selectedKeysRaw" @input="selectedKeysRaw = ($event.target as HTMLTextAreaElement).value" @blur="commitKeysFromRaw" class="text-area compact"></textarea>
                      </label>
                      <label class="field">
                        <span>次要关键词 (SECONDARY)</span>
                        <textarea :value="selectedSecondaryKeysRaw" @input="selectedSecondaryKeysRaw = ($event.target as HTMLTextAreaElement).value" @blur="commitSecondaryKeysFromRaw" class="text-area compact"></textarea>
                      </label>
                    </section>

                    <section class="editor-content-block">
                      <div class="editor-content-title">世界观设定 / 内容 (CONTENT)</div>
                      <textarea
                        ref="contentTextareaRef"
                        v-model="selectedEntry.content"
                        class="text-area large editor-content-area"
                      ></textarea>
                      <div
                        class="content-resize-handle"
                        @pointerdown="startContentResize"
                      >
                        <span class="content-resize-grip">⋯</span>
                      </div>
                    </section>

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
                  </section>
                  <div
                    v-show="!isMobile"
                    class="wb-resize-handle editor"
                    :class="{ dragging: paneResizeState?.key === 'editor' }"
                    @pointerdown="startPaneResize('editor', $event)"
                  ></div>

                  <aside class="editor-side" :class="{ focus: isDesktopFocusMode }">
                    <article class="editor-card focus-side-card" :class="{ open: focusSidePanelState.strategy }">
                      <template v-if="isDesktopFocusMode">
                        <button type="button" class="focus-side-summary" @click="toggleFocusSidePanel('strategy')">
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
                              v-model="selectedScanDepthText"
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
                        <button type="button" class="focus-side-summary" @click="toggleFocusSidePanel('insertion')">
                          <span class="focus-side-summary-title">插入设置</span>
                          <span class="focus-side-summary-value">{{ focusInsertionSummary }}</span>
                          <span class="focus-side-summary-arrow">{{ focusSidePanelState.insertion ? '▾' : '▸' }}</span>
                        </button>
                      </template>
                      <h4 v-else>插入设置 (INSERTION)</h4>
                      <div class="focus-side-content" :class="{ hidden: isDesktopFocusMode && !focusSidePanelState.insertion }">
                        <label class="field">
                          <span>位置 (Position)</span>
                          <select
                            v-model="selectedPositionSelectValue"
                            class="text-input"
                          >
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
                        <button type="button" class="focus-side-summary" @click="toggleFocusSidePanel('recursion')">
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
                              <span class="editor-mini-collapse-value">{{ selectedRecursionDelayText || 'null' }}</span>
                            </summary>
                            <div class="editor-mini-collapse-body">
                              <input
                                v-model="selectedRecursionDelayText"
                                type="text"
                                class="text-input"
                                placeholder="留空表示 null"
                              />
                            </div>
                          </details>
                          <details class="editor-mini-collapse">
                            <summary>
                              <span>sticky</span>
                              <span class="editor-mini-collapse-value">{{ selectedStickyText || 'null' }}</span>
                            </summary>
                            <div class="editor-mini-collapse-body">
                              <input
                                v-model="selectedStickyText"
                                type="text"
                                class="text-input"
                                placeholder="留空表示 null"
                              />
                            </div>
                          </details>
                          <details class="editor-mini-collapse">
                            <summary>
                              <span>cooldown</span>
                              <span class="editor-mini-collapse-value">{{ selectedCooldownText || 'null' }}</span>
                            </summary>
                            <div class="editor-mini-collapse-body">
                              <input
                                v-model="selectedCooldownText"
                                type="text"
                                class="text-input"
                                placeholder="留空表示 null"
                              />
                            </div>
                          </details>
                          <details class="editor-mini-collapse">
                            <summary>
                              <span>delay</span>
                              <span class="editor-mini-collapse-value">{{ selectedEffectDelayText || 'null' }}</span>
                            </summary>
                            <div class="editor-mini-collapse-body">
                              <input
                                v-model="selectedEffectDelayText"
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
import { useFindReplace, useMultiEdit, useAIChat, useAIConfig, useTagSystem, useGlobalWorldbooks, useHistorySnapshots, useFocusMode, useEditorLayout, useCrossCopy } from './composables';
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
import './components/crossCopyShared.css';
import './components/globalModeDesktopShared.css';
import './components/tagEditorShared.css';
import './components/aiChatShared.css';
import './components/settingsModalShared.css';
import './components/entryListSidebarShared.css';
import './components/worldbookPickerShared.css';
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
import { THEMES, type ThemeKey } from './themes';
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
  ImportedPayload,
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
let worldbookLoadRequestId = 0;
let pendingWorldbookLoadCount = 0;

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
void aiChatMessagesRef;

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
  worldbookNames, bindings, refreshBindings, ensureSelectionForGlobalMode,
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
_focusClampPaneWidths = clampPaneWidths;
_focusPersistLayoutState = persistLayoutState;
// ── end useFocusMode + useEditorLayout ───────────────────────────────
void contentTextareaRef;
void editorContentBlockRef;

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

function setWorldbookPickerElement(element: HTMLElement | null): void {
  worldbookPickerRef.value = element;
}

function openAiConfigModal(): void {
  aiConfigPreview.value = false;
  aiConfigChanges.value = [];
  aiConfigTargetWorldbook.value = selectedWorldbookName.value || '';
}

function setRolePickerElement(element: HTMLElement | null): void {
  rolePickerRef.value = element;
}

function setAiChatMessagesElement(element: HTMLElement | null): void {
  aiChatMessagesRef.value = element as HTMLDivElement | null;
}

function onSettingsUpdateField(path: string, value: unknown): void {
  updatePersistedState(state => {
    if (path === 'show_ai_chat') {
      state.show_ai_chat = value as boolean;
    } else if (path === 'multi_edit.enabled') {
      state.multi_edit.enabled = value as boolean;
    } else if (path === 'multi_edit.sync_extra_json') {
      state.multi_edit.sync_extra_json = value as boolean;
    } else if (path === 'sort.mode') {
      state.sort.mode = value as 'mutate' | 'view';
    } else if (path === 'sort.reassign_uid') {
      state.sort.reassign_uid = value as boolean;
    } else if (path === 'glass_mode') {
      state.glass_mode = value as boolean;
    }
  });
}

function setRolePickerSearchInputElement(element: HTMLInputElement | null): void {
  rolePickerSearchInputRef.value = element;
}

function setCrossCopyGridElement(element: HTMLElement | null): void {
  crossCopyGridRef.value = element;
}

function setEntryHistoryLayoutElement(element: HTMLElement | null): void {
  entryHistoryLayoutRef.value = element;
}

function setWorldbookHistoryLayoutElement(element: HTMLElement | null): void {
  worldbookHistoryLayoutRef.value = element;
}

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
  const baseColors = THEMES[currentTheme.value].colors;
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

function downloadJson(filename: string, payload: unknown): void {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportCurrentWorldbook(): void {
  if (!selectedWorldbookName.value) {
    return;
  }
  const payload = {
    format: 'worldbook_assistant_v1',
    name: selectedWorldbookName.value,
    exported_at: new Date().toISOString(),
    entries: draftEntries.value,
  };
  const filename = `${selectedWorldbookName.value.replace(/[\\/:*?"<>|]/g, '_')}.json`;
  downloadJson(filename, payload);
}

function collectRawEntries(root: Record<string, unknown>): unknown[] {
  if (Array.isArray(root.entries)) {
    return root.entries;
  }
  const entriesMap = asRecord(root.entries);
  if (entriesMap) {
    return Object.values(entriesMap);
  }
  const dataRoot = asRecord(root.data);
  if (dataRoot) {
    if (Array.isArray(dataRoot.entries)) {
      return dataRoot.entries;
    }
    const dataEntriesMap = asRecord(dataRoot.entries);
    if (dataEntriesMap) {
      return Object.values(dataEntriesMap);
    }
  }
  return [];
}

function parseImportedPayload(fileName: string, text: string): ImportedPayload {
  const parsed = JSON.parse(text) as unknown;
  const fallbackName = fileName.replace(/\.[^/.]+$/, '') || '导入世界书';

  if (Array.isArray(parsed)) {
    return {
      name: fallbackName,
      entries: normalizeEntryList(parsed),
    };
  }

  const root = asRecord(parsed);
  if (!root) {
    throw new Error('导入内容必须是 JSON 对象或数组');
  }

  const entries = collectRawEntries(root);
  if (!entries.length) {
    throw new Error('未识别到有效的 entries');
  }

  const dataRoot = asRecord(root.data);
  const nameCandidate = toStringSafe(root.name ?? dataRoot?.name, fallbackName).trim();

  return {
    name: nameCandidate || fallbackName,
    entries: normalizeEntryList(entries),
  };
}

function triggerImport(): void {
  importFileInput.value?.click();
}

async function onImportChange(event: Event): Promise<void> {
  const target = event.target as HTMLInputElement | null;
  const file = target?.files?.[0];
  if (!file) {
    return;
  }

  const fileText = await file.text();
  try {
    const payload = parseImportedPayload(file.name, fileText);
    const suggested = payload.name || file.name.replace(/\.[^/.]+$/, '');
    const newNameRaw = prompt('请输入新世界书名称', suggested);
    const newName = toStringSafe(newNameRaw).trim();
    if (!newName) {
      return;
    }
    await createOrReplaceWorldbook(newName, payload.entries, { render: 'immediate' });
    await reloadWorldbookNames(newName, {
      source: 'manual',
      reason: '导入后切换到新世界书',
    });
    await refreshBindings();
    toastr.success(`已导入为新世界书: ${newName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const shouldFallback = confirm(`解析导入文件失败: ${message}\n是否尝试按酒馆原生方式导入？`);
    if (!shouldFallback) {
      return;
    }
    const response = await importRawWorldbook(file.name, fileText);
    if (typeof response !== 'string' && !response.ok) {
      throw new Error(`原生导入失败: HTTP ${response.status}`);
    }
    const importedName = typeof response === 'string' ? response.trim() : '';
    await hardRefresh({ source: 'manual', reason: '导入后刷新' });
    if (importedName) setStatus(`原生导入成功: ${importedName}`);
    toastr.success('已按酒馆原生方式导入');
  } finally {
    if (target) {
      target.value = '';
    }
  }
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

function resolveContextWorldbookCandidate(): string | null {
  const available = worldbookNames.value;
  if (!available.length) {
    return null;
  }
  const chatBound = toStringSafe(bindings.chat).trim();
  if (chatBound && available.includes(chatBound)) {
    return chatBound;
  }
  const charPrimary = toStringSafe(bindings.charPrimary).trim();
  if (charPrimary && available.includes(charPrimary)) {
    return charPrimary;
  }
  const charAdditional = bindings.charAdditional.find(name => available.includes(name));
  return charAdditional ?? null;
}

function ensureSelectionForGlobalMode(options: WorldbookSwitchOptions = {}): boolean {
  if (!globalWorldbookMode.value) {
    return true;
  }
  const globals = selectableWorldbookNames.value;
  if (!globals.length) {
    return switchWorldbookSelection('', {
      source: options.source ?? 'auto',
      reason: options.reason ?? '全局模式下无可用世界书',
      allowDirty: options.allowDirty,
      silentOnCancel: options.silentOnCancel,
    });
  }
  if (!globals.includes(selectedWorldbookName.value)) {
    return switchWorldbookSelection(globals[0], {
      source: options.source ?? 'auto',
      reason: options.reason ?? '全局模式同步当前选择',
      allowDirty: options.allowDirty,
      silentOnCancel: options.silentOnCancel,
    });
  }
  return true;
}

function trySelectWorldbookByContext(
  options: { preferWhenEmptyOnly?: boolean; source?: SelectionSource } = {},
): boolean {
  if (globalWorldbookMode.value) {
    return false;
  }
  if (options.preferWhenEmptyOnly && selectedWorldbookName.value) {
    return false;
  }
  const candidate = resolveContextWorldbookCandidate();
  if (!candidate || candidate === selectedWorldbookName.value) {
    return false;
  }
  const switched = switchWorldbookSelection(candidate, {
    source: options.source ?? 'auto',
    reason: '自动定位上下文世界书',
    silentOnCancel: true,
  });
  if (!switched) {
    setStatus('检测到上下文世界书变更，但当前有未保存修改，已取消自动切换');
    return false;
  }
  setStatus(`已自动定位到上下文世界书: ${candidate}`);
  return true;
}

function toggleGlobalMode(): void {
  if (isAnyCineLocked.value) {
    return;
  }
  globalWorldbookMode.value = !globalWorldbookMode.value;
  if (globalWorldbookMode.value) {
    aiGeneratorMode.value = false;
    tagEditorMode.value = false;
    setCrossCopyModeActive(false);
    const synced = ensureSelectionForGlobalMode({
      source: 'manual',
      reason: '切换到全局模式',
      silentOnCancel: true,
    });
    if (!synced) {
      globalWorldbookMode.value = false;
      setStatus('已取消切换到全局世界书模式');
      return;
    }
    setStatus('已切换到全局世界书模式');
    return;
  }
  if (!selectedWorldbookName.value) {
    trySelectWorldbookByContext({ source: 'manual' });
  }
  setStatus('已切换到上下文世界书模式');
}


function runFocusWorldbookAction(action: 'create' | 'duplicate' | 'delete' | 'export' | 'import'): void {
  closeFocusWorldbookMenu();
  if (action === 'create') {
    void createNewWorldbook();
    return;
  }
  if (action === 'duplicate') {
    void duplicateWorldbook();
    return;
  }
  if (action === 'delete') {
    void deleteCurrentWorldbook();
    return;
  }
  if (action === 'export') {
    exportCurrentWorldbook();
    return;
  }
  triggerImport();
}

function closeWorldbookPicker(): void {
  worldbookPickerOpen.value = false;
}

function openWorldbookPicker(): void {
  worldbookPickerSearchText.value = '';
  worldbookPickerOpen.value = true;
}


function toggleWorldbookPicker(): void {
  if (worldbookPickerOpen.value) {
    closeWorldbookPicker();
    return;
  }
  openWorldbookPicker();
}

function toggleTheme(): void {
  const keys = Object.keys(THEMES) as ThemeKey[];
  const index = keys.indexOf(currentTheme.value);
  const nextIndex = (index + 1) % keys.length;
  currentTheme.value = keys[nextIndex];
  setStatus(`已切换主题: ${THEMES[currentTheme.value].name}`);
}

function setTheme(key: ThemeKey): void {
  currentTheme.value = key;
  themePickerOpen.value = false;
  setStatus(`已切换主题: ${THEMES[key].label}`);
}

function onSetThemeEvent(event: Event): void {
  const key = (event as CustomEvent).detail as string;
  if (key && key in THEMES) {
    setTheme(key as ThemeKey);
  }
}

function selectWorldbookFromPicker(name: string): void {
  if (!name) {
    return;
  }
  const switched = switchWorldbookSelection(name, {
    source: 'manual',
    reason: '手动切换世界书',
  });
  if (switched) {
    closeWorldbookPicker();
  }
}

function bindFirstRoleCandidate(): void {
  const first = roleBindingCandidates.value.find(item => !item.bound);
  if (!first) {
    return;
  }
  bindRoleCandidateToSelectedPreset(first);
}

function onHostPointerDownForWorldbookPicker(event: PointerEvent): void {
  if (!worldbookPickerOpen.value && !rolePickerOpen.value && !themePickerOpen.value && !focusWorldbookMenuOpen.value) {
    return;
  }
  const target = event.target as Node | null;
  if (!target) {
    closeWorldbookPicker();
    closeRolePicker();
    closeFocusWorldbookMenu();
    themePickerOpen.value = false;
    return;
  }

  if (worldbookPickerOpen.value) {
    const worldbookRoot = worldbookPickerRef.value;
    if (!worldbookRoot || !worldbookRoot.contains(target)) {
      closeWorldbookPicker();
    }
  }

  if (rolePickerOpen.value) {
    const roleRoot = rolePickerRef.value;
    if (!roleRoot || !roleRoot.contains(target)) {
      closeRolePicker();
    }
  }

  if (themePickerOpen.value) {
    themePickerOpen.value = false;
  }

  if (focusWorldbookMenuOpen.value) {
    const focusMenuRoot = focusWorldbookMenuRef.value;
    if (!focusMenuRoot || !focusMenuRoot.contains(target)) {
      closeFocusWorldbookMenu();
    }
  }
}

function onHostKeyDownForWorldbookPicker(event: KeyboardEvent): void {
  if (!worldbookPickerOpen.value && !rolePickerOpen.value && !focusWorldbookMenuOpen.value) {
    return;
  }
  if (event.key === 'Escape') {
    closeWorldbookPicker();
    closeRolePicker();
    closeFocusWorldbookMenu();
  }
}

async function loadWorldbook(name: string): Promise<void> {
  if (!name) {
    return;
  }
  const requestId = ++worldbookLoadRequestId;
  pendingWorldbookLoadCount += 1;
  isBusy.value = true;
  const isStaleRequest = () => requestId !== worldbookLoadRequestId || selectedWorldbookName.value !== name;
  try {
    let rawEntries: WorldbookEntry[];
    try {
      rawEntries = await getWorldbook(name);
    } catch {
      // Fallback: try trimmed name in case of whitespace mismatch
      rawEntries = await getWorldbook(name.trim());
    }
    if (isStaleRequest()) {
      return;
    }
    const normalized = normalizeEntryList(rawEntries);
    draftEntries.value = klona(normalized);
    originalEntries.value = klona(normalized);
    syncEntriesDigestNow();
    ensureSelectedEntryExists();
    setStatus(`已加载 "${name}"，条目 ${normalized.length}`);
  } catch (error) {
    if (isStaleRequest()) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    if (name !== name.trim()) {
      toastr.error(`读取世界书失败: 世界书名称「${name.trim()}」首尾含有空格，请在酒馆中重命名该世界书以去除空格`);
      setStatus(`读取失败: 世界书名称含首尾空格，请重命名`);
    } else {
      toastr.error(`读取世界书失败: ${message}`);
      setStatus(`读取失败: ${message}`);
    }
  } finally {
    pendingWorldbookLoadCount = Math.max(0, pendingWorldbookLoadCount - 1);
    if (pendingWorldbookLoadCount === 0) {
      isBusy.value = false;
    }
  }
}

async function reloadWorldbookNames(preferred?: string, switchOptions: WorldbookSwitchOptions = {}): Promise<boolean> {
  const names = [...getWorldbookNames()].sort((left, right) => left.localeCompare(right, 'zh-Hans-CN'));
  worldbookNames.value = names;
  normalizeCrossCopyWorldbookSelection();
  persistCrossCopyState();

  if (!names.length) {
    const switched = switchWorldbookSelection('', {
      source: switchOptions.source ?? 'auto',
      reason: switchOptions.reason ?? '世界书列表已为空',
      allowDirty: switchOptions.allowDirty,
      silentOnCancel: true,
    });
    if (!switched) {
      setStatus('世界书列表已变化，但已保留未保存草稿');
      return false;
    }
    draftEntries.value = [];
    originalEntries.value = [];
    selectedEntryUid.value = null;
    return true;
  }

  const fallbackName = persistedState.value.last_worldbook;
  const candidate =
    (preferred && names.includes(preferred) && preferred) ||
    (fallbackName && names.includes(fallbackName) && fallbackName) ||
    selectedWorldbookName.value ||
    names[0];

  if (candidate && selectedWorldbookName.value !== candidate) {
    return switchWorldbookSelection(candidate, {
      source: switchOptions.source ?? 'auto',
      reason: switchOptions.reason ?? '同步世界书选择',
      allowDirty: switchOptions.allowDirty,
      silentOnCancel: true,
    });
  }

  if (selectedWorldbookName.value && !draftEntries.value.length) {
    await loadWorldbook(selectedWorldbookName.value);
  }
  return true;
}

async function hardRefresh(options: HardRefreshOptions = {}): Promise<void> {
  if (!ensureRefreshAllowed(options)) {
    return;
  }
  const allowDirty = hasUnsavedChanges.value;
  persistedState.value = readPersistedState();
  syncSelectedGlobalPresetFromState();
  applyCrossCopyStateFromPersisted();
  const reloaded = await reloadWorldbookNames(selectedWorldbookName.value || undefined, {
    source: options.source ?? 'auto',
    reason: options.reason ?? '刷新后同步世界书',
    allowDirty,
    silentOnCancel: true,
  });
  if (!reloaded) {
    return;
  }
  // Always re-fetch current worldbook data so external changes are synced
  if (selectedWorldbookName.value) {
    await loadWorldbook(selectedWorldbookName.value);
    // Sync raw keyword refs after reload
    selectedKeysRaw.value = selectedKeysText.value;
    selectedSecondaryKeysRaw.value = selectedSecondaryKeysText.value;
  }
  await refreshBindings();
  refreshRoleBindingCandidates();
  refreshCurrentRoleContext();
  await autoApplyRoleBoundPreset();
  if (globalWorldbookMode.value) {
    ensureSelectionForGlobalMode({
      source: options.source ?? 'auto',
      reason: '刷新后同步全局模式选择',
      allowDirty,
      silentOnCancel: true,
    });
  } else {
    trySelectWorldbookByContext({
      preferWhenEmptyOnly: options.preferContextSelection !== true,
      source: options.source ?? 'auto',
    });
  }
  setStatus('已刷新世界书和绑定信息');
}

async function saveCurrentWorldbook(): Promise<void> {
  if (!selectedWorldbookName.value) {
    toastr.warning('请先选择世界书');
    return;
  }
  if (!hasUnsavedChanges.value) {
    setStatus('当前没有需要保存的修改');
    return;
  }
  isSaving.value = true;
  try {
    draftEntries.value = normalizeEntryList(draftEntries.value.map(entry => klona(entry)));
    const pendingEntrySnapshots = collectEntrySnapshotsBeforeSave();
    const savedEntrySnapshotCount = pushEntrySnapshotsBulk(pendingEntrySnapshots);
    await replaceWorldbook(selectedWorldbookName.value, klona(draftEntries.value), { render: 'immediate' });
    originalEntries.value = klona(draftEntries.value);
    syncEntriesDigestNow();
    pushSnapshot('保存后快照');
    await refreshBindings();
    toastr.success(`已保存: ${selectedWorldbookName.value}`);
    setStatus(`保存成功: ${selectedWorldbookName.value}（条目历史 +${savedEntrySnapshotCount}）`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`保存失败: ${message}`);
    setStatus(`保存失败: ${message}`);
  } finally {
    isSaving.value = false;
  }
}

async function createNewWorldbook(): Promise<void> {
  const nameRaw = prompt('请输入新世界书名称');
  const name = toStringSafe(nameRaw).trim();
  if (!name) {
    return;
  }
  try {
    await createOrReplaceWorldbook(name, [], { render: 'immediate' });
    await reloadWorldbookNames(name, {
      source: 'manual',
      reason: '创建世界书后切换',
    });
    await refreshBindings();
    toastr.success(`已创建世界书: ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`创建失败: ${message}`);
  }
}

async function duplicateWorldbook(): Promise<void> {
  if (!selectedWorldbookName.value) {
    return;
  }
  const suggested = `${selectedWorldbookName.value}_copy`;
  const newNameRaw = prompt('请输入复制后的名称', suggested);
  const newName = toStringSafe(newNameRaw).trim();
  if (!newName) {
    return;
  }
  try {
    await createOrReplaceWorldbook(newName, klona(draftEntries.value), { render: 'immediate' });
    await reloadWorldbookNames(newName, {
      source: 'manual',
      reason: '复制世界书后切换',
    });
    await refreshBindings();
    toastr.success(`已复制为: ${newName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`复制失败: ${message}`);
  }
}

async function deleteCurrentWorldbook(): Promise<void> {
  if (!selectedWorldbookName.value) {
    return;
  }
  const current = selectedWorldbookName.value;
  if (!confirm(`确定删除世界书 "${current}" ?`)) {
    return;
  }
  try {
    const success = await deleteWorldbook(current);
    if (!success) {
      throw new Error('返回 false');
    }
    updatePersistedState(state => {
      delete state.history[current];
      delete state.entry_history[current];
    });
    toastr.success(`已删除: ${current}`);
    await reloadWorldbookNames(undefined, {
      source: 'manual',
      reason: '删除世界书后同步选择',
      allowDirty: true,
    });
    await refreshBindings();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toastr.error(`删除失败: ${message}`);
  }
}

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
  currentTheme.value = persistedState.value.theme || 'ocean';
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
  const theme = THEMES[currentTheme.value];
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

<style scoped>

/* ═══ Browse Mode Styles ═══ */

.browse-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 12px;
}

.browse-search {
  flex: 1;
  min-width: 120px;
  max-width: 320px;
}

.browse-mode-switch {
  display: flex;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--wb-border-main);
  margin-left: auto;
}

.browse-mode-btn {
  border-radius: 0 !important;
  border: none !important;
  font-size: 12px;
  padding: 4px 12px;
  background: transparent;
  color: var(--wb-text-muted);
  transition: all 0.2s ease;
}

.browse-mode-btn.active {
  background: var(--wb-accent);
  color: #fff;
}

.browse-bindings {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  flex-wrap: wrap;
  font-size: 12px;
}

.binding-tag {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.binding-tag.global {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}

.binding-tag.char {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.binding-tag.chat {
  background: rgba(234, 179, 8, 0.15);
  color: #facc15;
}

.browse-entry-count {
  color: var(--wb-text-muted);
  font-size: 11px;
}

.browse-action-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  flex-wrap: wrap;
  font-size: 12px;
}

.browse-action-spacer {
  flex: 1;
}

.browse-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 12px 12px;
}

.browse-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
  align-items: stretch;
}

.browse-card {
  background: var(--wb-bg-card, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--wb-border-main);
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.browse-card:hover {
  border-color: var(--wb-accent);
  box-shadow: 0 0 12px rgba(var(--wb-accent-rgb, 56, 189, 248), 0.15);
}

.browse-card.expanded {
  cursor: default;
  grid-column: 1 / -1;
  border-color: var(--wb-accent);
  box-shadow: 0 0 20px rgba(var(--wb-accent-rgb, 56, 189, 248), 0.1);
}

.browse-card.disabled {
  opacity: 0.55;
}

.browse-card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.browse-card-title {
  flex: 1;
  font-weight: 600;
  font-size: 13px;
  color: var(--wb-text-main);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.browse-toggle-wrap {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  font-size: 11px;
  flex-shrink: 0;
}

.browse-toggle-wrap input[type="checkbox"] {
  accent-color: var(--wb-accent);
}

.browse-toggle-label {
  color: var(--wb-text-muted);
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
}

.browse-card-keys {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.browse-key-chip {
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--wb-text-muted);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.browse-key-chip.more {
  background: transparent;
  color: var(--wb-accent);
  border-color: var(--wb-accent);
}

.browse-card-preview {
  font-size: 12px;
  color: var(--wb-text-muted);
  line-height: 1.5;
  max-height: clamp(3em, 8vh, 8em);
  overflow: hidden;
  white-space: pre-wrap;
  word-break: break-word;
  mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
  -webkit-mask-image: linear-gradient(to bottom, black 60%, transparent 100%);
}

.browse-card-meta {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.browse-meta-pill {
  padding: 1px 8px;
  border-radius: 6px;
  font-size: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--wb-text-muted);
}

.browse-meta-pill[data-status="constant"] {
  background: rgba(59, 130, 246, 0.12);
  color: #60a5fa;
}

.browse-meta-pill[data-status="selective"] {
  background: rgba(34, 197, 94, 0.12);
  color: #4ade80;
}

/* Expanded card inline editor */

.browse-card-expanded {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--wb-border-main);
  margin-top: 4px;
}

.browse-keys-input {
  resize: vertical;
  min-height: 24px;
  font-size: 12px;
}

.browse-secondary-keys-row {
  display: flex;
  gap: 6px;
}

.browse-secondary-keys-row select {
  width: 110px;
  flex-shrink: 0;
}

.browse-secondary-keys-row textarea {
  flex: 1;
}

.browse-content-input {
  resize: vertical;
  min-height: 280px;
  max-height: 70vh;
  font-size: 12px;
  font-family: inherit;
  line-height: 1.5;
}

.browse-config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.browse-recursion-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.browse-card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  padding-top: 6px;
  border-top: 1px solid var(--wb-border-main);
}

.browse-card-actions .btn:last-child {
  margin-left: auto;
}

.browse-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 16px;
  color: var(--wb-text-muted);
  gap: 8px;
}

.browse-empty-icon {
  font-size: 40px;
  opacity: 0.4;
}

.browse-empty-text {
  font-size: 14px;
}

/* Glow pulse for unsaved changes */
@keyframes glow-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(var(--wb-accent-rgb, 56, 189, 248), 0.3); }
  50% { box-shadow: 0 0 12px rgba(var(--wb-accent-rgb, 56, 189, 248), 0.7); }
}

.glow-pulse {
  animation: glow-pulse 2s ease-in-out infinite;
}

/* Mobile browse overrides */

.mobile-browse-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mobile-browse-toolbar {
  padding: 6px 8px;
  gap: 6px;
}

.mobile-browse-toolbar .browse-search {
  max-width: none;
  min-width: 80px;
}

.mobile-browse-scroll {
  padding: 0 8px 8px;
}

.mobile-browse-bindings {
  padding: 4px 0;
}

.mobile-browse-grid {
  grid-template-columns: 1fr;
  gap: 8px;
}

.mobile-browse-grid .browse-card.expanded {
  grid-column: auto;
}

.mobile-config-grid {
  grid-template-columns: 1fr 1fr;
}

.browse-global-mode {
  padding: 8px 12px;
}

.hidden-input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
  pointer-events: none;
}

/* Load more sentinel */

.browse-load-more-sentinel {
  grid-column: 1 / -1;
  display: flex;
  justify-content: center;
  padding: 16px;
}

.browse-load-more-text {
  font-size: 12px;
  color: var(--wb-text-muted);
  opacity: 0.6;
}

/* ═══ End Browse Mode Styles ═══ */

.wb-assistant-root {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 12px;
  background: var(--wb-bg-root);
  color: var(--wb-text-main);
  font-size: 13px;
  line-height: 1.5;
  border-radius: 12px;
  overflow: hidden;
}

/* Glassmorphism Styles */
.wb-assistant-root.is-glass-mode {
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.wb-assistant-root.is-glass-mode .wb-editor-container,
.wb-assistant-root.is-glass-mode .wb-layout-sidebar,
.wb-assistant-root.is-glass-mode .wb-entry-list,
.wb-assistant-root.is-glass-mode .st-utility-panel,
.wb-assistant-root.is-glass-mode .wb-modal-window {
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-color: color-mix(in srgb, var(--wb-border-main) 50%, transparent);
}
.wb-assistant-root.is-glass-mode .utility-btn {
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.focus-cine-overlay {
  position: absolute;
  inset: 0;
  z-index: 10290;
  pointer-events: auto;
  overflow: hidden;
}

.focus-cine-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 50% 40%, rgba(125, 211, 252, 0.14), rgba(2, 6, 23, 0.42) 72%),
    radial-gradient(circle at 50% 50%, rgba(2, 6, 23, 0), rgba(2, 6, 23, 0.42) 100%);
  animation: focus-cine-vignette 1400ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.copy-cine-overlay {
  position: absolute;
  inset: 0;
  z-index: 10292;
  pointer-events: auto;
  overflow: hidden;
}

.copy-cine-overlay::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 52% 46%, rgba(125, 211, 252, 0.12), rgba(2, 6, 23, 0.46) 70%),
    radial-gradient(circle at 48% 60%, rgba(2, 6, 23, 0), rgba(2, 6, 23, 0.38) 100%);
  animation: copy-cine-vignette 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.focus-cine-ghost {
  position: fixed;
  z-index: 10305;
  margin: 0;
  pointer-events: none;
  transform-origin: center center;
  will-change: transform, opacity, filter;
  filter: drop-shadow(0 10px 20px rgba(2, 6, 23, 0.45));
  animation-name: focus-cine-hero-flight;
  animation-fill-mode: forwards;
}

.copy-cine-ghost {
  position: fixed;
  z-index: 10308;
  margin: 0;
  pointer-events: none;
  transform-origin: center center;
  will-change: transform, opacity, filter;
  filter: drop-shadow(0 10px 20px rgba(2, 6, 23, 0.42));
  animation-name: copy-cine-hero-flight;
  animation-fill-mode: forwards;
}

[data-focus-hero].focus-cine-real-hidden {
  visibility: hidden !important;
}

[data-copy-hero].copy-cine-real-hidden {
  visibility: hidden !important;
}

@keyframes focus-cine-vignette {
  0% {
    opacity: 0;
  }
  35% {
    opacity: 0.86;
  }
  100% {
    opacity: 0.2;
  }
}

@keyframes focus-cine-hero-flight {
  0% {
    opacity: var(--cine-from-opacity, 1);
    transform: translate3d(0, 0, 0) scale(1, 1);
  }
  60% {
    opacity: 1;
    transform: translate3d(calc(var(--cine-dx, 0px) * 0.6), calc(var(--cine-dy, 0px) * 0.6 + var(--cine-arc-y, -20px)), 0)
      scale(calc(var(--cine-scale-x, 1) * 1.04), calc(var(--cine-scale-y, 1) * 1.04));
  }
  100% {
    opacity: var(--cine-to-opacity, 1);
    transform: translate3d(var(--cine-dx, 0px), var(--cine-dy, 0px), 0) scale(var(--cine-scale-x, 1), var(--cine-scale-y, 1));
  }
}

@keyframes copy-cine-vignette {
  0% {
    opacity: 0;
  }
  40% {
    opacity: 0.8;
  }
  100% {
    opacity: 0.16;
  }
}

@keyframes copy-cine-hero-flight {
  0% {
    opacity: var(--copy-cine-from-opacity, 1);
    transform: translate3d(0, 0, 0) scale(1, 1);
  }
  60% {
    opacity: 1;
    transform: translate3d(
      calc(var(--copy-cine-dx, 0px) * 0.62),
      calc(var(--copy-cine-dy, 0px) * 0.62 + var(--copy-cine-arc-y, -12px)),
      0
    ) scale(
      calc(var(--copy-cine-scale-x, 1) * 1.03),
      calc(var(--copy-cine-scale-y, 1) * 1.03)
    );
  }
  100% {
    opacity: var(--copy-cine-to-opacity, 1);
    transform: translate3d(var(--copy-cine-dx, 0px), var(--copy-cine-dy, 0px), 0) scale(var(--copy-cine-scale-x, 1), var(--copy-cine-scale-y, 1));
  }
}


.wb-scroll-area {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wb-scroll-area.copy-workspace {
  overflow: hidden;
}

.wb-settings-wrapper {
  width: 100%;
}

.wb-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 12px;
  padding: 16px 20px;
  background: var(--wb-bg-panel);
  margin-bottom: 8px;
  border: 1px solid var(--wb-border-subtle);
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
}

.wb-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-title strong {
  font-size: 16px;
}

.wb-title span {
  color: var(--wb-text-muted);
}

.wb-header-actions,
.list-actions,
.tool-line {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-toolbar {
  position: relative;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  border-radius: 12px;
  padding: 10px 12px;
  background: var(--wb-bg-panel);
}

.focus-cine-sink-row {
  position: absolute;
  right: 12px;
  top: 10px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  opacity: 0;
  pointer-events: none;
}

.focus-cine-sink {
  width: 86px;
  height: 34px;
  border-radius: 8px;
}

.wb-focus-toolbar {
  border-radius: 12px;
  padding: 10px 12px;
  display: grid;
  gap: 8px;
  background: var(--wb-bg-panel);
  border: 1px solid var(--wb-border-subtle);
  transition: padding 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.wb-focus-toolbar.compact {
  padding: 8px 10px;
}

.wb-focus-toolbar-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: nowrap;
  min-width: 0;
}

.wb-focus-core-group,
.wb-focus-tool-entry {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex-wrap: nowrap;
}

.wb-focus-core-group {
  flex: 1 1 auto;
}

.wb-focus-tool-entry {
  position: relative;
}

.focus-toolbar-label {
  min-width: 220px;
  flex: 1 1 auto;
}

.focus-toolbar-label-text {
  white-space: nowrap;
}

.wb-focus-tool-entry .btn {
  white-space: nowrap;
}

.wb-focus-toolbar.compact .btn {
  padding: 6px 10px;
  font-size: 12px;
}

.focus-menu-wrap {
  position: relative;
}

.focus-cine-sink-cluster {
  position: absolute;
  right: 0;
  top: 50%;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
  z-index: 0;
}

.focus-cine-sink-cluster .focus-cine-sink {
  position: absolute;
  right: 0;
  top: 0;
  transform: translateY(-50%);
}

.focus-menu-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 10140;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  background: var(--wb-dropdown-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  padding: 8px;
  min-width: 168px;
  display: grid;
  gap: 6px;
}

.focus-menu-pop-enter-active,
.focus-menu-pop-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.focus-menu-pop-enter-from,
.focus-menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.wb-focus-tools-band {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
  justify-self: end;
  margin-left: auto;
  max-width: 100%;
  padding-top: 2px;
}

.wb-focus-tools-band > .btn {
  animation: focus-tool-stagger 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.wb-focus-tools-band > .btn:nth-child(2) { animation-delay: 20ms; }
.wb-focus-tools-band > .btn:nth-child(3) { animation-delay: 40ms; }
.wb-focus-tools-band > .btn:nth-child(4) { animation-delay: 60ms; }
.wb-focus-tools-band > .btn:nth-child(5) { animation-delay: 80ms; }
.wb-focus-tools-band > .btn:nth-child(6) { animation-delay: 100ms; }
.wb-focus-tools-band > .btn:nth-child(7) { animation-delay: 120ms; }
.wb-focus-tools-band > .btn:nth-child(8) { animation-delay: 140ms; }
.wb-focus-tools-band > .btn:nth-child(9) { animation-delay: 160ms; }
.wb-focus-tools-band > .btn:nth-child(10) { animation-delay: 180ms; }
.wb-focus-tools-band > .btn:nth-child(11) { animation-delay: 200ms; }
.wb-focus-tools-band > .btn:nth-child(12) { animation-delay: 220ms; }

@keyframes focus-tool-stagger {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.focus-tools-band-enter-active,
.focus-tools-band-leave-active {
  transition: opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1), max-height 220ms ease;
  transform-origin: top right;
}

.focus-tools-band-enter-from,
.focus-tools-band-leave-to {
  opacity: 0;
  transform: translate(18px, -8px) scale(0.96);
  max-height: 0;
}

.focus-tools-band-enter-to,
.focus-tools-band-leave-from {
  opacity: 1;
  transform: translate(0, 0) scale(1);
  max-height: 300px;
}

.focus-tools-trigger-enter-active,
.focus-tools-trigger-leave-active {
  transition: opacity 140ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
}

.focus-tools-trigger-enter-from,
.focus-tools-trigger-leave-to {
  opacity: 0;
  transform: translate(-14px, 10px);
}

.focus-tools-collapse {
  margin-left: auto;
}

.toolbar-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--wb-text-muted);
  min-width: 320px;
  flex: 1 1 520px;
}

.toolbar-select {
  min-width: 200px;
}

.toolbar-select.small {
  min-width: 160px;
}

.wb-bindings {
  border-radius: 12px;
  padding: 12px;
  display: grid;
  gap: 8px;
  background: var(--wb-bg-panel);
}

.wb-bindings.copy-workspace {
  padding: 8px 10px;
  gap: 6px;
}

.wb-bindings.focus-bindings {
  padding: 0;
  background: transparent;
}


/* View Transitions */
.mobile-tab-enter-active,
.mobile-tab-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  width: 100%;
  height: 100%;
}
.mobile-tab-enter-from {
  opacity: 0;
  transform: translateX(15px);
}
.mobile-tab-leave-to {
  opacity: 0;
  transform: translateX(-15px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

.desktop-content-enter-active,
.desktop-content-leave-active {
  transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.desktop-content-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.desktop-content-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.history-btn {
  border-color: var(--wb-primary);
  background: var(--wb-primary-soft);
}

.utility-btn {
  border-color: var(--wb-primary-light);
  background: var(--wb-primary-soft);
}

.utility-btn.active {
  border-color: var(--wb-primary-light);
  background: var(--wb-primary-soft);
  color: var(--wb-primary-light);
}

.wb-assistant-root.focus-cine-locked .wb-main-layout {
  transition-duration: 1400ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.wb-assistant-root.copy-cine-locked .wb-bindings,
.wb-assistant-root.copy-cine-locked .cross-copy-panel.desktop,
.wb-assistant-root.copy-cine-locked .wb-main-layout {
  transition:
    opacity 1100ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 1100ms cubic-bezier(0.22, 1, 0.36, 1),
    filter 1100ms cubic-bezier(0.22, 1, 0.36, 1);
  will-change: transform, opacity, filter;
}

.wb-assistant-root.copy-cine-enter.copy-cine-running .wb-bindings {
  animation: copy-cine-bindings-enter 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.wb-assistant-root.copy-cine-enter.copy-cine-running .cross-copy-panel.desktop {
  animation: copy-cine-panel-enter 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.wb-assistant-root.copy-cine-exit.copy-cine-running .wb-bindings {
  animation: copy-cine-bindings-exit 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.wb-assistant-root.copy-cine-exit.copy-cine-running .wb-main-layout {
  animation: copy-cine-main-enter 1100ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes copy-cine-bindings-enter {
  0% {
    opacity: 0;
    transform: translateY(-10px) scale(0.992);
    filter: blur(1px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes copy-cine-bindings-exit {
  0% {
    opacity: 0;
    transform: translateY(-6px) scale(0.994);
    filter: blur(1px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes copy-cine-panel-enter {
  0% {
    opacity: 0;
    transform: translateY(16px) scale(0.985);
    filter: blur(1.5px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.wb-resize-handle {
  position: relative;
  width: 10px;
  cursor: col-resize;
  user-select: none;
  touch-action: none;
}

.wb-resize-handle::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  border-radius: 999px;
  background: var(--wb-primary-hover);
  transition: background-color 0.15s ease;
}

.wb-resize-handle:hover::before,
.wb-resize-handle.dragging::before {
  background: var(--wb-primary-light);
}

.editor-center {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 16px;
  background: var(--wb-bg-panel);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  height: 100%;
  overflow: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  transition: padding 320ms cubic-bezier(0.22, 1, 0.36, 1), gap 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-center.focus {
  padding: 18px;
}

.editor-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  border-bottom: 1px solid var(--wb-border-subtle);
  padding-bottom: 16px;
  transition: gap 320ms cubic-bezier(0.22, 1, 0.36, 1), padding-bottom 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.editor-head.focus {
  align-items: center;
  gap: 10px;
}

.focus-meta-summary-row {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
  align-items: center;
}

.focus-meta-chip {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 999px;
  background: var(--wb-input-bg);
  color: var(--wb-text-main);
  padding: 4px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 12px;
  max-width: 48%;
}

.focus-meta-chip strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-meta-chip.active {
  border-color: var(--wb-primary-light);
  background: var(--wb-primary-soft);
}

.focus-meta-panel {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  padding: 10px;
  background: var(--wb-input-bg);
}

.focus-meta-panel-enter-active,
.focus-meta-panel-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.focus-meta-panel-enter-from,
.focus-meta-panel-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.editor-comment {
  flex: 1;
}

.editor-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.editor-badge {
  font-size: 11px;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 999px;
  padding: 3px 10px;
  color: var(--wb-text-main);
  background: var(--wb-bg-panel);
  white-space: nowrap;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0,0,0,0.02);
}

.editor-badge.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

.editor-badge.on {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.2);
}

.editor-badge.off {
  color: var(--wb-text-muted);
  background: var(--wb-bg-root);
}

.editor-badge.strategy[data-status='constant'] {
  color: #3b82f6;
  background: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.2);
}

.editor-badge.strategy[data-status='vector'] {
  color: #a855f7;
  background: rgba(168, 85, 247, 0.1);
  border-color: rgba(168, 85, 247, 0.2);
}

.editor-badge.strategy[data-status='normal'] {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
  border-color: rgba(16, 185, 129, 0.2);
}

.editor-badge.strategy[data-status='disabled'] {
  color: var(--wb-text-muted);
  background: var(--wb-bg-root);
}

.editor-keyword-grid .text-area.compact {
  min-height: 36px;
  height: 36px;
  line-height: 1.35;
}

.editor-content-block {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.editor-content-title {
  font-size: 12px;
  color: var(--wb-primary-light);
  letter-spacing: 0.01em;
}

.editor-content-area {
  min-height: 320px;
  flex: 1;
  resize: none;
  line-height: 1.5;
}

.content-resize-handle {
  display: none;
  align-items: center;
  justify-content: center;
  height: 22px;
  cursor: ns-resize;
  background: var(--wb-bg-panel);
  border-radius: 0 0 8px 8px;
  touch-action: none;
  user-select: none;
}

.content-resize-grip {
  font-size: 12px;
  color: var(--wb-text-dim);
  letter-spacing: 3px;
  line-height: 1;
}

.editor-advanced {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  padding: 12px;
  background: var(--wb-input-bg);
}

.editor-advanced > summary {
  cursor: pointer;
  font-size: 12px;
  color: var(--wb-text-muted);
}

.editor-advanced[open] > summary {
  margin-bottom: 7px;
}

.editor-collapsible-group {
  display: grid;
  gap: 8px;
}

.editor-mini-collapse {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  background: var(--wb-input-bg);
}

.editor-mini-collapse > summary {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--wb-primary-light);
  font-size: 12px;
}

.editor-mini-collapse > summary::-webkit-details-marker {
  display: none;
}

.editor-mini-collapse > summary::after {
  content: '▾';
  margin-left: 6px;
  color: var(--wb-text-muted);
  transform: rotate(-90deg);
  transition: transform 0.2s ease;
}

.editor-mini-collapse[open] > summary::after {
  transform: rotate(0deg);
}

.editor-mini-collapse-value {
  margin-left: auto;
  color: var(--wb-text-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.editor-mini-collapse-body {
  padding: 0 10px 10px;
}

.editor-mini-collapse.disabled {
  opacity: 0.56;
}

.editor-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  overflow: auto;
}

.editor-side.focus .editor-grid.two-cols,
.editor-side.focus .editor-grid.three-cols {
  grid-template-columns: 1fr;
}

.editor-card {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 12px;
  padding: 16px;
  background: var(--wb-bg-panel);
  display: grid;
  gap: 10px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.focus-side-card {
  transition: border-color 220ms ease, box-shadow 220ms ease;
}

.focus-side-summary {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  background: var(--wb-input-bg);
  color: var(--wb-text-main);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.focus-side-summary-title {
  color: var(--wb-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.focus-side-summary-value {
  color: var(--wb-text-muted);
  margin-left: auto;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-side-summary-arrow {
  color: var(--wb-text-muted);
  font-size: 12px;
}

.focus-side-content {
  display: grid;
  gap: 10px;
}

.focus-side-content.hidden {
  display: none;
}

.editor-card h4 {
  margin: 0;
  font-size: 12px;
  color: var(--wb-primary);
}

.strategy-switch {
  display: grid;
  gap: 6px;
}

.strategy-pill {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  background: var(--wb-input-bg);
  color: var(--wb-text-muted);
  padding: 8px 12px;
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.strategy-pill:hover {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
}

.strategy-pill.active.constant {
  background: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
  border-color: rgba(59, 130, 246, 0.3);
}

.strategy-pill.active.vector {
  background: rgba(168, 85, 247, 0.12);
  color: #a855f7;
  border-color: rgba(168, 85, 247, 0.3);
}

.strategy-pill.active.selective {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.3);
}

.editor-grid {
  display: grid;
  gap: 8px;
}

.editor-grid.two-cols {
  grid-template-columns: 1fr 1fr;
}

.editor-grid.three-cols {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field > span {
  color: var(--wb-primary-light);
}

.field.disabled {
  opacity: 0.56;
}

.field-end {
  align-self: end;
}

.field-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.wb-assistant-root .text-input,
.wb-assistant-root .text-area,
.wb-assistant-root .toolbar-select {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--wb-text-main);
  background: var(--wb-input-bg);
  transition: background 0.25s cubic-bezier(0.25, 1, 0.5, 1), border-color 0.25s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.25s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
}

.wb-assistant-root .text-input:hover,
.wb-assistant-root .text-area:hover,
.wb-assistant-root .toolbar-select:hover {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
}

.wb-assistant-root .text-input:focus,
.wb-assistant-root .text-area:focus,
.wb-assistant-root .toolbar-select:focus {
  background: var(--wb-input-bg-focus);
  border-color: var(--wb-primary-light);
  outline: none;
  box-shadow: 0 0 0 3px var(--wb-primary-soft), inset 0 1px 2px rgba(0,0,0,0.05);
}

.text-area {
  min-height: 96px;
  resize: vertical;
}

.text-area.compact {
  min-height: 84px;
}

.text-area.large {
  min-height: 190px;
}

.checkbox-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.wb-tools-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tool-card {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 170px;
  background: var(--wb-bg-panel);
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.tool-card h4 {
  margin: 0;
  font-size: 13px;
  color: var(--wb-primary-light);
}

.history-compare {
  display: grid;
  gap: 6px;
}

.history-preview-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.history-preview-card {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  display: grid;
  gap: 4px;
  background: var(--wb-bg-panel);
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.history-preview-card strong {
  color: var(--wb-primary-light);
  font-size: 11px;
}

.history-preview-card span {
  color: var(--wb-text-muted);
  font-size: 11px;
  line-height: 1.35;
}

.history-note {
  border: 1px dashed var(--wb-border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  color: var(--wb-text-dim);
  font-size: 12px;
  background: rgba(0, 0, 0, 0.02);
  text-align: center;
}

.wb-status {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 12px;
  background: var(--wb-bg-panel);
  padding: 12px 14px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  color: var(--wb-text-main);
  flex-wrap: wrap;
  transition: background 0.3s ease, border-color 0.3s ease;
}

@keyframes wb-status-pulse {
  0% { opacity: 0.8; box-shadow: 0 0 0 rgba(250, 204, 21, 0); }
  50% { opacity: 1; color: #facc15; box-shadow: 0 0 12px rgba(250, 204, 21, 0.2); }
  100% { opacity: 0.8; box-shadow: 0 0 0 rgba(250, 204, 21, 0); }
}

.wb-status.has-unsaved {
  animation: wb-status-pulse 2s infinite ease-in-out;
  border: 1px solid rgba(250, 204, 21, 0.4);
}

.wb-assistant-root .btn {
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
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  transform: translateZ(0);
}

@keyframes wb-btn-pulse {
  0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.4); border-color: rgba(52, 211, 153, 0.6); }
  70% { box-shadow: 0 0 0 4px rgba(52, 211, 153, 0); border-color: rgba(52, 211, 153, 1); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); border-color: rgba(52, 211, 153, 0.6); }
}

.wb-assistant-root .btn.glow-pulse {
  animation: wb-btn-pulse 2s infinite ease-out;
  border-color: #34d399;
  color: #34d399;
  font-weight: 500;
}

.wb-assistant-root .btn:hover:not(:disabled) {
  background: var(--wb-input-bg-hover);
  border-color: var(--wb-border-main);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.wb-assistant-root .btn:active:not(:disabled) {
  transform: translateY(1px) scale(0.97);
  box-shadow: 0 0 0 0 transparent;
}

.wb-assistant-root .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.wb-assistant-root .btn.primary {
  background: var(--wb-primary-soft);
  border-color: var(--wb-primary);
  color: var(--wb-primary-light);
}

.wb-assistant-root .btn.primary:hover:not(:disabled) {
  background: var(--wb-primary);
  color: #fff;
  box-shadow: 0 4px 12px var(--wb-primary-soft);
}

.wb-assistant-root .btn.danger {
  background: rgba(225, 29, 72, 0.1);
  border-color: rgba(225, 29, 72, 0.4);
  color: #f43f5e;
}

.wb-assistant-root .btn.danger:hover:not(:disabled) {
  background: #e11d48;
  color: #fff;
  border-color: #be123c;
  box-shadow: 0 4px 12px rgba(225, 29, 72, 0.2);
}

.wb-assistant-root .btn.mini {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 6px;
}

.empty-note,
.empty-block {
  color: var(--wb-text-dim);
  font-size: 13px;
  text-align: center;
  letter-spacing: 0.02em;
}

.empty-block {
  padding: 24px 16px;
  border: 1px dashed var(--wb-border-subtle);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.02);
  margin: 10px 0;
}

.hidden-input {
  display: none;
}

@media (max-width: 1380px) {
  .wb-editor-shell {
    grid-template-columns: 1fr;
  }

  .editor-side {
    overflow: visible;
    max-height: none;
  }
}

@media (max-width: 1100px) {
  .wb-resize-handle {
    display: none;
  }

  .wb-main-layout {
    grid-template-columns: 1fr;
  }

  .wb-tools-grid {
    grid-template-columns: 1fr;
  }

  .editor-grid.two-cols,
  .editor-grid.three-cols {
    grid-template-columns: 1fr;
  }

  .editor-head {
    flex-direction: column;
    align-items: stretch;
  }

  .editor-badges {
    justify-content: flex-start;
  }

  .history-preview-grid {
    grid-template-columns: 1fr;
  }

  .wb-history-visual-main .cross-copy-content-grid {
    grid-template-columns: 1fr;
  }

  .wb-history-visual-main .cross-copy-content-col + .cross-copy-content-col {
    border-left: none;
    border-top: 1px solid var(--wb-border-main);
  }

  .wb-status {
    flex-direction: column;
  }
}

.editor-back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  margin: 0 0 8px 0;
  background: var(--wb-bg-panel);
  border: none;
  border-radius: 6px;
  color: var(--wb-primary);
  font-weight: 600;
  cursor: pointer;
}

.editor-back-btn:hover {
  background: var(--wb-primary-hover);
}

/* ═══ Mobile Tab View ═══ */
.mobile-tab-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.mobile-tab-content {
  flex: 1;
  min-height: 0;
  position: relative;
}

.mobile-pane {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  padding: 8px;
  -webkit-overflow-scrolling: touch;
}

.mobile-entry-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mobile-multi-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  padding: 8px;
  background: var(--wb-bg-panel);
  margin-bottom: 4px;
}

.mobile-multi-title {
  font-size: 12px;
  color: var(--wb-primary-light);
}

.mobile-multi-actions {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.mobile-multi-item {
  position: relative;
}

.mobile-multi-checkbox {
  flex-shrink: 0;
}

.mobile-multi-content-note {
  margin-bottom: 6px;
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: #fbbf24;
  background: rgba(245, 158, 11, 0.08);
}

.mobile-danger-zone {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--wb-border);
}

.mobile-danger-zone .btn {
  flex: 1;
}

.mobile-tab-bar {
  flex-shrink: 0;
  z-index: 10100;
  display: flex;
  border-top: 1px solid var(--wb-border-main);
  background: var(--wb-bg-panel);
  height: 52px;
}

.mobile-tab-bar button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: none;
  background: transparent;
  color: var(--wb-text-muted);
  font-size: 10px;
  padding: 4px 0;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  -webkit-tap-highlight-color: transparent;
}

.mobile-tab-bar button.active {
  color: var(--wb-primary-light);
  background: var(--wb-primary-soft);
}

.mobile-tab-bar .tab-icon {
  font-size: 20px;
  line-height: 1;
}

.mobile-tab-bar .tab-label {
  font-weight: 500;
}

.wb-assistant-root.is-mobile {
  padding: 6px;
  gap: 8px;

  .wb-modal-backdrop {
    position: absolute;
  }

  .wb-header,
  .wb-bindings,
  .wb-toolbar {
    padding: 6px;
    gap: 6px;
  }

  .toolbar-label {
    min-width: 100%;
  }

  .toolbar-select {
    width: 100%;
  }


  .wb-main-layout {
    display: block !important;
    height: auto !important;
    overflow: visible !important;
  }

  .wb-entry-list,
  .wb-editor,
  .wb-editor-shell,
  .editor-side {
    width: 100% !important;
    height: auto !important;
    max-height: none !important;
    border: none !important;
    padding: 0 !important;
  }

  .wb-entry-list {
    max-height: 80vh !important;
    max-height: 80lvh !important;
    overflow-y: auto;
  }

  .wb-editor-shell {
    display: block !important;
  }

  .list-scroll {
    max-height: 60vh;
    max-height: 60lvh;
  }
}

/* ─────────────────────────────────────────────────
   Override: Force theme colors on native form elements
   This beats SillyTavern global dark CSS which sets
   background/color on textarea, input, select, etc.
   ───────────────────────────────────────────────── */
.wb-assistant-root input,
.wb-assistant-root textarea,
.wb-assistant-root select,
.wb-assistant-root option,
.wb-assistant-root button {
  color: var(--wb-text-main) !important;
}

.wb-assistant-root input[type="text"],
.wb-assistant-root input[type="number"],
.wb-assistant-root textarea,
.wb-assistant-root select {
  background: var(--wb-input-bg) !important;
  border-color: transparent !important;
}

.wb-assistant-root input[type="text"]:hover,
.wb-assistant-root input[type="number"]:hover,
.wb-assistant-root textarea:hover,
.wb-assistant-root select:hover {
  background: var(--wb-input-bg-hover) !important;
}

.wb-assistant-root input[type="text"]:focus,
.wb-assistant-root input[type="number"]:focus,
.wb-assistant-root textarea:focus,
.wb-assistant-root select:focus {
  background: var(--wb-input-bg-focus) !important;
  border-color: var(--wb-primary-glow) !important;
  outline: none !important;
  box-shadow: 0 0 0 3px var(--wb-primary-soft) !important;
}
/* ═════════════════════════════════════════════════
   Mobile Responsive
   ═════════════════════════════════════════════════ */
.wb-assistant-root.is-mobile {
  padding: 6px;
  gap: 6px;
  border-radius: 0;

  /* ── Toolbar ── */
  .toolbar-label {
    min-width: unset;
    width: 100%;
  }

  .toolbar-label select {
    flex: 1;
    min-width: 0;
  }

  .toolbar-btns {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .toolbar-btns .btn {
    font-size: 0.78em;
    padding: 4px 8px;
  }

  /* ── Bindings bar ── */
  .wb-bindings {
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 8px;
    font-size: 0.78em;
  }

  /* ── Main layout ── */
  .wb-main-layout {
    display: block !important;
    overflow: visible;
    flex: none;
  }

  .wb-resize-handle {
    display: none !important;
  }

  .wb-entry-list,
  .wb-editor {
    min-height: 0;
    max-height: none;
  }

  /* ── Status footer ── */
  .wb-status {
    font-size: 0.72em;
    padding: 4px 8px;
    gap: 6px;
  }

  /* ── Editor content area ── */
  .editor-content-area {
    flex: 1;
    min-height: 40vh;
    min-height: 40lvh;
  }

  .content-resize-handle {
    display: flex;
    height: 28px;
  }

  .editor-content-block {
    position: relative;
    z-index: 10;
    background: var(--wb-bg-root);
  }

  .content-top-drag-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    cursor: ns-resize;
    background: var(--wb-bg-panel);
    border-radius: 8px 8px 0 0;
    touch-action: none;
    user-select: none;
  }

  .content-top-drag-grip {
    font-size: 12px;
    color: var(--wb-text-dim);
    letter-spacing: 3px;
    line-height: 1;
  }

  .text-area.compact {
    min-height: 60px;
  }

  .editor-center {
    padding: 8px;
  }

  .editor-side {
    padding: 8px;
  }

  .editor-grid.two-cols {
    grid-template-columns: 1fr;
  }
}
</style>
