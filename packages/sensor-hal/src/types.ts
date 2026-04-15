export enum SensorType {
  CAMERA = 'camera',
  TEMPERATURE = 'temperature',
  MOTION = 'motion',
  AUDIO = 'audio',
  GENERIC = 'generic',
}

export enum SensorState {
  IDLE = 'idle',
  ACTIVE = 'active',
  ERROR = 'error',
}

export interface SensorReading<T = unknown> {
  sensorId: string;
  sensorType: SensorType;
  timestamp: number;
  data: T;
  metadata?: Record<string, unknown>;
}

export interface ISensor<T = unknown> {
  readonly id: string;
  readonly type: SensorType;
  readonly name: string;
  state: SensorState;
  start(): Promise<void>;
  stop(): Promise<void>;
  read(): Promise<SensorReading<T>>;
  subscribe(callback: (reading: SensorReading<T>) => void): () => void;
}

// Inlined NuwaEvent for zero-dependency conversion
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
