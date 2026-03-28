协议预分割边界

> 英文版：[protocol-pre-split-boundary.md](protocol-pre-split-boundary.md)
> 说明：中文文档为准。

# 协议预分割边界

本文件冻结 monorepo 预拆分层级里“协议仓”应承载的内容边界。

当前阶段目标不是立即拆掉三个git仓库，而是先把协议侧真相源头可独立发布、可被实现仓消费的上游产品。

## 当前协议真相源

以下内容未来属于 `delegate-execution-protocol` 仓库范围：

- [包/合同](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/packages/contracts)
- [docs/current/spec/architecture.md](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/current/spec/architecture.md)
- [docs/current/spec/platform-api-v0.1.md](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/current/spec/platform-api-v0.1.md)
- [docs/current/spec/defaults-v0.1.md](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/current/spec/defaults-v0.1.md)
- [docs/current/spec/remote-hotline-scope.md](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/current/spec/remote-hotline-scope.md)
- [docs/current/guides/integration-playbook.md](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/current/guides/integration-playbook.md)
- [docs/current/diagrams/doc-truth-source-map.md](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/current/diagrams/doc-truth-source-map.md)
- [文档/模板](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/templates)

## 未来三仓归属

未来协议仓：

- `包/合同`
- 协议规范、模板、图、版本兼容说明

未来客户仓：

- `包/Caller控制器核心`
- `packages/responder-runtime-core`
- `packages/sqlite-store`
- `包裹/运输` 中客户端侧支架
- `应用程序/Caller控制器`
- `应用程序/Responder控制器`
- `应用程序/操作`
- `应用程序/操作控制台`

未来服务端仓：

- `应用程序/平台 API`
- `应用程序/平台控制台`
- `应用程序/平台控制台网关`
- `应用程序/传输中继`
- `包/postgres-store`
- `部署`
- `Dockerfile.workspace`

已冻结的归属规则：

- `platform-console-gateway` 归服务端，不归客户端
- `transport-relay` 归服务端，不归客户端
- `ops` 可以连接外部源码relay，也可以启动外部relay进程，但拆仓后不再要求relay 留在客户端仓

## 不属于协议仓的内容

以下内容保留在未来客户端/平台仓库，不宜倒灌回协议侧：

- Caller/Responder/操作/中继/平台的运行时间代码
- SQLite / PostgreSQL 存储实现
- 撰写、镜像、部署和运营运维流程
- 只描述当前实现细节的产品文档

## 协议稳定面

这几个面向中央仓库的接口现在被视为协议稳定面：

- `@delexec/contracts` 中的错误码与默认重试语义
- `@delexec/contracts` 中的请求状态枚举
- `@delexec/contracts`中的结果签名规范化规则
- `docs/templates` 中的目录模板、热线模板与 JSON Schema
- 协议规范文档中的对象模型、签名字段和验证顺序

## 发布产品策略

预分割阶段的协议发布物是`@delexec/contracts`。

它现在承担两类职责：

1.导出稳定的协议常量和助手。
2. 在资源时附带模板与协议文档快照，提供客户端/平台通过已发布的产物读取，而不是继续依赖单一仓库相对路径。

已固定的模板发布形式：

- 模板源仍由 [docs/templates](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/docs/templates) 维护。
- `@delexec/contracts` 在 `npm pack` / 发布时会携带 `templates/` 和 `templates/manifest.json`。
- 下游实现应通过`@delexec/contracts`导出的路径helper或manifest消费这些模板。

## 当前约束

-阶段现仍保留monorepo作为开发主仓。
-阶段现在仍保留 `@delexec/*` 命名，不做半途重命名。
- 在`@delexec/contracts`发布仓库、模板消费仓库、洁净室安装结算稳定前，不执行物理拆仓。

## 当前预分割完成信号

下面这些信号现已被明确纳入预分割门：

- `npm 运行测试：协议：包`
- `npm 运行测试：服务：包`
- `npm 运行测试：e2e：包`

这三条分别对应：

- 协议产物可洁净室安装
- 客户端/平台关键服务产品可洁净室安装和启动
- 跨边界e2e可优先使用已安装tarball命令，而不是源码入口
