import { NuwaEvent, EventHandler } from './types';

export class SimpleEventBus {
  private subs = new Map<string, { topic: string; handler: EventHandler }>();
  private counter = 0;
  private _history: NuwaEvent[] = [];

  subscribe(topic: string, handler: EventHandler): string {
    const id = `sub_${++this.counter}`;
    this.subs.set(id, { topic, handler });
    return id;
  }

  unsubscribe(id: string): boolean {
    return this.subs.delete(id);
  }

  publish(event: NuwaEvent): void {
    this._history.push(event);
    if (this._history.length > 1000) this._history.shift();
    for (const [, sub] of this.subs) {
      if (this.matchTopic(sub.topic, event.topic)) {
        try {
          sub.handler(event);
        } catch {
          // swallow handler errors
        }
      }
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
}
