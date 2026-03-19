Release Process

> 英文版：[release-process.md](release-process.md)
> 说明：中文文档为准。

# 发布流程

该存储库使用最少的 L0 发布流程。

该存储库仍然是一个单一存储库，但除了实现映像通道之外，预分割发布验证现在还有一个专用的协议包通道。

## Goals

- 为“平台”、“买家”、“卖家”和“中继”生成版本化容器映像
- 为“@delexec/contracts”生成一个发布型协议包
- 验证源构建撰写路径和基于图像的撰写路径
- 验证协议模板/文档可以从打包的工件而不是单一存储库相对路径中使用
- 保持释放杆足够小以达到 L0，同时保持可重复性

## 图片标签

Recommended tags:

- 不可变：git SHA
- 发布：`vX.Y.Z`
- 可选的移动标签：发布标签上的“最新”

## CI 期望

-“CI”运行协议、客户端和平台通道，包装和烟门映射到未来的三回购所有权
-“CI”还使用释放形状的图像坐标针对“部署/一体化”运行基于本地图像的烟雾
-“CI”运行命名边界检查，因此旧名称不会泄漏到批准的迁移文档之外
- “Published Images Smoke”是针对已发布图像的面向 GHCR 的验证路径
- `Images` 根据拉取请求构建发布图像，并可以将它们推送到发布标签或手动调度
- `CI` 检查当前存储库版本是否具有匹配的发行说明文件和兼容性矩阵条目
- `compose-smoke` 对故障进行分类，以便可以将镜像拉取/网络问题与服务运行状况或场景故障区分开来
- `compose-smoke` 每次运行使用一个独立的撰写项目，并在启动前预清理该项目，减少本地/CI 交叉运行污染
- 在将运行分类为“image_pull_failed”之前，“compose-smoke”会重试短暂的图像拉取启动失败几次

## 推荐的发布步骤

1.剪切一个版本标签，例如`v0.1.0`
2. 运行协议包检查并确认“@delexec/contracts”仍然打包、安装并公开捆绑的模板/文档
3. 运行打包服务检查并确认 `platform` / `buyer` / `seller` / `relay` tarball 仍然在洁净室中安装和启动
4. 运行 packaged-e2e 检查并确认完整的 e2e 套件仍然通过通过“E2E_*_CMD”注入的已安装 tarball 命令
5. 让“Images”工作流程发布“rsp-platform”、“rsp-buyer”、“rsp-seller”和“rsp-relay”
6. 确保 `docs/archive/releases/vX.Y.Z.md` 存在并且 `docs/archive/releases/compatibility-matrix.md` 包含该标签
7. 验证针对 GHCR 传递的匹配“Published Images Smoke”工作流程
8. 将任何外部部署环境更新为已发布的“IMAGE_TAG”
9.确保当前的准备边界仍然匹配`docs/current/guides/product-readiness-boundary.md`

## 编写烟雾故障类

- `image_pull_failed`：基础镜像或注册表/网络拉取问题
  - 包括 Docker Hub 身份验证/令牌获取失败，例如“无法获取 oauth 令牌”、“无法授权”或镜像解析期间的注册表 EOF
- `port_conflict`：本地端口分配问题
- `compose_up_failed`：通用撰写启动失败
-`service_runtime_failed`：容器已启动但进入`不健康/退出/重新启动`
- `health_check_timeout`：服务没有及时变得健康
- `postgres_crud_check_failed`：数据库启动但基本 CRUD 失败
- `register_failed` / `catalog_failed` / `buyer_remote_request_failed` / `ack_not_ready` / `buyer_result_not_ready`：业务路径回归

## 兼容性说明

对于 L0，在存储库版本级别跟踪兼容性：

- 一个存储库版本映射到一个图像标签集
- 混合版本部署尚未成为支持承诺的一部分
- 兼容性矩阵记录在“docs/archive/releases/compatibility-matrix.md”中

## 协议包说明

`@delexec/contracts` 的预分割打包规则：

- 包名称已被冻结为“@delexec/contracts”
- 包必须独立于 monorepo 根“npm pack”
- 打包的工件必须包含“templates/manifest.json”和“protocol-docs/”下的协议文档快照
- 客户端/平台端代码应该集中于使用打包的协议工件，而不是直接读取“文档/模板”

## 预分割兼容性门

预分割发布验证现在具有三个打包门：

- `npm 运行测试：协议：包`
- `npm 运行测试：服务：包`
- `npm 运行测试：e2e：包`

他们一起验证：

- 协议工件可安装并导出捆绑的模板/文档
- 实施服务工件是可安装和可启动的
- 当服务从已安装的 tarball 命令而不是源入口点启动时，端到端流程将通过
