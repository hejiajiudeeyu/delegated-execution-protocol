# atlas.knowledge.qa.v1

**Atlas 企业知识问答** — 用自然语言提问，获得基于私有知识库的有据可查回答和引用来源。私有知识语料库、检索策略、领域微调嵌入模型和重排序算法全部运行在 Responder 侧，对 Caller 完全不可见。

## 基本信息

| 字段 | 值 |
|------|----|
| `hotline_id` | `atlas.knowledge.qa.v1` |
| `responder_id` | `responder_atlas` |
| `task_types` | `["knowledge_qa", "rag_retrieval"]` |
| `capabilities` | `["knowledge.retrieve", "qa.grounded", "multilingual"]` |
| `tags` | `["enterprise", "rag", "knowledge-base", "qa"]` |

## 为什么适合作为 Hotline

Caller 只需发送一个问题字符串。Responder 的核心 IP——私有知识语料库、分块策略、基于领域词汇微调的嵌入模型和重排序算法——始终留在 Responder 的执行环境中。知识本身永远不会向外流出。这是 Hotline 设计的典型范例：**问题是公开的，知识是私有的**。

## 适用场景

- 企业内部 HR、政策、合规问答
- 客户支持知识库检索
- 工程团队技术文档助手
- 新员工入职知识查询
- 专有文档集合的研究综合

## 不适用场景

- 需要实时外部数据的问题（股价、实时新闻）
- 需要严格逐字法律引用的任务（使用专用法律审查服务）
- 开放域通用知识问答（更适合通用 LLM）
- 需要长共享上下文的多轮对话推理

## 已知限制

- 最大问题长度：1,000 字符
- `retrieval_coverage: "none"` 表示知识库对此问题没有相关覆盖
- 置信度低于 0.6 时表明覆盖不足或质量较低——请谨慎对待答案
- 若 Responder 的策略限制原文暴露，`sources[].excerpt` 可能被省略

## 输入

提供自然语言问题（必需，最大 1,000 字符），可选指定 `language`（响应语言）、`max_sources`（最大引用数量）和 `context_hint`（检索焦点提示）。无文件附件。

## 输出

返回 `answer`（有据可查的自然语言回答）、`confidence`（0.0–1.0）、`sources`（引用列表）、可选的 `follow_up_questions`（追问建议）和 `retrieval_coverage`（覆盖评估）。无文件附件。

## 快速开始

```json
{
  "input": {
    "question": "我们公司对员工出差报销的标准是什么？国内二线城市的住宿上限是多少？",
    "language": "zh-CN",
    "max_sources": 3,
    "context_hint": "HR policy"
  }
}
```

完整调用合约见 `example-contract.json`，完整结果结构见 `example-result.json`。
