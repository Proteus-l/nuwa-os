import {
  NuwaEvent,
  AgentState,
  AgentAction,
  AgentContext,
  Percept,
  IProcess,
  ProcessState,
} from './types';
import { SimpleEventBus } from './simple-event-bus';

export class SimpleBaseAgent {
  readonly id: string;
  readonly name: string;
  state: AgentState = AgentState.IDLE;
  protected context?: AgentContext;
  protected percepts: Percept[] = [];
  protected perceptBufferSize: number;
  private unsubscribers: (() => void)[] = [];

  constructor(config: {
    id: string;
    name: string;
    perceptBufferSize?: number;
    subscriptions?: string[];
  }) {
    this.id = config.id;
    this.name = config.name;
    this.perceptBufferSize = config.perceptBufferSize ?? 10;
  }

  async init(context: AgentContext): Promise<void> {
    this.context = context;
  }

  async start(): Promise<void> {
    this.state = AgentState.RUNNING;
  }

  async stop(): Promise<void> {
    this.state = AgentState.IDLE;
    this.unsubscribers.forEach((fn) => fn());
  }

  subscribeTo(topic: string): void {
    if (!this.context) return;
    const unsub = this.context.subscribe(topic, (event: NuwaEvent) => this.onEvent(event));
    this.unsubscribers.push(unsub);
  }

  async onEvent(event: NuwaEvent): Promise<void> {
    this.percepts.push({
      source: event.source,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
    });
    if (this.percepts.length >= this.perceptBufferSize) {
      await this.tickThink();
    }
  }

  async tickThink(): Promise<void> {
    if (this.percepts.length === 0) return;
    this.state = AgentState.THINKING;
    const batch = this.percepts.splice(0);
    try {
      const actions = await this.think(batch);
      this.state = AgentState.RUNNING;
      for (const action of actions) {
        await this.executeAction(action);
      }
    } catch {
      this.state = AgentState.ERROR;
    }
  }

  async think(_percepts: Percept[]): Promise<AgentAction[]> {
    return [];
  }

  protected async executeAction(action: AgentAction): Promise<void> {
    if (action.type === 'emit' && this.context) {
      this.context.publish({
        type: 'agent',
        topic: `agent.${this.id}.action`,
        data: action.payload,
      });
    } else if (action.type === 'log' && this.context) {
      this.context.log('info', String(action.payload));
    } else if (action.type === 'speak' && this.context) {
      this.context.log('info', `[SPEAK] ${action.payload}`);
    }
  }
}

export class SimpleAgentProcess implements IProcess {
  readonly id: string;
  readonly name: string;
  priority: number;
  state = ProcessState.READY;
  private agent: SimpleBaseAgent;

  constructor(agent: SimpleBaseAgent, priority = 10) {
    this.id = `proc_${agent.id}`;
    this.name = `AgentProcess[${agent.name}]`;
    this.priority = priority;
    this.agent = agent;
  }

  async onStart(): Promise<void> {
    this.state = ProcessState.RUNNING;
  }

  async onStop(): Promise<void> {
    this.state = ProcessState.TERMINATED;
    await this.agent.stop();
  }

  async onTick(_tick: number): Promise<void> {
    await this.agent.tickThink();
  }
}

export class SimpleAgentRuntime {
  private agents = new Map<string, SimpleBaseAgent>();
  private eventBus: SimpleEventBus;

  constructor(eventBus: SimpleEventBus) {
    this.eventBus = eventBus;
  }

  async registerAgent(agent: SimpleBaseAgent): Promise<void> {
    const ctx: AgentContext = {
      agentId: agent.id,
      subscribe: (topic, handler) => {
        const id = this.eventBus.subscribe(topic, handler);
        return () => {
          this.eventBus.unsubscribe(id);
        };
      },
      publish: (event) => {
        this.eventBus.publish({
          id: this.eventBus.generateEventId(),
          type: event.type ?? 'agent',
          topic: event.topic ?? `agent.${agent.id}.event`,
          timestamp: event.timestamp ?? Date.now(),
          source: event.source ?? agent.id,
          data: event.data,
          metadata: event.metadata,
          priority: event.priority,
        });
      },
      log: (_level, _msg) => {
        /* console.log(`[${agent.id}][${level}] ${msg}`); */
      },
      getTime: () => Date.now(),
    };
    await agent.init(ctx);
    this.agents.set(agent.id, agent);
  }

  async startAll(): Promise<void> {
    for (const a of this.agents.values()) await a.start();
  }

  async stopAll(): Promise<void> {
    for (const a of this.agents.values()) await a.stop();
  }

  getAgent(id: string): SimpleBaseAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): SimpleBaseAgent[] {
    return Array.from(this.agents.values());
  }
}
