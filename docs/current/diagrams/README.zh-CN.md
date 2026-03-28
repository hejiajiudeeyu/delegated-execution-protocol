当前图表索引

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# 当前图表索引

本目录用于存放当前实现对应的核心流程图，建议阅读顺序如下：

1. `doc-truth-source-map.md`：文档真相源与虚假分层图。
2. `user-registration-call-flow.md`：用户注册与 API Key 签发（默认 Caller）。
3. `permission-lifecycle-and-rbac.md`：权限来源、角色状态机、RBAC触发事件与接口矩阵。
4. `user-remote-hotline-call-flow.md`：Caller -> 平台 -> Responder 主调用链（含失败分支与验收）。
5. `implemented-call-flow.md`：当前已实现基线调用流。

补充说明：
- 所有图采用统一编号体系`阶段+步骤+后缀`（如`G3-REQ`, `H1-F1`）。
- 权限变更细节统一以 `permission-lifecycle-and-rbac.md` 为准；其他图仅保留鉴权闸门。
- 文档分层与真相源规则统一以 `doc-truth-source-map.md` 和 `../spec/architecture.md` 第 1.4 节为准。
- 当前ACK回传模式为Pull（`GET /v1/requests/{request_id}/events`）。
- 接口字段与返回结构以 `../spec/platform-api-v0.1.md` 为唯一规范源；若与 API 文档冲突，以 API 文档为准，并需回补修改图。
- Caller 超时确认策略：`soft_timeout` 询问、`hard_timeout` 自动终态 `TIMED_OUT`；该语义不等价于终端进程 kill。
- 计划中的 onboarding、搜索、外部 transport、多轮对话等演进内容统一收敛到 `../../planned/roadmap/evolution-roadmap.md`。
