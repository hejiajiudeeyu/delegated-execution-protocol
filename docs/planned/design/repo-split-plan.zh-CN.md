仓库规划拆分

> 英文版：[repo-split-plan.md](repo-split-plan.md)
> 说明：中文文档为准。

# 仓库拆分规划

## 1.背景

当前 monorepo 包含协议定义、参考实现（买方/卖方）、平台服务、部署配置、运维 CLI 与控制台。随着 L0 闭环趋于稳定，需要将仓库拆分为独立职责的多个仓库，促进协议独立演进、客户端独立分发、平台独立部署。

## 2.npm 范围

拆分后的包已经在 monorepo 内完成 `@delexec/` 范围收口，后续物理拆仓不再重新改名。

| 项 | 当前值 | 拆分后目标|
| :--- | :--- | :--- |
| npm 范围 | `@delexec` | `@delexec` |
| CLI 入口 | `npx @delexec/ops` | `npx @delexec/ops` |
|智威汤逊发行人 | `delexec-platform-api` | `delexec-platform-api` |
| 本地数据目录 | `~/.delexec/` | `~/.delexec/` |
| SQLite 文件名 | `delexec.sqlite` | `delexec.sqlite` |

移民合同：

- 范围变更是整体的全局替换，涉及所有 `package.json`、import 路径、文档示例、CLI 入口和 JWT 声明。
- 应在拆分执行中避免同一批次变更中完成，中间状态。
-scope、CLI、issuer和本地状态命名已经定稿，不再作为拆仓前待决项。

## 3.目标仓库

### 3.1 delegated-execution-protocol（协议仓库）

定义代理生态中的委托执行协议，包括角色、对象模型、授权、合同、结果验证、信任累积、版本兼容与扩展边界。

命名理由：

- 语义准确——协议核心是“跨边界委托执行”，而不是普通消息通信或工具调用。
- 与主流代理叙述自然对接——MCP是工具接入层，A2A是代理间互操作层，本协议指向执行委托这一层。
- 扩展性好——参与方无论叫subagent、provider、executor、seller，协议名都不基础。

应包含内容：

| 来源路径 | 说明 |
| :--- | :--- |
| `包/合同/` | 协议常量、枚举状态、错误域、签名规范化 |
| `文档/当前/` | 当前已实现的协议规范与接入文档|
| `文档/模板/` | 能力声明模板与 JSON Schema |
| `文档/当前/图表/` | 当前协议层流程图 |
| `docs/planned/roadmap/evolution-roadmap.md` | 演策划|
| `docs/current/spec/remote-subagent-scope.md` | 范围指引 |

发布形式：npm包（`@delexec/contracts`），提供客户端和平台仓库作为上游依赖引用。

### 3.2 delegated-execution-client（客户端仓库）

面向终端用户的统一客户端，支持买方主流程、卖方功能预置与启用，并内置市场接入能力。

命名理由：

- 足够宽——可同时容纳买家和卖家的彩虹能力。
- 不会把marketplace升格为仓库主名——marketplace只是内置接入能力之一。
- 符合用户直觉——“客户端”就是用户安装和使用的那个东西。

应包含内容：

| 来源路径 | 说明 |
| :--- | :--- |
| `packages/buyer-controller-core/` | | `packages/buyer-controller-core/` 买家端核心逻辑 |
| `packages/seller-runtime-core/` | 卖家端运行时核心|
| `包裹/运输/` | 传输骆驼（local、relay-http、email） |
| `packages/sqlite-store/` | 客户端侧本地存储 |
| `应用程序/买方控制器/` | 买家控制器服务 |
| `应用程序/卖家控制器/` | 卖家控制器服务 |
| `应用程序/操作/` | 统一Ops CLI |
| `应用程序/操作控制台/` | 用户控制台 |
| 客户端侧单元/集成测试 | — |

### 3.3 delegated-execution-platform-selfhost（自部署仓库）

提供委托执行平台的自部署方案，包括平台服务、部署配置、运维、升级、监控与树化运行支持。

命名理由：

- 边界清晰——一眼就知道是平台的自部署方案。
- 适合长期演进——docker compose、helm、k8s、registry、auth、verification、observability自然吸气。
- 命名体系统一——三个仓库都围绕 `delegate-execution` 组织。

应包含内容：

| 来源路径 | 说明 |
| :--- | :--- |
| `apps/platform-api/` | 平台控制面API |
| `应用程序/平台控制台/` | 平台管理控制台 |
| `应用程序/传输中继/` | 传输服务 |
| `packages/postgres-store/` | PostgreSQL 仓储 |
| `部署/` | 全部配置部署（平台、中继、买家、卖家、运营、一体） |
| `docker-compose.yml` | 根 撰写 |
| `Dockerfile.workspace` | 多应用构建基础镜像 |
| `生成文件` | 配置快捷命令 |
| `.github/workflows/images.yml` | 镜像构建与发布 |
| 部署文档、运维文档 | — |
| e2e 测试与撰写烟雾 | 全栈测试需要全栈环境|

## 4. 拆分后依赖架构

```
delegated-execution-protocol (npm: @delexec/contracts)
        ▲                    ▲
        │                    │
        │                    │
delegated-execution    delegated-execution
      -client            -platform-selfhost
```

协议仓库是纯上游。客户端和自部署仓库单向依赖协议仓库，互不依赖。

## 5.共享包归属

| 包| 归属仓库 | 消费方 | 说明 |
| :--- | :--- | :--- | :--- |
| `合同` |协议|客户端、平台-selfhost | 协议层定义，作为 npm 包发布 |
| `买方控制器核心` |客户| — |买家侧核心逻辑 |
| `卖家运行时核心` |客户| — |卖家侧核心逻辑 |
| `sqlite 存储` |客户| — | 客户端默认存储 |
| `postgres 商店` |平台-selfhost | — | 平台默认存储 |
| `本地传输` |客户| — | 本地传输，仅客户端使用 |
| `传输中继-http` |客户| — |中继 HTTP 传送 |
| `传输电子邮件` |客户| — | 邮件传输班级 |

## 6. 策略存储

| 侧 | 默认存储 | 理由 |
| :--- | :--- | :--- |
| 客户端（买家/卖家/运营商） | SQLite | 零运维、零配置、安装即用，不需要用户额外启动数据库进程 |
| 平台（platform-api） | PostgreSQL | 多车站安装、事务隔离、聚合查询、多实例共享 |

设计约束：

- 存储层通过架构抽象（`sqlite-store`、`postgres-store`）注入，业务逻辑不直接耦合具体存储实现。
- 默认选择不相等唯一选择——闹钟接口保持统一，后续需要可以切换。
- 拆分后 `sqlite-store` 紧接着 client 仓库，`postgres-store` 紧接着 platform-selfhost 仓库，两个仓库包不再有交集。

客户端选择SQLite的具体收益：

- 用户通过 `npx @delexec/ops` 启动后，SQLite 文件自动在本地数据目录中，消耗创建任何前置安装。
- 不引入额外的运行时进程，降低本地资源占用与排障复杂度。
- 离线场景下仍可查看历史请求记录。

平台选择 PostgreSQL 的具体收益：

- 支持多个卖家心跳、买家的代币签发以及多个事件上报到达。
-审核支持状态变更、目录边境更新等需要事务隔离的操作。
- 支持指标聚合查询与运维落地。
- 支持多实例水平扩展共享相同数据库。

## 7. 需要提前解决的问题

### 7.1 共享包发布管道

当前所有包为 `private: true`。分割前需要：

- 确认最终范围名称（暂定`@delexec/`，见§2）。
- 选定的发布渠道（npm public 或 GitHub Packages）。
- 建立发布模拟（CI自动发版或手动标签触发）。

### 7.2 ops CLI 对传输中继的直接依赖

当前 `ops` 应用直接依赖 `buyer-controller`、`seller-controller`、`transport-relay` 三个应用作为工作区依赖。拆分后 `transport-relay` 归入自部署仓库。

解决方案：

- 方案A：ops中内嵌轻量本地中继（用于游乐场场景）。
- 方案B：ops通过网络调用第三方中继，不再直接依赖其源码。

建议采用方案B，同时在ops中提供 `--local-relay` 选项，自动拉起一个独立中继进程用于本地开发。

### 7.3 E2E 测试拆分

目前`tests/`目录是统一的，e2e测试跨买家/卖家/平台全渠道。

拆分：策略

| 测试类型 | 归属 | 说明 |
| :--- | :--- | :--- |
|单位| 各仓库各自携带| 即将 | 源码
|整合| 各仓库各自携带| 即将 | 源码
|电子对电子 |平台-selfhost | 需要全栈环境，通过发布的镜像拉取各组件 |
|烟雾 |平台-selfhost | 同上 |

### 7.4 CI 拆分

当前 `ci.yml` 是统一同步。拆分后各需要仓库独立 CI：

- 协议：lint + 单元测试 + npm 发布。
- 客户端：lint + 单元 + 集成 + 客户端侧烟。
- platform-selfhost：lint + 单元 + 集成 + compose Smoke + e2e + 镜像构建发布。

### 7.5 模板与目录同步

容量模板存放在协议仓库。平台需要通过API下发这些模板。

同步机制候选：

- 平台构建时从协议仓库 npm 包中获取模板文件。
- 平台侧维护 git submodule 指向协议仓库的 templates 目录。
- 平台API代理透传，运行时从协议仓库发布产物中读取。

建议在 L0 阶段使用构建时提取方案，后续可迁移到独立存储。

## 8. 分割时机

建议在以下条件全部满足后执行拆分：

| 条件 | 原因 |
| :--- | :--- |
| L0 平仓清单最低栏 三项全部关闭 | 协议层趋于稳定，跨端联动大幅减少
|合同包接口有明确的版本号 | 协议包是拆分根基，必须先稳定 |
| 至少运行一次完整的已发布图像组成烟雾| 证明各组件可通过发布产物协作|
| ops CLI 对中继的直接依赖已解耦 | 否则分割会直接破坏 ops 功能 |

在此之前，保持monorepo开发。全仓库联调在monorepo中效率最高——改一处重复`npm run test:e2e`即可验证，耗费跨仓库协调发版。

## 9. 预拆分准备（monorepo 内可提前完成）

以下工作可以在不拆分的前提下完成，每完成一项都会降低以后拆分的成本。

### 9.1 冻结合约公共 API 表面

- 整理 `packages/contracts/src/index.js` 的完整导出列表。
- 明确每个导出项的类型签名和引申。
- 标记版本号并写入CHANGELOG。

### 9.2 存储包去耦合

- 确认`postgres-store`和`sqlite-store`没有对特定应用程序的隐式假设。
- 确定两者可作为独立的 npm 包被任意仓库消费。

### 9.3 E2E测试走HTTP调用

- 将e2e测试中的“源码直接导入”改为通过HTTP调用各服务。
- 拆分后测试不需要重写，只需改变服务启动方式。

### 9.4 ops CLI 解耦中继

- 将 ops 中对 `transport-relay` 的直接依赖代码改为“启动外部进程或连接外部服务”模式。
- 保留`--local-relay`选项用于本地开发。

### 9.5 镜像独立构建验证

- 确认 CI 的 `images.yml` 中每个应用程序的镜像能够独立构建和发布。
- 不依赖 monorepo 工作区解析。

## 10. 执行顺序

1. 完成预分割准备（§9）。
2. 确认最终npm作用域（§2），执行全局作用域替换。
3. 将`packages/contracts`改为可发布的公共包，确定版本策略、发布渠道。
4.拆出协议仓库——合约包+协议文档+模板。
5.拆出自部署仓库——platform-api、platform-console、transport-relay、deploy配置。
6. 剩余部分即为客户端仓库——调整ops对中继的依赖方式。
7. 重建e2e测试和CI——这是拆分中最复杂的部分，需要通过发布镜像拉取各个组件来构建全栈环境。
