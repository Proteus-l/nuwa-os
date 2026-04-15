export type EventPriority = 'HIGH' | 'NORMAL' | 'LOW';

export interface NuwaEvent {
  id: string;
  type: string; // 'sensor' | 'system' | 'agent' | 'user'
  topic: string; // e.g. 'sensor.camera.frame'
  timestamp: number;
  source: string;
  data: unknown;
  metadata?: Record<string, unknown>;
  priority?: EventPriority;
}

export type EventHandler = (event: NuwaEvent) => void | Promise<void>;

export interface Subscription {
  id: string;
  topic: string;
  handler: EventHandler;
}
