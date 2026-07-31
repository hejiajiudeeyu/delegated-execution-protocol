私有能力网络 MVP 架构决策（A-01 ~ A-04）与四轴状态模型

> 英文版：[mvp-architecture-decisions.md](mvp-architecture-decisions.md)
> 说明：中文文档为准。

# 私有能力网络 MVP 架构决策（A-01 ~ A-04）与四轴状态模型

- 状态：**owner 已批准**（2026-07-31），作为 MVP 基线
- 来源 PRD：`CALL ANYTHING 下一阶段产品需求文档 v1.0`（2026-07-16 战略冻结版）
- 决策授权记录：四仓 `.trellis/tasks/07-17-call-anything-private-capability-network-mvp/decisions.md`
- 适用里程碑：M1（A-01/A-02/A-03）、M1–M3（A-04）
- 本文只定义 **Client 与 Platform 必须共同理解的语义**。字段名、表名、API 路径、存储技术不在此冻结，属各 owning repo 实现细节。

## 为什么这些决策必须先落在协议层

这四项都不是某一侧能单独决定的：artifact 描述符要跨仓传递、Provider 连接模型决定谁先发起、重启对账需要双方对"未知态"有一致解释、状态轴决定哪些语义是共享真相。若任其在实现中各自长出来，会出现两套互不兼容的隐式契约——这正是当前 `request.status` 单一状态把执行/交付/验收/资金四件事混在一起的成因。

---

## A-01 Artifact 数据通道

**决策**：Platform 管理 artifact 的**元数据与授权**，字节走 **S3 兼容对象存储**；官方 Compose 可内置 MinIO。协议只承载描述符，永不承载 bucket key 或预签名 URL。

**协议承载的最小描述符语义**：

| 语义 | 说明 |
|---|---|
| artifact 标识 | 在一次 Call 内稳定、可被 Delivery 引用 |
| 角色 | `input` / `output` / `evidence` |
| 媒体类型与大小 | 用于接收侧预检与限额 |
| checksum | 算法 + 值；**校验不通过绝不可标记 delivered**（NFR-R03） |
| 有效期 | 授权窗口；过期后描述符不再可换取字节 |
| 生命周期状态 | 已分配 / 已提交 / 已过期 / 已删除（删除后留 tombstone） |

**不进协议**：bucket 名、对象 key、预签名 URL、存储后端类型、重传分片策略。这些是 Platform 私有实现，写进协议等于把存储选型焊死在跨仓契约上。

**推荐流转**：分配受限槽位 → 直传字节 → 提交 hash/size → Relay 只送描述符 → 接收侧凭授权下载 → 输出走反向路径 → 全部校验通过后 Delivery Integrity 才转 `verified`。

**理由**：Relay 传字节会让消息通道同时承担大文件传输与重传语义，是 PRD 风险 R2 点名的瓶颈；且当前 Relay 尚无鉴权（见安全前置）。分离元数据与字节让两者各自演进。

---

## A-02 Provider 连接模型

**决策**：**带鉴权的 Relay Inbox + Provider 侧发起的 HTTPS 长轮询**，配可见性租约（visibility lease）、幂等租约 ACK、退避与抖动。

**要点**：

- Provider **不开放入站端口**——设备在 NAT/办公网内也能接入，这是"公网跨设备"的前提。
- **连接在线不等于健康**：长轮询连接存在不可替代心跳（FR-003）。容量、维护窗口、版本仍由心跳上报。
- 租约语义：消息被取走后进入不可见窗口；ACK 幂等；超时未 ACK 则重新可见。**重新可见不等于可以重跑任务**——是否重跑由 A-03 的可恢复性等级决定。

**前置安全条件（硬门槛）**：当前 transport-relay 六路由无鉴权，且公网边缘曾直接反代（2026-07-31 已在 Caddy 与生产 nginx 双侧撤下，仅留 healthz）。**在 relay 鉴权落地前，任何私有文档或证据不得进入该通道**。M1 的真实数据测试以此为前置。

**理由**：备选的"Platform 主动推送到 Provider"要求设备可入站，直接违背私有设备场景；WebSocket 常连在断线重连与幂等上并不比长轮询省事，却增加边缘代理复杂度。

---

## A-03 重启与对账

**决策**：由 **HotlineVersion 声明可恢复性等级**，Platform 按等级决定资金与终态：

| 等级 | 语义 | 重启后行为 |
|---|---|---|
| `non_recoverable`（默认） | 不可安全重跑 | 进入明确失败终态并退款，**绝不自动重跑** |
| `restartable` | 可从头安全重跑 | 幂等重投同一 Call，不重复 hold |
| `checkpointed` | 可从检查点续跑 | 凭本地 journal 续跑；P0 只要求安全收口，续跑能力属 P1 |

**关键约束**：**任何"执行结果未知"的 RUNNING 任务都不得自动结算，也不得盲目重跑**（PRD Flow E）。未知态必须收敛为"恢复"或"明确终态"二者之一，不允许永久静默 pending（NFR-R01）。

**恢复证明（MVP 形态）**：Provider 侧维护 append-only 本地任务 journal（`attempt_id`、`boot_id`、状态迁移序列、检查点/输出清单摘要），重启后提交**签名对账报告**。本阶段不要求 TPM 或远程证明。

**职责分工**：Client 拥有本地 journal 与恢复执行；Platform 拥有对账判定与资金阻断/退款。

---

## A-04 共享状态边界（协议真相 vs 平台私有）

**决策**：协议定义**四条正交状态轴、合法迁移、跨仓对象/事件与资金错误语义**；Platform 存储 append-only 的 Call 事件与投影。

**属于协议真相**：四轴状态取值与合法迁移、Call/HotlineVersion/Artifact/Delivery 的跨仓标识与绑定关系、终态定义、资金错误码语义（余额不足、重复操作、不变量冲突）。

**属于平台私有**：Relay 租约、调度器任务、重试计数、对象存储 key、Console 过滤器与分页、审计投影、UI 状态。

### 四轴状态模型（canonical）

PRD 的核心洞见：**执行成功 ≠ 交付完整 ≠ Caller 接受 ≠ 账本已结算**。四者是正交维度，不得压进单一 status。

| 轴 | 取值 |
|---|---|
| Execution | `submitted` / `accepted` / `rejected` / `queued` / `executing` / `delivered` / `failed` / `timed_out` / `canceled` |
| Delivery Integrity | `pending` / `verified` / `invalid` |
| Acceptance | `not_started` / `pending` / `accepted` / `revision_requested` / `disputed` / `auto_accepted` |
| Settlement | `none` / `held` / `blocked` / `settled` / `refunded` |

### 规范化裁定（消除 PRD 内部冲突）

源 PRD 刻意留白，但以下冲突必须显式裁定，不能在实现中偶然编码：

1. **`delivered` 的含义收窄**：Execution 轴的 `delivered` **仅表示"Responder 已提交结果字节"**，不表示交付有效。是否有效由 Delivery Integrity 轴独立表达。二者合流是 FR-030 最危险的读法。
2. **`submitted` / `rejected` 的归属**：`submitted` 是 Execution 轴初始态；`rejected` 是**执行前拒绝**（FR-021），与 Delivery Integrity 的 `invalid` 不同源，二者不可互相替代。
3. **验收时钟起点**：**仅当 Delivery Integrity 转 `verified` 时**验收窗口才开始计时（FR-044），不因 Responder 提交字节而起算。一次修订后重新起算。
4. **终态定义**：Execution 终态 = `rejected` / `failed` / `timed_out` / `canceled` / （`delivered` 且 Acceptance 已终结）。**任何 Call 必须在 timeout + grace 内到达终态**（NFR-R01、护栏指标）。

### 合法迁移（Execution 轴）

```
submitted ─→ accepted ─→ queued ─→ executing ─→ delivered
    │           │           │          │
    │           │           │          └─→ failed / timed_out / canceled
    │           │           └─→ failed / timed_out / canceled
    │           └─→ canceled
    └─→ rejected
```

- `rejected` 只能由 `submitted` 到达，且**不产生 hold**（FR-050）。
- `delivered` 之后不再有 Execution 迁移；后续语义全部发生在 Delivery/Acceptance/Settlement 轴。
- 取消的允许阶段由 Platform 策略定义，但**已 `delivered` 的 Call 不可取消**，只能走验收/争议路径。

### 轴间联动（资金迁移矩阵）

| 触发 | Delivery | Acceptance | Settlement |
|---|---|---|---|
| 执行前拒绝 | — | — | `none`（不曾 hold） |
| 接受任务 | `pending` | `not_started` | `held` |
| 校验失败 | `invalid` | 不启动 | `refunded` |
| 校验通过 | `verified` | `pending`（窗口起算） | `held` |
| Caller 接受 | `verified` | `accepted` | `settled` |
| 窗口超时 | `verified` | `auto_accepted` | `settled` |
| 请求修订 | `verified` | `revision_requested` | `held`（沿用原 hold，不新增） |
| 发起争议 | `verified` | `disputed` | `blocked` |
| 争议裁定 | `verified` | `accepted` 或 `disputed` 终结 | `settled` 或 `refunded` |
| 不可恢复失败 / 超时 | `pending` 或 `invalid` | 不启动 | `refunded` |

**Exactly-once 要求**（NFR-R04）：`held` / `settled` / `refunded` 每个 Call 各至多发生一次。实现需要幂等键作用域、事件身份、重放/冲突行为与事务边界——"exactly-once"这个词本身不是设计，M3 需给出显式方案与崩溃/重试测试。

---

## 对现状的差距（供 M1 拆解）

| 现状 | 差距 |
|---|---|
| 单一 `request.status` + billing 事件 | 需拆为四条独立轴与事件投影 |
| 结果签名 + 输出 checksum 已实现 | 缺"冻结 schema 校验"与独立持久化的 Delivery Integrity 状态 |
| Relay 收发件箱 + 去重 + ACK | 缺鉴权、可见性租约、容量与维护状态 |
| 输出 artifact hash 与附件绑定 | 缺跨设备输入上传、生命周期授权、可恢复传输 |
| 结算跟随执行完成 | 缺验收门、争议冻结、修订经济、崩溃安全多分录事务 |

## 未在本文冻结

档位定价、验收窗口具体数值、保留期具体天数、抽成规则——属产品策略，见平台仓 `docs/planned/design/mvp-policy-decisions.zh-CN.md`（A-05/A-06/A-07）。
