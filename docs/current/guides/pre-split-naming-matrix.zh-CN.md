预分割命名矩阵

> 英文版：[pre-split-naming-matrix.md](pre-split-naming-matrix.md)
> 说明：中文文档为准。

# 预分割命名矩阵

本文件冻结未来三仓分割时需要一起替换的替换矩阵。

当前阶段的调用已经执行到仓内实现与当前文档，后续物理拆仓仓库git历史与仓库初始化。

## 当前名称到目标名称

| 维度 | 当前值 | 目标值| 当前状态 |
| :--- | :--- | :--- | :--- |
| 协议仓库 | `远程子代理协议` | `委托执行协议` | 仅限规划，未执行 |
| 客户端仓库 |不适用 | `委托执行客户端` | 仅限规划，未执行 |
| 服务端仓库|不适用 | `委托执行平台自主机` | 仅限规划，未执行 |
| npm 范围 | `@croc` | `@delexec` | 已执行 |
| 协议包 | `@delexec/contracts` | `@delexec/contracts` | 已执行 |
| CLI 包 | `@delexec/ops` | `@delexec/ops` | 已执行 |
| CLI 执行名 | `鳄鱼行动` | `delexec-ops` | 已执行，保留短兼容窗口 |
|智威汤逊发行人 | `croc-platform-api` | `delexec-platform-api` | 已执行 |
| 本地数据目录 | `~/.remote-subagent/` | `~/.delexec/` | 已执行，保留迁移逻辑 |
| SQLite 文件名 | `croc.sqlite` | `delexec.sqlite` | 已执行，保留迁移逻辑 |

## 执行规则

-范围、CLI名称、JWT发行者、本地目录名称和SQLite文件名称已经在同一个轮仓内收口完成。
- 全文扫描现在改为确认旧命名只保留在迁徙说明和历史规划文档中。
- 客户端与平台侧的洁净室/打包e2e门继续物理拆仓前置条件。

## 当前冻结决定

- `@delexec` 现在被视为正式定稿，不再作为占位。
- `delexec-ops`、`delexec-platform-api`、`~/.delexec/` 和 `delexec.sqlite` 已冻结为正式默认值。
- 兼容窗与迁移细节见[rename-local-state-migration-map.md](/Users/hejiajiudeeyu/Documents/Projects/remote-subagent-protocol/docs/current/guides/rename-local-state-migration-map.md)。
