import { IAgent } from './types.js';
import { AgentContextImpl, EventBusInterface } from './agent-context.js';

export class AgentRuntime {
  private agents: Map<string, IAgent> = new Map();
  private contexts: Map<string, AgentContextImpl> = new Map();
  private eventBus: EventBusInterface;

  constructor(eventBus: EventBusInterface) {
    this.eventBus = eventBus;
  }

  async registerAgent(agent: IAgent): Promise<void> {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent ${agent.id} already registered`);
    }
    const context = new AgentContextImpl({
      agentId: agent.id,
      eventBus: this.eventBus,
    });
    this.agents.set(agent.id, agent);
    this.contexts.set(agent.id, context);
    await agent.init(context);
  }

  async unregisterAgent(agentId: string): Promise<boolean> {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    await agent.stop();
    this.agents.delete(agentId);
    this.contexts.delete(agentId);
    return true;
  }

  async startAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.start();
    }
  }

  async stopAll(): Promise<void> {
    for (const agent of this.agents.values()) {
      await agent.stop();
    }
  }

  getAgent(id: string): IAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  getContext(agentId: string): AgentContextImpl | undefined {
    return this.contexts.get(agentId);
  }
}
