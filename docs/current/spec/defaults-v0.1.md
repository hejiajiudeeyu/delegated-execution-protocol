# Defaults v0.1（建议冻结参数）

用途：在编码前一次性冻结关键参数，避免 Caller 端、Responder 端、服务端实现分叉。

状态说明：
- `FROZEN`：已确认并冻结（v0.1）

更新时间：2026-03-05

补充约束（模式演进）：
- `L0-L3` 应被视为同一系统的可选运行模式，而不是四套不同协议实现。
- 模式切换只允许改变 controller 间通信拓扑、relay / mailbox / network 边界与 transport adapter 装配方式。
- 模式切换不得改变核心协议语义、请求/结果结构、状态机迁移规则、ACK 语义与幂等规则。

## 1) 请求与超时

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `ack_deadline_s` | `120` | FROZEN | Caller 发单后等待 ACK 的最大时长（含 transport 投递延迟） |
| `soft_timeout_s` | `90` | FROZEN | 软超时，触发告警或降级 |
| `hard_timeout_s` | `300` | FROZEN | 硬超时，Caller 终止等待并记超时 |
| `timeout_confirmation_mode` | `ask_by_default` | FROZEN | 达到 `soft_timeout_s` 时默认先询问 Caller Agent 是否继续等待 |
| `hard_timeout_auto_finalize` | `true` | FROZEN | 达到 `hard_timeout_s` 且未明确继续等待时自动终态 `TIMED_OUT` |
| `caller_controller_poll_interval_active_s` | `5` | FROZEN | Caller Agent 轮询 Controller 的活跃期间隔（前 30 秒） |
| `caller_controller_poll_interval_backoff_s` | `15` | FROZEN | Caller Agent 轮询 Controller 的退避间隔（30 秒后） |
| `max_retry_attempts` | `2` | FROZEN | 最大重试次数（总尝试数=3）。规划参数，当前未实现重试逻辑 |
| `retry_backoff` | `exponential + jitter` | FROZEN | 重试退避策略。规划参数，当前未实现 |
| `delivery_observation_window_s` | `60` | FROZEN | transport 投递观测窗口，用于超时分层计算。规划参数，当前未实现 |

## 2) Token 与安全

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `token_ttl_seconds` | `300` | FROZEN | 任务 token 有效期（当前实现默认 5 分钟） |
| `token_min_ttl_seconds` | `300` | FROZEN | v0.1 最短建议有效期 |
| `token_max_ttl_seconds` | `300` | FROZEN | v0.1 当前冻结为单一 TTL |
| `result_signature_algorithm` | `Ed25519` | FROZEN | 结果包签名算法 |
| `responder_token_validation_mode` | `online_introspect_required` | FROZEN | Responder 校验 token 统一走 `POST /v1/tokens/introspect` |
| `idempotency_window_hours` | `24` | FROZEN | `request_id` 去重窗口。规划参数，当前未实现显式窗口清理 |
| `introspect_sla_p99_ms` | `200` | FROZEN | introspect 接口 P99 延迟目标 |
| `introspect_cache_ttl_s` | `30` | FROZEN | introspect 结果缓存 TTL。规划参数，当前未实现缓存 |

## 3) 心跳与可用性

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `heartbeat_interval_s` | `30` | FROZEN | Responder 心跳上报间隔 |
| `degraded_threshold_s` | `90` | FROZEN | 超过该值进入 `degraded` |
| `offline_threshold_s` | `180` | FROZEN | 超过该值进入 `offline` |
| `catalog_health_cache_ttl_s` | `60` | FROZEN | Caller 读取健康状态缓存 TTL。规划参数，当前未实现 |

## 4) 目录与路由

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `catalog_cache_ttl_s` | `300` | FROZEN | Caller 目录缓存 TTL。规划参数，当前未实现 |
| `catalog_default_status_filter` | `enabled` | FROZEN | 默认过滤已启用条目 |
| `catalog_default_availability_filter` | `healthy` | FROZEN | 默认只选健康 responder |
| `routing_fallback_policy` | `retry_once_then_switch_responder` | FROZEN | ACK 超时后路由策略 |
| `catalog_import_mode` | `on_demand_immediate` | FROZEN | 目录按需即时导入 |
| `responder_hotline_binding_mode` | `platform_import_association` | FROZEN | hotline 与 responder 关系由平台导入时建立 |
| `template_delivery_mode` | `platform_api_bundle` | FROZEN | Caller 通过平台 API 拉取模板包，不直接读取仓库目录 |
| `catalog_expose_task_delivery_address` | `false` | FROZEN | 目录批量查询不返回 request-scoped `task_delivery/result_delivery` |
| `delivery_meta_mode` | `request_scoped` | FROZEN | 通过 `POST /v1/requests/{request_id}/delivery-meta` 单次下发 |
| `delivery_meta_ttl_seconds` | `300` | FROZEN | 投递元数据有效期（与 token TTL 对齐） |

## 5) 指标与展示

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `metrics_windows` | `24h,7d` | FROZEN | 默认指标窗口 |
| `mvp_display_metrics` | `call_volume,success_rate,timeout_rate,schema_compliance_rate,p95_exec_ms` | FROZEN | MVP 对外展示硬指标 |
| `caller_event_required` | `caller.request.dispatched,caller.request.acked,caller.request.succeeded,caller.request.timed_out,caller.request.unverified,caller.request.failed` | FROZEN | Caller 最小事件集 |
| `responder_event_required` | `responder.task.received,responder.task.rejected,responder.task.succeeded,responder.task.timed_out` | FROZEN | Responder 最小事件集 |

说明：
- `POST /v1/metrics/events` 建议在 L0 实现最小接收能力。
- `GET /v1/metrics/summary` 属于可延后增强，不阻塞 L0 协议闭环。

## 6) 版本与兼容

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `contract_version` | `0.1.0` | FROZEN | 合约版本 |
| `result_version` | `0.1.0` | FROZEN | 结果包版本 |
| `api_version_prefix` | `/v1` | FROZEN | 控制面 API 路径版本 |
| `compat_policy` | `additive-only` | FROZEN | 仅追加字段，不破坏旧语义 |
| `request_event_scope_v0_1` | `ACKED_completed_failed` | FROZEN | v0.1 实现 `ACKED` 与 Responder 完成态观测事件 `COMPLETED/FAILED`，不实现 `RUNNING/PROGRESS` |
| `platform_storage_backend` | `PostgreSQL` | FROZEN | 服务端主存储选型 |
| `api_auth_mode` | `api_key` | FROZEN | 控制面 API 鉴权方式 |
| `identity_onboarding_mode` | `register_caller_default_then_activate_responder_on_remote_hotline_onboarding` | FROZEN | 用户注册后默认 caller；responder 角色在 remote hotline onboarding/导入后激活 |
| `responder_identity_cardinality` | `one_responder_per_user` | FROZEN | v0.1 一个 user 仅绑定一个 responder_id |
| `catalog_submission_mode` | `platform_onboarding_api_with_dual_admin_review` | FROZEN | 当前通过 `POST /v2/hotlines` 提交 responder/hotline，上架前要求 responder 与 hotline 双审批 |

## 6.1) 服务条款（档位 / 隐私 / 履约模式）

FR-011 / FR-012 与 owner 决策 D8.2。三项都写在 Hotline 契约里，随冻结版本一起进 Call 快照。
M2 只让它们「说得出、冻得住」；验收窗真正开始生效在 M3——在那之前没有可失败的地方。

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `service_tier` | `quick` \| `standard` \| `deep` | PROVISIONAL | 未声明按 `standard` 解析；不写入既有记录 |
| `acceptance_window_s`(quick) | `86400` | PROVISIONAL | A-05 |
| `acceptance_window_s`(standard) | `259200` | PROVISIONAL | A-05 网络默认 72h |
| `acceptance_window_s`(deep) | `604800` | PROVISIONAL | A-05 |
| `acceptance_window_min_s` | `86400` | PROVISIONAL | 显式声明的窗口下界 |
| `acceptance_window_max_s` | `604800` | PROVISIONAL | 显式声明的窗口上界 |
| `privacy_mode` | `supervised` | PROVISIONAL | 本阶段唯一可运行的模式 |
| `fulfillment_mode` | `auto` \| `confirm` | PROVISIONAL | 未声明按 `auto` 解析（D8.2） |

约束：

- 显式 `acceptance_window_s` 优先于档位默认值——档位是简写，不是权威；但必须落在上下界内，
  **越界即拒绝发布，不做静默夹取**：被悄悄改过的窗口就是被悄悄改过的承诺。
- `privacy_mode` 声明 `sealed` **直接拒绝**，不降级为 `supervised` 执行。接受声明再按监督模式跑，
  等于告诉发布者数据被隔离了而事实并非如此——这是本区域唯一绝不能沉默的失败。
  `sealed` 与一个根本不存在的模式返回不同的错误：前者是本部署无法履行的真实模式，后者是拼错。
- 三项都是可选的，缺省即默认值。发布门不重新校验已批准的热线，新增必填字段会把目录切成
  「还能重新发布」与「不能重新发布」两半，而没有人做过这个决定。
- **不得把默认值写进既有记录**：那会改变内容摘要，已经绑定该版本的 Call 随即报 `digest_mismatch`。
  默认值在读取时解析（`serviceTierOf` / `privacyModeOf` / `fulfillmentModeOf`），永不落盘。


## 6.2) 交付完整性（FR-040）

M3 单元 1。在此之前 `schema_valid` 是执行方写在自己结果对象里的一个字段：**拿钱的那一方，是唯一
判定活干没干完的那一方**，而平台据此立刻结算。这一节定义那个可以失败的检查点。

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `delivery_integrity.grade` | `verified` \| `failed` \| `unchecked` | PROVISIONAL | 由 `validateDeliveredOutput` 的三元返回推出 |
| `hotline_version`（结果签名字段） | 随结果携带 | FROZEN（**追加式**） | 进入 canonical 字段表，位置紧邻 `hotline_id` |
| `artifacts[].contract_role` | 契约 `output_attachments.file_roles[].role` 之一 | PROVISIONAL | 与 artifact 描述符的 `role` 是两套词汇，见下 |
| 单次结果最多报告的字段级违约条数 | `10` | PROVISIONAL | 逐字段点名，超出部分截断 |

约束：

- **校验按 Call 钉住的那份契约做，不是目录当前值**。责任方签名之前自校一次（失败还来得及如实描述），
  平台再按同一份钉住的契约复核一次——「责任方说它检查过」正是本条要替换掉的那类断言。
- 结果签名覆盖 `hotline_version`。此前一份签名结果说得出自己来自哪条热线，却说不出它**声称满足的是
  哪份契约**：v1 产出的结果与 v2 产出的在密码学上无法区分，而 FR-040 恰恰要按 Call 钉住的那份来判。
- **该字段是追加式的**：结果里没有这个 key，canonical 形式里就没有，旧责任方签的字节因此**逐字节不变**、
  签名照样验得过。它只是能被检查的东西更少——那是更低的完整性等级，不是无效签名。
  拒绝验证每一个旧责任方，等于这次改动为了把交付描述得更清楚而把交付弄坏了。
- **发布顺序不可倒**：canonical 字段表只在「旧签名方 / 新校验方」方向上是兼容的。必须先发 contracts、
  再让平台与 caller（**所有校验方**）升上去，最后才允许责任方开始盖这个字段。倒过来做，
  生产上每一次正确交付都会变成签名校验失败。
- **三种回答，而不是两种**。以下情形既不该判违约、也不该判通过，逐条命名在 `unchecked` 里，
  由平台据此降级：契约根本没声明 `output_schema`（发布门存在之前批准的热线全是这一类）；
  结果是一次失败（失败不必长得像成功，但**也不得被判成已验证的交付**——M3 单元 2 的验收窗
  从「已验证交付」起表，而这里什么都没交付）；artifact 到了但不说自己填的是哪个契约角色。
- **`contract_role` 与 `ARTIFACT_ROLE` 是两套词汇，不得混用**。后者（`input` / `output` / `evidence`）
  描述字节的流向，写在 artifact 描述符上；前者描述这件 artifact 履行的是契约里的哪条承诺
  （如 `mineru_markdown`）。契约要求的是后一种，而 M3 之前的结果 artifact 两种都不带。
- 因此「artifact 一件都没有」判违约（契约要文件而一件没来，没有歧义），
  「artifact 有但不声明角色」判 `unchecked`（判失败会冤枉事实上完整的交付；静默判通过则等于
  任何责任方只要闭口不答就能永久跳过这项检查）。
- `output_schema` 本身编译不过时，错误指向**契约**而不是这次交付——指错了人，去修的就会是错的那一方。


## 6.3) 执行预算（FR-025）

M3 单元 6。此前一次调用上跑着**三个互不知情的时钟**：caller 自己的 `hard_timeout_s`、
平台的 `token_ttl_seconds`（同时兼任资金 hold 的过期），以及 responder 的每热线 hard 超时。
三个默认值都在五分钟量级，而一次真实 MinerU 解析（含冷启动模型加载）约四分钟——
2026-08-09 第一次真实生产调用就死在最先响的那个上，而且**只调高其中一个只会换一个错误码**。

现在由热线自己声明工作需要多久，其余各方从它派生。

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `execution_budget_s`(quick) | `300` | PROVISIONAL | 交互式的活 |
| `execution_budget_s`(standard) | `1800` | PROVISIONAL | |
| `execution_budget_s`(deep) | `14400` | PROVISIONAL | 深度的活是「你会走开」的那种 |
| `execution_budget_min_s` | `30` | PROVISIONAL | 显式声明的下界 |
| `execution_budget_max_s` | `43200` | PROVISIONAL | 显式声明的上界 |

约束：

- 显式 `execution_budget_s` 优先于档位默认值；越界**拒绝发布，不做静默夹取**——
  与验收窗同一条规矩：被悄悄改过的预算就是被悄悄改过的承诺，发布者应当当场知道，
  而不是等到工作在执行途中被杀掉才发现真实数字。
- **进冻结契约字段表**（`HOTLINE_VERSION_CONTRACT_FIELDS`），因此随 Call 快照，
  在途调用不受热线改档影响。
- **默认值只在读取时解析，绝不写进既有版本记录**：写入会改变内容摘要，
  已绑定该版本的 Call 随即报 `digest_mismatch`。与 `service_tier` 完全同一个陷阱与同一条红线，有测试钉住。

## 7) 核心参数确认结果

以下 8 项已确认并冻结（可直接进入实现）：
1. `ack_deadline_s=120`
2. `token_ttl_seconds=300`
3. `soft_timeout_s=90`, `hard_timeout_s=300`
4. `max_retry_attempts=2`, `retry_backoff=exponential+jitter`
5. `result_signature_algorithm=Ed25519`
6. `heartbeat_interval_s=30`, `degraded_threshold_s=90`, `offline_threshold_s=180`
7. `catalog_default_availability_filter=healthy`
8. `mvp_display_metrics=call_volume,success_rate,timeout_rate,schema_compliance_rate,p95_exec_ms`

补充实现决议：
- `responder_token_validation_mode=online_introspect_required`
- `request_event_scope_v0_1=ACKED_completed_failed`
- `catalog_import_mode=on_demand_immediate`
- `platform_storage_backend=PostgreSQL`
- `responder_hotline_binding_mode=platform_import_association`
- `catalog_expose_task_delivery_address=false`
- `delivery_meta_mode=request_scoped`
- `delivery_meta_ttl_seconds=300`
- `api_auth_mode=api_key`
- `identity_onboarding_mode=register_caller_default_then_activate_responder_on_remote_hotline_onboarding`
- `responder_identity_cardinality=one_responder_per_user`
- `catalog_submission_mode=platform_onboarding_api_with_dual_admin_review`

## 8) 本地配置覆盖

仓库根目录提供了 `.env.example`，只列出当前实现与 compose 联调中真实生效的环境变量。

建议覆盖项（示例）：
- `TOKEN_TTL_SECONDS=300`
- `BOOTSTRAP_RESPONDER_ID=responder_...`
- `BOOTSTRAP_HOTLINE_ID=hotline.namespace.v1`
- `BOOTSTRAP_TASK_DELIVERY_ADDRESS=local://relay/...`（responder task endpoint，platform 会在 `delivery-meta` 中映射为 `task_delivery.address`）
- `BOOTSTRAP_RESPONDER_API_KEY=...`
- `BOOTSTRAP_RESPONDER_PUBLIC_KEY_PEM=...`
- `BOOTSTRAP_RESPONDER_PRIVATE_KEY_PEM=...`
- `ACK_DEADLINE_S=120`
- `TIMEOUT_CONFIRMATION_MODE=ask_by_default|always_continue|always_finalize`
- `HARD_TIMEOUT_AUTO_FINALIZE=true|false`
- `CALLER_CONTROLLER_POLL_INTERVAL_ACTIVE_S=5`
- `CALLER_CONTROLLER_POLL_INTERVAL_BACKOFF_S=15`
- `PLATFORM_API_BASE_URL=http://platform-api:8080`
- `PLATFORM_API_KEY=...`
- `DATABASE_URL=postgresql://...`
- `SQLITE_DATABASE_PATH=./data/delexec.sqlite`
- `PORT=8080|8081|8082`
- `SERVICE_NAME=platform-api|caller-controller|responder-controller`
- `RESPONDER_ID=responder_...`
- `HOTLINE_IDS=hotline.a.v1,hotline.b.v1`
- `RESPONDER_SIGNING_PUBLIC_KEY_PEM=...`
- `RESPONDER_SIGNING_PRIVATE_KEY_PEM=...`
- `RESPONDER_MAX_HARD_TIMEOUT_S=300`
- `RESPONDER_ALLOWED_TASK_TYPES=extract,classify`
- `RESPONDER_HEARTBEAT_INTERVAL_MS=30000`

说明：
- 未设置时，行为以本文件冻结默认值为准。
- `PLATFORM_API_BASE_URL` / `PLATFORM_API_KEY` 当前由 Caller/Responder app 启动层读取，用于装配平台 client。
- `DATABASE_URL` 当前由 Platform/Caller/Responder app 启动层读取；若配置，则会自动执行 migration 并启用 PostgreSQL 状态快照持久化。
- `SQLITE_DATABASE_PATH` 当前由 Platform/Caller/Responder app 启动层读取；仅在未设置 `DATABASE_URL` 时生效，用于单机 SQLite 快照持久化。
- `BOOTSTRAP_*` 当前由 Platform app 启动层读取，用于固定 compose/本地联调时的第一组 bootstrap responder 身份。
- Responder 的 `RESPONDER_*` 变量当前只影响 app 启动层的运行时身份和签名 key 装配。
- `RESPONDER_MAX_HARD_TIMEOUT_S` / `RESPONDER_ALLOWED_TASK_TYPES` 当前由 Responder app 启动层读取，用于装配最小 guardrail。
- `RESPONDER_HEARTBEAT_INTERVAL_MS` 当前由 Responder app 启动层读取，用于启动心跳周期任务。
- 存储后端优先级：`DATABASE_URL` > `SQLITE_DATABASE_PATH`。
- 定位建议：`PostgreSQL` 作为默认/推荐后端；`SQLite` 仅作为单机部署、演示或本地开发的便利选项。
- `.env.example` 当前不包含尚未接入运行时的链路切换变量；例如 `TRANSPORT_MODE` 仍属于后续实现，不应提前伪装成已生效配置。
- 若实现侧采用配置文件（如 YAML/TOML），需保持与上述变量语义一致。
