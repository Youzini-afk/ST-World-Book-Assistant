/**
 * Type declarations for SillyTavern host globals.
 *
 * These functions and objects are injected by the SillyTavern runtime
 * and are available as globals when running inside the host environment.
 */

// ═══════════════════════════════════════════════════════════════════════
// ── Core Types ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

/** A single worldbook (World Info) entry — matches normalizeEntry() output. */
interface WorldbookEntry {
  uid: number;
  name: string;
  enabled: boolean;
  content: string;
  probability: number;
  strategy: {
    type: 'constant' | 'selective' | 'vectorized';
    keys: (string | RegExp)[];
    keys_secondary: {
      logic: 'and_any' | 'and_all' | 'not_all' | 'not_any';
      keys: (string | RegExp)[];
    };
    scan_depth: 'same_as_global' | number;
  };
  position: {
    type: 'before_character_definition' | 'after_character_definition'
      | 'before_example_messages' | 'after_example_messages'
      | 'before_author_note' | 'after_author_note'
      | 'at_depth';
    role: 'system' | 'user' | 'assistant';
    depth: number;
    order: number;
  };
  recursion: {
    delay_until: number | null;
    prevent_incoming: boolean;
    prevent_outgoing: boolean;
  };
  effect: {
    sticky: number | null;
    cooldown: number | null;
    delay: number | null;
  };
  extra?: Record<string, unknown>;
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════════════
// ── Worldbook CRUD ─────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

declare function getWorldbook(name: string): Promise<WorldbookEntry[]>;
declare function getWorldbookNames(): string[];
declare function createWorldbookEntries(
  name: string,
  entries: Array<{ name: string; content: string }>,
): Promise<void>;
declare function updateWorldbookWith(
  name: string,
  updater: (entries: WorldbookEntry[]) => WorldbookEntry[],
): Promise<void>;
declare function createOrReplaceWorldbook(
  name: string,
  entries: WorldbookEntry[],
): Promise<void>;
declare function importRawWorldbook(data: unknown): Promise<string>;

// ═══════════════════════════════════════════════════════════════════════
// ── Worldbook Binding Queries ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

declare function getGlobalWorldbookNames(): string[];
declare function getCharWorldbookNames(target?: string): {
  primary: string | null;
  additional: string[];
};
declare function getChatWorldbookName(target?: string): string | null;
declare function rebindGlobalWorldbooks(names: string[]): Promise<void>;

// ═══════════════════════════════════════════════════════════════════════
// ── Character & Chat ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

declare function getCharacterNames(): string[];
declare function getCurrentCharacterName(): string | null;
declare function getChatMessages(
  mesId: number | string,
): Array<{ message: string; [key: string]: unknown }>;
declare function getLastMessageId(): number;

// ═══════════════════════════════════════════════════════════════════════
// ── AI Generation ──────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

interface RolePrompt {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CustomApiConfig {
  apiurl: string;
  key?: string;
  model: string;
  max_tokens?: number;
  temperature: number;
  source?: string;
}

interface GenerateOptions {
  generation_id?: string;
  user_input: string;
  should_stream?: boolean;
  should_silence?: boolean;
  custom_api?: CustomApiConfig;
  overrides?: {
    chat_history?: { prompts: RolePrompt[] };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface GenerateRawOptions {
  user_input: string;
  should_silence?: boolean;
  custom_api?: CustomApiConfig;
  ordered_prompts?: (RolePrompt | 'user_input')[];
  [key: string]: unknown;
}

declare function generate(options: GenerateOptions): Promise<string>;
declare function generateRaw(options: GenerateRawOptions): Promise<string>;
declare function stopGenerationById(generationId: string): void;
declare function getModelList(options: { apiurl: string; key?: string }): Promise<string[]>;

// ═══════════════════════════════════════════════════════════════════════
// ── Event System ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

interface EventSubscription {
  stop: () => void;
}

declare function eventOn(
  event: string,
  handler: (...args: any[]) => void,
): EventSubscription;

declare const iframe_events: {
  STREAM_TOKEN_RECEIVED_FULLY: string;
  [key: string]: string;
};

// ═══════════════════════════════════════════════════════════════════════
// ── SillyTavern Global Object ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════

declare const POPUP_TYPE: {
  TEXT: number;
  CONFIRM: number;
  INPUT: number;
  DISPLAY: number;
};

declare class Popup {
  constructor(
    content: HTMLElement | string,
    type: number,
    inputValue?: string,
    options?: {
      wide?: boolean;
      allowVerticalScrolling?: boolean;
      [key: string]: unknown;
    },
  );
  show(): Promise<unknown>;
  close(): void;
  completeCancelled(): Promise<void>;
}

interface STContext {
  extensionSettings: Record<string, any>;
  eventSource: {
    on(event: string, handler: (...args: any[]) => void): void;
    off(event: string, handler: (...args: any[]) => void): void;
    emit(event: string, ...args: any[]): void;
  };
  eventTypes: Record<string, string>;
  saveSettingsDebounced?: () => void;
  [key: string]: unknown;
}

declare const SillyTavern: {
  getContext(): STContext;
  Popup: typeof Popup;
  POPUP_TYPE: typeof POPUP_TYPE;
};
