# @nuwa-os/agent-runtime

> 女娲 OS 的灵魂 — Agent 运行时框架

## 架构

```
                    EventBus
                   ╱        ╲
         subscribe           publish
            │                   ▲
            ▼                   │
┌──────────────────────────────────────────┐
│              AgentRuntime                 │
│                                          │
│  ┌─────────────────────────────────┐     │
│  │         AgentContext             │     │
│  │  subscribe / publish / log      │     │
│  └──────────────┬──────────────────┘     │
│                 │                         │
│  ┌──────────────▼──────────────────┐     │
│  │          BaseAgent              │     │
│  │                                 │     │
│  │  onEvent(event)                 │     │
│  │      ↓                          │     │
│  │  percepts[] ← 感知缓冲区       │     │
│  │      ↓ (buffer full / tick)     │     │
│  │  think(percepts)                │     │  ← 可替换插槽
│  │      ↓                          │     │
│  │  AgentAction[]                  │     │
│  │      ↓                          │     │
│  │  executeAction(action)          │     │
│  │    emit → EventBus              │     │
│  │    log  → 日志系统              │     │
│  │    speak → 语音输出             │     │
│  └─────────────────────────────────┘     │
│                                          │
│  ┌─────────────────────────────────┐     │
│  │       AgentProcess              │     │
│  │  adapts Agent → IProcess        │     │
│  │  onTick() → agent.tickThink()   │     │
│  └─────────────────────────────────┘     │
└──────────────────────────────────────────┘
                 │
                 │ registered as IProcess
                 ▼
           Kernel Scheduler
```

## 核心概念

### Perceive-Think-Act 循环

Agent 的核心运作模式，灵感来自经典 AI Agent 架构：

1. **Perceive（感知）**：通过 EventBus 订阅感兴趣的 topic，收到的事件转为 Percept 存入缓冲区
2. **Think（思考）**：缓冲区满或 Kernel tick 时触发 `think(percepts)`，分析感知数据并决策
3. **Act（行动）**：`think()` 返回 `AgentAction[]`，由 `executeAction()` 分发执行

```
事件流入 → onEvent() → percepts[] → think() → actions[] → executeAction()
```

### Agent 状态

```typescript
enum AgentState {
  IDLE = 'idle',          // 初始/已停止
  RUNNING = 'running',    // 运行中，等待感知
  THINKING = 'thinking',  // 正在执行 think()
  ERROR = 'error',        // 异常
}
```

### Agent 动作

```typescript
interface AgentAction {
  type: string;     // 'emit' | 'log' | 'speak' | 自定义
  payload: unknown;
}
```

内置动作类型：
| 类型 | 效果 |
|------|------|
| `emit` | 将 payload 作为事件发布到 EventBus |
| `log` | 输出日志 |
| `speak` | 语音输出（当前为日志，未来接 TTS） |

## API

### BaseAgent

```typescript
class MyAgent extends BaseAgent {
  constructor() {
    super({
      id: 'my-agent',
      name: 'My Agent',
      perceptBufferSize: 10,   // 积累 10 个感知后触发 think
      subscriptions: ['sensor.camera.**', 'device.thermometer.*'],
    });
  }

  async think(percepts: Percept[]): Promise<AgentAction[]> {
    // 分析感知数据，返回动作
    return [
      { type: 'log', payload: `处理了 ${percepts.length} 个感知` },
      { type: 'speak', payload: '环境正常' },
    ];
  }
}
```

### AgentRuntime

```typescript
const runtime = new AgentRuntime(eventBus);

// 注册 Agent（自动创建 Context 并初始化）
await runtime.registerAgent(myAgent);

// 启动所有 Agent
await runtime.startAll();

// 查询
runtime.getAgent('my-agent');
runtime.getAllAgents();
runtime.getContext('my-agent');

// 停止
await runtime.stopAll();
```

### AgentProcess

将 Agent 适配为内核进程：

```typescript
const agentProcess = new AgentProcess(myAgent, 5); // priority: 5

// 注册到内核
kernel.registerProcess(agentProcess);
// 每个 kernel tick 会调用 agentProcess.onTick()
// → 内部调用 agent.tickThink()
// → 触发 think() 并执行返回的 actions
```

### AgentContext

Agent 初始化时自动注入，提供与 OS 交互的能力：

```typescript
interface AgentContext {
  agentId: string;
  subscribe(topic: string, handler: EventHandler): () => void;
  publish(event: Partial<NuwaEvent>): void;
  log(level: string, message: string): void;
  getTime(): number;
}
```

## 文件结构

```
src/
├── index.ts              # 统一导出
├── types.ts              # AgentState, Percept, AgentAction, AgentContext, IAgent
├── base-agent.ts         # BaseAgent — Agent 基类
├── agent-context.ts      # AgentContextImpl — 上下文实现
├── agent-process.ts      # AgentProcess — 内核进程适配器
└── agent-runtime.ts      # AgentRuntime — Agent 管理器
```

## think() 插槽设计

`think()` 是 Agent 的"大脑"，当前为纯规则逻辑，设计为可替换：

```typescript
// 规则型（当前）
async think(percepts) {
  return [{ type: 'speak', payload: 'Scene appears normal.' }];
}

// LLM 型（未来）
async think(percepts) {
  const desc = percepts.map(p => describe(p)).join('\n');
  const resp = await llm.chat([{ role: 'user', content: desc }]);
  return [{ type: 'speak', payload: resp.content }];
}

// 多模态型（未来）
async think(percepts) {
  const frames = percepts.filter(p => p.type === 'sensor');
  const image = framesToImage(frames);
  const resp = await visionModel.analyze(image);
  return parseActions(resp);
}
```

替换 `think()` 不影响 OS 的其他任何层。
