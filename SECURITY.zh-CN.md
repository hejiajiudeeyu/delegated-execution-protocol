安全策略

> 英文版：[SECURITY.md](SECURITY.md)
> 说明：中文文档为准。

# 安全策略

## 1. 支持范围

当前重点覆盖：
- Token 签发与校验（`/v1/tokens/*`）
- 目录与控制面分发（`/v2/hotlines` 等）
- 请求事件与指标接口（`/v1/requests/*`、`/v1/metrics/*`）
- Caller / Responder 合约与结果包校验逻辑

## 2. 漏洞上报

请不要在公开 Issue 中直接披露安全漏洞细节。

优先使用 GitHub 私密安全报告：
- 漏洞上报：[https://github.com/hejiajiudeeyu/remote-hotline-protocol/security/advisories/new](https://github.com/hejiajiudeeyu/remote-hotline-protocol/security/advisories/new)

## 3. 上报内容建议

请尽量包含：
- 影响范围与前置条件
- 复现步骤
- PoC（可选）
- 影响预期（数据泄露、越权、重放等）
- 修复建议（可选）

## 4. 响应时效目标

- 24 小时内确认收到
- 72 小时内给出分级与处理路径
- 修复完成后协商披露时间

## 5. 披露流程

- 默认采用协调披露（coordinated disclosure）
- 在修复发布之前，不公开复现细节与利用代码
- 修复发布后，经双方确认可公开技术细节

## 6. 当前已知风险（MVP）

- 邮件通道不保证端到端加密，token 存在理论上的截获面
- v0.1 以在线 introspect 为主，平台可用性会影响 responder 验权
- v0.1 为 ACK-only 事件模型，排障精度有限

以上内容属于已声明的 MVP 取舍，不代表这些风险可以忽略。
