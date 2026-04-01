/**
 * Composable: AI Chat system
 * - Session CRUD
 * - Streaming generation
 * - Tag extraction from AI responses / chat history
 * - API config helpers (shared with useAIConfig)
 */

import { ref, computed, type Ref, type ComputedRef } from 'vue';
import {
  createWorldbookEntries,
  eventOn,
  generate,
  getChatMessages,
  getIframeEvents,
  getLastMessageId,
  getModelList,
  getWorldbook,
  stopGenerationById,
} from '../hostApi';
import { createId } from '../utils';
import { AI_CHAT_MESSAGE_LIMIT } from '../store/persistedState';
import type {
  PersistedState,
  AIApiConfig,
  AIChatMessage,
  AIChatSession,
  ExtractedTag,
} from '../types';

export interface UseAIChatOptions {
  persistedState: Ref<PersistedState>;
  updatePersistedState: (mutator: (state: PersistedState) => void) => void;
  setStatus: (msg: string) => void;
  selectedWorldbookName: Ref<string>;
}

export interface UseAIChatReturn {
  // ── Reactive state ──
  aiIsGenerating: Ref<boolean>;
  aiCurrentGenerationId: Ref<string | null>;
  aiStreamingText: Ref<string>;
  aiExtractedTags: Ref<ExtractedTag[]>;
  aiShowTagReview: Ref<boolean>;
  aiTargetWorldbook: Ref<string>;
  aiChatInputText: Ref<string>;
  aiUseContext: Ref<boolean>;
  aiChatMessagesRef: Ref<HTMLDivElement | null>;
  showApiSettings: Ref<boolean>;
  apiModelList: Ref<string[]>;
  apiModelLoading: Ref<boolean>;

  // ── Computed ──
  aiSessions: ComputedRef<AIChatSession[]>;
  aiActiveSession: ComputedRef<AIChatSession | null>;
  aiActiveMessages: ComputedRef<AIChatMessage[]>;

  // ── Session CRUD ──
  aiCreateSession: () => void;
  aiDeleteSession: (id: string) => void;
  aiSwitchSession: (id: string) => void;
  aiRenameSession: (id: string, title: string) => void;
  aiAddMessage: (role: 'user' | 'assistant', content: string) => void;

  // ── API config ──
  updateApiConfig: (partial: Partial<AIApiConfig>) => void;
  loadModelList: () => Promise<void>;
  buildCustomApiForGenerate: () => { custom_api?: CustomApiConfig };

  // ── Generation ──
  aiSendMessage: () => Promise<void>;
  aiStopGeneration: () => void;

  // ── Tag extraction ──
  aiExtractTags: (text: string, ignoreTags?: Set<string>) => ExtractedTag[];
  updateIgnoreTags: (raw: string) => void;
  resetIgnoreTags: () => void;
  markDuplicatesInTags: () => Promise<void>;
  extractFromChat: () => Promise<void>;
  aiCreateSelectedEntries: () => Promise<void>;
}

export function useAIChat(options: UseAIChatOptions): UseAIChatReturn {
  const { persistedState, updatePersistedState, setStatus, selectedWorldbookName } = options;

  // ── State ──────────────────────────────────────────────────────────
  const aiIsGenerating = ref(false);
  const aiCurrentGenerationId = ref<string | null>(null);
  const aiStreamingText = ref('');
  const aiExtractedTags = ref<ExtractedTag[]>([]);
  const aiShowTagReview = ref(false);
  const aiTargetWorldbook = ref('');
  const aiChatInputText = ref('');
  const aiUseContext = ref(true);
  const aiChatMessagesRef = ref<HTMLDivElement | null>(null);
  const showApiSettings = ref(false);
  const apiModelList = ref<string[]>([]);
  const apiModelLoading = ref(false);

  // ── Computed ───────────────────────────────────────────────────────
  const aiSessions = computed(() => persistedState.value.ai_chat.sessions);

  const aiActiveSession = computed((): AIChatSession | null => {
    const id = persistedState.value.ai_chat.activeSessionId;
    if (!id) return null;
    return aiSessions.value.find(s => s.id === id) ?? null;
  });

  const aiActiveMessages = computed((): AIChatMessage[] => aiActiveSession.value?.messages ?? []);

  // ── Session CRUD ──────────────────────────────────────────────────
  function aiCreateSession(): void {
    const id = createId('ai-chat');
    const session: AIChatSession = {
      id,
      title: `对话 ${aiSessions.value.length + 1}`,
      createdAt: Date.now(),
      messages: [],
    };
    updatePersistedState(state => {
      state.ai_chat.sessions.unshift(session);
      state.ai_chat.activeSessionId = id;
    });
    setStatus('已创建新对话');
  }

  function aiDeleteSession(id: string): void {
    updatePersistedState(state => {
      state.ai_chat.sessions = state.ai_chat.sessions.filter(s => s.id !== id);
      if (state.ai_chat.activeSessionId === id) {
        state.ai_chat.activeSessionId = state.ai_chat.sessions[0]?.id ?? null;
      }
    });
    setStatus('已删除对话');
  }

  function aiSwitchSession(id: string): void {
    updatePersistedState(state => {
      state.ai_chat.activeSessionId = id;
    });
  }

  function aiRenameSession(id: string, title: string): void {
    updatePersistedState(state => {
      const session = state.ai_chat.sessions.find(s => s.id === id);
      if (session) {
        session.title = title.trim() || session.title;
      }
    });
  }

  function aiAddMessage(role: 'user' | 'assistant', content: string): void {
    const sessionId = persistedState.value.ai_chat.activeSessionId;
    if (!sessionId) return;
    updatePersistedState(state => {
      const session = state.ai_chat.sessions.find(s => s.id === sessionId);
      if (session) {
        session.messages.push({ role, content, timestamp: Date.now() });
        if (session.messages.length > AI_CHAT_MESSAGE_LIMIT) {
          session.messages = session.messages.slice(-AI_CHAT_MESSAGE_LIMIT);
        }
      }
    });
  }

  // ── API config helpers ────────────────────────────────────────────
  function updateApiConfig(partial: Partial<AIApiConfig>): void {
    updatePersistedState(state => {
      Object.assign(state.ai_api_config, partial);
    });
  }

  async function loadModelList(): Promise<void> {
    const cfg = persistedState.value.ai_api_config;
    if (!cfg.apiurl) {
      toastr.warning('请先填写 API 基础 URL');
      return;
    }
    apiModelLoading.value = true;
    try {
      let models: string[];
      if (typeof getModelList === 'function') {
        models = await getModelList({ apiurl: cfg.apiurl, key: cfg.key || undefined });
      } else {
        let baseUrl = cfg.apiurl.replace(/\/+$/, '');
        if (!baseUrl.endsWith('/v1')) {
          baseUrl += '/v1';
        }
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (cfg.key) {
          headers['Authorization'] = `Bearer ${cfg.key}`;
        }
        const resp = await fetch(`${baseUrl}/models`, { method: 'GET', headers });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        }
        const json = await resp.json();
        models = (json.data || []).map((m: any) => m.id as string).filter(Boolean).sort();
      }
      apiModelList.value = models;
      if (models.length === 0) {
        toastr.info('未获取到模型列表');
      } else {
        toastr.success(`加载到 ${models.length} 个模型`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      toastr.error(`加载模型列表失败: ${msg}`);
      apiModelList.value = [];
    } finally {
      apiModelLoading.value = false;
    }
  }

  function buildCustomApiForGenerate(): { custom_api?: CustomApiConfig } {
    const cfg = persistedState.value.ai_api_config;
    if (cfg.mode === 'tavern' || cfg.use_main_api) {
      return {};
    }
    return {
      custom_api: {
        apiurl: cfg.apiurl,
        key: cfg.key || undefined,
        model: cfg.model,
        source: 'openai',
        max_tokens: cfg.max_tokens || undefined,
        temperature: cfg.temperature,
      },
    };
  }

  // ── Generation ────────────────────────────────────────────────────
  let aiStreamSubscription: { stop: () => void } | null = null;

  async function aiSendMessage(): Promise<void> {
    const text = aiChatInputText.value.trim();
    if (!text || aiIsGenerating.value) return;

    const sessionId = persistedState.value.ai_chat.activeSessionId;
    if (!sessionId) {
      aiCreateSession();
    }

    aiChatInputText.value = '';
    aiAddMessage('user', text);

    const session = persistedState.value.ai_chat.sessions.find(
      s => s.id === persistedState.value.ai_chat.activeSessionId,
    );
    if (!session) return;

    const historyPrompts: RolePrompt[] = session.messages.slice(0, -1).map(m => ({
      role: m.role,
      content: m.content,
    }));

    const generationId = createId('ai-gen');
    aiCurrentGenerationId.value = generationId;
    aiIsGenerating.value = true;
    aiStreamingText.value = '';

    const iframeEvents = getIframeEvents();
    aiStreamSubscription = eventOn(
      iframeEvents.STREAM_TOKEN_RECEIVED_FULLY,
      (fullText: string, genId: string) => {
        if (genId === generationId) {
          aiStreamingText.value = fullText;
        }
      },
    );

    try {
      const generateConfig: Parameters<typeof generate>[0] = {
        generation_id: generationId,
        user_input: text,
        should_stream: true,
        should_silence: true,
        ...buildCustomApiForGenerate(),
      };

      if (!aiUseContext.value) {
        generateConfig.overrides = {
          chat_history: { prompts: historyPrompts },
        };
      }

      const result = await generate(generateConfig);

      aiAddMessage('assistant', result);
      aiStreamingText.value = '';

      // Auto-extract tags
      const ignoreSet = new Set(persistedState.value.extract_ignore_tags.map(t => t.toLowerCase()));
      const tags = aiExtractTagsFn(result, ignoreSet);
      if (tags.length > 0) {
        aiExtractedTags.value = tags;
        aiShowTagReview.value = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`AI 生成失败: ${message}`);
      setStatus(`AI 生成失败: ${message}`);
    } finally {
      aiIsGenerating.value = false;
      aiCurrentGenerationId.value = null;
      aiStreamSubscription?.stop();
      aiStreamSubscription = null;
    }
  }

  function aiStopGeneration(): void {
    if (aiCurrentGenerationId.value) {
      stopGenerationById(aiCurrentGenerationId.value);
    }
  }

  // ── Tag extraction ────────────────────────────────────────────────
  function aiExtractTagsFn(text: string, ignoreTags?: Set<string>): ExtractedTag[] {
    const regex = /<([^/<>\s]+)>([\s\S]*?)<\/\1>/g;
    const results: ExtractedTag[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const tagName = match[1];
      const innerContent = match[2];
      if (ignoreTags && ignoreTags.has(tagName.toLowerCase())) {
        const nested = aiExtractTagsFn(innerContent, ignoreTags);
        results.push(...nested);
      } else {
        results.push({
          tag: tagName,
          content: innerContent.trim(),
          selected: true,
        });
      }
    }
    return results;
  }

  function updateIgnoreTags(raw: string): void {
    const tags = raw
      .split(/[,\n]+/)
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);
    const unique = [...new Set(tags)];
    updatePersistedState(state => {
      state.extract_ignore_tags = unique;
    });
  }

  function resetIgnoreTags(): void {
    updatePersistedState(state => {
      state.extract_ignore_tags = ['think', 'thinking', 'recap', 'content', 'details', 'summary'];
    });
  }

  async function markDuplicatesInTags(): Promise<void> {
    const targetName = aiTargetWorldbook.value;
    if (!targetName || aiExtractedTags.value.length === 0) {
      for (const tag of aiExtractedTags.value) {
        tag.duplicate = false;
        tag.updated = false;
      }
      return;
    }
    try {
      const existing = await getWorldbook(targetName);
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      const existingMap = new Map<string, string>();
      for (const e of existing) {
        existingMap.set(e.name.toLowerCase(), norm(e.content));
      }
      for (const tag of aiExtractedTags.value) {
        const key = tag.tag.toLowerCase();
        const existingNorm = existingMap.get(key);
        const tagNorm = norm(tag.content);
        if (existingNorm === undefined) {
          tag.duplicate = false;
          tag.updated = false;
        } else if (existingNorm === tagNorm) {
          tag.duplicate = true;
          tag.updated = false;
          tag.selected = false;
        } else {
          tag.duplicate = false;
          tag.updated = true;
        }
      }
    } catch {
      for (const tag of aiExtractedTags.value) {
        tag.duplicate = false;
        tag.updated = false;
      }
    }
  }

  async function extractFromChat(): Promise<void> {
    try {
      const lastId = getLastMessageId();
      if (lastId < 0) {
        toastr.warning('当前没有聊天记录');
        return;
      }
      const messages = getChatMessages(`0-${lastId}`);
      const ignoreSet = new Set(persistedState.value.extract_ignore_tags.map(t => t.toLowerCase()));
      const allTags: ExtractedTag[] = [];
      for (const msg of messages) {
        const tags = aiExtractTagsFn(msg.message || '', ignoreSet);
        allTags.push(...tags);
      }

      if (allTags.length === 0) {
        toastr.info('聊天记录中未找到 <tag>content</tag> 格式的条目');
        return;
      }

      const tagNameMap = new Map<string, ExtractedTag>();
      for (const t of allTags) {
        tagNameMap.set(t.tag.toLowerCase(), t);
      }
      const byName = [...tagNameMap.values()];

      const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
      const seenContent = new Set<string>();
      const deduped = byName.filter(t => {
        const contentKey = norm(t.content);
        if (seenContent.has(contentKey)) return false;
        seenContent.add(contentKey);
        return true;
      });

      aiExtractedTags.value = deduped;
      aiTargetWorldbook.value = selectedWorldbookName.value || '';
      aiShowTagReview.value = true;
      await markDuplicatesInTags();
      toastr.success(`从聊天记录中提取到 ${deduped.length} 个条目`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`提取失败: ${message}`);
    }
  }

  async function aiCreateSelectedEntries(): Promise<void> {
    const selected = aiExtractedTags.value.filter(t => t.selected);
    if (selected.length === 0) {
      toastr.warning('请至少勾选一个条目');
      return;
    }

    const targetName = aiTargetWorldbook.value;
    if (!targetName) {
      toastr.warning('请选择目标世界书');
      return;
    }

    try {
      const newEntries = selected.map(t => ({
        name: t.tag,
        content: t.content,
      }));

      await createWorldbookEntries(targetName, newEntries);
      toastr.success(`已创建 ${selected.length} 个条目到 "${targetName}"`);
      setStatus(`已创建 ${selected.length} 个条目到 "${targetName}"`);
      aiShowTagReview.value = false;
      aiExtractedTags.value = [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toastr.error(`创建条目失败: ${message}`);
    }
  }

  return {
    // State
    aiIsGenerating,
    aiCurrentGenerationId,
    aiStreamingText,
    aiExtractedTags,
    aiShowTagReview,
    aiTargetWorldbook,
    aiChatInputText,
    aiUseContext,
    aiChatMessagesRef,
    showApiSettings,
    apiModelList,
    apiModelLoading,

    // Computed
    aiSessions,
    aiActiveSession,
    aiActiveMessages,

    // Session CRUD
    aiCreateSession,
    aiDeleteSession,
    aiSwitchSession,
    aiRenameSession,
    aiAddMessage,

    // API config
    updateApiConfig,
    loadModelList,
    buildCustomApiForGenerate,

    // Generation
    aiSendMessage,
    aiStopGeneration,

    // Tag extraction
    aiExtractTags: aiExtractTagsFn,
    updateIgnoreTags,
    resetIgnoreTags,
    markDuplicatesInTags,
    extractFromChat,
    aiCreateSelectedEntries,
  };
}
