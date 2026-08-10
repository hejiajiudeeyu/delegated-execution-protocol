默认值 v0.1 建议（冻结参数）

> 英文版：[defaults-v0.1.md](defaults-v0.1.md)
> 说明：中文文档为准。

# Defaults v0.1（建议冻结参数）

用途：在编码前批量冻结关键参数，避免Caller端、Responder端、服务端实现分叉。

状态说明：
- `FROZEN`：已确认并冻结（v0.1）

更新时间：2026-03-05

补充合同（模式演进）：
- `L0-L3`应该被视为同一系统的可选运行模式，而不是四套不同的协议实现。
- 模式切换只允许改变控制器间通信拓扑、中继/邮箱/网络边界与传输适配器装配方式。
- 模式切换不得改变核心协议语义、请求/结果结构、状态机迁移规则、ACK 语义与幂等规则。

## 1) 请求与超时

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `ack_deadline_s` | `120` |冷冻 | Caller发单后等待ACK的最大时长（含传输投递延迟） |
| `软超时_s` | `90` |冷冻 | 软超时、触发同样或降级 |
| `hard_timeout_s` | `300` |冷冻 | 硬超时，Caller终止等待并记超时 |
| `超时确认模式` | `默认询问` |冷冻 | 达到`soft_timeout_s`时默认先询问Caller代理是否继续等待 |
| `hard_timeout_auto_finalize` | `真实` |冷冻 | 达到 `hard_timeout_s` 且显未继续等待时自动终态 `TIMED_OUT` |
| `caller_controller_poll_interval_active_s` | `5` |冷冻 |Caller代理轮询控制器的活跃期间隔（前30秒）|
| `caller_controller_poll_interval_backoff_s` | `15` |冷冻 |Caller代理轮询控制器的退避间隔（30秒后）|
| `最大重试次数` | `2` |冷冻 | 最大重试次数（总尝试数=3）。规划参数，当前未实现重试逻辑 |
| `重试_退避` | `指数 + 抖动` |冷冻 | 重试退避策略。规划参数，当前未实现 |
| `delivery_observation_window_s` | `60` |冷冻 | Transport 投递启动窗口，用于超时分层计算。规划参数，当前未实现 |

## 2) 代币与安全

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `token_ttl_秒` | `300` |冷冻 | 任务 token 近期（当前实现默认 5 分钟） |
| `token_min_ttl_seconds` | `300` |冷冻 | v0.1 最短建议距离 |
| `token_max_ttl_seconds` | `300` |冷冻 | v0.1 当前固定为 TTL |
| `结果签名算法` | `Ed25519` |冷冻 | 结果包签名算法 |
| `responder_token_validation_mode` | `online_introspect_required` |冷冻 | Responder校验代币统一走 `POST /v1/tokens/introspect` |
| `idempotency_window_hours` | `24` |冷冻 | `request_id` 去重窗口。规划参数，当前未实现显式窗口清理 |
| `introspect_sla_p99_ms` | `200` |冷冻 | introspect 接口 P99 延迟目标 |
| `introspect_cache_ttl_s` | `30` |冷冻 |内省服务器TTL。规划参数，当前未实现服务器 |

## 3) 心率与可用性

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `心跳间隔_s` | `30` |冷冻 | Responder心跳上报间隔|
| `degraded_threshold_s` | `90` |冷冻 | 超过该值进入`degraded` |
| `离线阈值` | `180` |冷冻 | 超过该值进入`offline` |
| `catalog_health_cache_ttl_s` | `60` |冷冻 | Caller读取健康状态缓存TTL。规划参数，当前未实现 |

## 4) 目录与路由

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `catalog_cache_ttl_s` | `300` |冷冻 | Caller目录存储TTL。规划参数，当前未实现 |
| `catalog_default_status_filter` | `已启用` |冷冻 | 默认过滤已开放入境 |
| `catalog_default_availability_filter` | '健康' |冷冻 | 默认只选健康Responder|
| `routing_fallback_policy` | `retry_once_then_switch_responder` |冷冻 | ACK超时后路由策略|
| `目录导入模式` | `on_demand_immediate` |冷冻 | 目录即时导入 |
| `responder_hotline_binding_mode` | `platform_import_association` |冷冻 |热线与Responder关系由平台导入时建立|
| `模板_交付_模式` | `platform_api_bundle` |冷冻 |Caller通过平台API拉取模板包，不直接采集仓库目录 |
| `catalog_expose_task_delivery_address` | `假` |冷冻 | 目录批量查询不返回请求范围`task_delivery/result_delivery` |
| `delivery_meta_mode` | `request_scoped` |冷冻 | 通过 `POST /v1/requests/{request_id}/delivery-meta` 单次下发 |
| `delivery_meta_ttl_seconds` | `300` |冷冻 | 投递元数据（与 token TTL 对齐） |

## 5) 指标与展示

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `metrics_windows` | `24 小时，7 天` |冷冻 | 预设指标窗口 |
| `mvp_display_metrics` | `call_volume、成功率、超时率、schema_compliance_rate、p95_exec_ms` |冷冻 | MVP对外展示硬指标|
| `caller_event_required` | `Caller.请求.调度，Caller.请求.确认，Caller.请求.成功，Caller.请求.超时，Caller.请求.未验证，Caller.请求.失败` |冷冻 | Caller最小事件集|
| `responder_event_required` | `responder.task.received、responder.task.rejected、responder.task.succeeded、responder.task.timed_out` |冷冻 | Responder最小事件集|

说明：
- `POST /v1/metrics/events` 建议在 L0 实现最小接收能力。
- `GET /v1/metrics/summary` 属于可延后增强，不阻塞 L0 协议闭环。

## 6) 版本与兼容

| 参数 | 建议值 | 状态 | 说明 |
|---|---:|---|---|
| `合约版本` | `0.1.0` |冷冻 | 合约版本 |
| `结果版本` | `0.1.0` |冷冻 | 结果包版本 |
| `api_version_prefix` | `/v1` |冷冻 | 控制面 API 路径版本 |
| `compat_policy` | `仅添加剂` |冷冻 | 重点补充字段，不破坏旧小区 |
| `request_event_scope_v0_1` | `ACKED_completed_failed` |冷冻 | v0.1 实现 `ACKED` 与Responder完成状态安装事件 `COMPLETED/FAILED`，不实现 `RUNNING/PROGRESS` |
| `platform_storage_backend` | `PostgreSQL` |冷冻 | 服务端主存储选型 |
| `api_auth_mode` | `api_key` |冷冻 | 控制面 API 鉴权方式 |
| `identity_onboarding_mode` | `register_caller_default_then_activate_responder_on_remote_hotline_onboarding` |冷冻 | 用户注册后默认Caller；Responder角色在远程热线onboarding/导入后激活 |
| `Responder身份基数` | `每个用户一个Responder` |冷冻 | v0.1 一个用户只能绑定一个responder_id |
| `catalog_submission_mode` | `platform_onboarding_api_with_dual_admin_review` |冷冻 | 当前通过 `POST /v2/hotlines` 提交 responder/hotline，上架前要求 responder 与 hotline 双渠道 |

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

以下8项已确认并冻结（可直接进入实现）：
1. `ack_deadline_s=120`
2.`token_ttl_秒=300`
3. `soft_timeout_s=90`, `hard_timeout_s=300`
4. `max_retry_attempts=2`, `retry_backoff=指数+抖动`
5. `result_signature_algorithm=Ed25519`
6.`heartbeat_interval_s=30`、`degraded_threshold_s=90`、`offline_threshold_s=180`
7. `catalog_default_availability_filter=healthy`
8.`mvp_display_metrics=通话量、成功率、超时率、schema_compliance_rate、p95_exec_ms`

补充解决方案：
- `responder_token_validation_mode=online_introspect_required`
- `request_event_scope_v0_1=ACKED_completed_failed`
- `catalog_import_mode=on_demand_immediate`
- `platform_storage_backend=PostgreSQL`
- `responder_hotline_binding_mode=platform_import_association`
-`catalog_expose_task_delivery_address = false`
- `delivery_meta_mode=request_scoped`
- `delivery_meta_ttl_seconds=300`
- `api_auth_mode=api_key`
- `identity_onboarding_mode=register_caller_default_then_activate_responder_on_remote_hotline_onboarding`
- `responder_identity_cardinality=one_responder_per_user`
- `catalog_submission_mode=platform_onboarding_api_with_dual_admin_review`

## 8) 本地配置覆盖

仓库根目录提供了 `.env.example`，只启动当前实现与 compose 联调中真实生效的环境变量。

建议覆盖项（示例）：
- `TOKEN_TTL_SECONDS=300`
- `BOOTSTRAP_RESPONDER_ID=Responder_...`
- `BOOTSTRAP_HOTLINE_ID=hotline.namespace.v1`
- `BOOTSTRAP_TASK_DELIVERY_ADDRESS=local://relay/...`（Responder任务端点，平台会在 `delivery-meta` 中映射为 `task_delivery.address`）
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
- `端口=8080|8081|8082`
- `SERVICE_NAME=platform-api|Caller控制器|Responder控制器`
- `RESPONDER_ID=Responder_...`
- `HOTLINE_IDS=hotline.a.v1,hotline.b.v1`
- `RESPONDER_SIGNING_PUBLIC_KEY_PEM=...`
- `RESPONDER_SIGNING_PRIVATE_KEY_PEM=...`
- `RESPONDER_MAX_HARD_TIMEOUT_S=300`
- `RESPONDER_ALLOWED_TASK_TYPES=提取、分类`
- `RESPONDER_HEARTBEAT_INTERVAL_MS=30000`

说明：
- 未设置时，行为以本文件冻结默认值。
- `PLATFORM_API_BASE_URL` / `PLATFORM_API_KEY` 当前由Caller/Responder app启动层读取，用于装配平台客户端。
- `DATABASE_URL` 当前由 Platform/Caller/Responder app 启动层读取；若配置，底部自动执行迁移并启用 PostgreSQL 状态快照持久化。
- `SQLITE_DATABASE_PATH` 当前由 Platform/Caller/Responder app 启动层读取；仅在未设置 `DATABASE_URL` 时生效，用于单机 SQLite 快照持久化。
- `BOOTSTRAP_*` 当前由 Platform app 启动层读取，用于固定撰写/本地联调时的第一组 bootstrap responder 身份。
- Responder的`RESPONDER_*`变量当前只影响app启动层的运行时身份和签名密钥配备。
- `RESPONDER_MAX_HARD_TIMEOUT_S` / `RESPONDER_ALLOWED_TASK_TYPES` 当前由Responder应用启动层读取，用于装配最小护栏。
- `RESPONDER_HEARTBEAT_INTERVAL_MS` 当前由Responder应用启动层读取，用于启动心跳任务周期。
- 存储优先级：`DATABASE_URL` > `SQLITE_DATABASE_PATH`。
- 定位建议：`PostgreSQL`作为默认/推荐报表；`SQLite`仅作为单机部署、演示或本地开发的便利选项。
- `.env.example` 当前不包含尚未接入运行时的交换机切换指示灯；例如 `TRANSPORT_MODE` 仍属于后续实现，不宜提前配置成已生效配置。
- 若实现侧采用配置文件（如YAML/TOML），需保持与上述参数语义一致。
