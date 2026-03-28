# starlight.creative.studio.v1

**Starlight AI 创意工坊** — 提交自然语言创作提示词，获得 AI 生成的创意图像。多模型编排管线、Prompt 工程策略、风格库和后处理逻辑全部运行在 Responder 侧，对 Caller 完全不可见。

## 基本信息

| 字段 | 值 |
|------|----|
| `hotline_id` | `starlight.creative.studio.v1` |
| `responder_id` | `responder_starlight` |
| `task_types` | `["creative_generation", "image_synthesis"]` |
| `capabilities` | `["image.generate", "style.transfer", "multi_model.orchestrate"]` |
| `tags` | `["creative", "image", "ai-generation", "design"]` |

## 为什么适合作为 Hotline

Caller 只需提供一个文本提示词和可选的风格参数。Responder 的核心 IP——多阶段模型编排管线、专有 Prompt 增强模板、风格迁移算法和微调模型——始终留在 Responder 的执行环境中，对外界不可见。这正是 Hotline 的核心特征：**对外发布的是接口，不是大脑**。

## 适用场景

- 产品摄影和电商视觉素材生成
- 营销 Banner 和社交媒体内容创作
- 概念图和创意探索
- 品牌一致性视觉资产批量生产
- 视觉营销方案的快速原型制作

## 不适用场景

- 需要实时修改循环的交互式编辑工作流
- 需要严格法律准确性的图示（医疗、法律、金融图表）
- 无专项协议情况下的超高分辨率印刷生产（> 4K）
- 受法规限制的内容生成

## 已知限制

- 最大提示词长度：2,000 字符
- 每次调用最多生成 4 个变体
- 参考图仅作为软风格信号使用，不作为直接条件输入
- 输出元数据中的 `pipeline_stage_count` 不透露具体阶段详情

## 输入

提供创作提示词（必需，最大 2,000 字符），可选指定 `style_preset`（风格预设）、`output_format`（输出格式）、`quantity`（生成数量）和 `aspect_ratio`（宽高比）。可附带可选的 `reference_image` 文件作为构图或风格参考。

## 输出

返回 `generated_items` 数组（每个生成资产对应一条记录），包含附件角色引用和尺寸信息。所有图像文件通过输出附件返回（`generated_asset_1` 至 `generated_asset_4`）。调用成功时至少返回一个资产。

## 快速开始

```json
{
  "input": {
    "prompt": "一款高端护肤精华的产品宣传图，背景简洁纯白，柔和的影棚光线，高端编辑风格",
    "style_preset": "product_clean",
    "output_format": "jpeg",
    "quantity": 2,
    "aspect_ratio": "1:1"
  }
}
```

完整调用合约见 `example-contract.json`，完整结果结构见 `example-result.json`。
