# 女娲 Runtime OS (Nuwa OS)

> 赋予 AI Agent 感知物理世界的能力

<p align="center">
  <strong>当你把这个 Runtime OS 接入到一个摄像头时，Agent 有视觉感知；接入到智能温控时，Agent 有体感温度；接入到车的中控，Agent 有奔驰的感觉。</strong>
</p>

---

## 概述

女娲 (Nuwa) 是一个云端 Runtime OS，将 AI Agent 作为操作系统的应用层，通过传感器和设备抽象层为 Agent 提供来自物理世界的环境输入。

现有的通用 Agent 只能接受人类的 prompt 输入，缺乏对物理世界的感知。而任何设备上的操作系统，因为有传感器和外设，都具备物理世界的环境输入能力。女娲正是基于这一理念构建——让 Agent 拥有"感官"。

## 架构

```
┌─────────────────────────────────────────────────┐
│                  Agent Apps                      │  ← VisionAgent, 自定义 Agent...
│            think(percepts) → actions             │
├─────────────────────────────────────────────────┤
│               Agent Runtime                      │  ← 感知-思考-行动 循环
│        subscribe → perceive → think → act        │
├─────────────────────────────────────────────────┤
│                Kernel Core                       │  ← 事件循环 + 进程调度
│          EventLoop → Scheduler → Process         │
├─────────────────────────────────────────────────┤
│                 Event Bus                        │  ← 全局 pub/sub，wildcard topic
│        publish() / subscribe(topic, handler)     │
├──────────────────────┬──────────────────────────┤
│     Sensor HAL       │    Device Gateway         │  ← 传感器/设备数据输入
│  Camera, Thermo...   │  VirtualCamera, ...       │
└──────────────────────┴──────────────────────────┘
```

**数据流：**

```
物理设备/虚拟设备
    ↓ 产生原始数据
Sensor HAL / Device Gateway
    ↓ 标准化为 NuwaEvent
Event Bus (topic: sensor.camera.frame, device.camera.data, ...)
    ↓ 按 topic 路由
Agent Runtime → Agent.onEvent() → percept 缓冲区
    ↓ Kernel tick 触发
Agent.think(percepts) → AgentAction[]
    ↓ 分发执行
emit → Event Bus / log → 日志 / speak → 语音输出
```

## 模块

| 包名 | 职责 | 测试 |
|------|------|------|
| [`@nuwa-os/event-bus`](packages/event-bus/) | 发布-订阅事件总线，支持 `*` 和 `**` 通配符 | 49 |
| [`@nuwa-os/kernel-core`](packages/kernel-core/) | 事件循环、进程调度器、系统时钟 | 55 |
| [`@nuwa-os/sensor-hal`](packages/sensor-hal/) | 传感器硬件抽象层，虚拟摄像头/温度计 | 53 |
| [`@nuwa-os/agent-runtime`](packages/agent-runtime/) | Agent 运行时框架，感知-思考-行动循环 | 45 |
| [`@nuwa-os/device-gateway`](packages/device-gateway/) | 设备接入网关，命令/数据双向通信 | 62 |
| [`@nuwa-os/demo-vision-agent`](packages/demo-vision-agent/) | 端到端集成 Demo，视觉感知 Agent | 29 |

**总计：293 tests，TypeScript strict mode，零编译错误。**

## 快速开始

```bash
# 克隆仓库
git clone https://code.byted.org/liuhuan.2021/nuwa-os.git
cd nuwa-os

# 安装依赖
npm install

# 运行 Demo（默认 5 秒，可自定义）
npx tsx packages/demo-vision-agent/src/demo.ts        # 5 秒
npx tsx packages/demo-vision-agent/src/demo.ts 10      # 10 秒

# 运行全量测试
npm test

# 类型检查
npm run typecheck
```

### Demo 输出示例

```
╔══════════════════════════════════════════╗
║        🧠  Nuwa Runtime OS  v0.0.1       ║
╚══════════════════════════════════════════╝

13:20:47.446 Booting Nuwa OS...
13:20:47.446 ✔ Kernel started (tick interval: 100ms)
13:20:47.446 ✔ Virtual Camera connected (200ms/frame)
13:20:47.446 ✔ VisionAgent online (subscribed: sensor.camera.**, device.camera.*)

── Live data flow (running 5s) ──

13:20:47.646 [Camera]       frame #1 (640x480)
13:20:47.646 [VisionAgent]  👁 perceived 1 inputs → produced 3 actions
13:20:47.647 [VisionAgent]  💬 "I can see 1 new frames. Scene appears normal."
13:20:47.846 [Camera]       frame #2 (640x480)
13:20:47.846 [VisionAgent]  👁 perceived 1 inputs → produced 3 actions
...

── Summary ──

  Kernel ticks:      49
  Events emitted:    48
  Frames processed:  24
  Actions produced:  72
  Agent state:       running

── Data Flow Verified ──

  VirtualCamera ──frame──▶ EventBus ──sensor.camera.**──▶ VisionAgent
  CameraDevice  ──data───▶ EventBus ──device.camera.*──▶ VisionAgent
                                                           │
                                                     think() → actions

  ✅ All systems verified — full sensor → agent pipeline working!
```

## 项目结构

```
nuwa-os/
├── package.json              # npm workspaces 根配置
├── tsconfig.base.json        # 共享 TypeScript 配置
├── changelog/                # 版本变更日志
│   └── v0.0.1.md
├── packages/
│   ├── event-bus/            # 事件总线
│   │   ├── src/
│   │   ├── __tests__/
│   │   └── docs/
│   ├── kernel-core/          # 内核
│   │   ├── src/
│   │   ├── __tests__/
│   │   └── docs/
│   ├── sensor-hal/           # 传感器抽象层
│   │   ├── src/
│   │   ├── __tests__/
│   │   └── docs/
│   ├── agent-runtime/        # Agent 运行时
│   │   ├── src/
│   │   ├── __tests__/
│   │   └── docs/
│   ├── device-gateway/       # 设备网关
│   │   ├── src/
│   │   ├── __tests__/
│   │   └── docs/
│   └── demo-vision-agent/    # 集成 Demo
│       ├── src/
│       ├── __tests__/
│       └── docs/
```

## 设计理念

### 1. 模块化 & 可替换

每个包独立、零外部依赖、类型自包含。替换虚拟摄像头为真实 RTSP 摄像头，只需实现 `ISensor<CameraFrameData>` 接口，其他层无感。

### 2. 事件驱动解耦

所有组件通过 Event Bus 通信，topic 格式 `{layer}.{type}.{detail}`：
- `sensor.camera.frame` — 摄像头帧数据
- `device.thermometer.data` — 温度计读数
- `agent.vision-agent-1.action` — Agent 动作输出

### 3. Perceive-Think-Act 循环

Agent 不是被动等 prompt，而是持续感知环境：

```typescript
// Agent 自动订阅感兴趣的 topic
subscribeTo('sensor.camera.**');

// 事件来了 → 放入感知缓冲区
onEvent(event) → percepts.push(...)

// Kernel tick 触发思考
think(percepts) → AgentAction[]

// 执行动作
executeAction(action) → emit / log / speak
```

### 4. 可插拔的 think()

当前 `think()` 是纯规则逻辑（不需要 API key），但设计为可替换插槽。接入 LLM：

```typescript
async think(percepts: Percept[]): Promise<AgentAction[]> {
  const frames = percepts.map(p => describeFrame(p.data));
  const response = await llm.chat({
    messages: [{ role: 'user', content: `你看到了:\n${frames.join('\n')}` }]
  });
  return [{ type: 'speak', payload: response.content }];
}
```

OS 的其他五层完全不用动。

## 技术栈

- **语言**：TypeScript 5.4+ (strict mode)
- **运行时**：Node.js 18+
- **测试**：Vitest 1.6+ (`--pool=forks`)
- **包管理**：npm workspaces (monorepo)
- **构建**：tsc --noEmit (类型检查)

## Roadmap

- [x] v0.0.1 — 核心架构 + 6 层模块 + 虚拟设备 + Demo
- [ ] v0.1.0 — 接入 LLM API (豆包 Vision / GPT-4V)，Agent 真正"看懂"画面
- [ ] v0.2.0 — 真实设备适配器 (RTSP 摄像头、BLE 温度计)
- [ ] v0.3.0 — 多 Agent 协作，Agent 间通过 Event Bus 交互
- [ ] v0.4.0 — 持久化层 (Agent 记忆、事件日志)
- [ ] v1.0.0 — 生产就绪，完整设备生态

## License

MIT
