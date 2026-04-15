# @nuwa-os/event-bus

> 女娲 OS 的中枢神经系统 — 基于 Topic 的发布-订阅事件总线

## 架构

```
Publisher                          Subscriber
   │                                   ▲
   │  publish(event)                   │  handler(event)
   ▼                                   │
┌──────────────────────────────────────────┐
│              EventBus                     │
│  ┌─────────────┐  ┌──────────────────┐   │
│  │ Subscriptions│  │  TopicMatcher    │   │
│  │  Map<id,sub> │  │  *.** wildcards  │   │
│  └─────────────┘  └──────────────────┘   │
│  ┌─────────────────────────────────────┐ │
│  │         Event History               │ │
│  │   circular buffer (configurable)    │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

## 核心概念

### NuwaEvent

系统中所有通信的标准数据格式：

```typescript
interface NuwaEvent {
  id: string;           // 唯一标识 (EventBus.generateEventId())
  type: string;         // 事件类型 (sensor, device, agent, system)
  topic: string;        // 路由 topic (sensor.camera.frame)
  timestamp: number;    // 时间戳
  source: string;       // 来源标识
  data: unknown;        // 负载数据
  metadata?: Record<string, unknown>;
  priority?: 'HIGH' | 'NORMAL' | 'LOW';
}
```

### Topic 通配符

| 模式 | 含义 | 示例 |
|------|------|------|
| 精确匹配 | 完全一致 | `sensor.camera.frame` |
| `*` | 匹配单级 | `sensor.*.frame` 匹配 `sensor.camera.frame` |
| `**` | 匹配多级 | `sensor.**` 匹配 `sensor.camera.frame`、`sensor.temperature.reading` |

Topic 命名约定：`{层}.{设备类型}.{数据类型}`

## API

### EventBus

```typescript
const bus = new EventBus({ historyLimit: 1000 });

// 订阅
const subId = bus.subscribe('sensor.camera.**', (event) => {
  console.log('收到摄像头数据:', event.data);
});

// 发布
bus.publish({
  id: EventBus.generateEventId(),
  type: 'sensor',
  topic: 'sensor.camera.frame',
  timestamp: Date.now(),
  source: 'vcam-1',
  data: { frameId: 1, width: 640, height: 480 },
});

// 查询历史
const recent = bus.history(10); // 最近 10 条

// 取消订阅
bus.unsubscribe(subId);

// 清空
bus.clear();
```

### TopicMatcher

```typescript
TopicMatcher.matches('sensor.camera.frame', 'sensor.camera.frame'); // true
TopicMatcher.matches('sensor.camera.frame', 'sensor.*.frame');      // true
TopicMatcher.matches('sensor.camera.frame', 'sensor.**');           // true
TopicMatcher.matches('sensor.camera.frame', 'device.**');           // false
```

## 文件结构

```
src/
├── index.ts           # 统一导出
├── types.ts           # NuwaEvent, EventHandler, Subscription, EventBusOptions
├── topic-matcher.ts   # TopicMatcher — 通配符匹配引擎
└── event-bus.ts       # EventBus — 核心发布-订阅实现
```

## 设计决策

1. **同步发布**：`publish()` 同步调用所有匹配的 handler，保证事件顺序确定性
2. **事件历史**：内置环形缓冲区，方便调试和回溯，通过 `historyLimit` 控制内存
3. **静态 ID 生成**：`EventBus.generateEventId()` 基于计数器，轻量且唯一
4. **错误隔离**：单个 handler 抛异常不影响其他 handler，通过 `onError` 回调处理
