# @nuwa-os/kernel-core

> 女娲 OS 的心脏 — 事件循环、进程调度与系统时钟

## 架构

```
                    ┌─────────────────┐
                    │   SystemClock    │
                    │  timeScale/pause │
                    └────────┬────────┘
                             │ now()
                             ▼
┌──────────────────────────────────────────┐
│              EventLoop                    │
│                                          │
│  setInterval(tickInterval)               │
│       │                                  │
│       ▼                                  │
│  ┌──────────┐    ┌───────────────────┐   │
│  │ tick++   │───▶│    Scheduler      │   │
│  └──────────┘    │                   │   │
│                  │  getReadyProcesses│   │
│                  │  (sorted by prio) │   │
│                  └───────┬───────────┘   │
│                          │               │
│            ┌─────────────┼─────────────┐ │
│            ▼             ▼             ▼ │
│       Process A    Process B    Process C│
│       (prio: 1)    (prio: 5)   (prio:10)│
│       onTick()     onTick()    onTick() │
└──────────────────────────────────────────┘
```

## 核心概念

### 进程 (IProcess)

内核管理的最小执行单元。所有需要周期性执行的组件（Agent、设备网关等）都包装为 Process：

```typescript
interface IProcess {
  readonly id: string;
  readonly name: string;
  priority: number;        // 数字越小优先级越高
  state: ProcessState;     // READY | RUNNING | BLOCKED | TERMINATED
  onStart(): Promise<void>;
  onStop(): Promise<void>;
  onTick(tick: number): Promise<void>;
}
```

### 进程状态机

```
  READY ──onStart()──▶ RUNNING ──onStop()──▶ TERMINATED
                         │   ▲
                  block() │   │ unblock()
                         ▼   │
                       BLOCKED
```

### Tick 驱动模型

内核以固定间隔（默认 100ms）执行 tick。每个 tick：
1. tick 计数器 +1
2. 调度器按优先级排序所有 RUNNING 状态的进程
3. 依次调用每个进程的 `onTick(tick)`

## API

### SystemClock

```typescript
const clock = new SystemClock();
clock.start();

clock.now();           // 当前时间 (受 timeScale 影响)
clock.elapsed();       // 启动后经过的时间

clock.timeScale = 2.0; // 2 倍速
clock.pause();          // 暂停
clock.resume();         // 恢复
clock.reset();          // 重置
```

### Scheduler

```typescript
const scheduler = new Scheduler();

// 注册进程
scheduler.register(agentProcess);    // priority: 5
scheduler.register(gatewayProcess);  // priority: 3

// 获取就绪进程（按优先级排序）
const ready = scheduler.getReadyProcesses();
// → [gatewayProcess (3), agentProcess (5)]

scheduler.unregister('proc_agent');
```

### EventLoop

```typescript
const loop = new EventLoop(scheduler, {
  tickInterval: 100,   // 100ms per tick
});

loop.start();          // 开始事件循环
loop.isRunning;        // true
loop.tick;             // 当前 tick 数
loop.stop();           // 停止
```

### BaseProcess

```typescript
class MyProcess extends BaseProcess {
  constructor() {
    super('my-proc', 'MyProcess', 5); // id, name, priority
  }

  async onTick(tick: number): Promise<void> {
    // 每个 tick 执行的逻辑
  }
}
```

## 文件结构

```
src/
├── index.ts          # 统一导出
├── types.ts          # ProcessState, IProcess
├── system-clock.ts   # SystemClock — 可控时钟
├── base-process.ts   # BaseProcess — 进程基类
├── scheduler.ts      # Scheduler — 优先级调度器
└── event-loop.ts     # EventLoop — 核心事件循环
```

## 设计决策

1. **优先级调度**：数字越小越先执行。设备网关（priority 3）先于 Agent（priority 5），确保 Agent 总能拿到最新数据
2. **Tick 而非事件**：内核用固定 tick 驱动而非事件驱动，保证确定性和可调试性
3. **进程适配器模式**：Agent 和 Gateway 自身不是 Process，而是通过 AgentProcess / GatewayProcess 适配，职责分离
4. **SystemClock 解耦**：支持 timeScale 和 pause，便于测试和 debug
