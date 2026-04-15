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

export type EventHandler = (event: NuwaEvent) => void;

export enum ProcessState {
  READY = 'ready',
  RUNNING = 'running',
  BLOCKED = 'blocked',
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

export enum AgentState {
  IDLE = 'idle',
  RUNNING = 'running',
  THINKING = 'thinking',
  ERROR = 'error',
}

export interface Percept {
  source: string;
  type: string;
  data: unknown;
  timestamp: number;
}

export interface AgentAction {
  type: string;
  payload: unknown;
  priority?: number;
}

export interface AgentContext {
  agentId: string;
  subscribe(topic: string, handler: EventHandler): () => void;
  publish(event: Partial<NuwaEvent>): void;
  log(level: 'info' | 'warn' | 'error', message: string): void;
  getTime(): number;
}

export enum SensorType {
  CAMERA = 'camera',
  TEMPERATURE = 'temperature',
}

export enum SensorState {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  ERROR = 'error',
}

export enum DeviceType {
  CAMERA = 'camera',
  THERMOMETER = 'thermometer',
}

export enum DeviceState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface DeviceData {
  deviceId: string;
  type: string;
  payload: unknown;
  timestamp: number;
}
