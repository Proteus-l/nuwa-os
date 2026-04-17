export enum AgentState {
  IDLE = 'idle',
  RUNNING = 'running',
  THINKING = 'thinking',
  ERROR = 'error',
}

export interface NuwaEvent {
  id: string;
  type: string;
  topic: string;
  timestamp: number;
  source: string;
  data: unknown;
  metadata?: Record<string, unknown>;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
}

export interface Percept {
  source: string;
  type: string; // 'visual' | 'thermal' | 'audio' | 'system'
  data: unknown;
  timestamp: number;
}

export interface AgentAction {
  type: string; // 'speak' | 'log' | 'emit' | 'request'
  payload: unknown;
  priority?: number;
}

/**
 * Semantic modality a capability exposes to the agent. Kept as a string union
 * here to stay decoupled from `@nuwa-os/capability-registry`; callers are
 * expected to pass compatible values.
 */
export type Modality =
  | 'vision'
  | 'thermal'
  | 'audio'
  | 'proximity'
  | 'text-input'
  | 'actuator'
  | 'generic';

export interface Capability {
  id: string;
  modality: Modality;
  sourceKind: 'sensor' | 'device';
  sourceId: string;
  name: string;
  description?: string;
  attachedAt: number;
  metadata?: Record<string, unknown>;
}

/**
 * Minimal read-only view of the capability registry that an agent can use
 * from within think(). Defined here to avoid a cross-package dependency;
 * `@nuwa-os/capability-registry` satisfies this structurally.
 */
export interface ICapabilityView {
  list(): Capability[];
  byModality(m: Modality): Capability[];
  has(m: Modality): boolean;
}

export interface CapabilityChangeEvent {
  kind: 'attached' | 'detached';
  capability: Capability;
}

export interface AgentContext {
  agentId: string;
  subscribe(topic: string, handler: (event: NuwaEvent) => void): () => void;
  publish(event: Partial<NuwaEvent>): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  getTime(): number;
  /**
   * Query what senses/devices the agent currently has. Optional so that
   * legacy agents created without a capability registry keep working.
   * When present, may still return undefined if the runtime was constructed
   * without a capability registry.
   */
  getCapabilities?(): ICapabilityView | undefined;
}

export interface IAgent {
  readonly id: string;
  readonly name: string;
  state: AgentState;
  init(context: AgentContext): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  onEvent(event: NuwaEvent): Promise<void>;
  think(percepts: Percept[]): Promise<AgentAction[]>;
}

// Inlined from kernel-core
export enum ProcessState {
  CREATED = 'created',
  RUNNING = 'running',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

export interface IProcess {
  readonly id: string;
  readonly name: string;
  priority: number;
  state: ProcessState;
  onStart(): Promise<void>;
  onStop(): Promise<void>;
  onTick(tick: number): Promise<void>;
}

export interface BaseAgentOptions {
  perceptBufferSize?: number; // default 10
  thinkInterval?: number; // default 1000ms
  subscriptions?: string[]; // default topic patterns to subscribe
}
