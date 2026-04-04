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
  TavernHelper?: Partial<HostGlobals>;
};

type HostOwner = {
  id: string;
  target: Record<string, unknown>;
};

let preferredHostOwnerId: string | null = null;

function rememberPreferredHostOwner(owner: HostOwner, reason: string): void {
  if (preferredHostOwnerId === owner.id) {
    return;
  }
  preferredHostOwnerId = owner.id;
  console.info('[WorldbookAssistant] using host API owner:', owner.id, reason);
}

function pushHostOwner(
  owners: HostOwner[],
  seen: Set<unknown>,
  target: unknown,
  id: string,
): void {
  if (!target || (typeof target !== 'object' && typeof target !== 'function') || seen.has(target)) {
    return;
  }
  seen.add(target);
  owners.push({ id, target: target as Record<string, unknown> });
}

function collectHostOwners(): HostOwner[] {
  const owners: HostOwner[] = [];
  const seen = new Set<unknown>();

  const addWindowOwners = (host: HostGlobals | null | undefined, label: string): void => {
    if (!host) {
      return;
    }
    pushHostOwner(owners, seen, host, `${label}:window`);
    pushHostOwner(owners, seen, host.TavernHelper, `${label}:TavernHelper`);
  };

  try {
    addWindowOwners(globalThis as HostGlobals, 'globalThis');
  } catch {
    /* ignore */
  }
  try {
    if (typeof window !== 'undefined') {
      addWindowOwners(window as unknown as HostGlobals, 'window');
      if (window.parent && window.parent !== window) {
        addWindowOwners(window.parent as unknown as HostGlobals, 'window.parent');
      }
    }
  } catch {
    /* ignore */
  }

  return owners;
}

function prioritizeHostOwners(owners: HostOwner[]): HostOwner[] {
  if (!preferredHostOwnerId) {
    return owners;
  }
  const preferred = owners.find(owner => owner.id === preferredHostOwnerId);
  if (!preferred) {
    return owners;
  }
  return [preferred, ...owners.filter(owner => owner.id !== preferredHostOwnerId)];
}

function getHostFunctionOwners<T extends (...args: any[]) => any>(name: string): Array<{ owner: HostOwner; fn: T }> {
  return prioritizeHostOwners(collectHostOwners()).flatMap(owner => {
    const value = owner.target[name];
    return typeof value === 'function' ? [{ owner, fn: value as T }] : [];
  });
}

function callHostFunctionSync<T extends (...args: any[]) => any, TResult = ReturnType<T>>(
  name: string,
  args: Parameters<T>,
  acceptResult?: (value: TResult) => boolean,
): TResult {
  const candidates = getHostFunctionOwners<T>(name);
  if (!candidates.length) {
    throw new ReferenceError(`${name} is not defined`);
  }

  let firstResult: TResult | undefined;
  let hasFirstResult = false;
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const result = candidate.fn.apply(candidate.owner.target, args) as TResult;
      if (!hasFirstResult) {
        firstResult = result;
        hasFirstResult = true;
      }
      if (!acceptResult || acceptResult(result)) {
        rememberPreferredHostOwner(candidate.owner, `selected by ${name}`);
        return result;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (hasFirstResult) {
    return firstResult as TResult;
  }
  if (lastError !== undefined) {
    throw lastError;
  }
  throw new ReferenceError(`${name} is not defined`);
}

async function callHostFunctionAsync<T extends (...args: any[]) => Promise<any>, TResult = Awaited<ReturnType<T>>>(
  name: string,
  args: Parameters<T>,
): Promise<TResult> {
  const candidates = getHostFunctionOwners<T>(name);
  if (!candidates.length) {
    throw new ReferenceError(`${name} is not defined`);
  }

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      const result = await candidate.fn.apply(candidate.owner.target, args) as TResult;
      rememberPreferredHostOwner(candidate.owner, `selected by ${name}`);
      return result;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new ReferenceError(`${name} is not defined`);
}

function resolveHostObject<T>(name: string): T {
  const owners = prioritizeHostOwners(collectHostOwners());
  for (const owner of owners) {
    const value = owner.target[name];
    if (value !== undefined && value !== null) {
      rememberPreferredHostOwner(owner, `selected object ${name}`);
      return value as T;
    }
  }
  throw new ReferenceError(`${name} is not defined`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isNonEmptyArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

export function getWorldbook(name: string): Promise<WorldbookEntry[]> {
  return callHostFunctionAsync('getWorldbook', [name]);
}

export function getWorldbookNames(): string[] {
  return callHostFunctionSync('getWorldbookNames', [], isNonEmptyArray) as string[];
}

export function createWorldbookEntries(
  name: string,
  entries: Array<{ name: string; content: string }>,
): Promise<void> {
  return callHostFunctionAsync('createWorldbookEntries', [name, entries]);
}

export function updateWorldbookWith(
  name: string,
  updater: (entries: WorldbookEntry[]) => WorldbookEntry[],
): Promise<void> {
  return callHostFunctionAsync('updateWorldbookWith', [name, updater]);
}

export function createOrReplaceWorldbook(
  name: string,
  entries: WorldbookEntry[],
  options?: WorldbookWriteOptions,
): Promise<void> {
  return callHostFunctionAsync('createOrReplaceWorldbook', [name, entries, options]);
}

export function replaceWorldbook(
  name: string,
  entries: WorldbookEntry[],
  options?: WorldbookWriteOptions,
): Promise<void> {
  return callHostFunctionAsync('replaceWorldbook', [name, entries, options]);
}

export function deleteWorldbook(name: string): Promise<boolean> {
  return callHostFunctionAsync('deleteWorldbook', [name]);
}

export function importRawWorldbook(data: unknown, payload?: unknown): Promise<ImportRawWorldbookResponse> {
  return callHostFunctionAsync('importRawWorldbook', [data, payload]);
}

export function getGlobalWorldbookNames(): string[] {
  return callHostFunctionSync('getGlobalWorldbookNames', [], isNonEmptyArray) as string[];
}

export function getCharWorldbookNames(target?: string): { primary: string | null; additional: string[] } {
  return callHostFunctionSync('getCharWorldbookNames', [target], value => {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const result = value as { primary?: unknown; additional?: unknown };
    return isNonEmptyString(result.primary) || isNonEmptyArray(result.additional);
  }) as { primary: string | null; additional: string[] };
}

export function getChatWorldbookName(target?: string): string | null {
  return callHostFunctionSync('getChatWorldbookName', [target], isNonEmptyString) as string | null;
}

export function rebindGlobalWorldbooks(names: string[]): Promise<void> {
  return callHostFunctionAsync('rebindGlobalWorldbooks', [names]);
}

export function getCharacterNames(): string[] {
  return callHostFunctionSync('getCharacterNames', [], isNonEmptyArray) as string[];
}

export function getCurrentCharacterName(): string | null {
  return callHostFunctionSync('getCurrentCharacterName', [], isNonEmptyString) as string | null;
}

export function getChatMessages(mesId: number | string): Array<{ message: string; [key: string]: unknown }> {
  return callHostFunctionSync('getChatMessages', [mesId]) as Array<{ message: string; [key: string]: unknown }>;
}

export function getLastMessageId(): number {
  return callHostFunctionSync('getLastMessageId', []) as number;
}

export function generate(options: GenerateOptions): Promise<string> {
  return callHostFunctionAsync('generate', [options]);
}

export function generateRaw(options: GenerateRawOptions): Promise<string> {
  return callHostFunctionAsync('generateRaw', [options]);
}

export function stopGenerationById(generationId: string): void {
  callHostFunctionSync('stopGenerationById', [generationId]);
}

export function getModelList(options: { apiurl: string; key?: string }): Promise<string[]> {
  return callHostFunctionAsync('getModelList', [options]);
}

export function eventOn(event: string, handler: (...args: any[]) => void): EventSubscription {
  return callHostFunctionSync('eventOn', [event, handler]) as EventSubscription;
}

export function getIframeEvents(): { STREAM_TOKEN_RECEIVED_FULLY: string; [key: string]: string } {
  return resolveHostObject('iframe_events');
}
