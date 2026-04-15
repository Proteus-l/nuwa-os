import { AgentContext, NuwaEvent } from './types.js';

export interface EventBusInterface {
  subscribe(topic: string, handler: (event: NuwaEvent) => void): () => void;
  publish(event: NuwaEvent): void;
}

export class AgentContextImpl implements AgentContext {
  readonly agentId: string;
  private eventBus: EventBusInterface;

  constructor(opts: { agentId: string; eventBus: EventBusInterface }) {
    this.agentId = opts.agentId;
    this.eventBus = opts.eventBus;
  }

  subscribe(
    topic: string,
    handler: (event: NuwaEvent) => void,
  ): () => void {
    return this.eventBus.subscribe(topic, handler);
  }

  publish(event: Partial<NuwaEvent>): void {
    const fullEvent: NuwaEvent = {
      id:
        event.id ??
        `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: event.type ?? 'agent',
      topic: event.topic ?? `agent.${this.agentId}.event`,
      timestamp: event.timestamp ?? Date.now(),
      source: event.source ?? this.agentId,
      data: event.data,
      metadata: event.metadata,
      priority: event.priority,
    };
    this.eventBus.publish(fullEvent);
  }

  log(level: 'info' | 'warn' | 'error', message: string): void {
    console.log(`[Agent:${this.agentId}] [${level}] ${message}`);
  }

  getTime(): number {
    return Date.now();
  }
}
