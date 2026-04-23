# Nuwa OS 架构深度分析与演进方案（v0.0.1 → v0.2）

## 1. 现状架构诊断（基于当前代码）

Nuwa OS 当前已经具备一个清晰的 6 层分层模型：

1. **感知输入层**：`sensor-hal` + `device-gateway`
2. **中枢通信层**：`event-bus`
3. **内核调度层**：`kernel-core`
4. **智能体运行层**：`agent-runtime`
5. **应用与编排层**：`demo-vision-agent`

这套架构的优点：

- 事件驱动、模块解耦，替换某一层成本低。
- 抽象接口边界清楚，测试覆盖相对完整。
- Demo 跑通了“感知 → 思考 → 行动”的最小闭环。

当前短板（MVP 落地视角）：

- **可观测性不足**：没有统一健康信号、吞吐指标、错误指标。
- **运行保障不足**：缺少背压、重试、死信、超时控制等可靠性机制。
- **数据闭环不足**：缺少事件持久化与回放能力，无法做离线分析和回归。
- **控制面不足**：缺少 northbound API（管理、运维、调试入口）。
- **真实设备能力不足**：目前以虚拟设备为主，真实硬件适配尚未标准化。

---

## 2. 最应该优先做什么（优先级判断）

### P0（立刻做）

**建立可观测性与健康诊断基线**，先解决“系统是否在正常工作、哪里出了问题”的问题。

理由：

- 这是后续接入 LLM、真实设备、多 Agent 前的必要基础设施。
- 没有可观测性，后续故障定位会指数级变难。
- 实现成本低，收益高，且不会破坏现有分层。

### P1（下一步）

- 事件可靠性：重试、死信、限流。
- 事件持久化：运行日志 + 回放。
- northbound API：状态查询、组件控制、指标导出。

### P2（随后）

- 接入真实设备协议适配器（RTSP/BLE/MQTT）。
- 引入 LLM/VLM 推理适配层（推理预算、超时策略、降级逻辑）。

---

## 3. MVP 方案目前欠缺项（Checklist）

### 必须补齐

- [ ] `/health` 级别健康状态（boot、kernel、runtime、gateway）。
- [ ] 关键指标：event publish/delivery、handler error、agent processed frames。
- [ ] 故障可定位：至少要能识别“事件发了但没人处理”与“处理器异常”。

### 建议补齐

- [ ] 关键路径延迟指标（sensor→agent action）。
- [ ] 异常分级（warning/error/fatal）。
- [ ] 事件追踪标识（traceId/correlationId）。

### 后续增强

- [ ] 时序存储（Prometheus/OpenTelemetry）。
- [ ] 可视化仪表盘。
- [ ] 自动化告警。

---

## 4. 本次落地内容（已开始执行）

围绕 P0，本次先在 `demo-vision-agent` 完成“最小可观测性闭环”：

1. 在 `SimpleEventBus` 增加运行统计：
   - `publishedEvents`
   - `deliveredEvents`
   - `handlerErrors`
   - `activeSubscriptions`
   - `historySize`
2. 在 `NuwaOS.status()` 增加 `diagnostics` 区块：
   - 健康状态 `healthy/stopped`
   - 关键信号汇总（events + errors + frames）
3. 新增测试覆盖：
   - 验证指标随运行增长
   - 验证运行时 diagnostics 健康状态输出

---

## 5. 三阶段演进路线图（建议）

### 阶段 A：可观测性 MVP（1~2 周）

- 完成统一 metrics schema。
- 增加组件级健康检查。
- 输出结构化日志（JSON）。

### 阶段 B：可靠性 MVP（2~4 周）

- 事件投递重试策略（指数退避）。
- 死信队列（DLQ）与错误追踪。
- 背压与限流机制。

### 阶段 C：生产化（4~8 周）

- northbound API（管理控制面）。
- 事件持久化与回放。
- 多 Agent 协作与资源配额。

---

## 6. 风险与对策

- 风险：指标与主流程耦合过深，影响性能。
  - 对策：指标采集保持 O(1) 原子计数，不做重逻辑。
- 风险：后续协议适配层复杂度陡增。
  - 对策：先定义统一 Adapter Contract，再接入具体协议。
- 风险：LLM 接入导致链路不稳定。
  - 对策：配置超时 + fallback agent + budget 控制。

---

## 7. 结论

Nuwa OS 现阶段最正确的动作是：

> **先把系统“看得见、测得到、定位得了”做出来，再扩展真实设备与模型能力。**

本次改动即为该方向的第一步，目标是把系统从“可运行 Demo”推进到“可运营 MVP”。
