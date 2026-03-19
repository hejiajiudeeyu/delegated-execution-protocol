Security Policy

> 英文版：[SECURITY.md](SECURITY.md)
> 说明：中文文档为准。

# 安全策略

## 1. 支持范围

当前重点覆盖：
- Token签发与校验（`/v1/tokens/*`）
- 目录与全局分发（`/v1/catalog/*`）
- 请求事件与指标接口（`/v1/requests/*`, `/v1/metrics/*`）
- 买方/卖方承诺与结果包校验逻辑

## 2.漏洞上报

请不要在公开Issue中直接披露安全漏洞细节。

请优先使用GitHub私人漏洞报告（PVR）私人下报告：
- 报告漏洞：`https://github.com/hejiajiudeeyu/remote-subagent-protocol/security/advisories/new`


## 3.上报内容建议

请尽量包含：
- 影响范围与前置条件
- 复现步骤
- PoC（可选）
- 影响预期（数据泄露/越权/重放等）
- 修复建议（任选）

## 4.响应时效目标

- 24小时内确认收到
- 72小时内部提出分级与处理路径
- 修复完成后协商披露时间

## 5. 披露流程

- 默认采用协调披露（Cooperative Disclosure）。
- 在修复发布之前，不公开复现细节与利用代码。
- 修复发布后，可在双方确认后公开技术细节。

## 6. 当前已知风险（MVP）

- 邮件通道不保证端到端加密，Token存在理论截获面
- v0.1以在线内省为主，平台可用性会影响卖家售货权
- v0.1 为 ACK-only 事件模型，排错精度有限

以上风险文档属于已声明的MVP取舍，不代表可以忽略的安全问题。
