import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentProcess } from '../src/agent-process';
import { BaseAgent } from '../src/base-agent';
import {
  AgentState,
  AgentAction,
  AgentContext,
  NuwaEvent,
  Percept,
  ProcessState,
} from '../src/types';

// --- Concrete mock agent ---
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

function makeContext(agentId: string): AgentContext {
  return {
    agentId,
    subscribe(_topic: string, _handler: (event: NuwaEvent) => void): () => void {
      return () => {};
    },
    publish(_event: Partial<NuwaEvent>): void {},
    log(_level: 'info' | 'warn' | 'error', _message: string): void {},
    getTime(): number {
      return Date.now();
    },
  };
}

function makeEvent(overrides: Partial<NuwaEvent> = {}): NuwaEvent {
  return {
    id: 'evt_1',
    type: 'test',
    topic: 'test.topic',
    timestamp: Date.now(),
    source: 'test-source',
    data: { msg: 'data' },
    ...overrides,
  };
}

describe('AgentProcess', () => {
  let agent: MockAgent;
  let process: AgentProcess;

  beforeEach(() => {
    agent = new MockAgent({
      id: 'agent-1',
      name: 'Agent One',
      options: {
        perceptBufferSize: 5,
        thinkInterval: 99999,
      },
    });
    process = new AgentProcess(agent, 15);
  });

  it('should construct with correct id and name from agent', () => {
    expect(process.id).toBe('proc_agent-1');
    expect(process.name).toBe('AgentProcess[Agent One]');
  });

  it('should have default priority of 5 when not specified', () => {
    const defaultProcess = new AgentProcess(agent);
    expect(defaultProcess.priority).toBe(5);
  });

  it('should use provided priority', () => {
    expect(process.priority).toBe(15);
  });

  it('should start in CREATED state', () => {
    expect(process.state).toBe(ProcessState.CREATED);
  });

  it('should transition to RUNNING on onStart', async () => {
    const context = makeContext('agent-1');
    await agent.init(context);
    await process.onStart();
    expect(process.state).toBe(ProcessState.RUNNING);
  });

  it('should transition to TERMINATED on onStop and stop the agent', async () => {
    const context = makeContext('agent-1');
    await agent.init(context);
    await agent.start();

    await process.onStart();
    await process.onStop();

    expect(process.state).toBe(ProcessState.TERMINATED);
    expect(agent.state).toBe(AgentState.IDLE);
  });

  it('should call _triggerThink on agent during onTick', async () => {
    const context = makeContext('agent-1');
    await agent.init(context);
    await agent.start();

    const triggerThinkSpy = vi.spyOn(agent, '_triggerThink');
    await process.onTick(1);

    expect(triggerThinkSpy).toHaveBeenCalledTimes(1);
  });

  it('should allow agent to process percepts through onTick', async () => {
    const context = makeContext('agent-1');
    await agent.init(context);
    await agent.start();

    // Add some events to the agent (buffer size is 5, so 2 events won't auto-trigger think)
    await agent.onEvent(makeEvent({ id: 'e1' }));
    await agent.onEvent(makeEvent({ id: 'e2' }));

    // onTick should trigger _triggerThink which processes the percepts
    await process.onTick(1);

    expect(agent.thinkCalls).toHaveLength(1);
    expect(agent.thinkCalls[0]).toHaveLength(2);
  });

  it('should handle multiple ticks without percepts gracefully', async () => {
    const context = makeContext('agent-1');
    await agent.init(context);
    await agent.start();

    // Multiple ticks with no events -- should not throw
    await process.onTick(1);
    await process.onTick(2);
    await process.onTick(3);

    expect(agent.thinkCalls).toHaveLength(0);
  });

  it('should preserve agent lifecycle through process lifecycle', async () => {
    const context = makeContext('agent-1');
    await agent.init(context);
    await agent.start();

    await process.onStart();
    expect(process.state).toBe(ProcessState.RUNNING);
    expect(agent.state).toBe(AgentState.RUNNING);

    await process.onStop();
    expect(process.state).toBe(ProcessState.TERMINATED);
    expect(agent.state).toBe(AgentState.IDLE);
  });
});
