import { NuwaEvent, EventHandler } from './types';

export interface EventBusStats {
  publishedEvents: number;
  deliveredEvents: number;
  handlerErrors: number;
  unmatchedEvents: number;
  activeSubscriptions: number;
  historySize: number;
}

export interface EventAuditRecord {
  timestamp: number;
  type: 'published' | 'handler_error' | 'unmatched';
  eventId: string;
  topic: string;
  source: string;
  subscriberId?: string;
  error?: string;
}

export class SimpleEventBus {
  private subs = new Map<string, { topic: string; handler: EventHandler }>();
  private counter = 0;
  private _history: NuwaEvent[] = [];
  private audit: EventAuditRecord[] = [];
  private publishedEvents = 0;
  private deliveredEvents = 0;
  private handlerErrors = 0;
  private unmatchedEvents = 0;

  subscribe(topic: string, handler: EventHandler): string {
    const id = `sub_${++this.counter}`;
    this.subs.set(id, { topic, handler });
    return id;
  }

  unsubscribe(id: string): boolean {
    return this.subs.delete(id);
  }

  publish(event: NuwaEvent): void {
    this.publishedEvents += 1;
    this._history.push(event);
    if (this._history.length > 1000) this._history.shift();
    this.audit.push({
      timestamp: Date.now(),
      type: 'published',
      eventId: event.id,
      topic: event.topic,
      source: event.source,
    });
    if (this.audit.length > 1000) this.audit.shift();

    let matched = false;
    for (const [, sub] of this.subs) {
      if (this.matchTopic(sub.topic, event.topic)) {
        matched = true;
        try {
          sub.handler(event);
          this.deliveredEvents += 1;
        } catch {
          this.handlerErrors += 1;
          this.audit.push({
            timestamp: Date.now(),
            type: 'handler_error',
            eventId: event.id,
            topic: event.topic,
            source: event.source,
            subscriberId: sub.topic,
            error: 'handler execution failed',
          });
          if (this.audit.length > 1000) this.audit.shift();
        }
      }
    }

    if (!matched) {
      this.unmatchedEvents += 1;
      this.audit.push({
        timestamp: Date.now(),
        type: 'unmatched',
        eventId: event.id,
        topic: event.topic,
        source: event.source,
      });
      if (this.audit.length > 1000) this.audit.shift();
    }
  }

  history(limit?: number): NuwaEvent[] {
    const h = [...this._history].reverse();
    return limit ? h.slice(0, limit) : h;
  }

  // Support * and ** wildcards
  private matchTopic(pattern: string, topic: string): boolean {
    if (pattern === '**') return true;
    const pParts = pattern.split('.');
    const tParts = topic.split('.');
    return this.matchParts(pParts, 0, tParts, 0);
  }

  private matchParts(p: string[], pi: number, t: string[], ti: number): boolean {
    if (pi === p.length && ti === t.length) return true;
    if (pi === p.length) return false;
    if (p[pi] === '**') {
      // ** matches one or more segments
      for (let i = ti + 1; i <= t.length; i++) {
        if (this.matchParts(p, pi + 1, t, i)) return true;
      }
      return pi + 1 === p.length && ti < t.length;
    }
    if (ti === t.length) return false;
    if (p[pi] === '*' || p[pi] === t[ti]) {
      return this.matchParts(p, pi + 1, t, ti + 1);
    }
    return false;
  }

  generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  stats(): EventBusStats {
    return {
      publishedEvents: this.publishedEvents,
      deliveredEvents: this.deliveredEvents,
      handlerErrors: this.handlerErrors,
      unmatchedEvents: this.unmatchedEvents,
      activeSubscriptions: this.subs.size,
      historySize: this._history.length,
    };
  }

  auditTrail(limit?: number): EventAuditRecord[] {
    const trail = [...this.audit].reverse();
    return limit ? trail.slice(0, limit) : trail;
  }
}
