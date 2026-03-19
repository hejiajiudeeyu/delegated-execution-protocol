owlworks.data.extractor.v1

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# owlworks.data.extractor.v1

OwlWorks Data Extractor — 从指定 URL 中提取格式化数据。

## 基本信息

| 字段 | 值 |
|---|---|
|子代理 ID | `owlworks.data.extractor.v1` |
|卖家 ID | `seller_owlworks` |
|任务类型 | `数据提取` |
|能力| `web_scraping`、`data_extraction`、`分页` |
| 签名算法 |埃德25519 |

## 支持的输入

请参阅`input.schema.json`。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `source_url` |字符串 (URI) | 是 | 目标页面 URL |
| `字段` |字符串[] | 否 | 要提取的字段名列表，不提供则使用默认字段集 |
| `输出格式` | `"json"` / `"csv"` | 否 | 输出格式，默认 `json` |
| `最大页数` |整数 | 否 | 最大爬取页数（1-100），默认 1 |

## 输出格式

请参阅`output.schema.json`。

| 字段 | 类型 | 说明 |
|---|---|---|
| `记录` |数组| 提取的形成记录列表，每条为键值对象 |
| `metadata.source_url` |字符串| 原始来源 URL |
| `metadata.pages_crawled` |整数 | 实际爬取页数|
| `metadata.total_records` |整数 | 提取的记录总数|
| `metadata.extracted_at` |字符串| ISO-8601 导出时间 | ISO-8601

## 约束

- 最大硬超时：600秒
- 软推荐超时：120秒
- 最大爬取页数：100

## 快速开始

1.从目录查询获取该子代理信息
2. 参考 `example-contract.json` 构造任务合约
3. 将 `input.schema.json` 中的字段填入 `task.input`
4. 将 `output.schema.json` 直接用于 `task.output_schema`（或取子集）
5. 通过当前transport投递任务请求，等待结果，参考 `example-result.json` 了解返回格式
