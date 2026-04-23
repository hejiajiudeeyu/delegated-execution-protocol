delegated-execution-protocol

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# delegated-execution-protocol

> **属于 [CALL ANYTHING](https://callanything.xyz/)** —— 让任意 AI Agent 调用任意外部能力的开放协议。
> 本仓库是 **协议真实来源（truth-source）**：定义了什么是 Hotline、Caller 与 Responder 如何通信，以及任何 Agent 都能解析的标准 `result_package` 返回结构。
>
> 📖 [Docs](https://callanything.xyz/docs/) · [术语表](https://callanything.xyz/glossary/) · [FAQ](https://callanything.xyz/faq/) · [Blog](https://callanything.xyz/blog/) · [Marketplace](https://callanything.xyz/marketplace/) · [对比 vs MCP](https://callanything.xyz/compare/hotline-vs-mcp/)

---

## 关于 CALL ANYTHING

CALL ANYTHING 是一套面向 **AI Agent 委托外部能力（delegated execution）** 的开放协议。三个概念，一次学完：

- **Hotline** —— 把身份、计费、审批、可观测、路由全部固化在协议里的标准化能力契约。它不是 API、不是 MCP server、不是 Skill —— 但它**可以暴露成**这三种之一，因为 Hotline 是产品形态，那些只是接入面。
- **Caller / Responder** —— 每一通 Hotline 调用的两端。Caller 通常是 AI Agent 或 Agent 团队；Responder 通常是 **超级个体（OPC, One-Person Company）** —— 把私域专长打包成 7×24 在线、按次结算、Agent 可直接调用的服务实体的个人。
- **`result_package`** —— 协议级统一返回结构。所有 Hotline 都以同一种结构应答，Agent 学一次解析逻辑，就能调用任意 Hotline。

本仓库负责整个协议生态里 **跨仓库的稳定协议层** —— schemas、校验工具、错误注册表、签名/规范化规则、模板资产、兼容性指引。其它仓库构建在它之上：

- 🛠️ **客户端运行时与 CLI** —— [delegated-execution-client](https://github.com/hejiajiudeeyu/delegated-execution-client)（`@delexec/ops` + `delexec-ops` CLI）
- 🚀 **自托管平台与运维控制台** —— [delegated-execution-platform-selfhost](https://github.com/hejiajiudeeyu/delegated-execution-platform-selfhost)
- 🌐 **品牌站、公开 Marketplace、文档** —— [callanything.xyz](https://callanything.xyz/)

如果你是首次进入，建议先阅读品牌站的 [Caller 快速开始](https://callanything.xyz/docs/quick-start-caller/) 或 [Responder 快速开始](https://callanything.xyz/docs/quick-start-responder/)，再回来读本仓库内的协议定义。

---

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
