@delexec/contracts

> 英文版：[README.md](README.md)
> 说明：中文文档为准。

# @delexec/contracts

`@delexec/contracts` 是这个 monorepo 的预分割协议包。

它是可发布的上游工件，在该 monorepo 物理上分为单独的协议、客户端和平台存储库之前，客户端和平台端实现预计会使用它。

## 公共API接口

该包中的稳定协议导出：

- `请求状态`
- `ERROR_DOMAIN`
- `错误_注册表`
- `getErrorDomain(代码)`
- `isKnownErrorCode(代码)`
- `isRetryableErrorCode（代码，后备？）`
- `buildStructuredError（代码、消息、选项？）`
- `canonicalizeResultPackageForSignature（结果）`
- `getBundledTemplatesRoot()`
- `getBundledProtocolDocsRoot()`
- `hasBundledProtocolAssets()`
- `loadBundledTemplateManifest()`
- `resolveBundledTemplatePath(relativePath?)`
- `resolveBundledProtocolDocPath(relativePath?)`

面向协议的稳定性承诺：

- 错误代码及其默认的可重试性语义被视为协议表面
- 请求生命周期状态被视为协议表面
- 用于签名的结果包规范化被视为协议表面
- 模板打包格式被视为协议表面

## 打包资产

打包或发布后，此包包括：

- `模板/`
- `模板/manifest.json`
- `协议文档/`

事实来源仍然是存储库文档和模板目录。该包捆绑了一个发布型快照，因此下游客户端/平台代码可以通过已发布的工件而不是单一存储库相对路径来使用协议资产。

## 当前范围

该包有意排除实现端运行时代码：

- Caller 运行时和控制器
- Responder 运行时和控制器
- 平台API和控制台
- 传输中继实施
- 存储适配器
- ops CLI 和本地主管逻辑

该边界是预分割合约的一部分，并由该存储库中的 CI 检查强制执行。
