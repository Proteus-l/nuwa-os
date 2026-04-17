import {
  AgentState,
  AgentAction,
  AgentContext,
  BaseAgentOptions,
  CapabilityChangeEvent,
  IAgent,
  NuwaEvent,
  Percept,
} from './types.js';

/** Topic patterns the runtime will auto-subscribe every agent to. */
const CAPABILITY_TOPIC_PATTERN = 'capability.**';

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
    // Auto-subscribe to capability lifecycle. This is always-on so that
    // a persona / spirit layer can react to attach/detach without every
    // concrete agent having to opt in.
    const capUnsub = context.subscribe(CAPABILITY_TOPIC_PATTERN, (event) => {
      const ev = this.parseCapabilityEvent(event);
      if (ev) this.onCapabilityChange(ev).catch((err) => {
        this.context?.log('error', `onCapabilityChange error: ${err}`);
      });
    });
    this._unsubscribers.push(capUnsub);
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

  /**
   * Parse a bus event on `capability.attached` / `capability.detached` into
   * a structured change event. Returns null if the payload shape is unexpected.
   */
  protected parseCapabilityEvent(event: NuwaEvent): CapabilityChangeEvent | null {
    let kind: 'attached' | 'detached';
    if (event.topic === 'capability.attached') kind = 'attached';
    else if (event.topic === 'capability.detached') kind = 'detached';
    else return null;
    const cap = event.data as CapabilityChangeEvent['capability'] | undefined;
    if (!cap || typeof cap !== 'object' || typeof cap.id !== 'string') {
      return null;
    }
    return { kind, capability: cap };
  }

  /**
   * Hook fired when a capability attaches or detaches. Override to react
   * (e.g. promote short-term memory before a sense goes dark, or inject a
   * reflective percept for the next think()). Default is a no-op.
   */
  protected async onCapabilityChange(
    _event: CapabilityChangeEvent,
  ): Promise<void> {
    // default: no-op; subclasses may override.
  }

  abstract think(percepts: Percept[]): Promise<AgentAction[]>;
}
