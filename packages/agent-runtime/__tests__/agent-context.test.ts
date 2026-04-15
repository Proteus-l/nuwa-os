import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentContextImpl, EventBusInterface } from '../src/agent-context';
import { NuwaEvent } from '../src/types';

class MockEventBus implements EventBusInterface {
  private subs: Map<string, { topic: string; handler: (event: NuwaEvent) => void }> = new Map();
  private counter = 0;
  public publishedEvents: NuwaEvent[] = [];

  subscribe(topic: string, handler: (event: NuwaEvent) => void): () => void {
    const id = `sub_${++this.counter}`;
    this.subs.set(id, { topic, handler });
    return () => {
      this.subs.delete(id);
    };
  }

  publish(event: NuwaEvent): void {
    this.publishedEvents.push(event);
    for (const [, sub] of this.subs) {
      if (sub.topic === event.topic || sub.topic === '**') {
        sub.handler(event);
      }
    }
  }

  getSubCount(): number {
    return this.subs.size;
  }
}

describe('AgentContextImpl', () => {
  let eventBus: MockEventBus;
  let ctx: AgentContextImpl;

  beforeEach(() => {
    eventBus = new MockEventBus();
    ctx = new AgentContextImpl({ agentId: 'agent-42', eventBus });
  });

  it('should have the correct agentId', () => {
    expect(ctx.agentId).toBe('agent-42');
  });

  it('should subscribe and return an unsubscribe function', () => {
    const handler = vi.fn();
    const unsub = ctx.subscribe('test.topic', handler);
    expect(typeof unsub).toBe('function');
    expect(eventBus.getSubCount()).toBe(1);

    unsub();
    expect(eventBus.getSubCount()).toBe(0);
  });

  it('should receive events through subscription', () => {
    const handler = vi.fn();
    ctx.subscribe('my.topic', handler);

    const event: NuwaEvent = {
      id: 'e1',
      type: 'test',
      topic: 'my.topic',
      timestamp: 1000,
      source: 'src',
      data: 'hello',
    };
    eventBus.publish(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should not receive events after unsubscribe', () => {
    const handler = vi.fn();
    const unsub = ctx.subscribe('my.topic', handler);
    unsub();

    eventBus.publish({
      id: 'e1',
      type: 'test',
      topic: 'my.topic',
      timestamp: 1000,
      source: 'src',
      data: null,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should publish with auto-filled fields when partial event given', () => {
    ctx.publish({ data: { key: 'value' } });

    expect(eventBus.publishedEvents).toHaveLength(1);
    const published = eventBus.publishedEvents[0];

    expect(published.id).toMatch(/^evt_/);
    expect(published.type).toBe('agent');
    expect(published.topic).toBe('agent.agent-42.event');
    expect(published.source).toBe('agent-42');
    expect(published.data).toEqual({ key: 'value' });
    expect(typeof published.timestamp).toBe('number');
  });

  it('should preserve explicitly provided fields on publish', () => {
    ctx.publish({
      type: 'custom-type',
      topic: 'custom.topic',
      timestamp: 9999,
      source: 'custom-source',
      data: 42,
      priority: 'HIGH',
      metadata: { tag: 'urgent' },
    });

    const published = eventBus.publishedEvents[0];
    expect(published.type).toBe('custom-type');
    expect(published.topic).toBe('custom.topic');
    expect(published.timestamp).toBe(9999);
    expect(published.source).toBe('custom-source');
    expect(published.data).toBe(42);
    expect(published.priority).toBe('HIGH');
    expect(published.metadata).toEqual({ tag: 'urgent' });
  });

  it('should log with correct prefix format', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    ctx.log('info', 'hello world');
    expect(consoleSpy).toHaveBeenCalledWith('[Agent:agent-42] [info] hello world');
    consoleSpy.mockRestore();
  });

  it('should return a number from getTime', () => {
    const time = ctx.getTime();
    expect(typeof time).toBe('number');
    expect(time).toBeGreaterThan(0);
  });

  it('should generate unique event ids for multiple publishes', () => {
    ctx.publish({ data: 'a' });
    ctx.publish({ data: 'b' });

    const ids = eventBus.publishedEvents.map((e) => e.id);
    expect(ids[0]).not.toBe(ids[1]);
  });
});
