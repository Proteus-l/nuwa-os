# @nuwa-os/demo-vision-agent

> 端到端集成 Demo — 从虚拟摄像头到 Agent 视觉分析的完整数据通路

## 架构

```
┌──────────────────────────────────────────────────────────────┐
│                        NuwaOS.boot()                         │
│                                                              │
│  ┌────────────────┐    ┌───────────────┐                     │
│  │ SimpleVirtual  │    │ SimpleVirtual │                     │
│  │    Camera      │    │ CameraDevice  │                     │
│  │  (200ms/帧)    │    │  (设备层)     │                     │
│  └───────┬────────┘    └──────┬────────┘                     │
│          │ reading             │ onData                       │
│          ▼                     ▼                              │
│  ┌──────────────────────────────────────┐                    │
│  │          SimpleEventBus              │                    │
│  │  sensor.camera.frame                 │                    │
│  │  device.camera.data                  │                    │
│  └──────────────────┬───────────────────┘                    │
│                     │ subscribe                               │
│                     ▼                                         │
│  ┌──────────────────────────────────────┐                    │
│  │          VisionAgent                 │                    │
│  │  onEvent() → percepts[]             │                    │
│  │      ↓ (buffer full / tick)         │                    │
│  │  think(percepts) → AgentAction[]    │                    │
│  │    log / speak / emit               │                    │
│  └──────────────────────────────────────┘                    │
│                     ▲                                         │
│                     │ onTick()                                │
│  ┌──────────────────┴───────────────────┐                    │
│  │          SimpleKernel                │                    │
│  │  100ms tick → 调度所有进程            │                    │
│  └──────────────────────────────────────┘                    │
└──────────────────────────────────────────────────────────────┘
```

## 核心概念

### 为什么用 Simple* 实现？

Demo 包内置了一套简化版的核心组件（SimpleEventBus、SimpleKernel、SimpleBaseAgent 等），原因是：

1. **零跨包依赖**：Demo 可独立运行，不需要先编译其他包
2. **代码自包含**：阅读 Demo 源码即可理解完整数据流，无需跳转到其他包
3. **快速原型**：聚焦核心逻辑，去掉生产级别的错误处理和边界情况
4. **教学目的**：每个 Simple* 类都是对应完整实现的精简版，方便理解

在生产环境中应使用 `@nuwa-os/event-bus`、`@nuwa-os/kernel-core` 等完整实现。

### 完整启动流程

`NuwaOS.boot()` 按以下顺序初始化全栈：

```
1. SimpleEventBus         ← 创建事件总线
2. SimpleSensorRegistry   ← 注册传感器
3. SimpleVirtualCamera    ← 启动摄像头（200ms/帧）
4. 桥接: camera → EventBus (topic: sensor.camera.frame)
5. SimpleVirtualCameraDevice → SimpleDeviceGateway
6. 桥接: gateway → EventBus (topic: device.camera.data)
7. VisionAgent → SimpleAgentRuntime
8. SimpleAgentProcess → SimpleKernel (priority: 5)
9. Kernel.start()         ← 开始 100ms tick 循环
```

关闭时按相反顺序：Kernel → Agent → Gateway → Camera

### 数据流

```
SimpleVirtualCamera (每 200ms 生成一帧)
    │
    ├── reading handler → eventBus.publish({
    │     topic: 'sensor.camera.frame',
    │     data: { frameId, width: 640, height: 480, format: 'rgb24' }
    │   })
    │
SimpleVirtualCameraDevice (每 tick 生成一帧)
    │
    ├── onData handler → eventBus.publish({
    │     topic: 'device.camera.data',
    │     data: DeviceData
    │   })
    │
EventBus
    │
    ├── VisionAgent 订阅 sensor.camera.** 和 device.camera.*
    │
    ▼
VisionAgent.onEvent(event)
    │
    ├── event → Percept → percepts[] 缓冲区
    │
    ▼ (缓冲区满 或 kernel tick 触发)
VisionAgent.think(percepts)
    │
    ├── 统计视觉帧数
    ├── 返回 AgentAction[]
    │     ├── { type: 'log',   payload: '处理了 N 帧' }
    │     ├── { type: 'speak', payload: '场景正常' }
    │     └── { type: 'emit',  payload: { framesAnalyzed, ... } }
    │
    ▼
executeAction(action)
    ├── emit  → eventBus.publish(...)
    ├── log   → console.log(...)
    └── speak → console.log('[speak]', ...)
```

## 组件说明

### SimpleEventBus

事件总线精简版，支持通配符订阅：

```typescript
const bus = new SimpleEventBus();

// 订阅（支持 * 和 ** 通配符）
bus.subscribe('sensor.camera.**', (event) => { ... });

// 发布
bus.publish({
  id: SimpleEventBus.generateEventId(),
  type: 'sensor',
  topic: 'sensor.camera.frame',
  timestamp: Date.now(),
  source: 'vcam-1',
  data: frameData,
});

// 查询历史（最多保留 1000 条）
const recent = bus.history(10);
```

### SimpleKernel

微内核精简版，优先级调度：

```typescript
const kernel = new SimpleKernel(100); // 100ms tick 间隔

kernel.registerProcess(agentProcess);
await kernel.start();   // 开始 tick 循环
await kernel.stop();

console.log(kernel.tick);       // 当前 tick 数
console.log(kernel.isRunning);  // 运行状态
```

### SimpleBaseAgent

Agent 基类，实现感知-思考-行动循环：

```typescript
class MyAgent extends SimpleBaseAgent {
  constructor() {
    super({
      id: 'my-agent',
      name: 'My Agent',
      perceptBufferSize: 5,
      subscriptions: ['sensor.**'],
    });
  }

  async think(percepts: Percept[]): Promise<AgentAction[]> {
    // 子类实现决策逻辑
    return [{ type: 'log', payload: `收到 ${percepts.length} 个感知` }];
  }
}
```

**生命周期**：

```
IDLE → start() → RUNNING → onEvent() → percepts[]
                      ↓
                  tickThink() (kernel tick 触发)
                      ↓
                  THINKING → think(percepts) → actions[]
                      ↓
                  executeAction() → RUNNING
                      ↓
                  stop() → IDLE
```

### VisionAgent

视觉感知 Agent，Demo 的核心：

```typescript
const agent = new VisionAgent('vision-1', 'VisionAgent');

// 订阅: sensor.camera.** 和 device.camera.*
// perceptBufferSize: 5

// think() 逻辑：
// 1. 过滤视觉感知（type === 'sensor' 或包含 data 对象）
// 2. 累计帧计数
// 3. 返回 3 个动作：log + speak + emit

// 统计信息
const stats = agent.getStats();
// { framesProcessed: 24, actionsProduced: 72, state: 'running' }
```

### NuwaOS

一键启动类，编排全栈初始化：

```typescript
const os = new NuwaOS();

// 启动全栈
await os.boot();

// 获取组件引用（用于 demo 可视化）
const eventBus = os.getEventBus();
const agent = os.getVisionAgent();

// 系统状态
const status = os.status();
// { booted, kernelTick, agentState, eventsInHistory, ... }

// 关闭
await os.shutdown();
```

## Demo 运行

### 命令

```bash
# 默认运行 5 秒
npx tsx packages/demo-vision-agent/src/demo.ts

# 自定义运行时长（10 秒）
npx tsx packages/demo-vision-agent/src/demo.ts 10
```

### 实时输出

Demo 通过以下技巧实现实时可视化：

1. **EventBus 钩子**：订阅 `sensor.camera.**` 和 `device.**`，打印彩色帧信息
2. **think() 拦截**：monkey-patch `agent.think()`，在思考前后打印感知数量和动作结果
3. **ANSI 颜色**：Cyan=摄像头, Green=系统, Yellow=语音, Magenta=思考

```
╔══════════════════════════════════════════╗
║        🧠  Nuwa Runtime OS  v0.0.1       ║
╚══════════════════════════════════════════╝

13:20:47.446 Booting Nuwa OS...
13:20:47.446 ✔ Kernel started (tick interval: 100ms)
13:20:47.446 ✔ Virtual Camera connected (200ms/frame)
13:20:47.446 ✔ VisionAgent online

── Live data flow ──

13:20:47.646 [Camera]       frame #1 (640x480)
13:20:47.646 [VisionAgent]  👁 perceived 1 inputs → produced 3 actions
13:20:47.647 [VisionAgent]  💬 "Scene appears normal."
...

── Summary ──

  Kernel ticks:      49
  Events emitted:    48
  Frames processed:  24
  Actions produced:  72
  Agent state:       running

  ✅ All systems verified — full sensor → agent pipeline working!
```

### 验证点

Demo 自动验证以下数据通路：

```
VirtualCamera ──frame──▶ EventBus ──sensor.camera.**──▶ VisionAgent
CameraDevice  ──data───▶ EventBus ──device.camera.*──▶ VisionAgent
                                                          │
                                                    think() → actions

✅ 帧数 > 0 且 动作数 > 0 → 全链路正常
⚠️ 帧数 = 0 或 动作数 = 0 → 数据通路异常
```

## 文件结构

```
src/
├── index.ts              # 统一导出
├── types.ts              # 所有类型定义（NuwaEvent, AgentState, Percept, ...）
├── simple-event-bus.ts   # SimpleEventBus — 事件总线精简版
├── simple-kernel.ts      # SimpleKernel — 微内核精简版
├── simple-sensor.ts      # SimpleSensorRegistry + SimpleVirtualCamera
├── simple-gateway.ts     # SimpleDeviceGateway + SimpleVirtualCameraDevice
├── simple-runtime.ts     # SimpleBaseAgent + SimpleAgentProcess + SimpleAgentRuntime
├── vision-agent.ts       # VisionAgent — 视觉感知 Agent
├── nuwa-os.ts            # NuwaOS — 全栈编排
└── demo.ts               # 实时可视化 Demo 入口
```

## 设计决策

1. **自包含**：所有依赖在包内重新实现，`npm install` 后即可运行，无编译顺序要求
2. **think() 可观测**：Demo 通过拦截 think() 方法实现实时可视化，不修改 Agent 代码
3. **可配置时长**：CLI 参数控制运行秒数，方便快速验证和长时间观察
4. **自动验证**：运行结束自动检查数据通路完整性，输出 pass/fail 结果
