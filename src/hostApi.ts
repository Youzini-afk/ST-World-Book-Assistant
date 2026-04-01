type WorldbookWriteOptions = {
  render?: string;
  [key: string]: unknown;
};

type ImportRawWorldbookResponse = { ok: boolean; status: number; [key: string]: unknown } | string;

type HostGlobals = typeof globalThis & {
  getWorldbook?: (name: string) => Promise<WorldbookEntry[]>;
  getWorldbookNames?: () => string[];
  createWorldbookEntries?: (
    name: string,
    entries: Array<{ name: string; content: string }>,
  ) => Promise<void>;
  updateWorldbookWith?: (
    name: string,
    updater: (entries: WorldbookEntry[]) => WorldbookEntry[],
  ) => Promise<void>;
  createOrReplaceWorldbook?: (
    name: string,
    entries: WorldbookEntry[],
    options?: WorldbookWriteOptions,
  ) => Promise<void>;
  replaceWorldbook?: (
    name: string,
    entries: WorldbookEntry[],
    options?: WorldbookWriteOptions,
  ) => Promise<void>;
  deleteWorldbook?: (name: string) => Promise<boolean>;
  importRawWorldbook?: (data: unknown, payload?: unknown) => Promise<ImportRawWorldbookResponse>;
  getGlobalWorldbookNames?: () => string[];
  getCharWorldbookNames?: (target?: string) => { primary: string | null; additional: string[] };
  getChatWorldbookName?: (target?: string) => string | null;
  rebindGlobalWorldbooks?: (names: string[]) => Promise<void>;
  getCharacterNames?: () => string[];
  getCurrentCharacterName?: () => string | null;
  getChatMessages?: (mesId: number | string) => Array<{ message: string; [key: string]: unknown }>;
  getLastMessageId?: () => number;
  generate?: (options: GenerateOptions) => Promise<string>;
  generateRaw?: (options: GenerateRawOptions) => Promise<string>;
  stopGenerationById?: (generationId: string) => void;
  getModelList?: (options: { apiurl: string; key?: string }) => Promise<string[]>;
  eventOn?: (event: string, handler: (...args: any[]) => void) => EventSubscription;
  iframe_events?: { STREAM_TOKEN_RECEIVED_FULLY: string; [key: string]: string };
};

function getHostGlobals(): HostGlobals {
  return globalThis as HostGlobals;
}

function requireHostFunction<T extends (...args: any[]) => any>(name: string, value: T | undefined): T {
  if (typeof value !== 'function') {
    throw new ReferenceError(`${name} is not defined`);
  }
  return value;
}

function requireHostObject<T>(name: string, value: T | undefined | null): T {
  if (!value) {
    throw new ReferenceError(`${name} is not defined`);
  }
  return value;
}

export function getWorldbook(name: string): Promise<WorldbookEntry[]> {
  return requireHostFunction('getWorldbook', getHostGlobals().getWorldbook)(name);
}

export function getWorldbookNames(): string[] {
  return requireHostFunction('getWorldbookNames', getHostGlobals().getWorldbookNames)();
}

export function createWorldbookEntries(
  name: string,
  entries: Array<{ name: string; content: string }>,
): Promise<void> {
  return requireHostFunction('createWorldbookEntries', getHostGlobals().createWorldbookEntries)(name, entries);
}

export function updateWorldbookWith(
  name: string,
  updater: (entries: WorldbookEntry[]) => WorldbookEntry[],
): Promise<void> {
  return requireHostFunction('updateWorldbookWith', getHostGlobals().updateWorldbookWith)(name, updater);
}

export function createOrReplaceWorldbook(
  name: string,
  entries: WorldbookEntry[],
  options?: WorldbookWriteOptions,
): Promise<void> {
  return requireHostFunction('createOrReplaceWorldbook', getHostGlobals().createOrReplaceWorldbook)(name, entries, options);
}

export function replaceWorldbook(
  name: string,
  entries: WorldbookEntry[],
  options?: WorldbookWriteOptions,
): Promise<void> {
  return requireHostFunction('replaceWorldbook', getHostGlobals().replaceWorldbook)(name, entries, options);
}

export function deleteWorldbook(name: string): Promise<boolean> {
  return requireHostFunction('deleteWorldbook', getHostGlobals().deleteWorldbook)(name);
}

export function importRawWorldbook(data: unknown, payload?: unknown): Promise<ImportRawWorldbookResponse> {
  return requireHostFunction('importRawWorldbook', getHostGlobals().importRawWorldbook)(data, payload);
}

export function getGlobalWorldbookNames(): string[] {
  return requireHostFunction('getGlobalWorldbookNames', getHostGlobals().getGlobalWorldbookNames)();
}

export function getCharWorldbookNames(target?: string): { primary: string | null; additional: string[] } {
  return requireHostFunction('getCharWorldbookNames', getHostGlobals().getCharWorldbookNames)(target);
}

export function getChatWorldbookName(target?: string): string | null {
  return requireHostFunction('getChatWorldbookName', getHostGlobals().getChatWorldbookName)(target);
}

export function rebindGlobalWorldbooks(names: string[]): Promise<void> {
  return requireHostFunction('rebindGlobalWorldbooks', getHostGlobals().rebindGlobalWorldbooks)(names);
}

export function getCharacterNames(): string[] {
  return requireHostFunction('getCharacterNames', getHostGlobals().getCharacterNames)();
}

export function getCurrentCharacterName(): string | null {
  return requireHostFunction('getCurrentCharacterName', getHostGlobals().getCurrentCharacterName)();
}

export function getChatMessages(mesId: number | string): Array<{ message: string; [key: string]: unknown }> {
  return requireHostFunction('getChatMessages', getHostGlobals().getChatMessages)(mesId);
}

export function getLastMessageId(): number {
  return requireHostFunction('getLastMessageId', getHostGlobals().getLastMessageId)();
}

export function generate(options: GenerateOptions): Promise<string> {
  return requireHostFunction('generate', getHostGlobals().generate)(options);
}

export function generateRaw(options: GenerateRawOptions): Promise<string> {
  return requireHostFunction('generateRaw', getHostGlobals().generateRaw)(options);
}

export function stopGenerationById(generationId: string): void {
  requireHostFunction('stopGenerationById', getHostGlobals().stopGenerationById)(generationId);
}

export function getModelList(options: { apiurl: string; key?: string }): Promise<string[]> {
  return requireHostFunction('getModelList', getHostGlobals().getModelList)(options);
}

export function eventOn(event: string, handler: (...args: any[]) => void): EventSubscription {
  return requireHostFunction('eventOn', getHostGlobals().eventOn)(event, handler);
}

export function getIframeEvents(): { STREAM_TOKEN_RECEIVED_FULLY: string; [key: string]: string } {
  return requireHostObject('iframe_events', getHostGlobals().iframe_events);
}
