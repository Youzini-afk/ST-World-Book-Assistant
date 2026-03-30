<template>
  <div ref="rootRef" class="wb-assistant-root" :class="[focusCineRootClass, { 'is-mobile': isMobile, 'is-glass-mode': persistedState.glass_mode }]" :style="themeStyles">

    <!-- ═══ Mobile Tab View ═══ -->
    <template v-if="isMobile">

      <!-- ═══ Mobile Browse Mode ═══ -->
      <template v-if="panelMode === 'browse'">
        <div class="mobile-browse-view">
          <!-- Mobile browse toolbar -->
          <section class="wb-toolbar browse-toolbar mobile-browse-toolbar">
            <div ref="worldbookPickerRef" class="worldbook-picker">
              <button class="worldbook-picker-trigger" type="button" @click="toggleWorldbookPicker">
                <span class="worldbook-picker-trigger-text" :title="selectedWorldbookName || '请选择世界书'">
                  {{ selectedWorldbookName || '请选择' }}
                </span>
                <span class="worldbook-picker-trigger-arrow">▾</span>
              </button>
              <div v-if="worldbookPickerOpen" class="worldbook-picker-dropdown">
                <input
                  
                  v-model="worldbookPickerSearchText"
                  type="text"
                  class="text-input worldbook-picker-search"
                  placeholder="搜索..."
                  @keydown.enter.prevent="filteredSelectableWorldbookNames[0] && selectWorldbookFromPicker(filteredSelectableWorldbookNames[0])"
                />
                <div class="worldbook-picker-list">
                  <button
                    v-for="name in filteredSelectableWorldbookNames"
                    :key="`mbrowse-wb-${name}`"
                    class="worldbook-picker-item"
                    :class="{ active: name === selectedWorldbookName }"
                    type="button"
                    @click="selectWorldbookFromPicker(name)"
                  >
                    {{ name }}
                  </button>
                  <div v-if="!filteredSelectableWorldbookNames.length" class="empty-note">无匹配</div>
                </div>
              </div>
            </div>
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
                <div ref="worldbookPickerRef" class="worldbook-picker">
                  <button class="worldbook-picker-trigger" type="button" @click="toggleWorldbookPicker">
                    <span class="worldbook-picker-trigger-text" :title="selectedWorldbookName || '请选择世界书'">
                      {{ selectedWorldbookName || '请选择世界书' }}
                    </span>
                    <span class="worldbook-picker-arrow">▾</span>
                  </button>
                  <div v-if="worldbookPickerOpen" class="worldbook-picker-dropdown">
                    <div v-if="tagDefinitions.length" class="worldbook-picker-tags tree-mode">
                      <div class="tag-filter-toolbar">
                        <button class="btn mini tag-filter-open" type="button" @click="tagFilterPanelOpen = !tagFilterPanelOpen">🏷 标签筛选</button>
                        <span class="tag-filter-summary">{{ tagFilterSummary }}</span>
                        <select v-model="tagFilterLogic" class="text-input tag-filter-select">
                          <option value="or">OR</option>
                          <option value="and">AND</option>
                        </select>
                        <select v-model="tagFilterMatchMode" class="text-input tag-filter-select">
                          <option value="descendants">子树</option>
                          <option value="exact">精确</option>
                        </select>
                        <button class="btn mini" type="button" :disabled="!selectedTagFilterIds.length" @click="clearTagFilterSelection">清空</button>
                      </div>
                      <Transition name="tag-filter-panel">
                        <div v-if="tagFilterPanelOpen" class="tag-filter-panel" :class="{ mobile: isMobile }">
                          <input v-model="tagFilterSearchText" type="text" class="text-input tag-filter-search" placeholder="搜索标签名称 / 路径..." />
                          <div v-if="selectedTagFilterIds.length" class="tag-filter-selected-list">
                            <button
                              v-for="tagId in selectedTagFilterIds"
                              :key="`tag-selected-mobile-${tagId}`"
                              class="tag-filter-selected-chip"
                              type="button"
                              @click="toggleTagFilterSelection(tagId)"
                            >
                              {{ tagPathMap.get(tagId) ?? tagId }} ×
                            </button>
                          </div>
                          <div v-if="isMobile" class="tag-flat-list">
                            <label
                              v-for="tag in tagAssignOptions.filter(item => !tagFilterSearchText.trim() || item.path.toLowerCase().includes(tagFilterSearchText.trim().toLowerCase()))"
                              :key="`tag-flat-mobile-${tag.id}`"
                              class="tag-flat-item"
                              :style="{ '--tag-color': tag.color }"
                            >
                              <input type="checkbox" :checked="selectedTagFilterIdSet.has(tag.id)" @change="toggleTagFilterSelection(tag.id)" />
                              <span>{{ tag.path }}</span>
                            </label>
                            <div v-if="!tagAssignOptions.length" class="empty-note">暂无标签</div>
                          </div>
                          <div v-else class="tag-tree-list">
                            <div v-for="row in tagTreeRows" :key="`tag-tree-mobile-${row.id}`" class="tag-tree-row" :style="{ '--depth': row.depth, '--tag-color': row.color }">
                              <button
                                v-if="row.hasChildren"
                                class="tag-tree-toggle"
                                type="button"
                                @click.stop="toggleTagTreeExpanded(row.id)"
                              >{{ tagTreeExpandedIds.includes(row.id) || tagFilterSearchText.trim() ? '▾' : '▸' }}</button>
                              <span v-else class="tag-tree-toggle placeholder"></span>
                              <input type="checkbox" :checked="selectedTagFilterIdSet.has(row.id)" @change="toggleTagFilterSelection(row.id)" />
                              <span class="tag-tree-name">{{ row.name }}</span>
                              <span class="tag-tree-path">{{ row.path }}</span>
                            </div>
                            <div v-if="!tagTreeRows.length" class="empty-note">没有匹配的标签</div>
                          </div>
                        </div>
                      </Transition>
                    </div>
                    <input
                      v-model="worldbookPickerSearchText"
                      type="text"
                      class="text-input worldbook-picker-search"
                      placeholder="搜索世界书..."
                      @keydown.enter.prevent="filteredSelectableWorldbookNames[0] && selectWorldbookFromPicker(filteredSelectableWorldbookNames[0])"
                    />
                    <div class="worldbook-picker-list">
                      <button
                        v-for="name in filteredSelectableWorldbookNames"
                        :key="`wb-pick-m-${name}`"
                        class="worldbook-picker-item"
                        :class="{ active: name === selectedWorldbookName }"
                        type="button"
                        @click="selectWorldbookFromPicker(name)"
                      >{{ name }}</button>
                      <div v-if="!filteredSelectableWorldbookNames.length" class="empty-note">没有匹配的世界书</div>
                    </div>
                  </div>
                </div>
              </label>
              <div class="toolbar-btns" style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn" type="button" :class="{ 'glow-pulse': hasUnsavedChanges }" :disabled="!hasUnsavedChanges" @click="saveCurrentWorldbook" style="padding:8px 14px;font-size:13px;">💾 保存</button>
                <button class="btn" type="button" @click="addEntry" style="padding:8px 14px;font-size:13px;">+ 新条目</button>
                <button class="btn" type="button" @click="triggerImport" style="padding:8px 14px;font-size:13px;">📥 导入</button>
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="exportCurrentWorldbook" style="padding:8px 14px;font-size:13px;">📤 导出</button>
                <button class="btn" type="button" @click="toggleGlobalMode" :style="{ padding:'8px 14px', fontSize:'13px', background: globalWorldbookMode ? 'var(--wb-primary)' : '', color: globalWorldbookMode ? '#fff' : '' }">🌐 全局</button>
                <button class="btn" type="button" @click="extractFromChat" style="padding:8px 14px;font-size:13px;">📥 提取</button>
                <button class="btn" type="button" @click="showApiSettings = true" style="padding:8px 14px;font-size:13px;">⚙️ 设置</button>
                <button class="btn" type="button" @click="aiConfigPreview = false; aiConfigChanges = []; aiConfigTargetWorldbook = selectedWorldbookName || ''" style="padding:8px 14px;font-size:13px;">🔧 AI配置</button>
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
            <!-- Global Mode Panel (mobile) -->
            <div v-if="globalWorldbookMode" style="border:1px solid var(--wb-border-subtle);border-radius:8px;padding:10px;margin-bottom:8px;background:var(--wb-bg-card);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:600;font-size:13px;">🌐 全局世界书（{{ bindings.global.length }}）</span>
                <button class="btn mini danger" type="button" :disabled="!bindings.global.length" @click="clearGlobalWorldbooks" style="font-size:11px;">清空</button>
              </div>
              <label class="field" style="margin-bottom:6px;">
                <span style="font-size:12px;">预设（切换即应用）</span>
                <select v-model="selectedGlobalPresetId" class="text-input" @change="onGlobalPresetSelectionChanged" style="font-size:12px;">
                  <option value="">默认预设（清空全局世界书）</option>
                  <option v-for="preset in globalWorldbookPresets" :key="preset.id" :value="preset.id">
                    {{ preset.name }}（{{ preset.worldbooks.length }}）
                  </option>
                </select>
              </label>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
                <button class="btn mini" type="button" :disabled="!bindings.global.length" @click="saveCurrentAsGlobalPreset" style="font-size:11px;">保存组合</button>
                <button class="btn mini" type="button" :disabled="!selectedGlobalPreset" @click="overwriteSelectedGlobalPreset" style="font-size:11px;">覆盖预设</button>
                <button class="btn mini danger" type="button" :disabled="!selectedGlobalPreset" @click="deleteSelectedGlobalPreset" style="font-size:11px;">删除预设</button>
              </div>
              <label class="field" style="margin-bottom:6px;">
                <span style="font-size:12px;">搜索并添加</span>
                <input v-model="globalAddSearchText" type="text" class="text-input" placeholder="搜索世界书..." @keydown.enter.prevent="addFirstGlobalCandidate" style="font-size:12px;" />
              </label>
              <div v-if="globalAddCandidates.length" style="max-height:120px;overflow-y:auto;margin-bottom:6px;">
                <button v-for="name in globalAddCandidates" :key="`m-add-${name}`" type="button" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:none;background:var(--wb-input-bg);border-radius:4px;color:var(--wb-text-main);font-size:12px;margin-bottom:2px;cursor:pointer;" @click="addGlobalWorldbook(name)">
                  <span>{{ name }}</span><span style="color:#22c55e;">+ 添加</span>
                </button>
              </div>
              <div v-if="filteredGlobalWorldbooks.length" style="font-size:12px;margin-bottom:4px;opacity:0.7;">已启用：</div>
              <div style="display:flex;flex-direction:column;gap:2px;margin-bottom:8px;">
                <button v-for="name in filteredGlobalWorldbooks" :key="`m-gl-${name}`" type="button" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:none;background:var(--wb-input-bg);border-radius:4px;color:var(--wb-text-main);font-size:12px;cursor:pointer;" @click="removeGlobalWorldbook(name)">
                  <span>{{ name }}</span><span style="color:#ef4444;">移除</span>
                </button>
              </div>
              <!-- Role Binding Section -->
              <div style="border-top:1px solid var(--wb-border-subtle);padding-top:8px;margin-top:4px;">
                <div style="font-size:12px;font-weight:600;margin-bottom:6px;">角色绑定</div>
                <div style="font-size:11px;margin-bottom:6px;opacity:0.8;" :style="{ color: currentRoleContext ? '#60a5fa' : '#94a3b8' }">
                  {{ currentRoleContext ? `当前角色: ${currentRoleContext.name}` : '当前未进入角色聊天' }}
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;">
                  <button class="btn mini" type="button" :disabled="!selectedGlobalPreset || !currentRoleContext" @click="bindCurrentRoleToSelectedPreset" style="font-size:11px;">绑定当前角色</button>
                  <button class="btn mini" type="button" :disabled="!selectedGlobalPreset || !isCurrentRoleBoundToSelectedPreset" @click="unbindCurrentRoleFromSelectedPreset" style="font-size:11px;">解绑当前角色</button>
                </div>
                <div style="margin-bottom:6px;">
                  <button type="button" :disabled="!selectedGlobalPreset" @click="toggleRolePicker" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:1px solid var(--wb-border-subtle);border-radius:4px;background:var(--wb-input-bg);color:var(--wb-text-main);font-size:12px;cursor:pointer;">
                    <span>{{ selectedGlobalPreset ? '从角色卡列表选择绑定' : '请先选择预设' }}</span>
                    <span>{{ rolePickerOpen ? '▴' : '▾' }}</span>
                  </button>
                  <div v-if="rolePickerOpen" style="margin-top:4px;">
                    <input v-model="roleBindSearchText" type="text" class="text-input" placeholder="搜索角色名..." style="font-size:12px;margin-bottom:4px;" @keydown.enter.prevent="bindFirstRoleCandidate" />
                    <div style="max-height:120px;overflow-y:auto;">
                      <button v-for="candidate in roleBindingCandidates" :key="`m-role-${candidate.key}`" type="button" :disabled="candidate.bound" style="display:flex;justify-content:space-between;align-items:center;width:100%;padding:6px 8px;border:none;background:var(--wb-input-bg);border-radius:4px;color:var(--wb-text-main);font-size:12px;margin-bottom:2px;cursor:pointer;opacity: 1;" :style="{ opacity: candidate.bound ? '0.5' : '1' }" @click="bindRoleCandidateToSelectedPreset(candidate)">
                        <span>{{ candidate.name }}</span><span :style="{ color: candidate.bound ? '#94a3b8' : '#22c55e' }">{{ candidate.bound ? '已绑定' : '绑定' }}</span>
                      </button>
                      <div v-if="!roleBindingCandidates.length" style="font-size:11px;opacity:0.5;padding:4px;">没有匹配角色</div>
                    </div>
                  </div>
                </div>
                <div v-if="selectedGlobalPreset" style="display:flex;flex-wrap:wrap;gap:4px;">
                  <button v-for="binding in selectedGlobalPresetRoleBindings" :key="`m-rb-${selectedGlobalPreset?.id}-${binding.key}`" type="button" style="display:inline-flex;align-items:center;gap:4px;padding:4px 8px;border:1px solid var(--wb-border-subtle);border-radius:4px;background:var(--wb-input-bg);color:var(--wb-text-main);font-size:11px;cursor:pointer;" @click="removeRoleBindingFromSelectedPreset(binding.key)">
                    {{ binding.name }} <span style="color:#ef4444;">×</span>
                  </button>
                  <div v-if="!selectedGlobalPresetRoleBindings.length" style="font-size:11px;opacity:0.5;">当前预设尚未绑定角色</div>
                </div>
                <div v-else style="font-size:11px;opacity:0.5;">选择预设后可配置角色绑定</div>
              </div>
            </div>
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
            <section class="tag-editor-panel mobile-tag-editor">
              <div class="tag-editor-title">🏷️ 标签管理</div>
              <div class="tag-create-panel">
                <div class="tag-create-row">
                  <input
                    v-model="tagNewName"
                    type="text"
                    class="text-input"
                    placeholder="新标签名称"
                    @keydown.enter.prevent="tagCreate"
                  />
                  <button class="btn" type="button" @click="tagCreate">创建</button>
                  <button class="btn danger" type="button" @click="tagResetAll" :disabled="!tagDefinitions.length">清除全部</button>
                </div>
                <label class="field tag-parent-field">
                  <span>父标签（可选）</span>
                  <select v-model="tagNewParentId" class="text-input">
                    <option value="">根级</option>
                    <option v-for="option in tagAssignOptions" :key="`new-parent-mobile-${option.id}`" :value="option.id">
                      {{ option.path }}
                    </option>
                  </select>
                </label>
              </div>

              <div v-if="tagDefinitions.length" class="tag-editor-tree-wrap">
                <div class="tag-editor-subtitle">标签树</div>
                <div class="tag-editor-tree-list">
                  <div v-for="row in tagManagementRows" :key="`tag-mobile-row-${row.id}`" class="tag-editor-tree-item" :style="{ '--tag-color': row.color, '--depth': row.depth }">
                    <span class="tag-editor-indent"></span>
                    <span class="tag-editor-dot" :style="{ background: row.color }"></span>
                    <input
                      :value="tagDefinitionMap.get(row.id)?.name ?? ''"
                      class="tag-editor-name-input"
                      @blur="tagRename(row.id, ($event.target as HTMLInputElement).value)"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                    />
                    <select
                      class="text-input tag-parent-select"
                      :value="tagDefinitionMap.get(row.id)?.parent_id ?? ''"
                      @change="tagSetParent(row.id, ($event.target as HTMLSelectElement).value || null)"
                    >
                      <option value="">根级</option>
                      <option
                        v-for="option in tagAssignOptions"
                        :key="`tag-parent-mobile-${row.id}-${option.id}`"
                        :value="option.id"
                        :disabled="isTagParentOptionDisabled(row.id, option.id)"
                      >
                        {{ option.path }}
                      </option>
                    </select>
                    <div class="tag-color-picker">
                      <button
                        v-for="c in TAG_COLORS"
                        :key="`mobile-color-${row.id}-${c}`"
                        class="tag-color-dot"
                        :class="{ active: row.color === c }"
                        :style="{ background: c }"
                        type="button"
                        @click="tagSetColor(row.id, c)"
                      ></button>
                    </div>
                    <button class="tag-delete-btn" type="button" @click="tagDelete(row.id)">×</button>
                  </div>
                </div>
              </div>

              <div v-if="tagDefinitions.length" class="tag-assign-panel">
                <div class="tag-editor-subtitle">世界书分配</div>
                <div class="tag-assign-controls">
                  <label class="field">
                    <span>当前分配标签</span>
                    <select v-model="tagAssignTargetId" class="text-input">
                      <option value="">请选择标签</option>
                      <option v-for="option in tagAssignOptions" :key="`assign-mobile-${option.id}`" :value="option.id">
                        {{ option.path }}
                      </option>
                    </select>
                  </label>
                  <input v-model="tagAssignSearch" type="text" class="text-input" placeholder="搜索世界书..." />
                </div>
                <div class="tag-assign-list compact">
                  <button
                    v-for="name in tagAssignWorldbooks"
                    :key="`assign-mobile-wb-${name}`"
                    class="tag-assign-row toggle"
                    :class="{ active: tagAssignTargetId ? (tagAssignments[name] ?? []).includes(tagAssignTargetId) : false }"
                    type="button"
                    :disabled="!tagAssignTargetId"
                    @click="tagToggleAssignmentForSelectedTag(name)"
                  >
                    <span class="tag-assign-name" :title="name">{{ name }}</span>
                    <span class="tag-assign-state">{{ tagAssignTargetId && (tagAssignments[name] ?? []).includes(tagAssignTargetId) ? '已分配' : '未分配' }}</span>
                    <span class="tag-assign-paths">{{ getWorldbookTagPathSummary(name) }}</span>
                  </button>
                  <div v-if="!tagAssignWorldbooks.length" class="empty-note">没有匹配的世界书</div>
                </div>
              </div>

              <div v-else class="empty-note" style="margin-top:16px;">暂无标签，请先创建</div>
            </section>
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
          <div ref="worldbookPickerRef" class="worldbook-picker">
            <button class="worldbook-picker-trigger" type="button" @click="toggleWorldbookPicker">
              <span class="worldbook-picker-trigger-text" :title="selectedWorldbookName || '请选择世界书'">
                {{ selectedWorldbookName || '请选择世界书' }}
              </span>
              <span class="worldbook-picker-trigger-arrow">{{ worldbookPickerOpen ? '▴' : '▾' }}</span>
            </button>
            <div v-if="worldbookPickerOpen" class="worldbook-picker-dropdown">
              <input
                
                v-model="worldbookPickerSearchText"
                type="text"
                class="text-input worldbook-picker-search"
                placeholder="搜索世界书..."
                @keydown.enter.prevent="filteredSelectableWorldbookNames[0] && selectWorldbookFromPicker(filteredSelectableWorldbookNames[0])"
              />
              <div class="worldbook-picker-list">
                <button
                  v-for="name in filteredSelectableWorldbookNames"
                  :key="`browse-wb-${name}`"
                  class="worldbook-picker-item"
                  :class="{ active: name === selectedWorldbookName }"
                  type="button"
                  @click="selectWorldbookFromPicker(name)"
                >
                  {{ name }}
                </button>
                <div v-if="!filteredSelectableWorldbookNames.length" class="empty-note">没有匹配的世界书</div>
              </div>
            </div>
          </div>
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

      <!-- Global Mode Panel (reuse existing) -->
      <section v-if="globalWorldbookMode" class="wb-bindings browse-global-mode">
        <!-- Intentionally showing the same global mode panel -->
        <div class="global-mode-panel">
          <div class="global-mode-grid">
            <div class="global-mode-column">
              <label class="field">
                <span>搜索并添加常驻世界书</span>
                <input
                  v-model="globalAddSearchText"
                  type="text"
                  class="text-input"
                  placeholder="搜索并添加..."
                  @keydown.enter.prevent="addFirstGlobalCandidate"
                />
              </label>
              <TransitionGroup name="list" tag="div" class="global-mode-list">
                <button
                  v-for="name in globalAddCandidates"
                  :key="`browse-add-${name}`"
                  class="global-mode-item add"
                  type="button"
                  @click="addGlobalWorldbook(name)"
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
                  v-model="globalFilterText"
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
                  @click="removeGlobalWorldbook(name)"
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
              <div ref="worldbookPickerRef" class="worldbook-picker">
                <button class="worldbook-picker-trigger" type="button" @click="toggleWorldbookPicker">
                  <span class="worldbook-picker-trigger-text" :title="selectedWorldbookName || '请选择世界书'">
                    {{ selectedWorldbookName || '请选择世界书' }}
                  </span>
                  <span class="worldbook-picker-trigger-arrow">{{ worldbookPickerOpen ? '▴' : '▾' }}</span>
                </button>
                <div v-if="worldbookPickerOpen" class="worldbook-picker-dropdown">
                  <div v-if="tagDefinitions.length" class="worldbook-picker-tags tree-mode">
                    <div class="tag-filter-toolbar">
                      <button class="btn mini tag-filter-open" type="button" @click="tagFilterPanelOpen = !tagFilterPanelOpen">🏷 标签筛选</button>
                      <span class="tag-filter-summary">{{ tagFilterSummary }}</span>
                      <select v-model="tagFilterLogic" class="text-input tag-filter-select">
                        <option value="or">OR</option>
                        <option value="and">AND</option>
                      </select>
                      <select v-model="tagFilterMatchMode" class="text-input tag-filter-select">
                        <option value="descendants">子树</option>
                        <option value="exact">精确</option>
                      </select>
                      <button class="btn mini" type="button" :disabled="!selectedTagFilterIds.length" @click="clearTagFilterSelection">清空</button>
                    </div>
                    <Transition name="tag-filter-panel">
                      <div v-if="tagFilterPanelOpen" class="tag-filter-panel">
                        <input v-model="tagFilterSearchText" type="text" class="text-input tag-filter-search" placeholder="搜索标签名称 / 路径..." />
                        <div v-if="selectedTagFilterIds.length" class="tag-filter-selected-list">
                          <button
                            v-for="tagId in selectedTagFilterIds"
                            :key="`tag-selected-desktop-${tagId}`"
                            class="tag-filter-selected-chip"
                            type="button"
                            @click="toggleTagFilterSelection(tagId)"
                          >
                            {{ tagPathMap.get(tagId) ?? tagId }} ×
                          </button>
                        </div>
                        <div class="tag-tree-list">
                          <div v-for="row in tagTreeRows" :key="`tag-tree-desktop-${row.id}`" class="tag-tree-row" :style="{ '--depth': row.depth, '--tag-color': row.color }">
                            <button
                              v-if="row.hasChildren"
                              class="tag-tree-toggle"
                              type="button"
                              @click.stop="toggleTagTreeExpanded(row.id)"
                            >{{ tagTreeExpandedIds.includes(row.id) || tagFilterSearchText.trim() ? '▾' : '▸' }}</button>
                            <span v-else class="tag-tree-toggle placeholder"></span>
                            <input type="checkbox" :checked="selectedTagFilterIdSet.has(row.id)" @change="toggleTagFilterSelection(row.id)" />
                            <span class="tag-tree-name">{{ row.name }}</span>
                            <span class="tag-tree-path">{{ row.path }}</span>
                          </div>
                          <div v-if="!tagTreeRows.length" class="empty-note">没有匹配的标签</div>
                        </div>
                      </div>
                    </Transition>
                  </div>
                  <input
                    
                    v-model="worldbookPickerSearchText"
                    type="text"
                    class="text-input worldbook-picker-search"
                    placeholder="搜索世界书..."
                    @keydown.enter.prevent="filteredSelectableWorldbookNames[0] && selectWorldbookFromPicker(filteredSelectableWorldbookNames[0])"
                  />
                  <div class="worldbook-picker-list">
                    <button
                      v-for="name in filteredSelectableWorldbookNames"
                      :key="`worldbook-${name}`"
                      class="worldbook-picker-item"
                      :class="{ active: name === selectedWorldbookName }"
                      type="button"
                      @click="selectWorldbookFromPicker(name)"
                    >
                      {{ name }}
                    </button>
                    <div v-if="!filteredSelectableWorldbookNames.length" class="empty-note">没有匹配的世界书</div>
                  </div>
                </div>
              </div>
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
                  <div ref="worldbookPickerRef" class="worldbook-picker">
                    <button class="worldbook-picker-trigger" type="button" @click="toggleWorldbookPicker">
                      <span class="worldbook-picker-trigger-text" :title="selectedWorldbookName || '请选择世界书'">
                        {{ selectedWorldbookName || '请选择世界书' }}
                      </span>
                      <span class="worldbook-picker-trigger-arrow">{{ worldbookPickerOpen ? '▴' : '▾' }}</span>
                    </button>
                    <div v-if="worldbookPickerOpen" class="worldbook-picker-dropdown">
                      <div v-if="tagDefinitions.length" class="worldbook-picker-tags tree-mode">
                        <div class="tag-filter-toolbar">
                          <button class="btn mini tag-filter-open" type="button" @click="tagFilterPanelOpen = !tagFilterPanelOpen">🏷 标签筛选</button>
                          <span class="tag-filter-summary">{{ tagFilterSummary }}</span>
                          <select v-model="tagFilterLogic" class="text-input tag-filter-select">
                            <option value="or">OR</option>
                            <option value="and">AND</option>
                          </select>
                          <select v-model="tagFilterMatchMode" class="text-input tag-filter-select">
                            <option value="descendants">子树</option>
                            <option value="exact">精确</option>
                          </select>
                          <button class="btn mini" type="button" :disabled="!selectedTagFilterIds.length" @click="clearTagFilterSelection">清空</button>
                        </div>
                        <Transition name="tag-filter-panel">
                          <div v-if="tagFilterPanelOpen" class="tag-filter-panel">
                            <input v-model="tagFilterSearchText" type="text" class="text-input tag-filter-search" placeholder="搜索标签名称 / 路径..." />
                            <div v-if="selectedTagFilterIds.length" class="tag-filter-selected-list">
                              <button
                                v-for="tagId in selectedTagFilterIds"
                                :key="`tag-selected-focus-${tagId}`"
                                class="tag-filter-selected-chip"
                                type="button"
                                @click="toggleTagFilterSelection(tagId)"
                              >
                                {{ tagPathMap.get(tagId) ?? tagId }} ×
                              </button>
                            </div>
                            <div class="tag-tree-list">
                              <div v-for="row in tagTreeRows" :key="`tag-tree-focus-${row.id}`" class="tag-tree-row" :style="{ '--depth': row.depth, '--tag-color': row.color }">
                                <button
                                  v-if="row.hasChildren"
                                  class="tag-tree-toggle"
                                  type="button"
                                  @click.stop="toggleTagTreeExpanded(row.id)"
                                >{{ tagTreeExpandedIds.includes(row.id) || tagFilterSearchText.trim() ? '▾' : '▸' }}</button>
                                <span v-else class="tag-tree-toggle placeholder"></span>
                                <input type="checkbox" :checked="selectedTagFilterIdSet.has(row.id)" @change="toggleTagFilterSelection(row.id)" />
                                <span class="tag-tree-name">{{ row.name }}</span>
                                <span class="tag-tree-path">{{ row.path }}</span>
                              </div>
                              <div v-if="!tagTreeRows.length" class="empty-note">没有匹配的标签</div>
                            </div>
                          </div>
                        </Transition>
                      </div>
                      <input
                        
                        v-model="worldbookPickerSearchText"
                        type="text"
                        class="text-input worldbook-picker-search"
                        placeholder="搜索世界书..."
                        @keydown.enter.prevent="filteredSelectableWorldbookNames[0] && selectWorldbookFromPicker(filteredSelectableWorldbookNames[0])"
                      />
                      <div class="worldbook-picker-list">
                        <button
                          v-for="name in filteredSelectableWorldbookNames"
                          :key="`focus-worldbook-${name}`"
                          class="worldbook-picker-item"
                          :class="{ active: name === selectedWorldbookName }"
                          type="button"
                          @click="selectWorldbookFromPicker(name)"
                        >
                          {{ name }}
                        </button>
                        <div v-if="!filteredSelectableWorldbookNames.length" class="empty-note">没有匹配的世界书</div>
                      </div>
                    </div>
                  </div>
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
                <button class="btn history-btn utility-btn" data-focus-hero="tool_ai_config" data-copy-hero="tool_ai_config" type="button" @click="aiConfigPreview = false; aiConfigChanges = []; aiConfigTargetWorldbook = selectedWorldbookName || ''">🔧 AI配置</button>
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
            <div v-if="!isDesktopFocusMode && crossCopyMode" class="wb-copy-workspace-head">
              <div class="wb-copy-workspace-title">
                <strong>📚 跨书复制工作台</strong>
                <span>{{ crossCopyWorkspaceSummary }}</span>
              </div>
              <div class="wb-copy-workspace-actions">
                <span class="wb-copy-workspace-meta">{{ crossCopyWorkspaceComparedText }}</span>
                <div class="wb-copy-workspace-tool-anchor">
                  <button class="btn mini utility-btn" type="button" :disabled="isAnyCineLocked" @click="toggleCrossCopyWorkspaceTools">
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
                <button class="btn mini utility-btn" type="button" :disabled="isAnyCineLocked" @click="toggleCrossCopyMode">退出模式</button>
              </div>
            </div>
            <Transition name="copy-workspace-tools">
            <div v-if="!isDesktopFocusMode && (!crossCopyMode || crossCopyWorkspaceToolsExpanded)" class="wb-history-shortcuts" :class="{ 'copy-workspace-tools': crossCopyMode }">
              <button class="btn history-btn utility-btn" data-focus-hero="focus_toggle" data-copy-hero="focus_toggle" type="button" :disabled="isAnyCineLocked" @click="toggleFocusEditing">🎯 专注编辑</button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="tool_global"
                data-copy-hero="tool_global"
                type="button"
                :class="{ active: globalWorldbookMode }"
                @click="toggleGlobalMode"
              >
                🌐 全局模式
              </button>
              <button class="btn history-btn" data-focus-hero="tool_entry_history" data-copy-hero="tool_entry_history" type="button" :disabled="!selectedEntry" @click="openEntryHistoryModal">
                🕰️ 条目时光机
              </button>
              <button
                class="btn history-btn"
                data-focus-hero="tool_worldbook_history"
                data-copy-hero="tool_worldbook_history"
                type="button"
                :disabled="!selectedWorldbookName"
                @click="openWorldbookHistoryModal"
              >
                ⏪ 整本时光机
              </button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="find_btn"
                data-copy-hero="find_btn"
                type="button"
                :class="{ active: floatingPanels.find.visible }"
                :disabled="!draftEntries.length || isAnyCineLocked"
                @click="toggleFloatingPanel('find')"
              >
                🔎 查找与替换
              </button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="tool_activation"
                data-copy-hero="tool_activation"
                type="button"
                :class="{ active: floatingPanels.activation.visible }"
                @click="toggleFloatingPanel('activation')"
              >
                📡 激活监控
              </button>
              <button
                v-if="persistedState.show_ai_chat"
                class="btn history-btn utility-btn"
                data-focus-hero="tool_ai_generate"
                data-copy-hero="tool_ai_generate"
                type="button"
                :class="{ active: aiGeneratorMode }"
                @click="aiToggleMode"
              >
                🤖 AI 生成
              </button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="tool_extract"
                data-copy-hero="tool_extract"
                type="button"
                @click="extractFromChat"
              >
                📥 从聊天提取
              </button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="tool_tag"
                data-copy-hero="tool_tag"
                type="button"
                :class="{ active: tagEditorMode }"
                @click="tagToggleMode"
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
                @click="toggleCrossCopyMode"
              >
                📚 跨书复制
              </button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="tool_settings"
                data-copy-hero="tool_settings"
                type="button"
                @click="showApiSettings = true"
              >
                ⚙️ 设置
              </button>
              <button
                class="btn history-btn utility-btn"
                data-focus-hero="tool_ai_config"
                data-copy-hero="tool_ai_config"
                type="button"
                @click="aiConfigPreview = false; aiConfigChanges = []; aiConfigTargetWorldbook = selectedWorldbookName || ''"
              >
                🔧 AI配置
              </button>
            </div>
            </Transition>
            <div v-if="globalWorldbookMode" class="global-mode-panel">
              <div class="global-mode-head">
                <span class="global-mode-title">全局世界书（{{ bindings.global.length }}）</span>
                <button class="btn mini danger" type="button" :disabled="!bindings.global.length" @click="clearGlobalWorldbooks">
                  清空全局
                </button>
              </div>
              <div class="global-mode-sections">
                <details class="global-mode-section" open>
                  <summary class="global-mode-section-summary">
                    <span class="global-mode-section-title">世界书预设（切换即应用）</span>
                    <span class="global-mode-section-meta">
                      {{ selectedGlobalPreset ? selectedGlobalPreset.name : '默认预设（清空全局）' }}
                    </span>
                  </summary>
                  <div class="global-mode-section-body global-preset-panel">
                    <label class="field">
                      <span>选择预设</span>
                      <select v-model="selectedGlobalPresetId" class="text-input" @change="onGlobalPresetSelectionChanged">
                        <option value="">默认预设（清空全局世界书）</option>
                        <option v-for="preset in globalWorldbookPresets" :key="preset.id" :value="preset.id">
                          {{ preset.name }}（{{ preset.worldbooks.length }}）
                        </option>
                      </select>
                    </label>
                    <div class="global-mode-actions">
                      <button class="btn" type="button" :disabled="!bindings.global.length" @click="saveCurrentAsGlobalPreset">
                        保存当前组合
                      </button>
                      <button class="btn" type="button" :disabled="!selectedGlobalPreset" @click="overwriteSelectedGlobalPreset">
                        覆盖当前预设
                      </button>
                      <button class="btn danger" type="button" :disabled="!selectedGlobalPreset" @click="deleteSelectedGlobalPreset">
                        删除预设
                      </button>
                    </div>
                  </div>
                </details>

                <details class="global-mode-section" open>
                  <summary class="global-mode-section-summary">
                    <span class="global-mode-section-title">角色绑定（一个预设可绑定多个角色）</span>
                    <span class="preset-role-current" :class="{ empty: !currentRoleContext }">
                      {{ currentRoleContext ? `当前角色: ${currentRoleContext.name}` : '当前未进入角色聊天' }}
                    </span>
                  </summary>
                  <div class="global-mode-section-body preset-role-panel">
                    <div class="preset-role-actions">
                      <button
                        class="btn mini"
                        type="button"
                        :disabled="!selectedGlobalPreset || !currentRoleContext"
                        @click="bindCurrentRoleToSelectedPreset"
                      >
                        绑定当前角色
                      </button>
                      <button
                        class="btn mini"
                        type="button"
                        :disabled="!selectedGlobalPreset || !isCurrentRoleBoundToSelectedPreset"
                        @click="unbindCurrentRoleFromSelectedPreset"
                      >
                        解绑当前角色
                      </button>
                    </div>
                    <div ref="rolePickerRef" class="role-picker">
                      <button
                        class="role-picker-trigger"
                        type="button"
                        :disabled="!selectedGlobalPreset"
                        @click="toggleRolePicker"
                      >
                        <span class="role-picker-trigger-text">
                          {{ selectedGlobalPreset ? '从角色卡列表选择绑定' : '请先选择预设' }}
                        </span>
                        <span class="role-picker-trigger-arrow">{{ rolePickerOpen ? '▴' : '▾' }}</span>
                      </button>
                      <div v-if="rolePickerOpen" class="role-picker-dropdown">
                        <input
                          ref="rolePickerSearchInputRef"
                          v-model="roleBindSearchText"
                          type="text"
                          class="text-input role-picker-search"
                          placeholder="搜索角色名 / avatar..."
                          @keydown.enter.prevent="bindFirstRoleCandidate"
                        />
                        <div class="role-picker-list">
                          <button
                            v-for="candidate in roleBindingCandidates"
                            :key="`role-candidate-${candidate.key}`"
                            class="role-picker-item"
                            type="button"
                            :disabled="candidate.bound"
                            @click="bindRoleCandidateToSelectedPreset(candidate)"
                          >
                            <span class="name">{{ candidate.name }}</span>
                            <span class="meta">{{ candidate.bound ? '已绑定' : '绑定' }}</span>
                          </button>
                          <div v-if="!roleBindingCandidates.length" class="empty-note">没有匹配角色</div>
                        </div>
                      </div>
                    </div>
                    <div class="preset-role-tags">
                      <button
                        v-for="binding in selectedGlobalPresetRoleBindings"
                        :key="`binding-${selectedGlobalPreset?.id}-${binding.key}`"
                        class="preset-role-tag"
                        type="button"
                        :title="`点击移除绑定: ${binding.name}`"
                        @click="removeRoleBindingFromSelectedPreset(binding.key)"
                      >
                        <span>{{ binding.name }}</span>
                        <span class="remove">×</span>
                      </button>
                      <div v-if="selectedGlobalPreset && !selectedGlobalPresetRoleBindings.length" class="empty-note">
                        当前预设尚未绑定角色
                      </div>
                      <div v-if="!selectedGlobalPreset" class="empty-note">选择预设后可配置角色绑定</div>
                    </div>
                  </div>
                </details>
              </div>
              <div class="global-mode-grid">
                <div class="global-mode-column">
                  <label class="field">
                    <span>搜索并添加常驻世界书</span>
                    <input
                      v-model="globalAddSearchText"
                      type="text"
                      class="text-input"
                      placeholder="搜索并添加常驻世界书..."
                      @keydown.enter.prevent="addFirstGlobalCandidate"
                    />
                  </label>
                  <TransitionGroup name="list" tag="div" class="global-mode-list">
                    <button
                      v-for="name in globalAddCandidates"
                      :key="`add-${name}`"
                      class="global-mode-item add"
                      type="button"
                      @click="addGlobalWorldbook(name)"
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
                      v-model="globalFilterText"
                      type="text"
                      class="text-input"
                      placeholder="筛选常驻世界书..."
                    />
                  </label>
                  <TransitionGroup name="list" tag="div" class="global-mode-list">
                    <button
                      v-for="name in filteredGlobalWorldbooks"
                      :key="`global-${name}`"
                      class="global-mode-item active"
                      type="button"
                      @click="removeGlobalWorldbook(name)"
                    >
                      <span class="global-mode-item-name">{{ name }}</span>
                      <span class="global-mode-item-action">移除</span>
                    </button>
                    <div v-if="!filteredGlobalWorldbooks.length" key="empty" class="empty-note">
                      {{ bindings.global.length ? '没有匹配结果' : '暂无常驻世界书' }}
                    </div>
                  </TransitionGroup>
                </div>
              </div>
              <div class="global-mode-actions">
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="toggleGlobalBinding">
                  {{ isGlobalBound ? '移出全局' : '加入全局' }}
                </button>
              </div>
            </div>
          </section>

          <!-- ═══ AI Generator Panel ═══ -->
          <section v-if="aiGeneratorMode" class="ai-generator-panel">
            <div class="ai-sidebar">
              <div class="ai-sidebar-head">
                <span class="ai-sidebar-title">对话列表</span>
                <button class="btn mini" type="button" @click="aiCreateSession">+ 新建</button>
              </div>
              <div class="ai-session-list">
                <div
                  v-for="session in aiSessions"
                  :key="session.id"
                  class="ai-session-item"
                  :class="{ active: session.id === aiActiveSession?.id }"
                  role="button"
                  tabindex="0"
                  @click="aiSwitchSession(session.id)"
                  @keydown.enter.prevent="aiSwitchSession(session.id)"
                  @keydown.space.prevent="aiSwitchSession(session.id)"
                >
                  <span class="ai-session-title">{{ session.title }}</span>
                  <span class="ai-session-meta">{{ session.messages.length }} 条消息</span>
                  <button
                    class="ai-session-delete"
                    type="button"
                    title="删除对话"
                    @click.stop="aiDeleteSession(session.id)"
                  >×</button>
                </div>
                <div v-if="!aiSessions.length" class="empty-note">暂无对话，点击上方新建</div>
              </div>
            </div>
            <div class="ai-chat-area">
              <div v-if="!aiActiveSession" class="ai-chat-empty">
                <div class="ai-chat-empty-icon">🤖</div>
                <div class="ai-chat-empty-text">选择或新建一个对话开始生成</div>
              </div>
              <template v-else>
                <div class="ai-chat-messages" ref="aiChatMessagesRef">
                  <div
                    v-for="(msg, idx) in aiActiveMessages"
                    :key="`msg-${idx}`"
                    class="ai-chat-bubble"
                    :class="msg.role"
                  >
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
                  <textarea
                    v-model="aiChatInputText"
                    class="text-input ai-chat-input"
                    placeholder="输入提示词，让 AI 生成世界书条目..."
                    rows="2"
                    :disabled="aiIsGenerating"
                    @keydown.enter.exact.prevent="aiSendMessage"
                  ></textarea>
                  <button
                    v-if="!aiIsGenerating"
                    class="btn ai-send-btn"
                    type="button"
                    :disabled="!aiChatInputText.trim()"
                    @click="aiSendMessage"
                  >发送</button>
                  <button
                    v-else
                    class="btn danger ai-stop-btn"
                    type="button"
                    @click="aiStopGeneration"
                  >停止</button>
                </div>
              </template>
            </div>
          </section>

          <!-- 标签编辑模式 -->
          <section v-if="tagEditorMode" class="tag-editor-panel" style="padding:16px;">
            <div class="tag-editor-title">🏷️ 标签管理</div>
            <div class="tag-create-panel desktop">
              <div class="tag-create-row">
                <input
                  v-model="tagNewName"
                  type="text"
                  class="text-input"
                  placeholder="新标签名称"
                  @keydown.enter.prevent="tagCreate"
                />
                <select v-model="tagNewParentId" class="text-input tag-parent-select">
                  <option value="">根级</option>
                  <option v-for="option in tagAssignOptions" :key="`new-parent-desktop-${option.id}`" :value="option.id">
                    {{ option.path }}
                  </option>
                </select>
                <button class="btn" type="button" @click="tagCreate">创建</button>
                <button class="btn danger" type="button" @click="tagResetAll" :disabled="!tagDefinitions.length">清除全部</button>
              </div>
            </div>
            <div v-if="tagDefinitions.length" class="tag-editor-layout">
              <div class="tag-editor-tree-wrap">
                <div class="tag-editor-subtitle">标签树</div>
                <TransitionGroup name="list" tag="div" class="tag-editor-tree-list">
                  <div v-for="row in tagManagementRows" :key="`tag-desktop-row-${row.id}`" class="tag-editor-tree-item" :style="{ '--tag-color': row.color, '--depth': row.depth }">
                    <span class="tag-editor-indent"></span>
                    <span class="tag-editor-dot" :style="{ background: row.color }"></span>
                    <input
                      :value="tagDefinitionMap.get(row.id)?.name ?? ''"
                      class="tag-editor-name-input"
                      @blur="tagRename(row.id, ($event.target as HTMLInputElement).value)"
                      @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                    />
                    <select
                      class="text-input tag-parent-select"
                      :value="tagDefinitionMap.get(row.id)?.parent_id ?? ''"
                      @change="tagSetParent(row.id, ($event.target as HTMLSelectElement).value || null)"
                    >
                      <option value="">根级</option>
                      <option
                        v-for="option in tagAssignOptions"
                        :key="`tag-parent-desktop-${row.id}-${option.id}`"
                        :value="option.id"
                        :disabled="isTagParentOptionDisabled(row.id, option.id)"
                      >
                        {{ option.path }}
                      </option>
                    </select>
                    <div class="tag-color-picker">
                      <button
                        v-for="c in TAG_COLORS"
                        :key="`desktop-color-${row.id}-${c}`"
                        class="tag-color-dot"
                        :class="{ active: row.color === c }"
                        :style="{ background: c }"
                        type="button"
                        @click="tagSetColor(row.id, c)"
                      ></button>
                    </div>
                    <button class="tag-delete-btn" type="button" @click="tagDelete(row.id)">×</button>
                  </div>
                </TransitionGroup>
              </div>
              <div class="tag-assign-panel">
                <div class="tag-editor-subtitle">世界书分配</div>
                <div class="tag-assign-controls">
                  <label class="field">
                    <span>当前分配标签</span>
                    <select v-model="tagAssignTargetId" class="text-input">
                      <option value="">请选择标签</option>
                      <option v-for="option in tagAssignOptions" :key="`assign-desktop-${option.id}`" :value="option.id">
                        {{ option.path }}
                      </option>
                    </select>
                  </label>
                  <label class="field">
                    <span>搜索世界书</span>
                    <input v-model="tagAssignSearch" type="text" class="text-input" placeholder="搜索世界书..." />
                  </label>
                </div>
                <div class="tag-assign-list">
                  <button
                    v-for="name in tagAssignWorldbooks"
                    :key="`assign-desktop-wb-${name}`"
                    class="tag-assign-row toggle"
                    :class="{ active: tagAssignTargetId ? (tagAssignments[name] ?? []).includes(tagAssignTargetId) : false }"
                    type="button"
                    :disabled="!tagAssignTargetId"
                    @click="tagToggleAssignmentForSelectedTag(name)"
                  >
                    <span class="tag-assign-name" :title="name">{{ name }}</span>
                    <span class="tag-assign-state">{{ tagAssignTargetId && (tagAssignments[name] ?? []).includes(tagAssignTargetId) ? '已分配' : '未分配' }}</span>
                    <span class="tag-assign-paths">{{ getWorldbookTagPathSummary(name) }}</span>
                  </button>
                  <div v-if="!tagAssignWorldbooks.length" class="empty-note">没有匹配的世界书</div>
                </div>
              </div>
            </div>
            <div v-else class="empty-note" style="margin-top:20px;">暂无标签，请先创建</div>
          </section>

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
            <aside v-show="!showMobileEditor" class="wb-entry-list" :class="{ focus: isDesktopFocusMode }">
              <div v-if="!isDesktopFocusMode" class="list-search">
                <input v-model="searchText" type="text" class="text-input" placeholder="搜索名称 / 内容 / 关键词" />
                <label class="checkbox-inline">
                  <input v-model="onlyEnabled" type="checkbox" />
                  <span>仅启用</span>
                </label>
              </div>
              <div v-if="!isDesktopFocusMode" class="list-summary">
                <span>条目 {{ filteredEntries.length }} / {{ draftEntries.length }} | 启用 {{ enabledEntryCount }} | 选中 {{ selectedEntryCount }}</span>
                <button class="btn mini" type="button" :disabled="!draftEntries.length" :class="{ active: viewSortActive }" @click="sortEntries" style="margin-left:auto;font-size:11px;">🔢 排序</button>
              </div>
              <div v-if="selectedEntryCount > 1 && !isMobile" class="list-multi-edit-hint" :class="{ off: !multiEditEnabled }">
                {{ multiEditHintText }}
              </div>
              <TransitionGroup name="list" tag="div" class="list-scroll">
                <button
                  v-for="entry in filteredEntries"
                  :key="entry.uid"
                  type="button"
                  class="entry-item"
                  :data-status="getEntryVisualStatus(entry)"
                  :class="{
                    selected: selectedEntryUidSet.has(entry.uid),
                    primary: entry.uid === selectedEntryUid,
                    'drag-source': draggingEntryUids.includes(entry.uid),
                    'drop-before': entryDropTargetUid === entry.uid && entryDropPosition === 'before',
                    'drop-after': entryDropTargetUid === entry.uid && entryDropPosition === 'after',
                    disabled: !entry.enabled,
                  }"
                  :draggable="!isMobile"
                  @click="selectEntry(entry.uid, $event)"
                  @dragstart="handleEntryDragStart(entry.uid, $event)"
                  @dragover="handleEntryDragOver(entry.uid, $event)"
                  @drop="handleEntryDrop(entry.uid, $event)"
                  @dragend="handleEntryDragEnd"
                >
                  <div class="entry-item-head">
                    <span class="entry-status-dot" :data-status="getEntryVisualStatus(entry)"></span>
                    <div class="entry-item-title">{{ entry.name || `条目 ${entry.uid}` }}</div>
                    <span v-if="!isDesktopFocusMode" class="entry-chip uid">#{{ entry.uid }}</span>
                  </div>
                  <div v-if="!isDesktopFocusMode" class="entry-item-tags">
                    <span class="entry-chip status" :data-status="getEntryVisualStatus(entry)">
                      {{ getEntryStatusLabel(entry) }}
                    </span>
                    <span class="entry-chip">🔑 {{ entry.strategy.keys.length }}</span>
                    <span class="entry-chip">🎯 {{ entry.probability }}</span>
                    <span class="entry-chip mono">#{{ entry.position.order }}</span>
                  </div>
                  <div v-if="!isDesktopFocusMode" class="entry-item-preview">{{ getEntryKeyPreview(entry) }}</div>
                </button>
              </TransitionGroup>
              <div v-if="!isDesktopFocusMode" class="list-actions">
                <button class="btn" type="button" :disabled="!selectedWorldbookName" @click="addEntry">新增</button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="duplicateSelectedEntry">
                  复制
                </button>
                <button class="btn danger" type="button" :disabled="!selectedEntry" @click="removeSelectedEntry">
                  删除
                </button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="moveSelectedEntry(-1)">
                  上移
                </button>
                <button class="btn" type="button" :disabled="!selectedEntry" @click="moveSelectedEntry(1)">下移</button>
              </div>
            </aside>
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
    <!-- 设置弹窗 -->
    <div v-if="showApiSettings" class="ai-tag-review-overlay" @click.self="showApiSettings = false">
      <div class="ai-tag-review-modal" style="max-width:520px;">
        <div class="ai-tag-review-head">
          <span class="ai-tag-review-title">⚙️ 设置中心</span>
          <button class="ai-tag-review-close" type="button" @click="showApiSettings = false">×</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;max-height:60vh;">
          <div style="border:1px solid var(--wb-border-subtle,#334155);border-radius:8px;padding:10px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">体验设置</div>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">
              <input type="checkbox" :checked="fabVisible" @change="setFabVisible(($event.target as HTMLInputElement).checked)" />
              <span>显示悬浮按钮（📖）</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-bottom:6px;">
              <input type="checkbox" :checked="floorBtnVisible" @change="toggleFloorBtns(($event.target as HTMLInputElement).checked)" />
              <span>显示楼层提取按钮</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" :checked="persistedState.show_ai_chat" @change="updatePersistedState(s => s.show_ai_chat = ($event.target as HTMLInputElement).checked)" />
              <span>显示 AI 对话模块</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;">
              <input
                type="checkbox"
                :checked="persistedState.multi_edit.enabled"
                @change="updatePersistedState(s => s.multi_edit.enabled = ($event.target as HTMLInputElement).checked)"
              />
              <span>启用多选配置联动</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input
                type="checkbox"
                :checked="persistedState.multi_edit.sync_extra_json"
                @change="updatePersistedState(s => s.multi_edit.sync_extra_json = ($event.target as HTMLInputElement).checked)"
                :disabled="!persistedState.multi_edit.enabled"
              />
              <span>多选联动时同步高级字段 / extra JSON</span>
            </label>
            <label class="field" style="margin-top:8px;">
              <span>父标签删除策略</span>
              <select class="text-input" :value="persistedState.tag_editor.delete_parent_mode" @change="setTagDeleteParentMode(($event.target as HTMLSelectElement).value)">
                <option value="promote">删除父标签并上提子标签</option>
                <option value="cascade">级联删除整棵标签树</option>
              </select>
            </label>
            <div style="font-size:11px;color:var(--wb-text-muted,#64748b);margin-top:4px;">开启后将在工具栏和移动端 Tab 中显示 AI 对话入口</div>
            <label class="field" style="margin-top:8px;">
              <span>排序模式</span>
              <select class="text-input" :value="persistedState.sort.mode" @change="updatePersistedState(s => s.sort.mode = ($event.target as HTMLSelectElement).value as 'mutate' | 'view')">
                <option value="mutate">直接排序（修改条目顺序）</option>
                <option value="view">仅显示排序（不修改数据）</option>
              </select>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;">
              <input
                type="checkbox"
                :checked="persistedState.sort.reassign_uid"
                @change="updatePersistedState(s => s.sort.reassign_uid = ($event.target as HTMLInputElement).checked)"
              />
              <span>排序后重新分配 UID（仅直接排序模式）</span>
            </label>
            <label class="field" style="margin-top:8px;">
              <span>主题</span>
              <select class="text-input" :value="currentTheme" @change="setTheme(($event.target as HTMLSelectElement).value as ThemeKey)">
                <option v-for="item in themeOptions" :key="`setting-theme-${item.key}`" :value="item.key">{{ item.label }}</option>
              </select>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:6px;">
              <input type="checkbox" :checked="persistedState.glass_mode" @change="updatePersistedState(s => s.glass_mode = ($event.target as HTMLInputElement).checked)" />
              <span>启用毛玻璃特效 (Glassmorphism)</span>
            </label>
          </div>
          <div style="border-top:1px solid var(--wb-border-subtle,#334155);padding-top:10px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:8px;">API 设置</div>
          </div>
          <div style="display:flex;gap:12px;align-items:center;">
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="radio" value="custom" :checked="persistedState.ai_api_config.mode === 'custom'" @change="updateApiConfig({ mode: 'custom', use_main_api: false })" />
              <span>自定义API</span>
            </label>
            <label style="display:flex;align-items:center;gap:4px;cursor:pointer;">
              <input type="radio" value="tavern" :checked="persistedState.ai_api_config.mode === 'tavern'" @change="updateApiConfig({ mode: 'tavern' })" />
              <span>使用酒馆连接预设</span>
            </label>
          </div>
          <template v-if="persistedState.ai_api_config.mode === 'custom'">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
              <input type="checkbox" :checked="persistedState.ai_api_config.use_main_api" @change="updateApiConfig({ use_main_api: ($event.target as HTMLInputElement).checked })" />
              <span>使用主API（直接使用酒馆当前API和模型）</span>
            </label>
            <template v-if="!persistedState.ai_api_config.use_main_api">
              <div style="font-size:11px;color:#f59e0b;">⚠️ API密钥将保存在脚本本地存储中。</div>
              <label class="field">
                <span>API基础URL</span>
                <input class="text-input" type="text" :value="persistedState.ai_api_config.apiurl" @change="updateApiConfig({ apiurl: ($event.target as HTMLInputElement).value })" placeholder="https://api.openai.com/v1" />
              </label>
              <label class="field">
                <span>API密钥（可选）</span>
                <input class="text-input" type="password" :value="persistedState.ai_api_config.key" @change="updateApiConfig({ key: ($event.target as HTMLInputElement).value })" placeholder="sk-..." />
              </label>
              <div style="display:flex;gap:10px;">
                <label class="field" style="flex:1;">
                  <span>最大Tokens</span>
                  <input class="text-input" type="number" :value="persistedState.ai_api_config.max_tokens" @change="updateApiConfig({ max_tokens: Number(($event.target as HTMLInputElement).value) || 4096 })" />
                </label>
                <label class="field" style="flex:1;">
                  <span>温度</span>
                  <input class="text-input" type="number" step="0.1" min="0" max="2" :value="persistedState.ai_api_config.temperature" @change="updateApiConfig({ temperature: Number(($event.target as HTMLInputElement).value) || 1 })" />
                </label>
              </div>
              <button class="btn" type="button" :disabled="apiModelLoading || !persistedState.ai_api_config.apiurl" @click="loadModelList" style="width:100%;">
                {{ apiModelLoading ? '加载中...' : '加载模型列表' }}
              </button>
              <label class="field" v-if="apiModelList.length > 0">
                <span>选择模型</span>
                <select class="text-input" :value="persistedState.ai_api_config.model" @change="updateApiConfig({ model: ($event.target as HTMLSelectElement).value })">
                  <option value="">请选择模型</option>
                  <option v-for="m in apiModelList" :key="m" :value="m">{{ m }}</option>
                </select>
              </label>
              <label class="field" v-else>
                <span>模型名称（手动输入）</span>
                <input class="text-input" type="text" :value="persistedState.ai_api_config.model" @change="updateApiConfig({ model: ($event.target as HTMLInputElement).value })" placeholder="gpt-4o" />
              </label>
            </template>
          </template>
          <div v-if="persistedState.ai_api_config.mode === 'tavern'" style="font-size:12px;color:var(--wb-text-muted);padding:8px 0;">
            将直接使用酒馆当前启用的预设和API配置进行生成。
          </div>
        </div>
      </div>
    </div>

    <!-- AI 配置输入弹窗 -->
    <div v-if="aiConfigTargetWorldbook && !aiConfigPreview && !aiConfigGenerating" class="ai-tag-review-overlay" @click.self="aiConfigTargetWorldbook = ''">
      <div class="ai-tag-review-modal" style="max-width:600px;">
        <div class="ai-tag-review-head">
          <span class="ai-tag-review-title">🔧 AI 配置世界书</span>
          <button class="ai-tag-review-close" type="button" @click="aiConfigTargetWorldbook = ''">×</button>
        </div>
        <div style="padding:16px;display:flex;flex-direction:column;gap:12px;overflow-y:auto;max-height:60vh;">
          <label class="field">
            <span>目标世界书</span>
            <select v-model="aiConfigTargetWorldbook" class="text-input">
              <option value="">请选择</option>
              <option v-for="name in worldbookNames" :key="`cfg-wb-${name}`" :value="name">{{ name }}</option>
            </select>
          </label>
          <label class="field">
            <span>配置指令（自然语言描述）</span>
            <textarea v-model="aiConfigInput" class="text-input" rows="8" placeholder="例如：
将以下条目设为蓝灯常驻，位置设为角色定义前：
- 世界观设定（顺序1）
- 角色速览（顺序2）

所有条目启用不可递归和防止进一步递归"></textarea>
          </label>
          <details style="margin-top:4px;">
            <summary style="cursor:pointer;color:var(--wb-text-dim);font-size:12px;user-select:none;">📝 查看/修改系统提示词</summary>
            <div style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
              <textarea v-model="aiConfigCustomPrompt" class="text-input" rows="10" :placeholder="'留空则使用默认提示词。\n当前默认提示词会在选择世界书后自动填入条目名。'" style="font-size:12px;font-family:monospace;"></textarea>
              <div style="display:flex;gap:6px;">
                <button class="btn" type="button" style="font-size:12px;" @click="aiConfigCustomPrompt = ''">🔄 恢复默认</button>
                <button class="btn" type="button" style="font-size:12px;" @click="loadDefaultConfigPrompt">📋 加载默认提示词</button>
              </div>
            </div>
          </details>
          <button class="btn primary" type="button" :disabled="!aiConfigInput.trim() || !aiConfigTargetWorldbook || aiConfigGenerating" @click="aiConfigGenerate" style="width:100%;margin-top:8px;">
            {{ aiConfigGenerating ? '⏳ AI 分析中...' : '🤖 发送给 AI 分析' }}
          </button>
        </div>
      </div>
    </div>

    <!-- AI 配置生成中遮罩 -->
    <div v-if="aiConfigGenerating" class="ai-tag-review-overlay">
      <div class="ai-tag-review-modal" style="max-width:400px;text-align:center;padding:40px;">
        <div style="font-size:24px;margin-bottom:12px;">⏳</div>
        <div style="color:var(--wb-text-main);">AI 正在分析配置指令...</div>
      </div>
    </div>

    <!-- AI 配置预览弹窗 -->
    <div v-if="aiConfigPreview" class="ai-tag-review-overlay" @click.self="aiConfigPreview = false">
      <div class="ai-tag-review-modal" style="max-width:700px;">
        <div class="ai-tag-review-head">
          <span class="ai-tag-review-title">📋 配置变更预览</span>
          <button class="ai-tag-review-close" type="button" @click="aiConfigPreview = false">×</button>
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
              <tr v-for="(c, i) in aiConfigChanges" :key="i" style="border-bottom:1px solid var(--wb-border);" :style="{ opacity: c.selected ? 1 : 0.4 }">
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
          <button class="btn" type="button" @click="aiConfigChanges.forEach(c => c.selected = true)">全选</button>
          <button class="btn" type="button" @click="aiConfigChanges.forEach(c => c.selected = false)">全不选</button>
          <button class="btn primary" type="button" :disabled="!aiConfigChanges.some(c => c.selected)" @click="aiConfigApply">
            应用选中变更（{{ aiConfigChanges.filter(c => c.selected).length }}）
          </button>
        </div>
      </div>
    </div>

    <!-- 标签审查 -->
    <div v-if="aiShowTagReview" class="ai-tag-review-overlay" @click.self="aiShowTagReview = false">
      <div class="ai-tag-review-modal">
        <div class="ai-tag-review-head">
          <span class="ai-tag-review-title">📋 提取到的条目（{{ aiExtractedTags.length }}）</span>
          <button class="ai-tag-review-close" type="button" @click="aiShowTagReview = false">×</button>
        </div>
        <div class="ai-tag-review-target">
          <label class="field">
            <span>目标世界书</span>
            <select v-model="aiTargetWorldbook" class="text-input" @change="markDuplicatesInTags">
              <option value="">请选择目标世界书</option>
              <option v-for="name in worldbookNames" :key="`ai-wb-${name}`" :value="name">{{ name }}</option>
            </select>
          </label>
        </div>
        <details class="ai-tag-ignore-config">
          <summary>🚫 忽略标签配置</summary>
          <div style="padding:8px 0 0;font-size:12px;color:var(--wb-text-muted);margin-bottom:4px;">匹配到这些标签时跳过导入，但继续扫描其内部可用标签（逗号或换行分隔）</div>
          <textarea
            class="text-input"
            rows="2"
            :value="persistedState.extract_ignore_tags.join(', ')"
            @change="updateIgnoreTags(($event.target as HTMLTextAreaElement).value)"
            style="width:100%;font-size:12px;"
          ></textarea>
          <button class="btn" type="button" style="margin-top:4px;font-size:11px;" @click="resetIgnoreTags">🔄 恢复默认</button>
        </details>
        <div class="ai-tag-list">
          <label
            v-for="(tag, idx) in aiExtractedTags"
            :key="`tag-${idx}`"
            class="ai-tag-item"
            :class="{ 'ai-tag-duplicate': tag.duplicate }"
          >
            <input v-model="tag.selected" type="checkbox" />
            <div class="ai-tag-info">
              <span class="ai-tag-name">{{ tag.tag }}<span v-if="tag.duplicate" style="color:#f59e0b;font-size:0.85em;margin-left:6px;">⚠️ 已存在</span><span v-else-if="tag.updated" style="color:#3b82f6;font-size:0.85em;margin-left:6px;">🔄 内容已更新</span></span>
              <span class="ai-tag-preview">{{ tag.content.slice(0, 120) }}{{ tag.content.length > 120 ? '...' : '' }}</span>
            </div>
          </label>
        </div>
        <div class="ai-tag-review-actions">
          <button class="btn" type="button" @click="aiExtractedTags.forEach(t => t.selected = true)">全选</button>
          <button class="btn" type="button" @click="aiExtractedTags.forEach(t => t.selected = false)">全不选</button>
          <button
            class="btn primary"
            type="button"
            :disabled="!aiTargetWorldbook || !aiExtractedTags.some(t => t.selected)"
            @click="aiCreateSelectedEntries"
          >创建选中条目（{{ aiExtractedTags.filter(t => t.selected).length }}）</button>
        </div>
      </div>
    </div>

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
import './components/crossCopyShared.css';
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

.mobile-browse-toolbar .worldbook-picker {
  max-width: 160px;
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

.worldbook-picker {
  position: relative;
  flex: 1 1 auto;
  min-width: 240px;
}

.worldbook-picker-trigger {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--wb-input-bg);
  color: var(--wb-text-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.worldbook-picker-trigger:hover {
  border-color: var(--wb-primary-light);
}

.worldbook-picker-trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.worldbook-picker-trigger-arrow {
  flex-shrink: 0;
  color: var(--wb-text-muted);
}

.wb-assistant-root .worldbook-picker-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 10120;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  background: var(--wb-dropdown-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.worldbook-picker-search {
  width: 100%;
}

.worldbook-picker-list {
  max-height: 260px;
  overflow: auto;
  border: none;
  border-radius: 8px;
  background: var(--wb-bg-panel);
  display: flex;
  flex-direction: column;
}

.worldbook-picker-item {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--wb-border-subtle);
  background: transparent;
  color: var(--wb-text-main);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.worldbook-picker-item:last-child {
  border-bottom: none;
}

.worldbook-picker-item:hover {
  background: var(--wb-primary-soft);
}

.worldbook-picker-item.active {
  background: var(--wb-primary-soft);
  color: var(--wb-primary-light);
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

.global-mode-panel {
  border-radius: 12px;
  background: var(--wb-bg-panel);
  padding: 12px;
  display: grid;
  gap: 12px;
}

.global-mode-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.global-mode-title {
  color: var(--wb-primary-light);
  font-weight: 700;
  letter-spacing: 0.02em;
}

.global-mode-sections {
  display: grid;
  gap: 10px;
}

.global-mode-section {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 10px;
  background: var(--wb-bg-panel);
  overflow: hidden;
}

.global-mode-section-summary {
  list-style: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 180ms ease;
}

.global-mode-section-summary:hover {
  background: color-mix(in srgb, var(--wb-primary-soft) 45%, transparent);
}

.global-mode-section-summary::-webkit-details-marker {
  display: none;
}

.global-mode-section-summary::after {
  content: '▾';
  margin-left: auto;
  color: var(--wb-text-muted);
  transition: transform 180ms ease;
}

.global-mode-section:not([open]) .global-mode-section-summary::after {
  transform: rotate(-90deg);
}

.global-mode-section-title {
  color: var(--wb-primary-light);
  font-weight: 600;
}

.global-mode-section-meta {
  color: var(--wb-text-muted);
  font-size: 12px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-mode-section-body {
  border-top: 1px solid var(--wb-border-subtle);
  padding: 10px;
  display: grid;
  gap: 8px;
}

.global-preset-panel {
  display: grid;
  gap: 8px;
}

.preset-role-panel {
  display: grid;
  gap: 6px;
}

.preset-role-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preset-role-current {
  color: var(--wb-primary);
  font-size: 12px;
}

.preset-role-current.empty {
  color: var(--wb-text-muted);
}

.preset-role-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.role-picker {
  position: relative;
}

.role-picker-trigger {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--wb-input-bg);
  color: var(--wb-text-main);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  cursor: pointer;
}

.role-picker-trigger:disabled {
  opacity: 0.55;
  cursor: default;
}

.role-picker-trigger:hover:not(:disabled) {
  border-color: var(--wb-primary-light);
}

.role-picker-trigger-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.role-picker-trigger-arrow {
  flex-shrink: 0;
  color: var(--wb-text-muted);
}

.wb-assistant-root .role-picker-dropdown {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  z-index: 10130;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 8px;
  background: var(--wb-dropdown-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 12px 32px rgba(0,0,0,0.4);
  padding: 8px;
  display: grid;
  gap: 8px;
}

.role-picker-search {
  width: 100%;
}

.role-picker-list {
  border: none;
  border-radius: 8px;
  background: var(--wb-bg-panel);
  max-height: 220px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.role-picker-item {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--wb-border-subtle);
  background: transparent;
  color: var(--wb-text-main);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
}

.role-picker-item:last-child {
  border-bottom: none;
}

.role-picker-item:hover:not(:disabled) {
  background: var(--wb-primary-soft);
}

.role-picker-item:disabled {
  opacity: 0.55;
  cursor: default;
}

.role-picker-item .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.role-picker-item .meta {
  color: var(--wb-primary-light);
  flex-shrink: 0;
  font-size: 11px;
}

.preset-role-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.preset-role-tag {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 999px;
  background: var(--wb-bg-panel);
  color: var(--wb-text-main);
  padding: 2px 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.preset-role-tag:hover {
  border-color: #f43f5e;
}

.preset-role-tag .remove {
  color: #fca5a5;
}

.global-mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.global-mode-column {
  border-radius: 8px;
  padding: 10px;
  background: var(--wb-bg-panel);
  display: grid;
  gap: 6px;
  min-height: 168px;
}

.global-mode-list {
  border-radius: 8px;
  background: var(--wb-input-bg);
  max-height: 176px;
  min-height: 88px;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.global-mode-item {
  width: 100%;
  border: none;
  border-bottom: 1px solid var(--wb-border-subtle);
  background: transparent;
  color: var(--wb-text-main);
  padding: 7px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  text-align: left;
}

.global-mode-item:last-child {
  border-bottom: none;
}

.global-mode-item:hover {
  background: var(--wb-primary-soft);
}

.global-mode-item.add .global-mode-item-action {
  color: #86efac;
}

.global-mode-item.active .global-mode-item-action {
  color: #fca5a5;
}

.global-mode-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-mode-item-action {
  font-size: 12px;
  flex-shrink: 0;
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

/* List Transitions for TransitionGroup */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: scaleY(0.8) translateY(-10px);
}

.list-leave-active {
  position: absolute;
}

.global-mode-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
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

.wb-main-layout {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-columns: 280px 10px minmax(0, 1fr);
  gap: 0;
  align-items: stretch;
  transition: grid-template-columns 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.wb-main-layout.global-mode-visible {
  flex: 0 0 auto;
  height: auto;
  min-height: clamp(360px, 46vh, 700px);
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

@keyframes copy-cine-main-enter {
  0% {
    opacity: 0.2;
    transform: translateY(18px) scale(0.972);
    filter: blur(1.6px);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

.wb-entry-list,
.wb-editor {
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: transparent;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  transition: padding 320ms cubic-bezier(0.22, 1, 0.36, 1), background-color 320ms cubic-bezier(0.22, 1, 0.36, 1), border-color 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.list-search {
  display: grid;
  gap: 6px;
  padding: 0 8px;
  flex-shrink: 0;
}

.list-summary {
  color: var(--wb-text-muted);
  font-size: 12px;
  padding: 0 8px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}

.list-multi-edit-hint {
  margin: 0 8px;
  border: 1px solid color-mix(in srgb, var(--wb-primary) 36%, transparent);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--wb-primary-light);
  background: color-mix(in srgb, var(--wb-primary-soft) 72%, transparent);
  flex-shrink: 0;
}

.list-multi-edit-hint.off {
  color: var(--wb-text-muted);
  border-color: var(--wb-border-subtle);
  background: var(--wb-input-bg);
}

.list-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
  padding: 4px 4px 4px 4px;
  transition: padding 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.entry-item {
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  background: var(--wb-input-bg);
  color: var(--wb-text-main);
  border-radius: 10px;
  padding: 12px 14px 12px 18px;
  cursor: pointer;
  display: grid;
  gap: 6px;
  position: relative;
  transition:
    background 0.25s ease,
    transform 0.25s ease,
    border-color 0.25s ease,
    box-shadow 0.25s ease,
    padding 320ms cubic-bezier(0.22, 1, 0.36, 1),
    border-radius 320ms cubic-bezier(0.22, 1, 0.36, 1),
    margin-bottom 320ms cubic-bezier(0.22, 1, 0.36, 1),
    gap 320ms cubic-bezier(0.22, 1, 0.36, 1);
  margin-bottom: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.entry-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: 10px 0 0 10px;
  background: linear-gradient(to bottom, #64748b, rgba(100, 116, 139, 0.15));
}

.entry-item[data-status='constant']::before {
  background: linear-gradient(to bottom, #3b82f6, rgba(59, 130, 246, 0));
}

.entry-item[data-status='vector']::before {
  background: linear-gradient(to bottom, #a855f7, rgba(168, 85, 247, 0));
}

.entry-item[data-status='normal']::before {
  background: linear-gradient(to bottom, #22c55e, rgba(34, 197, 94, 0));
}

.entry-item[data-status='disabled']::before {
  background: linear-gradient(to bottom, #6b7280, rgba(107, 114, 128, 0));
}

.entry-item:hover {
  background: var(--wb-input-bg-hover);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0,0,0,0.1);
  border-color: var(--wb-border-main);
}

.entry-item.selected {
  background: color-mix(in srgb, var(--wb-primary-soft) 65%, transparent);
  border-color: color-mix(in srgb, var(--wb-primary) 70%, transparent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--wb-primary) 55%, transparent), 0 4px 14px rgba(0,0,0,0.12);
  transform: translateY(-1px);
}

.entry-item.selected.primary {
  background: var(--wb-primary-soft);
  border-color: var(--wb-primary);
  box-shadow: 0 0 0 1px var(--wb-primary), 0 4px 20px rgba(0,0,0,0.15);
  transform: translateY(-1px);
}

.entry-item.drag-source {
  opacity: 0.82;
}

.entry-item.drop-before::after,
.entry-item.drop-after::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 999px;
  background: var(--wb-primary-light);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--wb-primary-light) 65%, transparent);
  pointer-events: none;
}

.entry-item.drop-before::after {
  top: -2px;
}

.entry-item.drop-after::after {
  bottom: -2px;
}

.entry-item.disabled {
  opacity: 0.74;
}

.entry-item-head {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.entry-status-dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #64748b;
  flex-shrink: 0;
  box-shadow: 0 0 0 2px var(--wb-bg-panel);
}

.entry-status-dot[data-status='constant'] {
  background: #3b82f6;
}

.entry-status-dot[data-status='vector'] {
  background: #a855f7;
}

.entry-status-dot[data-status='normal'] {
  background: #22c55e;
}

.entry-status-dot[data-status='disabled'] {
  background: #6b7280;
}

.entry-item-title {
  font-weight: 700;
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: font-size 320ms cubic-bezier(0.22, 1, 0.36, 1);
}

.entry-item-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.entry-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid var(--wb-border-subtle);
  border-radius: 999px;
  padding: 2px 10px;
  color: var(--wb-text-main);
  font-size: 11px;
  background: var(--wb-bg-panel);
  font-weight: 500;
}

.entry-chip.uid {
  color: var(--wb-primary-light);
  font-size: 10px;
  padding: 1px 7px;
}

.entry-chip.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 10px;
}

.entry-chip.status[data-status='constant'] {
  color: #93c5fd;
  background: rgba(59, 130, 246, 0.16);
}

.entry-chip.status[data-status='vector'] {
  color: #d8b4fe;
  background: rgba(168, 85, 247, 0.16);
}

.entry-chip.status[data-status='normal'] {
  color: #86efac;
  background: rgba(34, 197, 94, 0.16);
}

.entry-chip.status[data-status='disabled'] {
  color: #cbd5e1;
  background: rgba(100, 116, 139, 0.15);
}

.entry-item-preview {
  color: var(--wb-text-muted);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-left: 16px;
  opacity: 0.85;
}

.entry-item-preview::before {
  content: 'Keys: ';
  color: var(--wb-text-muted);
  margin-right: 4px;
}

.wb-editor {
  height: 100%;
  overflow: hidden;
}

.wb-editor-shell {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 10px 360px;
  gap: 0;
  transition: grid-template-columns 240ms cubic-bezier(0.22, 1, 0.36, 1);
}

.wb-assistant-root.focus-cine-locked .wb-editor-shell {
  transition-duration: 1400ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.wb-main-layout.focus-mode .wb-entry-list {
  border: 1px solid var(--wb-border-subtle);
  border-radius: 12px;
  padding: 6px;
  background: var(--wb-bg-panel);
}

.wb-main-layout.focus-mode .list-scroll {
  padding: 2px;
}

.wb-main-layout.focus-mode .entry-item {
  padding: 9px 10px 9px 14px;
  border-radius: 8px;
  margin-bottom: 4px;
  gap: 4px;
}

.wb-main-layout.focus-mode .entry-item-title {
  font-size: 12px;
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
  .global-mode-grid {
    grid-template-columns: 1fr;
  }

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

.mobile-ai-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.mobile-ai-panel .ai-chat-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
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
  .global-mode-panel,
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

  .worldbook-picker-trigger {
    white-space: normal;
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

.list-actions {
  padding: 0 8px;
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
   AI Generator Panel
   ═════════════════════════════════════════════════ */
.ai-generator-panel {
  display: flex;
  gap: 0;
  flex: 1;
  min-height: 0;
  border-radius: var(--wb-radius);
  overflow: hidden;
  background: var(--wb-bg-secondary);
}

/* ── Sidebar ── */
.ai-sidebar {
  width: 220px;
  min-width: 180px;
  border-right: 1px solid var(--wb-border);
  display: flex;
  flex-direction: column;
  background: var(--wb-bg-panel);
}

.ai-sidebar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid var(--wb-border);
}

.ai-sidebar-title {
  font-weight: 600;
  font-size: 0.9em;
  color: var(--wb-text-main);
}

.ai-session-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.ai-session-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 2px;
  border: none;
  border-radius: var(--wb-radius-sm, 6px);
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
  position: relative;
  outline: none;
}

.ai-session-item:hover {
  background: var(--wb-bg-highlight);
}

.ai-session-item:focus-visible {
  box-shadow: 0 0 0 2px var(--wb-primary, #38bdf8);
}

.ai-session-item.active {
  background: var(--wb-primary-soft);
}

.ai-session-title {
  flex: 1;
  font-size: 0.85em;
  color: var(--wb-text-main);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-session-meta {
  font-size: 0.72em;
  color: var(--wb-text-dim);
  width: 100%;
  margin-top: 2px;
}

.ai-session-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  background: transparent;
  color: var(--wb-text-dim);
  font-size: 1em;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.ai-session-item:hover .ai-session-delete {
  opacity: 1;
}

.ai-session-delete:hover {
  background: var(--wb-danger, #e74c3c);
  color: #fff;
}

/* ── Chat Area ── */
.ai-chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.ai-chat-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--wb-text-dim);
}

.ai-chat-empty-icon {
  font-size: 3em;
  opacity: 0.5;
}

.ai-chat-empty-text {
  font-size: 0.95em;
}

.ai-chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* ── Chat bubbles ── */
.ai-chat-bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-chat-bubble.user {
  align-self: flex-end;
  background: var(--wb-primary-soft);
  border-bottom-right-radius: 4px;
}

.ai-chat-bubble.assistant {
  align-self: flex-start;
  background: var(--wb-bg-panel);
  border: 1px solid var(--wb-border);
  border-bottom-left-radius: 4px;
}

.ai-chat-bubble-role {
  font-size: 0.72em;
  font-weight: 600;
  color: var(--wb-text-dim);
  margin-bottom: 4px;
}

.ai-chat-bubble-content {
  font-size: 0.88em;
  color: var(--wb-text-main);
}

.ai-cursor {
  animation: ai-blink 0.7s infinite;
  color: var(--wb-primary);
}

@keyframes ai-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.ai-thinking {
  color: var(--wb-text-dim);
  font-style: italic;
}

/* ── Input bar ── */
.ai-chat-input-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--wb-border);
  background: var(--wb-bg-panel);
  align-items: flex-end;
}

.ai-context-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78em;
  color: var(--wb-text-dim);
  cursor: pointer;
  user-select: none;
}

.ai-context-toggle input {
  margin: 0;
}

.ai-context-toggle span {
  white-space: nowrap;
}

.ai-chat-input {
  flex: 1;
  resize: vertical;
  min-height: 40px;
  max-height: 140px;
  font-size: 0.88em;
}

.ai-send-btn,
.ai-stop-btn {
  min-width: 64px;
  height: 40px;
}

/* ═════════════════════════════════════════════════
   Tag Review Modal (API Settings / AI Config / Chat Extract)
   ═════════════════════════════════════════════════ */
.ai-tag-review-overlay {
  position: fixed;
  inset: 0;
  z-index: 10020;
  background: var(--wb-overlay-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  box-sizing: border-box;
}

.ai-tag-review-modal {
  background: var(--wb-glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--wb-border-subtle);
  border-radius: 16px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.4), 0 2px 6px rgba(0, 0, 0, 0.1);
  width: 580px;
  max-width: 92vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.ai-tag-review-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--wb-border-subtle);
  background: var(--wb-glass-header);
}

.ai-tag-review-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--wb-text-main);
}

.ai-tag-review-close {
  width: 30px;
  height: 30px;
  border: 1px solid var(--wb-border-subtle);
  background: var(--wb-input-bg);
  color: var(--wb-text-main);
  font-size: 1.1em;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.ai-tag-review-close:hover {
  background: var(--wb-input-bg-hover);
  border-color: #f43f5e;
  transform: translateY(-1px);
}

.ai-tag-review-target {
  padding: 14px 20px;
  border-bottom: 1px solid var(--wb-border-subtle);
}

.ai-tag-list {
  flex: 1;
  overflow-y: auto;
  padding: 10px 20px;
}

.ai-tag-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--wb-border-subtle);
  cursor: pointer;
  transition: background 0.15s ease;
}

.ai-tag-item:last-child {
  border-bottom: none;
}

.ai-tag-item:hover {
  background: var(--wb-primary-soft);
  border-radius: 8px;
  margin: 0 -8px;
  padding: 12px 8px;
}

.ai-tag-item input[type="checkbox"] {
  margin-top: 3px;
}

.ai-tag-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.ai-tag-name {
  font-weight: 600;
  font-size: 13px;
  color: var(--wb-primary-light);
}

.ai-tag-preview {
  font-size: 12px;
  color: var(--wb-text-dim);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.ai-tag-review-actions {
  display: flex;
  gap: 8px;
  padding: 14px 20px;
  border-top: 1px solid var(--wb-border-subtle);
  justify-content: flex-end;
  background: var(--wb-glass-header);
}

.btn.primary {
  background: var(--wb-primary);
  color: #fff;
  border-color: var(--wb-primary);
}

.btn.primary:hover {
  filter: brightness(1.1);
}

.btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

  /* ── AI Generator Panel ── */
  .ai-generator-panel {
    flex-direction: column;
  }

  .ai-sidebar {
    width: 100%;
    min-width: unset;
    max-height: 110px;
    border-right: none;
    border-bottom: 1px solid var(--wb-border);
  }

  .ai-sidebar-head {
    padding: 6px 10px;
  }

  .ai-session-list {
    overflow-x: auto;
    overflow-y: hidden;
    display: flex;
    flex-direction: row;
    gap: 4px;
    padding: 4px 8px;
  }

  .ai-session-item {
    flex-shrink: 0;
    min-width: 140px;
    max-width: 200px;
  }

  .ai-chat-messages {
    padding: 10px;
    gap: 8px;
  }

  .ai-chat-bubble {
    max-width: 95%;
  }

  .ai-chat-input-bar {
    padding: 8px 10px;
    gap: 6px;
  }

  .ai-chat-input {
    min-height: 36px;
    font-size: 0.85em;
  }

  /* ── Tag review modal (mobile full-screen) ── */
  .ai-tag-review-overlay {
    position: absolute;
    inset: 0;
    padding: 0;
    z-index: 10200;
    align-items: stretch;
    justify-content: stretch;
  }

  .ai-tag-review-modal {
    width: 100% !important;
    max-width: 100% !important;
    max-height: 100% !important;
    height: 100%;
    border-radius: 0;
    border: none;
    box-shadow: none;
  }

  .ai-tag-review-head {
    padding: 12px 14px;
    flex-shrink: 0;
  }

  .ai-tag-review-title {
    font-size: 13px;
  }

  .ai-tag-review-close {
    width: 28px;
    height: 28px;
    font-size: 1em;
  }

  .ai-tag-review-target {
    padding: 10px 14px;
    flex-shrink: 0;
  }

  .ai-tag-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    padding: 8px 14px;
  }

  .ai-tag-item {
    padding: 10px 0;
    gap: 10px;
  }

  .ai-tag-item:hover {
    margin: 0;
    padding: 10px 0;
    background: transparent;
  }

  .ai-tag-review-actions {
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 14px;
    flex-shrink: 0;
  }

  .ai-tag-review-actions .btn {
    flex: 1;
    min-width: 0;
    font-size: 12px;
    padding: 8px 10px;
  }

  /* Override inline max-height on modal body scrollable divs */
  .ai-tag-review-modal > div:not(.ai-tag-review-head):not(.ai-tag-review-actions):not(.ai-tag-review-target):not(.ai-tag-list):not(.ai-tag-ignore-config) {
    max-height: none !important;
    flex: 1;
    min-height: 0;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
  }

  /* AI config preview table horizontal scroll */
  .ai-tag-review-modal table {
    display: block;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    font-size: 12px;
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
<style scoped>
/* ── Tag System ── */
.worldbook-picker-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 8px 2px;
}
.worldbook-picker-tags.tree-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid var(--wb-border-subtle);
  background: rgba(12, 24, 52, 0.72);
}

.tag-filter-toolbar {
  display: grid;
  grid-template-columns: auto minmax(120px, 1fr) auto auto auto;
  align-items: center;
  gap: 6px;
}

.tag-filter-open {
  white-space: nowrap;
}

.tag-filter-summary {
  font-size: 12px;
  color: var(--wb-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-filter-select {
  height: 28px;
  min-width: 66px;
  font-size: 12px;
  padding: 3px 8px;
}

.tag-filter-panel-enter-active,
.tag-filter-panel-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tag-filter-panel-enter-from,
.tag-filter-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.tag-filter-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 8px;
  border: 1px solid var(--wb-border-subtle);
  background: rgba(7, 18, 40, 0.86);
  padding: 8px;
}

.tag-filter-search {
  height: 30px;
  font-size: 12px;
}

.tag-filter-selected-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-height: 74px;
  overflow: auto;
}

.tag-filter-selected-chip {
  border: 1px solid rgba(96, 165, 250, 0.45);
  background: rgba(37, 99, 235, 0.2);
  color: #bfdbfe;
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.tag-tree-list,
.tag-flat-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow: auto;
  padding-right: 2px;
}

.tag-tree-row {
  display: grid;
  grid-template-columns: 16px 16px minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 6px;
  padding: 5px 6px;
  padding-left: calc(6px + var(--depth, 0) * 12px);
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.tag-tree-toggle {
  border: none;
  background: transparent;
  color: var(--wb-text-dim);
  cursor: pointer;
  width: 16px;
  height: 16px;
  padding: 0;
  line-height: 1;
}

.tag-tree-toggle.placeholder {
  display: inline-block;
}

.tag-tree-name {
  color: var(--tag-color, #60a5fa);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-tree-path {
  color: var(--wb-text-dim);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-flat-item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.02);
  color: var(--tag-color, #60a5fa);
  font-size: 12px;
}

.tag-editor-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  max-height: 100%;
}

.tag-editor-title {
  font-size: 18px;
  font-weight: 700;
}

.tag-create-panel {
  border-radius: 10px;
  border: 1px solid var(--wb-border-subtle);
  background: rgba(255, 255, 255, 0.03);
  padding: 10px;
}

.tag-create-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.tag-create-row .text-input {
  min-width: 180px;
  flex: 1 1 220px;
}

.tag-parent-field {
  margin-top: 8px;
}

.tag-editor-layout {
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(340px, 1.2fr);
  gap: 16px;
  min-height: 0;
}

.tag-editor-subtitle {
  font-size: 14px;
  font-weight: 600;
  color: var(--wb-text-main);
}

.tag-editor-tree-wrap,
.tag-assign-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: 10px;
  border: 1px solid var(--wb-border-subtle);
  background: rgba(255, 255, 255, 0.03);
  padding: 10px;
  min-height: 0;
}

.tag-editor-tree-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 55vh;
  overflow-y: auto;
}

.tag-editor-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 8px;
  background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
}

.tag-editor-tree-item {
  display: grid;
  grid-template-columns: auto 12px minmax(120px, 1fr) minmax(160px, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
}

.tag-editor-indent {
  width: calc(var(--depth, 0) * 14px);
  height: 1px;
}

.tag-editor-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.tag-editor-name-input {
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(255,255,255,.15);
  color: inherit;
  font-size: 13px;
  padding: 2px 4px;
  width: 80px;
  outline: none;
}
.tag-editor-name-input:focus {
  border-bottom-color: #60a5fa;
}

.tag-parent-select {
  min-width: 140px;
  font-size: 12px;
  height: 30px;
}

.tag-color-picker {
  display: flex;
  gap: 3px;
  flex-wrap: wrap;
}
.tag-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  padding: 0;
  transition: border-color .15s;
}
.tag-color-dot.active {
  border-color: #fff;
  box-shadow: 0 0 4px rgba(255,255,255,.3);
}
.tag-delete-btn {
  background: none;
  border: none;
  color: #f87171;
  font-size: 16px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
  opacity: .6;
  transition: opacity .15s;
}
.tag-delete-btn:hover {
  opacity: 1;
}

.tag-assign-controls {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.tag-assign-list {
  max-height: 55vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tag-assign-list.compact {
  max-height: 42vh;
}

.tag-assign-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  align-items: center;
  gap: 4px 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  text-align: left;
}

.tag-assign-row.toggle {
  cursor: pointer;
}

.tag-assign-row.toggle.active {
  border-color: rgba(59, 130, 246, 0.6);
  background: rgba(37, 99, 235, 0.18);
}

.tag-assign-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.tag-assign-state {
  font-size: 11px;
  color: #93c5fd;
  border: 1px solid rgba(147, 197, 253, 0.45);
  border-radius: 999px;
  padding: 1px 8px;
}

.tag-assign-paths {
  grid-column: 1 / -1;
  font-size: 11px;
  color: var(--wb-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mobile-tag-editor .tag-editor-title {
  font-size: 16px;
}

.mobile-tag-editor .tag-create-row .text-input {
  flex: 1 1 100%;
}

.mobile-tag-editor .tag-editor-tree-list {
  max-height: 42vh;
}

.mobile-tag-editor .tag-editor-tree-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.mobile-tag-editor .tag-editor-indent {
  width: calc(var(--depth, 0) * 10px);
}

.mobile-tag-editor .tag-editor-name-input {
  flex: 1 1 120px;
  min-width: 100px;
}

.mobile-tag-editor .tag-parent-select {
  width: 100%;
  min-width: 0;
}

@media (max-width: 1360px) {
  .tag-filter-toolbar {
    grid-template-columns: auto minmax(100px, 1fr) auto;
    grid-auto-rows: auto;
  }
  .tag-filter-summary {
    grid-column: 2 / 4;
  }
}

@media (max-width: 1200px) {
  .tag-editor-layout {
    grid-template-columns: 1fr;
  }
  .tag-assign-controls {
    grid-template-columns: 1fr;
  }
  .tag-editor-tree-item {
    grid-template-columns: auto 12px minmax(0, 1fr);
  }
  .tag-editor-tree-item .tag-parent-select {
    grid-column: 3 / 4;
  }
  .tag-editor-tree-item .tag-color-picker {
    grid-column: 2 / 4;
  }
  .tag-editor-tree-item .tag-delete-btn {
    grid-column: 1 / 2;
    justify-self: end;
  }
}

@media (max-width: 760px) {
  .tag-filter-toolbar {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }
  .tag-filter-select {
    min-width: 58px;
  }
  .tag-tree-row {
    grid-template-columns: 14px 14px minmax(0, 1fr);
  }
  .tag-tree-path {
    grid-column: 3 / 4;
  }
  .tag-assign-list,
  .tag-assign-list.compact {
    max-height: 38vh;
  }
}
</style>
