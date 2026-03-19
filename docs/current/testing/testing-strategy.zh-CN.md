测试策略（MVP v0.1）

> 英文版：[testing-strategy.md](testing-strategy.md)
> 说明：中文文档为准。

# 测试策略 (MVP v0.1)

预分割附加规则：

- E2E与兼容性测试优先使用独立进程缓冲区，不直接导入各服务的服务器工厂
- 未来跨仓验收的启动约定见 [Cross-Repo 兼容性测试](/Users/hejiajiudeeyu/Documents/Projects/remote-subagent-protocol/docs/current/testing/cross-repo-compatibility-testing.md)

## 1.目标

建立可持续的测试体系，覆盖三端基础行为、核心故障分支，以及面向调试的双反馈面：

- TUI：终端实时结果（Vitest）
- Web UI：流程图定位失败步骤（Flow Dashboard）

## 2. 分层策略

- 单位：状态机、错误码、schema约束等纯逻辑
- 集成：单服务 HTTP 接口与内存状态行为
- E2E：平台+买家控制器+卖家控制器的端到端场景，按独立进程 / HTTP 边界运行
- Compose Smoke：Docker 真实进程冒烟（`tests/smoke/compose-smoke.mjs`）

## 3. 场景来源

测试场景由两个部分共同定义：

- 流程图（步骤覆盖与编号节点）：`../diagrams/user-remote-subagent-call-flow.md`
- 规范文档（断言口径）：`../spec/architecture.md`、`../spec/platform-api-v0.1.md`、`../guides/integration-playbook.md`

## 4. 模拟/运行时策略

`tests/mocks/` 下占用以下替身定义（当前为工件，集成和E2E测试直接使用真实内存态服务实例）：

- `MockPlatformApi`：注册、token、introspect 的轻量替身
- `MockEmailBus`：模拟投递、轮询
- `FakeClock`：超时测试中的可控时间源

当前默认联调以本地参考传输为主：
- 买家通过`dispatch`把任务envelope写入本地transport
- 卖家通过 `inbox/pull` 拉取并 ACK 本地传输消息
- 平台继续只承担控制面职责

Mock仍用于单点接口与失败分支测试；真实邮件通道测试则补充冒烟通道。

## 4.1 真实进程联调（Compose Smoke）

- 入口：`npm run test:compose-smoke`
- 严格入口：`npm run test:compose-smoke:strict`
- 行为：启动`docker-compose.yml`，等待三端健康检查，执行最小成功队列，再自动`down`
- 目标：验证“真实进程 + 网络 + 端口映射 + 服务组合”无基础阻塞
- 严格模式语义：docker不可用时直接失败，避免CI中出现“绕过”的假阳性

## 5. 流程图问题定位

E2E输出 `tests/reports/latest.json`，每条问题记录包含：

- `case_id`
- `flow_step_id`（如`F1-F1`）
- `错误代码`
- `严重性`
- `消息`

Web UI 加载该报告并在流程图中高亮对应步骤。

## 6. MVP 激励验收

- 成功：终态`成功`
- 超时：终态 `TIMED_OUT`
- 令牌过期：`AUTH_TOKEN_EXPIRED`
- 结果不合规：`RESULT_SCHEMA_INVALID` / `UNVERIFIED`

并覆盖“错误结果包可被买家验收并反馈”的路径。

当前E2E额外已验证：
- 卖方最终验签使用预绑定信任隧道，结果包自带隧道
- `delivery-meta` 与令牌声明的 `request_id/seller_id/subagent_id/buyer_id` 绑定
- 平台卖家侧接口的最小RBAC约束
