import type { EventSubscription } from './types';

type EventName = string | symbol;
type EventHandler = (...args: any[]) => void;

type EventSourceLike = {
  on?: (eventName: EventName, handler: EventHandler) => unknown;
  addEventListener?: (eventName: EventName, handler: EventHandler) => unknown;
  off?: (eventName: EventName, handler: EventHandler) => unknown;
  removeListener?: (eventName: EventName, handler: EventHandler) => unknown;
  removeEventListener?: (eventName: EventName, handler: EventHandler) => unknown;
};

function detachEventSourceListener(
  eventSource: EventSourceLike,
  eventName: EventName,
  handler: EventHandler,
): void {
  if (typeof eventSource.off === 'function') {
    eventSource.off(eventName, handler);
    return;
  }
  if (typeof eventSource.removeListener === 'function') {
    eventSource.removeListener(eventName, handler);
    return;
  }
  if (typeof eventSource.removeEventListener === 'function') {
    eventSource.removeEventListener(eventName, handler);
  }
}

export function subscribeEventSource(
  eventSource: unknown,
  eventName: EventName,
  handler: EventHandler,
): EventSubscription | null {
  const source = eventSource as EventSourceLike | null | undefined;
  if (!source) {
    return null;
  }

  if (typeof source.on === 'function') {
    source.on(eventName, handler);
  } else if (typeof source.addEventListener === 'function') {
    source.addEventListener(eventName, handler);
  } else {
    return null;
  }

  return {
    stop: () => detachEventSourceListener(source, eventName, handler),
  };
}
