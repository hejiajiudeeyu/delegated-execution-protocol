# pixel.product.renderer.v1

**Pixel 产品图渲染器** — 上传产品照片，获得高质量的电商渲染视觉素材。精调渲染模型、品牌风格管线、背景合成算法和后处理链全部运行在 Responder 侧，对 Caller 完全不可见。

## 基本信息

| 字段 | 值 |
|------|----|
| `hotline_id` | `pixel.product.renderer.v1` |
| `responder_id` | `responder_pixel` |
| `task_types` | `["product_render", "image_compositing"]` |
| `capabilities` | `["image.render", "background.synthesis", "product.retouch"]` |
| `tags` | `["ecommerce", "product-photo", "rendering", "image-ai"]` |

## 为什么适合作为 Hotline

Caller 只需提供一张产品照片和一段文字描述。Responder 的核心 IP——基于商业产品摄影训练的专有精调渲染模型、背景合成算法、多道合成管线和后处理预设——始终留在 Responder 的执行环境中。源产品照片处理完成后不会被存储。这是 Hotline 设计的典型范例：**产品是公开的，渲染智能是私有的**。

## 适用场景

- 电商平台产品详情页视觉素材
- 产品发布营销资产批量生产
- 多角度产品渲染用于目录生成
- 广告投放的快速视觉 A/B 测试
- 经销商白牌产品摄影替换

## 不适用场景

- 需要物理触感细节精确还原的产品（如面料质地认证）
- 严格的工程制图或技术线图
- 视频或动态产品渲染（此 hotline 仅生成静态图像）
- 需要人工审核品牌标准色匹配认证的任务

## 已知限制

- 源照片最大大小：15MB
- 支持输入格式：JPEG、PNG、WebP
- 每次调用最多生成 4 张渲染图
- 元数据中 `background_removal_applied: false` 表示源照片背景较为复杂，可能影响渲染质量——建议事先裁剪产品边界

## 输入

提供产品描述（必需，最大 1,500 字符）和 `product_photo` 附件（必需，最大 15MB）。可选指定 `background_style`（背景风格）、`angle`（拍摄角度）、`resolution`（分辨率）和 `quantity`（生成数量）。

## 输出

返回 `renders` 数组（每张渲染图对应一条记录），包含附件角色引用和已应用的风格信息。所有图像文件通过输出附件返回（`rendered_image_1` 至 `rendered_image_4`）。调用成功时至少返回一张渲染图。

## 快速开始

```json
{
  "input": {
    "product_description": "一款黑色哑光铝合金外壳的蓝牙耳机，弧形头梁，带软垫耳罩，侧面有金属品牌标识。展示科技感和高端质感。",
    "background_style": "dark_premium",
    "angle": "three_quarter",
    "resolution": "1500x1500",
    "quantity": 2
  }
}
```

同时附上角色为 `product_photo` 的产品照片附件。完整调用合约见 `example-contract.json`，完整结果结构见 `example-result.json`。
