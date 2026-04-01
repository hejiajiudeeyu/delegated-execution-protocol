Integration Playbook v0.1（Caller/Responder/平台）

> 英文版：[integration-playbook.md](integration-playbook.md)
> 说明：中文文档为准。

# Integration Playbook v0.1（Caller/Responder/平台）

本文档回答了三个问题：
- Caller端如何发起请求、跟踪状态、验收结果。
- Responder端如何接收请求、校验执行、回传结果。
- 协议控制面如何将目录稳定地“传给”Caller与Responder（控制面分发）。

本文档描述的是 `Remote Hotline Protocol` 的接入方式，以及当前仓库参考实现的联调路径；它不要求未来所有实现共享同一个集中式托管中继。

本手册与以下文档定位：
- `../spec/architecture.md`
- `../spec/platform-api-v0.1.md`

## 1. 目的（MVP）

1. Caller拉取目录，选定 `responder_id + hotline_id`。
2. Caller生成 `request_id` 与任务合约。
3. Caller调用 `POST /v1/tokens/task` 申请短期代币。
4. Caller调用`POST /v1/requests/{request_id}/delivery-meta`获取单次投递元数据（`task_delivery + result_delivery + verify`）。
5. 当前实现：Caller通过`POST /controller/requests/{request_id}/dispatch`把任务信封发送到`L0本地传输`。
6. 当前实现：Responder 通过 `POST /controller/inbox/pull` 拉取任务，解析并发并继续后续处理。
7. Responder通过服务端上报ACK（已接单，可附ETA）。
8. Responder执行任务，生成结果包并签名。
9. 当前实现：Responder 通过 `Transport Adapter` 选择相同的 `request_id` 语义回传结果包，由 Caller Controller 接收。
10. 当前实现：Responder在结果确定后额外向平台写入 `COMPLETED` 或 `FAILED` 事件，作为控制面初始，不替代结果回传。
11. Caller轮询服务端请求事件与结果，按 `request_id` 验签+验签模式（含错误结果包）。
12. Caller/Responder分别调用 `POST /v1/metrics/events` 上报最小指标。

## 2. Caller端详细流程

## 2.1 启动前准备
- 先完成用户注册（`POST /v1/users/register`）并获取API Key（默认`caller`范围）。
- 配置平台基本URL与认证信息（仅控制面API）。
- 当前本地参考实现中，`ops-console`通过本地密码解锁`~/.delexec/secrets.enc.json`；Caller API key、responder key、transport Secrets不再读取默认浏览器存储。
- 配置选定`Transport Adapter`能力（当前为`L0本地传输`；已实现的外部模式为`relay_http`、`emailengine`、`gmail`）。
- 维护本地状态表（可SQLite）：
  - 主键：`request_id`
  - 字段：`status`, `responder_id`, `hotline_id`, `token_exp_at`, `attempt`, `updated_at`

## 2.2 目录查询与选择
- 调用：`GET /v2/hotlines?capability=...&status=enabled`
- 选择规则（建议MVP）：
  - `状态=已启用`
  - `availability_status=健康`
  - `template_ref` 可用
  - 若目录提供 `capability/supported_task_types`，则应覆盖当前任务
  - 若目录提供 `eta_hint.exec_p95_s`，则应在范围内
- 选择后存储：
  - 缓存键：`hotline_id`
  - TTL建议：5分钟

## 2.2.1 拉取能力声明模板（渐进式披露）
- Caller确定目标热线后，读取目录边境中的`template_ref`字段（语义绑定键）。
- 调用模板下发接口：`GET /v2/hotlines/{hotline_id}/template-bundle?template_ref=...`
- 响应中读取：
  - `input_schema`：了解需要提供的输入字段
  - `output_schema`：了解将获得的输出格式
  - `example_contract` / `example_result`：若服务端提供，则可参考样例
  - `readme_markdown`：若服务端提供，则用于补充能力说明
- 对输入字段，应优先把 `input_schema.properties.<field>.description` 理解为逐字段填写说明，而不是面向 Responder 的内部注释。
- 对输出字段，`output_schema.properties.<field>.description` 应按返回字段含义理解。
- Caller代理可以根据此自动构造合约中的`task.input`和`task.output_schema`。
- 任选：使用 `If-None-Match` + `ETag` 做模板缓存与增量刷新。

## 2.3 发起请求
- 生成`request_id`（UUIDv7）。
- 构造任务合约（参见 `../spec/architecture.md` 第 4 节）。
- 调用 `POST /v1/tokens/task`，请求体包含：
  - `request_id`、`responder_id`、`hotline_id`
- 将返回 token 约定 `token` 字段。
- 调用 `POST /v1/requests/{request_id}/delivery-meta` 拉取：
  - `任务交付`
  - `结果交付`
  - `验证.显示代码`
- `task_delivery.address` 应视为不透明传输端点；仅使用本次 `delivery-meta` 返回的端点投递请求，而不是从目录批量字段直接取地址。
- `result_delivery` 是Responder回传结果的绑定路由；当前实现支持`email|local|relay_http`，工件`platform_inbox`。
- 发送任务请求：
  - 统一信封：包含 `request_id / responder_id / hotline_id / Payload / thread_hint`
- 本地状态更新：`已创建 -> 已发送`
- 当前`L0`联调中，`dispatch`会直接把本地请求状态推进到`SENT`。

补充说明：
- Email/SMTP/Webhook等外部传输的主题、线程头和编码规则不属于L0主路径，后续按适配器文档补充。

## 2.4 ACK轮询（避免盲等）
- Caller完成任务投递后立即轮询：`GET /v1/requests/{request_id}/events`
- 期望在`ack_deadline_s`（默认120秒，含传输投递延迟延迟）内收到`ACKED`事件。
- 若未收到ACK：
  - 记录 `DELIVERY_OR_ACCEPTANCE_TIMEOUT`
  - 可触发一次重试或切换备选Responder
- ACK 后状态迁移：`接收 -> ACKED`
- 同一事件完成物流观察到Responder写入的`COMPLETED/FAILED`状态；这些事件仅用于控制面启动与辅助排障，并不直接决定Caller本地终状态。

## 2.5 结果轮询与验收
- 轮询间隔建议：
  - 前 30 秒/5 秒
  - 随后每 15 秒，直到 `hard_timeout_s`
- 收到候选结果后按顺序校验：
  1. `request_id` 匹配
  2. `responder_id/hotline_id` 匹配
  3. `verification.display_code` 匹配本地请求绑定值
  4. 结果签名通过（使用目录或`delivery-meta`预绑定的`responder_public_key_pem`）
  5. 若存在 `artifacts[]`，附件 `name/media_type/byte_size/sha256` 校验通过
  4. `status=ok` 时，`output` 符合 `output_schema`
  5. `status=error` 时，`error.code/message` 结构完整
- 状态迁移：
  - v0.1 不实现 `RUNNING/PROGRESS` 细节事件；Caller控制面通常观察到 `ACKED` 后等待传输结果，必要时可额外查看 `COMPLETED/FAILED` 出发事件
  - `status=ok` 且验证通过：Caller本地终态为 `SUCCEEDED`
  - 协议验证不通过：`UNVERIFIED` 或 `FAILED(RESULT_*)`
  - `status=error` 且校验通过：Caller本地终态通常映射为 `FAILED`，将 `error` 反馈给Caller代理作为后续决策输入
  - 超过 `hard_timeout_s`：`TIMED_OUT`

## 2.5.1 超时确认策略（Caller控制器）
- `soft_timeout_s`到达时默认询问Caller代理是否继续等待（`timeout_confirmation_mode=ask_by_default`）。
- `hard_timeout_s` 到达且未收到 `continue_wait=true` 时，Caller控制器自动终态为 `TIMED_OUT`。
- `TIMED_OUT`最多表示Caller侧停止等待与轮询，不代表队列Responder进程一定被杀掉。

## 2.5.2 Caller代理轮询控制器（内部接口）
- 建议接口：`GET /controller/requests/{request_id}`（内部，不属于平台API）。
- 返回字段最大集：
  - `request_id`、`status`、`soft_timeout_at`、`hard_timeout_at`
  - `last_error_code`、`updated_at`、`needs_timeout_confirmation`
  - 终态时返回 `result_package` 或实现自定义终态字段
- 超时决策编写接口：`POST /controller/requests/{request_id}/timeout-decision`
  - 请求体：`continue_wait`（bool）, `decided_at`（ISO8601 UTC）, `note`（可选）
  - 用途：Caller代理明确告知控制人是否继续等待
- 轮询：策略
  - 活跃期（前30秒）每5秒
  - 退避期（30秒后）每15秒

## 2.6 重试规则
- 仅在以下场景重试（最多3次）：
  - 运输投递失败（`DELIVERY_*`）
  - 返回Responder `retryable=true`
- 退避：指数退避 + 臀部。
- 相同的 `request_id` 不重新生成；重试仍使用同一个 `request_id`。

## 2.7 Caller指标上报
- 建议上报事件：
  - `Caller.请求.派发`
  - `Caller.请求.acked`
  - `Caller.请求.成功`
  - `Caller.请求.timed_out`
  - `Caller.请求.未验证`
  - `Caller请求失败`
- 统一调用：`POST /v1/metrics/events`

## 2.8 本地参数覆盖
- 仓库根目录提供`.env.example`，默认参数见`../spec/defaults-v0.1.md`。
- 当前覆盖，当前建议仅对已接入运行时的端口：
  - `TOKEN_TTL_SECONDS`
  - `BOOTSTRAP_RESPONDER_ID`
  - `BOOTSTRAP_HOTLINE_ID`
  - `BOOTSTRAP_TASK_DELIVERY_ADDRESS`
  - `BOOTSTRAP_RESPONDER_API_KEY`
  - `BOOTSTRAP_RESPONDER_PUBLIC_KEY_PEM`
  - `BOOTSTRAP_RESPONDER_PRIVATE_KEY_PEM`
  - `ACK_DEADLINE_S`
  - `超时_确认_模式`
  - `HARD_TIMEOUT_AUTO_FINALIZE`
  - `CALLER_CONTROLLER_POLL_INTERVAL_ACTIVE_S`
  - `CALLER_CONTROLLER_POLL_INTERVAL_BACKOFF_S`
  - `PLATFORM_API_BASE_URL`
  - `PLATFORM_API_KEY`
  - `DATABASE_URL`
  - `SQLITE_DATABASE_PATH`
  - `端口`
  - `服务_名称`
  - `Responder ID`
  - `HOTLINE_IDS`
  - `RESPONDER_SIGNING_PUBLIC_KEY_PEM`
  - `RESPONDER_SIGNING_PRIVATE_KEY_PEM`
  - `RESPONDER_MAX_HARD_TIMEOUT_S`
  - `RESPONDER_ALLOWED_TASK_TYPES`
  - `RESPONDER_HEARTBEAT_INTERVAL_MS`
- 尚未接入运行时的叉口开关无法读取本地模板；例如 `TRANSPORT_MODE` 仍属于 post-L0 事项。
- 存储优先级为：`DATABASE_URL` 优先，`SQLITE_DATABASE_PATH`作为单机回退选项。
- 推荐部署仍使用 PostgreSQL；SQLite 只适合单节点运行。

## 3. Responder端详细流程

## 3.1 启动前准备
- 先完成用户主体注册并领取API Key（默认Caller角色）。
- 若该运行时要承载远程热线，则通过 `POST /v2/hotlines` 提交 onboarding 草案；Responder与热线都需管理员渠道后才会进入公开目录。
- responder本地运行时可先启动；但仅当`responder.review_status=approved`、`hotline.review_status=approved`且双方`status=enabled`时，才可被Caller发现和远程调用。
- responder侧调用平台接口前，需通过 `API key + responder scope + 资源归属(owner_user_id->responder_id->hotline_id)`鉴权。
- 当前联调模式内部外部通道；Responder通过`POST /controller/inbox/pull`从`L0本地运输`拉取任务。
- 外部通道保留为后续模式，可实例化为 `Email MCP`、`SMTP/API emailbridge` 或 `HTTP/Webhook`。
- 配置token验证能力：
  - 在线内省（`POST /v1/tokens/introspect`，v0.1 必做）
- 配置权力等存储（SQLite/Redis/Postgres 护士）：
  - 键：`request_id`
  - 值：`status`, `result_hash`, `finished_at`
- 配置签名私钥（结果包签名）。
- 配置心跳任务：每 30 秒调用 `POST /v2/responders/{responder_id}/heartbeat`。

## 3.2 请求处理实例
1. 收件：拉取新任务消息。
2. 解析：读取JSON约定，校验必填字段。
3. 鉴权：通过平台 `POST /v1/tokens/introspect` 进行在线校验。
4. 护栏：超时、任务类型支持情况。
5. 幂等：
  - 若`request_id`已完成，则直接回传相同结果包。
  - 若执行中，返回`EXEC_IN_PROGRESS`。
6. 入队：按 `priority + enqueue_at` 进入 `QUEUED`。
7. ACK：调用`POST /v1/requests/{request_id}/ack`，最小上报`responder_id/hotline_id`，任选附加`eta_hint_s`。
8. 执行：worker从队列取任务，调用具体执行器（插件函数）。
9. 封包：写入`status/output/error/timing/usage`。
10. 签名：对规范的 JSON 签名写入 `signature_algorithm/signature_base64`。
11. 回传：按相同 `request_id` / `thread_hint` 语义返回结果包。
12. 完成状态放置：Responder在结果包确定后调用 `POST /v1/requests/{request_id}/events` 写入 `COMPLETED` 或 `FAILED`。

## 3.2.1 审核测试
- 管理员可通过 `POST /v2/admin/hotlines/{hotline_id}/review-tests` 发起隐藏审核测试。
- 审核复测试用真实协议隐藏主链，但请求标记为审查测试，不会直接公开到目录。
- 当前自动化实时探测仅覆盖平台可直连的“local://”/中继支持的传输；电子邮件通道首期仍以静态检查和手动复核为主。

## 3.2.1 Responder队列机制（MVP建议）
- 入队时机：完成代币/签核决定并立即接受后入队。
- 出队策略：同优先级先进先出。
- 队列拒绝：满或资源阈值返回 `EXEC_QUEUE_FULL` + `retry_after_s`。
- worker异常恢复：使用`lease_ttl + heartbeat`，租约任务过渡到`QUEUED`。

补充说明：
- `tenant_quota` 属于后续多机场扩展，不属于 L0 必备。

## 3.3 Responder心跳建议
- 默认间隔：`30s`
- 上报字段：`timestamp`, `queue_depth`, `est_exec_p95_s`
- 若心跳中断，平台将可用性降级为“降级/离线”，影响Caller选路。

## 3.4 Responder失败与拒绝语义
- 令牌过期：`AUTH_TOKEN_EXPIRED`
- 任务类型不支持：当前实现为 `CONTRACT_TASK_TYPE_UNSUPPORTED`
- 执行超时/执行器异常：使用 `EXEC_*` 域错误码
- 具体错误码与默认 `retryable` 语义以 `@delexec/contracts` 中的中心樱桃番茄

## 3.5 Responder指标上报
- 建议上报事件：
  - `请求已收到`
  - `请求已接受`
  - `请求被拒绝`
  - `请求成功`
  - `请求超时`
- 上报接口：`POST /v1/metrics/events`

## 3.6 Responder信息变更（L0后）
- **可修改字段**：`display_name`、`description`、`eta_hint`、`responder_public_key_pem`、`status`。
- **变更方式**：通过表单重新提交变更项 + 平台CLI审核导入（复用现有导入流程）。
- **变更变更**：触发双键窗口（见`../spec/architecture.md`第5.6节），Caller验签自动兼容。
- **不可自主变更字段**：`hotline_id`、`responder_id`、`capability`、`supported_task_types`（需平台审核后由管理员变更）。
- **生效时间**：导入完成后立即生效，Caller下次目录查询即可获取最新信息。

说明：
- 该节属于L0后的运行治理，而不是L0最小闭环要求。
- 详细演进建议统一见`../../planned/roadmap/evolution-roadmap.md`。

## 3.7 能力声明模板维护
- Responder在 `docs/templates/hotlines/{hotline_id}/` 下维护 5 个模板文件（`input.schema.json`、`output.schema.json`、`example-contract.json`、`example-result.json`、`README.md`）。
- 模板变更通过PR提交，平台管理员审核。
- 架构变更须允许遵循一致性策略版本（仅逻辑兼容新增字段）。
- 模板更新后目录边界的`updated_at`同步刷新。
- Caller侧模板消费统一走平台API，不直接读取仓库目录。

## 4.平台目录配送（重点）

你问的“服务端怎么给他们传目录”，MVP建议**拉模式（拉）**，避免平台老年人复杂度：

补充本地控制台实现：
- `platform-console` 不再由浏览器直接持有运营商 API 密钥。
- 当前仓库通过 `platform-console-gateway` 本地代理保存平台 URL + admin key，并代为转发 `/v1/admin/*` 请求。

## 4.1 在线查询（默认）
- Caller调用 `GET /v2/hotlines`。
- 适合低流量与冷启动场景。
- 优点：实现最简单，天然实时。
- 可按 `availability_status=healthy` 过滤离线Responder。

## 4.2 快照同步（任选增强）
- 不属于L0。
- 若目录规模扩大，再添加 `GET /v1/catalog/snapshot`。

## 4.3 增量更新（后续）
- 不属于L0。
- 若目录进入高频阶段，再新增 `GET /v1/catalog/changes?since_version=...`。

## 4.4 存储与一致性建议
- Caller存储TTL：5分钟（MVP）。
- 关键请求前可强制刷新一次目录（避免选到已下线热线）。
- 目录项包含：
  - `状态`（`启用|禁用`）
  - `availability_status`（`健康|降级|离线`）
  - `最后心跳时间`
  - `版本`
  - `更新时间`
  - `responder_public_key_pem`
- 投递地址通过`POST /v1/requests/{request_id}/delivery-meta`单次下发，不在目录批量列表公开。
- 验必须签使用目录中的最新发票；每轮换时需保留短暂双钥匙窗口。

## 4.5 手动导入流程（当前方案，非L0阻塞）
1. 用户完成主体注册并获取API Key（默认Caller）。
2. 用户通过表单提交远程热线信息与能力说明（填写 `owner_user_id`）。
3. 平台管理员基于模板维护热线并关联`responder_id`。
4. 平台管理员通过CLI审核并导入；导入成功后激活该用户的Responder角色能力。
5. Caller通过查询接口获取可用目录入口。

模板文件：
- `docs/templates/catalog-hotline.template.json`
- `docs/templates/catalog-hotlines.import.template.ndjson`
- 能力声明模板：`docs/templates/hotlines/{hotline_id}/`（参见`../spec/architecture.md` §4.5）

补充说明：
- 该流程服务于目录负载与身份激活，不支持L0单轮闭环。
- 更完整的入门迁移方案请参见“../../planned/roadmap/evolution-roadmap.md”。

## 5. 最小机状态落地表（建议）

状态枚举：
- `已创建`
- `已发送`
- `已确认`
- `成功了`
- ‘失败’
- `超时`
- “未经验证”

建议字段：
- `request_id`（PK）
- `Caller ID`
- `Responder ID`
- `hotline_id`
- `状态`
- `尝试`
- `最后一个错误代码`
- `token_exp_at`
- `ack_deadline_at`
- `hard_timeout_at`
- `更新时间`

## 6. MVP 验收清单（面向三方）

- Caller端：
  - 能够独立完成发单、轮询、验收、重试。
  - 对同`request_id` 重复结果只认一次。
- Responder端：
  - 令牌过渡可以拒绝并返回标准错误码。
  - 幂等去重可回放结果。
- 平台：
  - 目录查询稳定可用。
  - 令牌签发与索赔完整。
  - 至少能接收最小起始事件；聚合分析可后续补齐。
