Tests

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# Tests

本目录包含MVP阶段的测试组件和联调能力。

## 目录

- `tests/unit`：纯逻辑单测
- `tests/integration`：单服务集成测试（HTTP + 内存状态）
- `tests/e2e`：三端联调场景（成功/超时/token过渡/结果不合规）
- `tests/mocks`：联调mock（平台、交通运输、时钟）
- `tests/helpers`：测试工具函数
- `tests/reports`：测试运行产物（`latest.json`）

邮件运输相关补充：

- `测试/集成/email-transport.integration.test.js`
  - 内存邮件传输抽象测试
- `测试/集成/emailengine-transport.integration.test.js`
  - EmailEngine REST `API v1` 适配器测试
- `测试/集成/gmail-transport.integration.test.js`
  - Gmail `gmail/v1` 适配器测试

## 运行

- `npm 运行测试：单元`
- `npm 运行测试：集成`
- `npm 运行测试：e2e`
- `npm run test:e2e:ui`（Vitest Web UI）
- `npm 运行测试：部署：配置`
- `npm 运行测试：烟雾：平台`
- `npm 运行测试：烟雾：Caller`
- `npm 运行测试：烟雾：Responder`
- `npm 运行测试：compose-smoke`
- `npm 运行测试：public-stack-smoke`
- `npm 运行测试：本地图像烟雾`
- `npm 运行测试：已发布的图像-smoke`

`compose-smoke` 补充说明：
- 默认情况下会为每次运行生成独立的`COMPOSE_PROJECT_NAME`，避免与本机其他组件互相污染。
- 运行前会先做`docker compose config`预审核，物质同项目做一次`down --remove-orphans -v`预清理。
- 对 `image_pull_failed` 会做有限次自动重试（默认 2 次，可用 `COMPOSE_IMAGE_PULL_RETRIES` 覆盖）。
- 失败分类重点区分：`image_pull_failed`、`port_conflict`、`service_runtime_failed`、`health_check_timeout`、业务流程回归。

镜像型烟雾区分：

- `测试：本地图像烟雾`
  - 依赖本机构建良好的发布型镜像
  - 主要用于CI中验证基于图像的撰写路径本身
- `测试：发布的图像烟雾`
  - 直接尝试从`IMAGE_REGISTRY/IMAGE_TAG`拉取镜像
  - 当前默认目标是 `ghcr.io/hejiajiudeeyu`
  - 更适合发布后或手动工作流程验证

## 流程图反馈

`npm run test:e2e` 会写出 `tests/reports/latest.json`，可在
`site/protocol-playground.html` 中加载并将问题映射到每个图步骤编号（如 `F1-F1`）。
