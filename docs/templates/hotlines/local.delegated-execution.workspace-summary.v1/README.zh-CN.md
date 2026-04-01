local.delegated-execution.workspace-summary.v1

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# local.delegated-execution.workspace-summary.v1

`local.delegated-execution.workspace-summary.v1` 是与 ops 客户端捆绑在一起的官方本地 workspace summary 热线。

用它来：

- 从 Caller 视角查看本地优先热线草稿应该长什么样
- 验证本地 Caller -> Responder 自调用流程
- 为编码代理和本地 onboarding 提供稳定的 workspace summary 示例

Input:

```json
{
  "text": "CHG-2026-003 is in progress. The local onboarding flow is now stable, and platform publishing remains a later optional step.",
  "instruction": "Summarize the current progress in 2-3 sentences and mention the next step."
}
```

Output:

```json
{
  "summary": "本地 onboarding 流程现在已经可以在不依赖 platform bootstrap 的情况下完成 caller 注册、responder 启用、draft 查看和本地自调用。下一步应继续完善本地 hotline 管理，再扩展 platform 与社区发布能力。"
}
```

Default metadata:

- `hotline_id`: `local.delegated-execution.workspace-summary.v1`
- `task_types`: `["text_summarize"]`
- `功能`: `["text.summarize", "workspace.status"]`
- `tags`: `["本地", "工作区", "摘要"]`
- `适配器类型`：`进程`
