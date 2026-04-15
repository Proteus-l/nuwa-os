# @nuwa-os/device-gateway

> 女娲 OS 的外设接入层 — 统一设备抽象与 EventBus 桥接

## 架构

```
VirtualCameraDevice    VirtualThermometerDevice
        │                        │
        └────────┬───────────────┘
                 │ extends
                 ▼
          ┌─────────────┐
          │ VirtualDevice│  ← 抽象基类，内置数据发射器
          │  (abstract)  │
          └──────┬──────┘
                 │ implements
                 ▼
          ┌─────────────┐     ┌──────────────────┐
          │   IDevice    │────▶│  DeviceRegistry  │
          └──────┬──────┘     └────────┬─────────┘
                 │                     │
                 ▼                     ▼
          ┌──────────────────────────────────┐
          │          DeviceGateway           │
          │                                  │
          │  addDevice() → 注册 + 桥接       │
          │  bridgeToEventBus(data)          │
          │    DeviceData → NuwaEvent        │
          │    topic: device.{type}.data     │
          └──────────────┬───────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────┐
          │         GatewayProcess           │
          │  adapts DeviceGateway → IProcess │
          │  onStart() → gateway.start()     │
          │  onStop()  → gateway.stop()      │
          └──────────────────────────────────┘
                         │
                         │ registered as IProcess
                         ▼
                   Kernel Scheduler
```

## 核心概念

### 设备接口 IDevice

所有设备的统一抽象，支持双向通信：

```typescript
interface IDevice {
  readonly id: string;
  readonly name: string;
  readonly type: DeviceType;
  readonly state: DeviceState;
  readonly protocol: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(command: DeviceCommand): Promise<DeviceResponse>;
  onData(handler: (data: DeviceData) => void): () => void;
}
```

### 设备类型

```typescript
enum DeviceType {
  CAMERA = 'camera',
  THERMOMETER = 'thermometer',
  MICROPHONE = 'microphone',
  ACTUATOR = 'actuator',
  GENERIC = 'generic',
}
```

### 设备状态

```typescript
enum DeviceState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}
```

### 命令-响应模型

```typescript
// 向设备发送命令
interface DeviceCommand {
  type: string;     // 'capture' | 'read' | 'set_resolution' | ...
  payload?: unknown;
}

// 设备返回响应
interface DeviceResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}
```

### 设备数据

```typescript
interface DeviceData {
  deviceId: string;
  type: string;       // 'frame' | 'temperature' | ...
  timestamp: number;
  data: unknown;
}
```

## API

### DeviceRegistry

设备注册表，管理设备的注册/注销和生命周期回调：

```typescript
const registry = new DeviceRegistry();

// 注册设备
registry.register(camera);
registry.register(thermometer);

// 查询设备
const cam = registry.getDevice('vcam-1');
const cameras = registry.getDevicesByType(DeviceType.CAMERA);
const all = registry.getAllDevices();
console.log('设备数:', registry.getCount());

// 监听注册/注销事件
const unsub = registry.onDeviceRegistered((device) => {
  console.log(`设备上线: ${device.name}`);
});

registry.onDeviceUnregistered((deviceId) => {
  console.log(`设备下线: ${deviceId}`);
});

// 注销设备
registry.unregister('vcam-1');

// 清理回调
unsub();
```

### VirtualDevice（抽象基类）

所有虚拟设备的基类，内置数据定时发射器：

```typescript
abstract class VirtualDevice implements IDevice {
  // 子类实现命令处理
  abstract handleCommand(command: DeviceCommand): Promise<DeviceResponse>;

  // 启动定时数据发射（子类在 connect() 中调用）
  protected startEmitting(interval: number, generateData: () => DeviceData): void;
  protected stopEmitting(): void;

  // 向所有 handler 发射数据
  protected emit(data: DeviceData): void;
}
```

### VirtualCameraDevice

虚拟摄像头设备，产生 RGB 帧数据：

```typescript
const camera = new VirtualCameraDevice('vcam-1', 'Main Camera');

// 连接后自动以 200ms 间隔发射帧
await camera.connect();

// 监听帧数据
const unsub = camera.onData((data) => {
  console.log(`帧 #${data.data.frameId} (${data.data.width}x${data.data.height})`);
});

// 发送命令
const snapshot = await camera.send({ type: 'capture' });
const res = await camera.send({ type: 'get_resolution' });
await camera.send({
  type: 'set_resolution',
  payload: { width: 1920, height: 1080 },
});

// 断开
await camera.disconnect();
```

支持的命令：

| 命令 | 说明 | 返回 |
|------|------|------|
| `capture` | 拍照快照 | `{ frameId, width, height, format, data }` |
| `get_resolution` | 获取当前分辨率 | `{ width, height }` |
| `set_resolution` | 设置分辨率 | `{ width, height }` |

### VirtualThermometerDevice

虚拟温度计设备，产生温度读数：

```typescript
const thermo = new VirtualThermometerDevice('vtherm-1', 'Room Thermo');

// 连接后自动以 2000ms 间隔发射温度读数
await thermo.connect();

// 监听温度数据
thermo.onData((data) => {
  console.log(`温度: ${data.data.temperature}°C 湿度: ${data.data.humidity}%`);
});

// 发送命令
const reading = await thermo.send({ type: 'read' });
const range = await thermo.send({ type: 'get_range' });

await thermo.disconnect();
```

支持的命令：

| 命令 | 说明 | 返回 |
|------|------|------|
| `read` | 读取当前温度 | `{ temperature, humidity, unit }` |
| `get_range` | 获取温度范围 | `{ min, max }` |

### DeviceGateway

设备网关，管理所有设备并桥接数据到 EventBus：

```typescript
// 创建网关，传入 EventBus 发布函数
const gateway = new DeviceGateway((event) => {
  eventBus.publish(event);
});

// 添加设备（自动注册到 Registry 并设置数据桥接）
gateway.addDevice(camera);
gateway.addDevice(thermometer);

// 启动（连接所有设备）
await gateway.start();

// 查询
const device = gateway.getDevice('vcam-1');
const all = gateway.getAllDevices();
const registry = gateway.getRegistry();
console.log('运行中:', gateway.isRunning());

// 移除设备
await gateway.removeDevice('vcam-1');

// 停止（断开所有设备）
await gateway.stop();
```

**数据桥接机制**：

当设备发射数据时，DeviceGateway 自动转换为 NuwaEvent：

```
DeviceData { deviceId: 'vcam-1', type: 'frame', data: {...} }
    ↓ bridgeToEventBus()
NuwaEvent {
  id: 'evt_1234567890_abc123',
  type: 'device.data',
  topic: 'device.frame.data',      ← device.{data.type}.data
  timestamp: 1234567890,
  source: 'vcam-1',
  data: DeviceData
}
    ↓ publishFn()
EventBus
```

### GatewayProcess

将 DeviceGateway 适配为内核进程：

```typescript
const gatewayProcess = new GatewayProcess(gateway, 3); // priority: 3

// 注册到内核
kernel.registerProcess(gatewayProcess);

// onStart() → gateway.start()
// onStop()  → gateway.stop()
// onTick()  → no-op（设备为事件驱动，不需要 tick 轮询）
```

## 文件结构

```
src/
├── index.ts                         # 统一导出
├── types.ts                         # IDevice, DeviceType, DeviceState, DeviceCommand...
├── device-registry.ts               # DeviceRegistry — 设备注册表
├── virtual-device.ts                # VirtualDevice — 虚拟设备抽象基类
├── devices/
│   ├── virtual-camera-device.ts     # VirtualCameraDevice — 虚拟摄像头
│   └── virtual-thermometer-device.ts # VirtualThermometerDevice — 虚拟温度计
├── device-gateway.ts                # DeviceGateway — 设备网关 + EventBus 桥接
└── gateway-process.ts               # GatewayProcess — 内核进程适配器
```

## 设计决策

1. **双向通信**：`onData()` 订阅设备数据流（推模式），`send()` 向设备发送命令（拉模式），覆盖所有设备交互场景
2. **自动桥接**：`addDevice()` 同时完成注册和 EventBus 桥接，无需手动连线
3. **事件驱动**：GatewayProcess 的 `onTick()` 为空操作，所有数据流通过事件回调驱动，不浪费 CPU
4. **可扩展**：新增设备只需继承 `VirtualDevice` 并实现 `handleCommand()`，Gateway 和 Registry 无需修改

## 扩展示例

添加一个虚拟 GPS 设备：

```typescript
class VirtualGPSDevice extends VirtualDevice {
  constructor(id = 'vgps-1', name = 'Virtual GPS') {
    super(id, name, DeviceType.GENERIC, 'nmea');
  }

  async connect(): Promise<void> {
    await super.connect();
    this.startEmitting(1000, () => ({
      deviceId: this.id,
      type: 'location',
      timestamp: Date.now(),
      data: {
        latitude: 39.9 + Math.random() * 0.01,
        longitude: 116.4 + Math.random() * 0.01,
        altitude: 50 + Math.random() * 5,
      },
    }));
  }

  async handleCommand(command: DeviceCommand): Promise<DeviceResponse> {
    if (command.type === 'get_position') {
      return {
        success: true,
        data: { latitude: 39.9042, longitude: 116.4074 },
      };
    }
    return { success: false, error: `Unknown command: ${command.type}` };
  }
}

// 接入网关
gateway.addDevice(new VirtualGPSDevice());
// EventBus 自动收到 topic: device.location.data
```
