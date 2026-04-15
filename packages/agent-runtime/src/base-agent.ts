import {
  AgentState,
  AgentAction,
  AgentContext,
  BaseAgentOptions,
  IAgent,
  NuwaEvent,
  Percept,
} from './types.js';

export abstract class BaseAgent implements IAgent {
  readonly id: string;
  readonly name: string;
  state: AgentState = AgentState.IDLE;

  protected context?: AgentContext;
  protected percepts: Percept[] = [];
  protected perceptBufferSize: number;
  protected thinkInterval: number;
  protected subscriptions: string[];
  private _unsubscribers: (() => void)[] = [];
  private _thinkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: { id: string; name: string; options?: BaseAgentOptions }) {
    this.id = opts.id;
    this.name = opts.name;
    this.perceptBufferSize = opts.options?.perceptBufferSize ?? 10;
    this.thinkInterval = opts.options?.thinkInterval ?? 1000;
    this.subscriptions = opts.options?.subscriptions ?? [];
  }

  async init(context: AgentContext): Promise<void> {
    this.context = context;
    for (const topic of this.subscriptions) {
      const unsub = context.subscribe(topic, (event) => this.onEvent(event));
      this._unsubscribers.push(unsub);
    }
  }

  async start(): Promise<void> {
    this.state = AgentState.RUNNING;
    this._thinkTimer = setInterval(() => {
      this._triggerThink();
    }, this.thinkInterval);
  }

  async stop(): Promise<void> {
    if (this._thinkTimer) {
      clearInterval(this._thinkTimer);
      this._thinkTimer = null;
    }
    this._unsubscribers.forEach((fn) => fn());
    this._unsubscribers = [];
    this.percepts = [];
    this.state = AgentState.IDLE;
  }

  async onEvent(event: NuwaEvent): Promise<void> {
    const percept = this.eventToPercept(event);
    this.percepts.push(percept);
    if (this.percepts.length >= this.perceptBufferSize) {
      await this._triggerThink();
    }
  }

  async _triggerThink(): Promise<void> {
    if (this.percepts.length === 0) return;
    const batch = this.percepts.splice(0);
    this.state = AgentState.THINKING;
    try {
      const actions = await this.think(batch);
      this.state = AgentState.RUNNING;
      for (const action of actions) {
        this._dispatchAction(action);
      }
    } catch (err) {
      this.state = AgentState.ERROR;
      this.context?.log('error', `Think error: ${err}`);
    }
  }

  _dispatchAction(action: AgentAction): void {
    switch (action.type) {
      case 'emit':
        this.context?.publish({
          type: 'agent',
          data: action.payload,
          topic: `agent.${this.id}.action`,
        });
        break;
      case 'log':
        this.context?.log('info', String(action.payload));
        break;
      default:
        // no-op for other action types
        break;
    }
  }

  protected eventToPercept(event: NuwaEvent): Percept {
    return {
      source: event.source,
      type: event.type,
      data: event.data,
      timestamp: event.timestamp,
    };
  }

  abstract think(percepts: Percept[]): Promise<AgentAction[]>;
}
