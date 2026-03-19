delegated-execution-protocol

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# delegated-execution-protocol

用于委托执行的协议定义、模式、模板和兼容性文档。

该存储库是从原始 monorepo 中分离出来的协议端，包含可发布的“@delexec/contracts”包以及协议真实源文档和模板资产。

## 人工智能协作

- `CLAUDE.md` 定义了存储库特定的开发和验证规则。
- `AGENTS.md` 为 AI 编码代理提供了最小的路由和所有权摘要。

## 存储库职责

该存储库拥有稳定的跨存储库协议面：

- 协议对象、模式和验证助手
- 错误注册表、状态枚举和签名/规范化规则
- 捆绑模板和协议文档快照
- 客户端和平台实施者的兼容性指南

该存储库不拥有买方运行时行为、卖方运行时行为、操作员部署或特定于应用程序的存储实现。

## 发布目标

- npm 包：`@delexec/contracts`
- 访问：公开
- 运行时：Node.js 20+

## 如何在这里开发

- 当您需要更改协议形状、请求/结果语义、模式验证或模板有效负载时，请首先更改此存储库。
- 将实现细节保留在该存储库之外。如果更改仅影响 CLI UX、部署、持久性策略或操作员工作流程，则它属于另一个存储库。
- 将每个更改视为上游兼容性更改。更新文档、捆绑资产和发行说明以及代码。

推荐变更流程：

1. 修改此存储库中的协议代码和文档。
2. 发布新的`@delexec/contracts`版本。
3. 更新 `dele脱-execution-client` 和 `dele脱-execution-platform-selfhost` 以使用新版本。

## 本地验证

```bash
npm install
npm test
```
