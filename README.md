# 女娲 Runtime OS (Nuwa OS)

> 为 AI Agent 提供身体、感官与运行时的 Agent Runtime OS

当你把这个 Runtime OS 接入摄像头，Agent 有视觉感知；接入温控，Agent 有体感温度；接入车的中控，Agent 有奔驰的感觉。

---

## 概述

女娲是一个 Agent Runtime OS，将 AI Agent 作为操作系统的应用层，通过感知、记忆、人格、应用适配等运行时模块，连接任意 AI Agent 与任意物理外设。

---

## 架构

```
   ┌──────────────────────────────────────────────────┐
   │                用户 / 外部世界                   │
   └──────────────────────────────────────────────────┘
                       ▲        ▼

  ╭──────────────────────────────────────────────────╮
  │  应用层  App Adapters                  [S3 📋]   │
  │  视觉 · 温度 · 对话 · ...                        │
  ╞══════════════════════════════════════════════════╡
  │  人格层  Persona                       [S3 📋]   │
  │  多人格 YAML · Registry · Engine                 │
  ╞══════════════════════════════════════════════════╡
  │  记忆层  Memory                        [S2 📋]   │
  │  短期 ring buffer · 长期 JSONL + adapter         │
  │  persona scope · user scope                      │
  ╞══════════════════════════════════════════════════╡
  │  大脑  SpiritAgent（通用 LlmAgent）    [S3 📋]   │
  │  LlmClient（MockLlmClient 默认）       [S2 📋]   │
  ╞══════════════════════════════════════════════════╡
  │  感知翻译  Perception Pipeline         [S2 📋]   │
  │  raw event → Observation(text)                   │
  │  Camera · Thermal · Audio translator             │
  ╞══════════════════════════════════════════════════╡
  │  能力感知  Capability Registry   ✅ [S1 完成]    │
  │  Modality 语义视图 · attach/detach 上 bus        │
  ╞══════════════════════════════════════════════════╡
  │  Agent 运行时  agent-runtime     🟡 [S1 扩展]    │
  │  onCapabilityChange 钩子 · getCapabilities 查询  │
  ╰──────────────────────────────────────────────────╯

                      底层管道
           event-bus · kernel-core · sensor-hal · device-gateway

   图例：⚪ v0.0.1    ✅ S1 新增    🟡 S1 扩展    📋 规划中
```

---

## 模块

| 包 | 层 | 状态 |
|---|---|---|
| [`@nuwa-os/agent-runtime`](packages/agent-runtime/) | Agent 运行时 | 🟡 S1 扩展 |
| [`@nuwa-os/capability-registry`](packages/capability-registry/) | 能力感知 | ✅ S1 新增 |
| `@nuwa-os/perception` | 感知翻译 | 📋 S2 |
| `@nuwa-os/memory` | 记忆 | 📋 S2 |
| `@nuwa-os/persona` | 人格 | 📋 S3 |
| `@nuwa-os/app-adapter` | 应用层 | 📋 S3 |
| `@nuwa-os/spirit-agent` | 器灵本体 | 📋 S3 |
| [`@nuwa-os/demo-vision-agent`](packages/demo-vision-agent/) | v0.0.1 demo | ⚪ |

<details>
<summary>底层管道</summary>

| 包 | 职责 |
|---|---|
| [`@nuwa-os/event-bus`](packages/event-bus/) | 全局 pub/sub，通配符 topic |
| [`@nuwa-os/kernel-core`](packages/kernel-core/) | 事件循环 · 进程调度 |
| [`@nuwa-os/sensor-hal`](packages/sensor-hal/) | 传感器硬件抽象 |
| [`@nuwa-os/device-gateway`](packages/device-gateway/) | 设备接入网关 |

</details>

---

## Roadmap（按 Slice 交付）

| Slice | 内容 | 状态 |
|---|---|---|
| **S1** · 能力感知 | capability-registry + agent-runtime 钩子 | ✅ 完成 |
| **S2** · 感知 & 记忆 | perception + memory（JSONL）+ MockLlmClient | 📋 下一步 |
| **S3** · 人格 & 器灵 | persona + app-adapter + spirit-agent | 📋 |
| **S4** · 完整剧本 | demo-spirit-transition 端到端集成 demo | 📋 |

后续大版本：
- **v0.2** — 真实硬件适配器（RTSP、BLE 等）
- **v0.3** — 多器灵共存
- **v1.0** — 生产就绪

---

## 快速开始

```bash
git clone https://code.byted.org/liuhuan.2021/nuwa-os.git
cd nuwa-os
npm install

# 运行 v0.0.1 的视觉 demo
npx tsx packages/demo-vision-agent/src/demo.ts

# 全量测试 & 类型检查
npm test
npm run typecheck
```

---

## 技术栈

TypeScript 5.4+（strict） · Node.js 18+ · Vitest · npm workspaces

---

## License

MIT
