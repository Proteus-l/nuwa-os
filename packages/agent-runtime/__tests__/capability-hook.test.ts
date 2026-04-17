import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from '../src/base-agent';
import { AgentContextImpl, EventBusInterface } from '../src/agent-context';
import { AgentRuntime } from '../src/agent-runtime';
import {
  AgentAction,
  Capability,
  CapabilityChangeEvent,
  ICapabilityView,
  NuwaEvent,
  Percept,
} from '../src/types';

/**
 * Smarter mock bus that supports `.**` suffix wildcard matching so we can
 * exercise the capability.** auto-subscription path.
 */
class WildcardBus implements EventBusInterface {
  private subs = new Map<string, { topic: string; handler: (e: NuwaEvent) => void }>();
  private counter = 0;

  subscribe(topic: string, handler: (e: NuwaEvent) => void): () => void {
    const id = `sub_${++this.counter}`;
    this.subs.set(id, { topic, handler });
    return () => {
      this.subs.delete(id);
    };
  }

  publish(event: NuwaEvent): void {
    for (const sub of this.subs.values()) {
      if (this.matches(sub.topic, event.topic)) sub.handler(event);
    }
  }

  private matches(pattern: string, topic: string): boolean {
    if (pattern === topic) return true;
    if (pattern === '**') return true;
    if (pattern.endsWith('.**')) {
      const prefix = pattern.slice(0, -3);
      return topic === prefix || topic.startsWith(prefix + '.');
    }
    return false;
  }
}

class RecordingAgent extends BaseAgent {
  public changes: CapabilityChangeEvent[] = [];
  public thinkCalls: Percept[][] = [];

  async think(percepts: Percept[]): Promise<AgentAction[]> {
    this.thinkCalls.push(percepts);
    return [];
  }

  protected override async onCapabilityChange(
    ev: CapabilityChangeEvent,
  ): Promise<void> {
    this.changes.push(ev);
  }
}

function makeCapabilityEvent(
  kind: 'attached' | 'detached',
  cap: Capability,
): NuwaEvent {
  return {
    id: `cap_${Date.now()}`,
    type: 'capability',
    topic: kind === 'attached' ? 'capability.attached' : 'capability.detached',
    timestamp: Date.now(),
    source: 'capability-registry',
    data: cap,
  };
}

const visionCap: Capability = {
  id: 'sensor:cam-1',
  modality: 'vision',
  sourceKind: 'sensor',
  sourceId: 'cam-1',
  name: 'Living room camera',
  attachedAt: 1_000,
};

describe('BaseAgent capability hook', () => {
  let bus: WildcardBus;
  let ctx: AgentContextImpl;
  let agent: RecordingAgent;

  beforeEach(() => {
    bus = new WildcardBus();
    ctx = new AgentContextImpl({ agentId: 'a1', eventBus: bus });
    agent = new RecordingAgent({ id: 'a1', name: 'A1' });
  });

  it('auto-subscribes to capability.** during init and forwards attached events', async () => {
    await agent.init(ctx);
    bus.publish(makeCapabilityEvent('attached', visionCap));
    expect(agent.changes).toHaveLength(1);
    expect(agent.changes[0].kind).toBe('attached');
    expect(agent.changes[0].capability.modality).toBe('vision');
  });

  it('forwards detached events', async () => {
    await agent.init(ctx);
    bus.publish(makeCapabilityEvent('detached', visionCap));
    expect(agent.changes).toHaveLength(1);
    expect(agent.changes[0].kind).toBe('detached');
  });

  it('ignores malformed capability events', async () => {
    await agent.init(ctx);
    bus.publish({
      id: 'x',
      type: 'capability',
      topic: 'capability.attached',
      timestamp: Date.now(),
      source: 'x',
      data: null, // malformed
    });
    bus.publish({
      id: 'y',
      type: 'capability',
      topic: 'capability.attached',
      timestamp: Date.now(),
      source: 'x',
      data: { noId: true }, // missing id
    });
    expect(agent.changes).toHaveLength(0);
  });

  it('default hook is a no-op and swallows errors without crashing the bus', async () => {
    class SilentAgent extends BaseAgent {
      async think(_percepts: Percept[]): Promise<AgentAction[]> {
        return [];
      }
    }
    const silent = new SilentAgent({ id: 's1', name: 's' });
    const silentCtx = new AgentContextImpl({ agentId: 's1', eventBus: bus });
    await silent.init(silentCtx);
    expect(() =>
      bus.publish(makeCapabilityEvent('attached', visionCap)),
    ).not.toThrow();
  });

  it('async errors in the hook are logged, not propagated', async () => {
    class ThrowingAgent extends BaseAgent {
      async think(_p: Percept[]): Promise<AgentAction[]> {
        return [];
      }
      protected override async onCapabilityChange(): Promise<void> {
        throw new Error('boom');
      }
    }
    const throwing = new ThrowingAgent({ id: 't1', name: 't' });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await throwing.init(new AgentContextImpl({ agentId: 't1', eventBus: bus }));

    expect(() =>
      bus.publish(makeCapabilityEvent('attached', visionCap)),
    ).not.toThrow();

    // allow rejection to flush
    await new Promise((r) => setTimeout(r, 0));
    expect(logSpy.mock.calls.some(([msg]) => String(msg).includes('onCapabilityChange error'))).toBe(true);
    logSpy.mockRestore();
  });

  it('capability subscription is removed on stop()', async () => {
    await agent.init(ctx);
    await agent.start();
    await agent.stop();
    bus.publish(makeCapabilityEvent('attached', visionCap));
    expect(agent.changes).toHaveLength(0);
  });
});

describe('AgentRuntime capability injection', () => {
  it('exposes ctx.getCapabilities() to agents when capabilities are configured', async () => {
    const bus = new WildcardBus();
    const fakeView: ICapabilityView = {
      list: () => [visionCap],
      byModality: (m) => (m === 'vision' ? [visionCap] : []),
      has: (m) => m === 'vision',
    };
    const runtime = new AgentRuntime(bus, { capabilities: fakeView });

    class Probe extends BaseAgent {
      public seen?: ICapabilityView;
      async think(_p: Percept[]): Promise<AgentAction[]> {
        return [];
      }
      override async init(context: import('../src/types').AgentContext) {
        await super.init(context);
        this.seen = context.getCapabilities?.();
      }
    }
    const probe = new Probe({ id: 'probe', name: 'probe' });
    await runtime.registerAgent(probe);

    expect(probe.seen).toBe(fakeView);
    expect(probe.seen?.has('vision')).toBe(true);
  });

  it('ctx.getCapabilities() returns undefined when no registry configured', async () => {
    const bus = new WildcardBus();
    const runtime = new AgentRuntime(bus); // no options

    class Probe extends BaseAgent {
      public seen?: ICapabilityView;
      async think(_p: Percept[]): Promise<AgentAction[]> {
        return [];
      }
      override async init(context: import('../src/types').AgentContext) {
        await super.init(context);
        this.seen = context.getCapabilities?.();
      }
    }
    const probe = new Probe({ id: 'probe', name: 'probe' });
    await runtime.registerAgent(probe);

    expect(probe.seen).toBeUndefined();
  });
});
