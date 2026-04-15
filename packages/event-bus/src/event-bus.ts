import { TopicMatcher } from './topic-matcher.js';
import type { NuwaEvent, EventHandler, Subscription, EventPriority } from './types.js';

/** Priority values for sorting: lower number = higher priority. */
export const PRIORITY_ORDER: Record<EventPriority, number> = {
  HIGH: 0,
  NORMAL: 1,
  LOW: 2,
};

let subCounter = 0;
let eventCounter = 0;

export interface EventBusOptions {
  historyLimit?: number;
  onError?: (error: Error, event: NuwaEvent) => void;
}

export class EventBus {
  private subscribers: Map<string, Subscription> = new Map();
  private eventHistory: NuwaEvent[] = [];
  private historyLimit: number;
  private onError?: (error: Error, event: NuwaEvent) => void;

  constructor(options?: EventBusOptions) {
    this.historyLimit = options?.historyLimit ?? 100;
    this.onError = options?.onError;
  }

  subscribe(topic: string, handler: EventHandler): string {
    const id = `sub_${++subCounter}`;
    const subscription: Subscription = { id, topic, handler };
    this.subscribers.set(id, subscription);
    return id;
  }

  unsubscribe(id: string): boolean {
    return this.subscribers.delete(id);
  }

  publish(event: NuwaEvent): void {
    const effectivePriority: EventPriority = event.priority ?? 'NORMAL';
    const eventWithPriority: NuwaEvent = {
      ...event,
      priority: effectivePriority,
    };

    // Store event in history (respect historyLimit)
    this.eventHistory.push(eventWithPriority);
    if (this.eventHistory.length > this.historyLimit) {
      this.eventHistory.splice(0, this.eventHistory.length - this.historyLimit);
    }

    // Collect matching subscriptions
    const matching: Subscription[] = [];
    for (const sub of this.subscribers.values()) {
      if (TopicMatcher.matches(sub.topic, event.topic)) {
        matching.push(sub);
      }
    }

    // Subscribers are delivered in registration order.
    // PRIORITY_ORDER can be used by callers to sort events before publishing.

    // Call each handler, catch errors and pass to onError callback
    for (const sub of matching) {
      try {
        sub.handler(eventWithPriority);
      } catch (err: unknown) {
        if (this.onError) {
          this.onError(
            err instanceof Error ? err : new Error(String(err)),
            eventWithPriority,
          );
        }
      }
    }
  }

  history(limit?: number): NuwaEvent[] {
    // Return recent events, newest first
    const events = [...this.eventHistory].reverse();
    if (limit !== undefined && limit >= 0) {
      return events.slice(0, limit);
    }
    return events;
  }

  clear(): void {
    this.subscribers.clear();
    this.eventHistory = [];
  }

  static generateEventId(): string {
    return `evt_${++eventCounter}`;
  }
}
