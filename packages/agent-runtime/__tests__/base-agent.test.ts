import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseAgent } from '../src/base-agent';
import {
  AgentState,
  AgentAction,
  AgentContext,
  NuwaEvent,
  Percept,
} from '../src/types';
import { EventBusInterface } from '../src/agent-context';

// --- Mock Event Bus ---
class MockEventBus implements EventBusInterface {
  private subs: Map<string, { topic: string; handler: (event: NuwaEvent) => void }> = new Map();
  private counter = 0;

  subscribe(topic: string, handler: (event: NuwaEvent) => void): () => void {
    const id = `sub_${++this.counter}`;
    this.subs.set(id, { topic, handler });
    return () => {
      this.subs.delete(id);
    };
  }

  publish(event: NuwaEvent): void {
    for (const [, sub] of this.subs) {
      if (sub.topic === event.topic || sub.topic === '**') {
        sub.handler(event);
      }
    }
  }
}

// --- Concrete mock agent for testing ---
class MockAgent extends BaseAgent {
  public thinkCalls: Percept[][] = [];
  public thinkResult: AgentAction[] = [];

  constructor(
    config: {
      id: string;
      name: string;
      options?: {
        perceptBufferSize?: number;
        thinkInterval?: number;
        subscriptions?: string[];
      };
    } = { id: 'test-agent', name: 'Test Agent' },
  ) {
    super(config);
  }

  async think(percepts: Percept[]): Promise<AgentAction[]> {
    this.thinkCalls.push(percepts);
    return this.thinkResult;
  }
}

function makeEvent(overrides: Partial<NuwaEvent> = {}): NuwaEvent {
  return {
    id: 'evt_1',
    type: 'test',
    topic: 'test.topic',
    timestamp: Date.now(),
    source: 'test-source',
    data: { hello: 'world' },
    ...overrides,
  };
}

function makeContext(eventBus: MockEventBus, agentId: string): AgentContext {
  const published: Partial<NuwaEvent>[] = [];

  return {
    agentId,
    subscribe(topic: string, handler: (event: NuwaEvent) => void): () => void {
      return eventBus.subscribe(topic, handler);
    },
    publish(event: Partial<NuwaEvent>): void {
      published.push(event);
    },
    log(_level: 'info' | 'warn' | 'error', _message: string): void {},
    getTime(): number {
      return Date.now();
    },
  };
}

describe('BaseAgent', () => {
  let agent: MockAgent;
  let eventBus: MockEventBus;
  let context: AgentContext;

  beforeEach(() => {
    vi.useFakeTimers();
    agent = new MockAgent({
      id: 'agent-1',
      name: 'Agent One',
      options: {
        perceptBufferSize: 3,
        thinkInterval: 100,
        subscriptions: ['world.events'],
      },
    });
    eventBus = new MockEventBus();
    context = makeContext(eventBus, 'agent-1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should have IDLE state after construction', () => {
    expect(agent.state).toBe(AgentState.IDLE);
    expect(agent.id).toBe('agent-1');
    expect(agent.name).toBe('Agent One');
  });

  it('should use default config values when not provided', () => {
    const defaultAgent = new MockAgent({ id: 'a', name: 'A' });
    expect(defaultAgent['perceptBufferSize']).toBe(10);
    expect(defaultAgent['thinkInterval']).toBe(1000);
    expect(defaultAgent['subscriptions']).toEqual([]);
  });

  it('should initialize with context and subscribe to topics', async () => {
    const subscribeSpy = vi.spyOn(context, 'subscribe');
    await agent.init(context);
    expect(subscribeSpy).toHaveBeenCalledWith('world.events', expect.any(Function));
    expect(agent['context']).toBe(context);
  });

  it('should transition to RUNNING on start', async () => {
    await agent.init(context);
    await agent.start();
    expect(agent.state).toBe(AgentState.RUNNING);
    await agent.stop();
  });

  it('should add percepts on onEvent', async () => {
    await agent.init(context);
    await agent.start();

    const event = makeEvent();
    agent['perceptBufferSize'] = 100;
    await agent.onEvent(event);

    expect(agent['percepts']).toHaveLength(1);
    expect(agent['percepts'][0]).toEqual({
      source: event.source,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
    });
    await agent.stop();
  });

  it('should trigger think when percept buffer reaches capacity', async () => {
    await agent.init(context);
    await agent.start();
    agent.thinkResult = [];

    // perceptBufferSize is 3, push 3 events
    for (let i = 0; i < 3; i++) {
      await agent.onEvent(makeEvent({ id: `evt_${i}` }));
    }

    // think should have been called once with 3 percepts
    expect(agent.thinkCalls).toHaveLength(1);
    expect(agent.thinkCalls[0]).toHaveLength(3);
    // percepts should be drained
    expect(agent['percepts']).toHaveLength(0);
    await agent.stop();
  });

  it('should skip _triggerThink when percepts are empty', async () => {
    await agent.init(context);
    await agent.start();

    await agent._triggerThink();
    expect(agent.thinkCalls).toHaveLength(0);
    expect(agent.state).toBe(AgentState.RUNNING);
    await agent.stop();
  });

  it('should trigger think via timer', async () => {
    await agent.init(context);
    await agent.start();

    await agent.onEvent(makeEvent());
    // thinkInterval is 100
    vi.advanceTimersByTime(100);
    // Allow microtask queue
    await vi.advanceTimersByTimeAsync(0);

    expect(agent.thinkCalls).toHaveLength(1);
    await agent.stop();
  });

  it('should execute emit action by publishing to context', async () => {
    const publishSpy = vi.spyOn(context, 'publish');
    await agent.init(context);
    await agent.start();

    agent.thinkResult = [{ type: 'emit', payload: { msg: 'hello' } }];
    // Force immediate think by filling buffer
    for (let i = 0; i < 3; i++) {
      await agent.onEvent(makeEvent({ id: `evt_${i}` }));
    }

    expect(publishSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'agent',
        data: { msg: 'hello' },
        topic: 'agent.agent-1.action',
      }),
    );
    await agent.stop();
  });

  it('should execute log action', async () => {
    const logSpy = vi.spyOn(context, 'log');
    await agent.init(context);
    await agent.start();

    agent.thinkResult = [{ type: 'log', payload: 'test log message' }];
    for (let i = 0; i < 3; i++) {
      await agent.onEvent(makeEvent({ id: `evt_${i}` }));
    }

    expect(logSpy).toHaveBeenCalledWith('info', 'test log message');
    await agent.stop();
  });

  it('should transition to ERROR state when think throws', async () => {
    const errorAgent = new MockAgent({
      id: 'err-agent',
      name: 'Error Agent',
      options: {
        perceptBufferSize: 1,
        thinkInterval: 99999,
      },
    });
    const errContext = makeContext(eventBus, 'err-agent');
    const logSpy = vi.spyOn(errContext, 'log');

    await errorAgent.init(errContext);
    await errorAgent.start();

    // Override think to throw
    errorAgent.think = async () => {
      throw new Error('brain failure');
    };

    await errorAgent.onEvent(makeEvent());
    expect(errorAgent.state).toBe(AgentState.ERROR);
    expect(logSpy).toHaveBeenCalledWith(
      'error',
      expect.stringContaining('Think error'),
    );
    await errorAgent.stop();
  });

  it('should stop, clear timer, unsubscribe, clear percepts, and return to IDLE', async () => {
    await agent.init(context);
    await agent.start();
    expect(agent.state).toBe(AgentState.RUNNING);

    await agent.stop();
    expect(agent.state).toBe(AgentState.IDLE);
    expect(agent['_unsubscribers']).toHaveLength(0);
    expect(agent['_thinkTimer']).toBeNull();
    expect(agent['percepts']).toHaveLength(0);
  });

  it('should convert event to percept correctly via eventToPercept', () => {
    const event = makeEvent({
      source: 'src',
      type: 'msg',
      data: 42,
      timestamp: 1234,
    });
    const percept = agent['eventToPercept'](event);
    expect(percept).toEqual({
      source: 'src',
      type: 'msg',
      data: 42,
      timestamp: 1234,
    });
  });
});
