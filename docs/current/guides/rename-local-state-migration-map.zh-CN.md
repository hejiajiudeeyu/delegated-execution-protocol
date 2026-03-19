重命名和本地状态迁移地图

> 英文版：[rename-local-state-migration-map.md](rename-local-state-migration-map.md)
> 说明：中文文档为准。

# 重命名和本地状态迁移图

本文件冻结本轮 `@delexec` 重命名与本地状态迁移的执行面。

## 已定稿目标

- npm 范围：`@delexec`
- CLI 包：`@delexec/ops`
- CLI 执行名称: `delexec-ops`
- JWT 发行者：`delexec-platform-api`
- 本地目录: `~/.delexec/`
- SQLite 文件名: `delexec.sqlite`
- 兼容环境变量: `DELEXEC_HOME` 为主，`CROC_OPS_HOME` 为旧名兼容

## 执行面

- `package.json` 包名与工作空间依赖
- import / export 路径源码
- 服务 bin 名与 packaged-e2e 启动命令
- README、部署文档、Codex onboarding、env 示例
- JWT `iss` 声明与规范示例
- 本地状态目录与本地SQLite默认文件名
- Codex 相关默认工作目录和当地状态路径约定

## 兼容窗口

- `croc-ops` 作为兼容 bin 暂时保留，但正式文档只写 `delexec-ops`
- `CROC_OPS_HOME`作为旧环境变量兼容保留，但`DELEXEC_HOME`为正式变量
- 默认路径将 `~/.remote-subagent/` 自动迁移到 `~/.delexec/`
- 旧`croc.sqlite`会在目标目录内自动迁移为`delexec.sqlite`

## 扫描规则

- 旧命名只允许保留在本文件、命名矩阵和历史规划文档中
- 运行时代码、测试、当前文档和 CI 不允许再出现旧范围、旧 CLI 名、旧目录名或旧发行者
