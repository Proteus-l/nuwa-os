import { describe, it, expect, vi } from 'vitest';
import { EventBus, PRIORITY_ORDER } from '../src/event-bus.js';
import type { NuwaEvent } from '../src/types.js';

let idCounter = 0;

function makeEvent(overrides: Partial<NuwaEvent> = {}): NuwaEvent {
  return {
    id: `evt_${++idCounter}`,
    type: 'test',
    topic: 'test.topic',
    timestamp: Date.now(),
    source: 'test-source',
    data: null,
    ...overrides,
  };
}

describe('EventBus', () => {
  // 1. Subscribe and receive events
  it('subscribe and receive events on matching topic', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.topic', handler);
    bus.publish(makeEvent({ topic: 'test.topic' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].topic).toBe('test.topic');
  });

  // 2. Unsubscribe stops delivery
  it('unsubscribe stops delivery', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    const subId = bus.subscribe('test.topic', handler);
    bus.publish(makeEvent({ topic: 'test.topic' }));
    expect(handler).toHaveBeenCalledTimes(1);

    const result = bus.unsubscribe(subId);
    expect(result).toBe(true);

    bus.publish(makeEvent({ topic: 'test.topic' }));
    expect(handler).toHaveBeenCalledTimes(1); // no additional call
  });

  // 3. Unsubscribe returns false for unknown id
  it('unsubscribe returns false for unknown id', () => {
    const bus = new EventBus();
    expect(bus.unsubscribe('nonexistent')).toBe(false);
  });

  // 4. Wildcard subscriptions with *
  it('single wildcard * subscriptions work', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.*', handler);
    bus.publish(makeEvent({ topic: 'test.topic' }));
    bus.publish(makeEvent({ topic: 'test.other' }));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  // 5. Double-star wildcard subscriptions
  it('double-star ** wildcard subscriptions work', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.**', handler);
    bus.publish(makeEvent({ topic: 'test.topic' }));
    bus.publish(makeEvent({ topic: 'test.topic.sub' }));

    expect(handler).toHaveBeenCalledTimes(2);
  });

  // 6. Priority ordering: events with HIGH/NORMAL/LOW recorded correctly
  it('priority ordering: HIGH events have priority 0, NORMAL 1, LOW 2', () => {
    expect(PRIORITY_ORDER.HIGH).toBe(0);
    expect(PRIORITY_ORDER.NORMAL).toBe(1);
    expect(PRIORITY_ORDER.LOW).toBe(2);
  });

  // 7. Default priority is NORMAL
  it('default priority is NORMAL when not specified', () => {
    const bus = new EventBus();
    let receivedPriority: string | undefined;

    bus.subscribe('test.topic', (event) => {
      receivedPriority = event.priority;
    });

    bus.publish(makeEvent({ topic: 'test.topic' }));
    expect(receivedPriority).toBe('NORMAL');
  });

  // 8. Priority is preserved when explicitly set
  it('explicit priority is preserved in delivered event', () => {
    const bus = new EventBus();
    const receivedPriorities: string[] = [];

    bus.subscribe('events.**', (event) => {
      receivedPriorities.push(event.priority!);
    });

    bus.publish(makeEvent({ topic: 'events.a', priority: 'HIGH' }));
    bus.publish(makeEvent({ topic: 'events.b', priority: 'NORMAL' }));
    bus.publish(makeEvent({ topic: 'events.c', priority: 'LOW' }));

    expect(receivedPriorities).toEqual(['HIGH', 'NORMAL', 'LOW']);
  });

  // 9. Event history recording
  it('event history records published events', () => {
    const bus = new EventBus();
    bus.publish(makeEvent({ topic: 'a.b' }));
    bus.publish(makeEvent({ topic: 'c.d' }));

    const hist = bus.history();
    expect(hist).toHaveLength(2);
    // newest first
    expect(hist[0].topic).toBe('c.d');
    expect(hist[1].topic).toBe('a.b');
  });

  // 10. Event history with limit
  it('history respects limit parameter', () => {
    const bus = new EventBus();
    bus.publish(makeEvent({ topic: 'a.1' }));
    bus.publish(makeEvent({ topic: 'a.2' }));
    bus.publish(makeEvent({ topic: 'a.3' }));

    const hist = bus.history(2);
    expect(hist).toHaveLength(2);
    expect(hist[0].topic).toBe('a.3');
    expect(hist[1].topic).toBe('a.2');
  });

  // 11. History respects historyLimit option
  it('history respects historyLimit constructor option', () => {
    const bus = new EventBus({ historyLimit: 3 });

    for (let i = 0; i < 5; i++) {
      bus.publish(makeEvent({ topic: `t.${i}` }));
    }

    const hist = bus.history();
    expect(hist).toHaveLength(3);
    // Only the last 3 events are kept (indices 2, 3, 4), newest first
    expect(hist[0].topic).toBe('t.4');
    expect(hist[1].topic).toBe('t.3');
    expect(hist[2].topic).toBe('t.2');
  });

  // 12. Error handling: subscriber errors do not break other subscribers
  it('error in one subscriber does not break other subscribers', () => {
    const errorHandler = vi.fn();
    const bus = new EventBus({ onError: errorHandler });
    const goodHandler = vi.fn();

    bus.subscribe('test.topic', () => {
      throw new Error('handler error');
    });
    bus.subscribe('test.topic', goodHandler);

    bus.publish(makeEvent({ topic: 'test.topic' }));

    expect(goodHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(errorHandler.mock.calls[0][0].message).toBe('handler error');
  });

  // 13. Error handling with non-Error thrown values
  it('non-Error thrown values are wrapped in Error', () => {
    const errorHandler = vi.fn();
    const bus = new EventBus({ onError: errorHandler });

    bus.subscribe('test.topic', () => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });

    bus.publish(makeEvent({ topic: 'test.topic' }));

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(errorHandler.mock.calls[0][0].message).toBe('string error');
  });

  // 14. Error without onError callback does not throw
  it('error without onError callback does not throw', () => {
    const bus = new EventBus();
    const goodHandler = vi.fn();

    bus.subscribe('test.topic', () => {
      throw new Error('ignored error');
    });
    bus.subscribe('test.topic', goodHandler);

    expect(() => {
      bus.publish(makeEvent({ topic: 'test.topic' }));
    }).not.toThrow();

    expect(goodHandler).toHaveBeenCalledTimes(1);
  });

  // 15. Multiple subscribers on same topic
  it('multiple subscribers on same topic all receive events', () => {
    const bus = new EventBus();
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.subscribe('test.topic', handler1);
    bus.subscribe('test.topic', handler2);
    bus.subscribe('test.topic', handler3);

    bus.publish(makeEvent({ topic: 'test.topic' }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
  });

  // 16. clear() removes all subscriptions and history
  it('clear() removes all subscriptions and history', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('test.topic', handler);
    bus.publish(makeEvent({ topic: 'test.topic' }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(bus.history()).toHaveLength(1);

    bus.clear();

    expect(bus.history()).toHaveLength(0);

    bus.publish(makeEvent({ topic: 'test.topic' }));
    // handler should not be called after clear
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // 17. No error when publishing with no subscribers
  it('no error when publishing with no subscribers', () => {
    const bus = new EventBus();
    expect(() => {
      bus.publish(makeEvent({ topic: 'no.subscribers' }));
    }).not.toThrow();
  });

  // 18. Non-matching topic does not trigger handler
  it('non-matching topic does not trigger handler', () => {
    const bus = new EventBus();
    const handler = vi.fn();

    bus.subscribe('sensor.camera', handler);
    bus.publish(makeEvent({ topic: 'motor.servo' }));

    expect(handler).toHaveBeenCalledTimes(0);
  });

  // 19. subscribe returns a unique subscription ID
  it('subscribe returns unique subscription IDs', () => {
    const bus = new EventBus();
    const id1 = bus.subscribe('a', () => {});
    const id2 = bus.subscribe('b', () => {});
    const id3 = bus.subscribe('c', () => {});

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).toMatch(/^sub_\d+$/);
  });

  // 20. generateEventId returns unique IDs
  it('generateEventId returns unique IDs', () => {
    const id1 = EventBus.generateEventId();
    const id2 = EventBus.generateEventId();
    const id3 = EventBus.generateEventId();

    expect(id1).not.toBe(id2);
    expect(id2).not.toBe(id3);
    expect(id1).toMatch(/^evt_\d+$/);
  });

  // 21. Event data is passed through correctly
  it('event data is passed through to handler', () => {
    const bus = new EventBus();
    let receivedData: unknown;

    bus.subscribe('test.topic', (event) => {
      receivedData = event.data;
    });

    const payload = { value: 42, nested: { key: 'hello' } };
    bus.publish(makeEvent({ topic: 'test.topic', data: payload }));

    expect(receivedData).toEqual(payload);
  });

  // 22. Event metadata is passed through
  it('event metadata is passed through to handler', () => {
    const bus = new EventBus();
    let receivedMeta: Record<string, unknown> | undefined;

    bus.subscribe('test.topic', (event) => {
      receivedMeta = event.metadata;
    });

    bus.publish(makeEvent({ topic: 'test.topic', metadata: { traceId: 'abc' } }));

    expect(receivedMeta).toEqual({ traceId: 'abc' });
  });

  // 23. History default limit of 100
  it('history defaults to 100 events', () => {
    const bus = new EventBus();

    for (let i = 0; i < 120; i++) {
      bus.publish(makeEvent({ topic: `t.${i}` }));
    }

    const hist = bus.history();
    expect(hist).toHaveLength(100);
    // Newest first: last published is t.119
    expect(hist[0].topic).toBe('t.119');
    expect(hist[99].topic).toBe('t.20');
  });

  // 24. History with limit 0 returns empty
  it('history with limit 0 returns empty array', () => {
    const bus = new EventBus();
    bus.publish(makeEvent({ topic: 'a.b' }));

    expect(bus.history(0)).toHaveLength(0);
  });
});
