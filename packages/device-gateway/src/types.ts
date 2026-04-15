export enum DeviceType {
  CAMERA = 'camera',
  THERMOMETER = 'thermometer',
  MICROPHONE = 'microphone',
  ACTUATOR = 'actuator',
  GENERIC = 'generic',
}

export enum DeviceState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface DeviceCommand {
  type: string;
  payload?: unknown;
}

export interface DeviceResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DeviceData {
  deviceId: string;
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface IDevice {
  readonly id: string;
  readonly name: string;
  readonly type: DeviceType;
  readonly protocol: string;
  state: DeviceState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(command: DeviceCommand): Promise<DeviceResponse>;
  onData(handler: (data: DeviceData) => void): () => void;
}

// Inlined NuwaEvent
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

// Inlined IProcess from kernel-core
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

// Inlined IEventBus
export interface IEventBus {
  publish(event: NuwaEvent): void;
  subscribe(topic: string, handler: (event: NuwaEvent) => void): string;
  unsubscribe(subscriptionId: string): boolean;
}
