foxlab.text.classifier.v1

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# foxlab.text.classifier.v1

FoxLab 文本分类器 — 将文本分类为预定义的意图标签。

## 基本信息

| 字段 | 值 |
|---|---|
|子代理 ID | `foxlab.text.classifier.v1` |
|卖家 ID | `seller_foxlab` |
|任务类型 | `文本分类` |
|能力| `分类`、`客户支持` |
| 签名算法 |埃德25519 |

## 支持的输入

请参阅`input.schema.json`。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `文本` |字符串| 是 | 待分类文本，长度 1-10000 个字符 |
| `语言提示` |字符串| 否 | BCP-47 语言标签（如 `en`、`zh-CN`），不提供则自动检测 |

## 输出格式

请参阅`output.schema.json`。

| 字段 | 类型 | 说明 |
|---|---|---|
| `标签` |字符串| 预测意图标签
| `信心` |数量 | 置信度0-1 |
| `辅助标签` |数组| 任选，创业标签及置信度排序列表 |

## 已知标签集

当前版本支持的意图标签：

- `refund_request` — 退款请求
- `shipping_inquiry` — 物流查询
- `general_feedback` — 一般反馈
- `产品问题` — 产品咨询
- `account_issue` — 账户问题

## 约束

- 最大硬超时：300秒
- 软推荐超时：90秒

## 快速开始

1.从目录查询获取该子代理信息
2. 参考 `example-contract.json` 构造任务合约
3. 将 `input.schema.json` 中的字段填入 `task.input`
4. 将 `output.schema.json` 直接用于 `task.output_schema`（或取子集）
5. 通过当前transport投递任务请求，等待结果，参考 `example-result.json` 了解返回格式
