import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentRuntime } from '../src/agent-runtime';
import { AgentContextImpl, EventBusInterface } from '../src/agent-context';
import {
  AgentState,
  AgentAction,
  AgentContext,
  IAgent,
  NuwaEvent,
  Percept,
} from '../src/types';

// --- Mock Event Bus implementing EventBusInterface ---
class MockEventBus implements EventBusInterface {
  private subs = new Map<string, { topic: string; handler: (event: NuwaEvent) => void }>();
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

// --- Mock Agent implementing IAgent ---
class MockAgent implements IAgent {
  readonly id: string;
  readonly name: string;
  state: AgentState = AgentState.IDLE;

  public initCalled = false;
  public startCalled = false;
  public stopCalled = false;
  public receivedEvents: NuwaEvent[] = [];
  public initContext?: AgentContext;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  async init(context: AgentContext): Promise<void> {
    this.initCalled = true;
    this.initContext = context;
  }

  async start(): Promise<void> {
    this.startCalled = true;
    this.state = AgentState.RUNNING;
  }

  async stop(): Promise<void> {
    this.stopCalled = true;
    this.state = AgentState.IDLE;
  }

  async onEvent(event: NuwaEvent): Promise<void> {
    this.receivedEvents.push(event);
  }

  async think(_percepts: Percept[]): Promise<AgentAction[]> {
    return [];
  }
}

describe('AgentRuntime', () => {
  let eventBus: MockEventBus;
  let runtime: AgentRuntime;

  beforeEach(() => {
    eventBus = new MockEventBus();
    runtime = new AgentRuntime(eventBus);
  });

  it('should register an agent and initialize it', async () => {
    const agent = new MockAgent('a1', 'Agent 1');
    await runtime.registerAgent(agent);

    expect(agent.initCalled).toBe(true);
    expect(agent.initContext).toBeDefined();
    expect(agent.initContext!.agentId).toBe('a1');
  });

  it('should throw when registering duplicate agent id', async () => {
    const agent1 = new MockAgent('dup', 'Dup1');
    const agent2 = new MockAgent('dup', 'Dup2');

    await runtime.registerAgent(agent1);
    await expect(runtime.registerAgent(agent2)).rejects.toThrow(
      'Agent dup already registered',
    );
  });

  it('should unregister an agent and stop it', async () => {
    const agent = new MockAgent('a1', 'Agent 1');
    await runtime.registerAgent(agent);

    const result = await runtime.unregisterAgent('a1');
    expect(result).toBe(true);
    expect(agent.stopCalled).toBe(true);
    expect(runtime.getAgent('a1')).toBeUndefined();
  });

  it('should return false when unregistering non-existent agent', async () => {
    const result = await runtime.unregisterAgent('nonexistent');
    expect(result).toBe(false);
  });

  it('should start all registered agents', async () => {
    const a1 = new MockAgent('a1', 'Agent 1');
    const a2 = new MockAgent('a2', 'Agent 2');
    await runtime.registerAgent(a1);
    await runtime.registerAgent(a2);

    await runtime.startAll();
    expect(a1.startCalled).toBe(true);
    expect(a2.startCalled).toBe(true);
    expect(a1.state).toBe(AgentState.RUNNING);
    expect(a2.state).toBe(AgentState.RUNNING);
  });

  it('should stop all registered agents', async () => {
    const a1 = new MockAgent('a1', 'Agent 1');
    const a2 = new MockAgent('a2', 'Agent 2');
    await runtime.registerAgent(a1);
    await runtime.registerAgent(a2);
    await runtime.startAll();

    await runtime.stopAll();
    expect(a1.stopCalled).toBe(true);
    expect(a2.stopCalled).toBe(true);
  });

  it('should get agent by id', async () => {
    const agent = new MockAgent('a1', 'Agent 1');
    await runtime.registerAgent(agent);

    expect(runtime.getAgent('a1')).toBe(agent);
    expect(runtime.getAgent('nonexistent')).toBeUndefined();
  });

  it('should get all agents', async () => {
    const a1 = new MockAgent('a1', 'Agent 1');
    const a2 = new MockAgent('a2', 'Agent 2');
    await runtime.registerAgent(a1);
    await runtime.registerAgent(a2);

    const agents = runtime.getAllAgents();
    expect(agents).toHaveLength(2);
    expect(agents).toContain(a1);
    expect(agents).toContain(a2);
  });

  it('should return empty array when no agents registered', () => {
    expect(runtime.getAllAgents()).toEqual([]);
  });

  it('should get context by agent id', async () => {
    const agent = new MockAgent('a1', 'Agent 1');
    await runtime.registerAgent(agent);

    const ctx = runtime.getContext('a1');
    expect(ctx).toBeInstanceOf(AgentContextImpl);
    expect(ctx!.agentId).toBe('a1');
  });

  it('should return undefined context for unknown agent', () => {
    expect(runtime.getContext('unknown')).toBeUndefined();
  });

  it('should remove context when agent is unregistered', async () => {
    const agent = new MockAgent('a1', 'Agent 1');
    await runtime.registerAgent(agent);
    expect(runtime.getContext('a1')).toBeDefined();

    await runtime.unregisterAgent('a1');
    expect(runtime.getContext('a1')).toBeUndefined();
  });

  it('should allow event flow: context publish reaches subscribing agent', async () => {
    const receiver = new MockAgent('receiver', 'Receiver');
    const sender = new MockAgent('sender', 'Sender');

    await runtime.registerAgent(receiver);
    await runtime.registerAgent(sender);

    // Manually subscribe receiver to a topic through the event bus
    const receiverCtx = runtime.getContext('receiver')!;
    const received: NuwaEvent[] = [];
    receiverCtx.subscribe('notifications', (evt) => received.push(evt));

    // Sender publishes through its context
    const senderCtx = runtime.getContext('sender')!;
    senderCtx.publish({
      topic: 'notifications',
      type: 'msg',
      data: { text: 'hello receiver' },
    });

    expect(received).toHaveLength(1);
    expect(received[0].data).toEqual({ text: 'hello receiver' });
    expect(received[0].source).toBe('sender');
  });
});
