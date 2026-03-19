跨存储库兼容性测试

> 英文版：[cross-repo-compatibility-testing.md](cross-repo-compatibility-testing.md)
> 说明：中文文档为准。

# 跨仓库兼容性测试

本文件定义了预拆分阶段的跨仓验收测试形态。

目标不是继续依赖 monorepo 内部源码导入，而是逐步把全系列测试切到“独立进程 + HTTP + 已发布产品”模式。

## 当前原则

- 单位/整合仍由各实际仓各自负责
- e2e /compatibility 测试必须把服务边界外组件启动
- 交互测试只走HTTP、CLI、compose，不走源码级服务器工厂导入

## 当前 e2e 启动模型

当前 [tests/e2e](/Users/hejiajiudeeyu/Documents/Projects/remote-subagent-protocol/tests/e2e) 已改成独立进程启动：

- 平台
- 继电器
- 买家
- 卖家
- 运营主管

默认情况下，测试会退到当前仓库内的源码入口。

但现在已经支持通过环境变量覆盖启动命令，从而优先消耗已安装包或外部命令。

仓库内还提供了一个tarball启动检查：

- `npm 运行测试：服务：包`
- `npm 运行测试：e2e：包`

此处检查会：

- `npm pack` 平台/买家/卖家/中继
- 在空目录安装 tarball
- 直接启动各自的bin
- 验证`/healthz`

`npm run test:e2e:packages` 会在此基础上继续：

- 把这些已安装的 tarball 入口注入 `E2E_*_CMD` / `E2E_*_ARGS`
- 实际运行整套`test:e2e`
- 验证e2e可以在“已安装产物优先”模式下通过

##环境变量

每个服务都可以通过两类环境指标覆盖：

- `E2E_<服务>_CMD`
- `E2E_<服务>_ARGS`

支持的服务名称：

- `平台`
- `中继`
- `买家`
- `卖家`
- `OPS_SUPERVISOR`

`*_ARGS` 既可以是 JSON 存储，也可以是空格分隔字符串。

译文：

```bash
E2E_PLATFORM_CMD=delexec-platform-api
E2E_PLATFORM_ARGS='[]'
E2E_RELAY_CMD=delexec-relay
E2E_BUYER_CMD=delexec-buyer-controller
E2E_SELLER_CMD=delexec-seller-controller
E2E_OPS_SUPERVISOR_CMD=delexec-ops
E2E_OPS_SUPERVISOR_ARGS='["start"]'
npm run test:e2e
```

路径的设计目标是：

- 本地开发时默认仍可从源码入口运行通
- 一旦客户端/平台仓开始发布 tarball 或 npm 包，同一套 e2e 可以直接切到已发布二进制入口

## 推荐分层

1.仓内测试  
   单元/集成，后续源码

2. 发布产物e2e  
   启动已安装包、已分配CLI或外部命令，只走HTTP / CLI

3.镜像级兼容性  
   拉发布镜像，用 compose 运行完整验收

## 当前限制

- 目前还没有把 `platform` / `buyer` / `seller` 赋为 clean-room 可独立 npm 安装的公开分发物
- 因此 `E2E_*_CMD` 的主要用途还是为本地 tarball、临时安装目录、外部包装脚本留接口
- 真正的“发布包优先”要等客户端/平台仓的分发闭环完成后再切为默认模式
