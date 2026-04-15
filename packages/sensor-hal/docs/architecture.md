# @nuwa-os/sensor-hal

> 女娲 OS 的感官系统 — 传感器硬件抽象层

## 架构

```
          物理世界 / 虚拟数据源
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
┌────────┐  ┌──────────┐  ┌────────┐
│Virtual  │  │Virtual   │  │ 未来:  │
│Camera   │  │Thermo    │  │ RTSP   │
│         │  │meter     │  │ BLE    │
└────┬────┘  └────┬─────┘  └───┬────┘
     │            │            │
     └────────────┼────────────┘
                  │  implements ISensor<T>
                  ▼
        ┌──────────────────┐
        │  SensorRegistry   │
        │  register/query   │
        └────────┬─────────┘
                 │ subscribe(callback)
                 ▼
        ┌──────────────────┐
        │  toNuwaEvent()   │  ← 标准化为 NuwaEvent
        │  → EventBus      │
        └──────────────────┘
```

## 核心概念

### 传感器类型

```typescript
enum SensorType {
  CAMERA = 'camera',
  TEMPERATURE = 'temperature',
  MOTION = 'motion',
  AUDIO = 'audio',
  GENERIC = 'generic',
}
```

### 传感器接口

```typescript
interface ISensor<T = unknown> {
  readonly id: string;
  readonly name: string;
  readonly type: SensorType;
  state: SensorState;          // IDLE | ACTIVE | ERROR
  start(interval?: number): void;
  stop(): void;
  read(): Promise<SensorReading<T>>;
  subscribe(callback: (reading: SensorReading<T>) => void): () => void;
}
```

### 传感器读数

```typescript
interface SensorReading<T> {
  sensorId: string;
  sensorType: SensorType;
  timestamp: number;
  data: T;
}
```

## 内置虚拟传感器

### VirtualCamera

模拟摄像头传感器，产生帧数据：

```typescript
const camera = new VirtualCamera('cam-1', 'Main Camera');
camera.start(200);  // 200ms 一帧（5 FPS）

camera.subscribe((reading) => {
  const frame = reading.data;
  // frame: { frameId, width, height, format, frameData }
});

// 单次读取
const snapshot = await camera.read();
camera.stop();
```

**CameraFrameData**：
- `frameId: number` — 帧序号
- `width: number` — 宽度（默认 640）
- `height: number` — 高度（默认 480）
- `format: string` — 格式（默认 'RGB'）
- `frameData: Uint8Array` — 原始数据

### VirtualThermometer

模拟温度传感器，产生温湿度数据：

```typescript
const thermo = new VirtualThermometer('temp-1', 'Room Sensor');
thermo.start(1000);  // 1 秒一次

thermo.subscribe((reading) => {
  const data = reading.data;
  // data: { celsius, humidity, unit }
});
```

**TemperatureData**：
- `celsius: number` — 温度（18-30°C 随机波动）
- `humidity: number` — 湿度（40-60%）
- `unit: string` — 单位（默认 'celsius'）

### SensorRegistry

```typescript
const registry = new SensorRegistry();

registry.register(camera);
registry.register(thermo);

registry.getAllSensors();                    // [camera, thermo]
registry.getSensorsByType(SensorType.CAMERA); // [camera]
registry.getSensor('cam-1');                 // camera

registry.onRegistered((sensor) => console.log('新传感器:', sensor.name));
registry.onUnregistered((id) => console.log('移除:', id));
```

### toNuwaEvent 工具函数

将传感器读数转为 EventBus 标准格式：

```typescript
const event = toNuwaEvent(reading);
// → { topic: 'sensor.camera.reading', source: 'cam-1', data: {...} }
eventBus.publish(event);
```

## 文件结构

```
src/
├── index.ts              # 统一导出
├── types.ts              # SensorType, SensorState, ISensor<T>, SensorReading<T>
├── sensor-registry.ts    # SensorRegistry
├── virtual-sensor.ts     # VirtualSensor<T> 抽象基类
├── sensors/
│   ├── virtual-camera.ts       # VirtualCamera
│   └── virtual-thermometer.ts  # VirtualThermometer
└── utils/
    └── converters.ts     # toNuwaEvent()
```

## 扩展指南

实现自定义传感器只需继承 `VirtualSensor<T>` 并实现 `generateData()`：

```typescript
interface GPSData {
  latitude: number;
  longitude: number;
  altitude: number;
}

class VirtualGPS extends VirtualSensor<GPSData> {
  constructor() {
    super('gps-1', 'GPS Sensor', SensorType.GENERIC);
  }

  protected generateData(): GPSData {
    return {
      latitude: 39.9042 + (Math.random() - 0.5) * 0.001,
      longitude: 116.4074 + (Math.random() - 0.5) * 0.001,
      altitude: 50 + Math.random() * 10,
    };
  }
}
```

注册后即可被 Agent 通过 EventBus 感知，无需修改任何其他模块。
