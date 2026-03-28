local.summary.v1

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# local.summary.v1

`local.summary.v1` 是与 ops 客户端捆绑在一起的官方本地演示热线。

用它来：

- 了解预期的Responder 热线形状
- 验证本地Caller -> Responder自助调用流程
- 具有稳定、零依赖示例的引导编码代理

Input:

```json
{
  "text": "Summarize this local example request."
}
```

Output:

```json
{
  "summary": "Summarize this local example request."
}
```

Default metadata:

- `hotline_id`: `local.summary.v1`
- `task_types`: `["text_summarize"]`
- `功能`: `["text.summarize"]`
- `tags`: `["本地", "示例", "演示"]`
- `适配器类型`：`进程`

捆绑的工作人员由以下人员提供：

- [example-hotline-worker.js](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/apps/ops/src/example-hotline-worker.js)
