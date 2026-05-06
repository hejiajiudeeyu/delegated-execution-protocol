# 计费与额度模型（Billing & Quota）方向定位 RFC

> 英文版：./billing-and-quota.md
> 说明：中文文档为准。

Status: Direction-setting (方向定位)
Updated: 2026-05-05

> **关于本文档的层级定位**
>
> 本 RFC **只冻结大方向**，不冻结具体规则。
>
> - **主体（§1–§9）** 是方向定位，所有结论为协议层产品哲学与边界承诺，后续修订才能改。
> - **附录 A** 是基于当前方向的"实现层提议草案"，给后续 platform RFC 与 protocol minor 一个起点；**不冻结**字段名、错误码名、阈值数字、上限值、采样比例。
>
> 任何与本 RFC 主体冲突的具体规则提议都不能成立。任何与附录 A 不一致的具体规则提议都可以重新议——附录 A 的存在只是为了让"已经想清楚的方向"有可承接的下一步。

具体支付商接入、计量数据流、UI 同意流、退款与对账、invoicing 实现等内容不在本文范围，分别归属：

- 平台侧：`repos/platform/docs/planned/design/billing-design-rfc.md`
- 客户端侧：`repos/client/docs/planned/design/billing-caller-consent.md`

---

## 1. 范围与原则

### 1.1 目标

为 v0.2+ 协议升级时引入"按调用计费"留下一份**最小、加性、与现有 L0 闭环不冲突**的方向定位，保证：

1. 不动现有 v0.1 任务合约、结果包、token claims、状态机的任何已冻结字段语义。
2. 不让 caller / responder / platform 三方角色因为计费而改变信任边界。
3. 不让"是否引入计费"成为 L0-L3 运行模式之间的差异点。
4. 让协议读者能从一处看到 billing 在协议层的边界，避免在客户端、平台、UI 三处分别发明计费字段。
5. 留下"零信任 hotline"机制位（§6），覆盖两个维度——**行为可信度**（金额 / SLA / 上报欺诈，需累积验证才能放权）与**输出可信度**（内容本身可能有害，即使签名验证 + schema 校验通过）；不与现有 admin review 机制冲突。

### 1.2 非目标

本 RFC **不**给出：

- 支付商选型（Stripe / Paddle / 国内支付 / invoicing-only）的决策。
- 计费数据从 platform 流向支付商或财务系统的具体管道。
- caller-side 同意收费的 UI 文案与最低交互要求。
- responder 收益分配、平台抽佣比例、税务处理。
- 退款、争议、对账周期、欠费冻结的运营级 SLA 数字。
- trust_tier 升降级的具体阈值、单次/日/月金额上限的具体数字。

这些都属于实现层、平台运维层或 UX 层，由对应仓库的 RFC 单独立项。本 RFC 主体保留方向，相关数字提议放在附录 A 作为草案。

### 1.3 与 v0.1 的兼容立场

`docs/current/spec/defaults-v0.1.md` 已冻结的所有参数与字段语义不变。本 RFC 主体的方向都满足：

- **加性**：仅追加可选字段，不修改已有字段语义。
- **未感知则不影响**：旧 caller / responder / platform 实现忽略新字段后必须仍可完成 L0 闭环。
- **不与 transport 绑定**：计费方向不影响 `TransportAdapter` 接口与 envelope `meta`。

### 1.4 Agent 时代与人类外包市场的关键差别

设计本 RFC 时不应把 Upwork / Fiverr / 99designs / 猪八戒等"人类外包平台"的收费机制整套照搬。那些机制大多是为了对抗"人类作为 supply"的特定约束——人类不能 7×24、不能并行、信任成本高、单次任务金额大、纠纷需要人来仲裁。Agent 时代的市场结构性不同。下面这张差异表是后续所有方向决策的参考前提。

| 维度 | 人类外包市场（Upwork/Fiverr/猪八戒/99designs） | 本协议下的 Agent 市场 |
| :--- | :--- | :--- |
| Supply 上限 | 受人类工时约束（一天 8 小时/一次 1 单） | 一个 hotline 可并发服务多个 caller；上限取决于 OPC 的产能与流程标准化程度 |
| 任务金额量级 | 单次 50–5000 美元为主 | 单次 1–500 美元为主流（接近人类外包但略低），长尾两端 0.1–2000 美元；**不是** micro-API |
| 信任建立方式 | 评价、案例、面谈、合同、escrow + 阶段验收 | 签名 + schema validation + 自动状态机 + 累积可观测指标 |
| 防滥发投标 | "Connects"投标币、月度配额 | 不需要——caller 不竞标，是单向调用；但需要反向防 caller 滥用申诉 |
| 防 supply 跑路 | 长 escrow + 双向评价 + 平台仲裁 | 自动重试 + UNVERIFIED 自动退 + hotline 分钟级冻结 |
| 防价格欺诈 | 信用历史 + 个体声誉 | 声明-实际偏差熔断 + 单次硬上限（hotline 自报） |
| 反 spam 上架 | 上架慢、人审为主、有月费门槛 | 上架瞬间，必须靠机器化分级（§6）防恶意洗榜 |
| 单次交易确定性 | 客户与 freelancer 不一定能精确报价 | hotline 可机器化估价，金额量级与 OPC 单次交付能力对得上 |
| 主要争议来源 | 主观质量评价、需求理解偏差 | 客观 schema 不符 / 签名不符 / 金额超约 |
| caller 调用频率 | 客户每月几次，需要持续沟通 | caller 是 agent，10–500 次/天/caller 常见，频率比人类高 1–2 个数量级 |
| 适合的结算节奏 | 周/月级 escrow → 阶段验收 → 放款 | 调用前预扣 → result 落地（秒到分钟级）→ 自动落账或自动退；invoicing 仅作为高信用 caller 的可选优化 |
| 平台抽佣的核心价值 | 信任 + 流量 + 仲裁 | 计量真实性 + 自动退款 + zero-trust 准入 |

由此可知，**应当借鉴**的人类市场机制包括：

- "余额预扣（escrow 思想）"——但要从"周级"压到"单次结算颗粒度"，且自动结算。
- "信用分级"——但要去人工评级，改为机器指标。
- "退款规则与争议仲裁"——但要把绝大多数判定下沉到协议状态机自动处理。
- "上架审核"——保留，但额外加 zero-trust 分级，因为 Agent 上架几乎无边际成本。

**不应当借鉴**的人类市场机制包括：

- "Connects"投标币 / 月度活跃费——caller 是机器，按单次调用付费已足。
- "比稿/竞标模式"——hotline 是确定能力声明，不是个体作品。
- "Hourly billing"——粒度太大，且无法机器化验证 elapsed time。
- "卖家分级靠刷好评"——本 RFC 的 trust_tier 必须由可签名的客观指标驱动。
- "周级仲裁队列"——绝大多数判定应在分钟级由协议状态机自动完成。

#### 价格区间假设

本协议下的 hotline 不是 micro-API（如 $0.001/call 的 LLM token 计费）。每一个 hotline 都对应一个 OPC（One-Person Company）已经标准化、可 7×24 调用的私有专长，主流价格落在 **单次 1–500 美元** 区间，与人类外包平台相近 **但略低**。略低的来源：

- 同一个 OPC 把流程标准化后可以并发服务多个 caller，单位成本下降。
- agent caller 不需要"找人沟通"的协调成本。
- 协议层自动验签、退款、争议处理替代了人工仲裁。
- 平台抽佣专注计量真实性，不再承担全流程信任建设，运营成本可压低。

长尾两端可以触达：低端 $0.1–$1（精简自动化批量任务），高端 $500–$2000（原本人类一天到一周的工作流）。后续涉及"参考现有市场决策"的所有章节都默认遵循此差异表与价格区间假设。

---

## 2. 核心立场：按市场需求分配，不按劳分配

本 RFC 的哲学锚点：**hotline 计费是按市场需求分配的"价值定价"，不是按劳分配的"成本透传"**。

### 2.1 两种计费哲学的概念区分

| 哲学 | 别名 | 谁承担"内部成本波动"风险 | 典型例子 |
| :--- | :--- | :--- | :--- |
| 按劳分配 | cost pass-through / 成本透传 / unit-based metering | **caller 承担**（caller 看到 raw 资源消耗） | OpenAI API 按 token、AWS 按 instance-second、Replicate 按 GPU-second |
| 按市场需求分配 | value-based pricing / 价值定价 | **responder 承担**（caller 只看交付价值） | Fiverr Gig "$50 做一个 logo"、Upwork "$200 审一份合同"、人类外包大多数场景 |

两者最大的差别不在结算单位，而在**风险归属**：

- 按劳分配：上游 LLM 涨价 / GPU 突涨 / 传输费率变化 → 直接传递给 caller。caller 必须理解 hotline 的内部成本结构。
- 按市场需求分配：上游波动 → responder 自己消化或调价。caller 只需理解"这件事值多少钱"。

### 2.2 为什么本协议选"按市场需求分配"

四个理由，从产品定位、责任边界、可预测性、抗成本冲击各打一个钉子：

1. **与 hotline 是 OPC 私有专长变现这一定位自洽**。OPC 卖的是"做完一件事的能力"，不是"消耗多少 token"。caller 通过 marketplace 找到一个客诉分诊 hotline，他要的是"分诊结果"，不是"被告知背后跑了 850 个 GPT 输入 token"。
2. **责任边界清晰**。responder 内部用 GPT-4 / Claude / 本地 fine-tune / 人工 + AI 混合 / 流程自动化都可以，是它自己的成本结构问题，亏盈自负。"我不管你用什么手段，做完按约定付"是这个协议的产品承诺。
3. **给 caller agent 强可预测性**。主流 fixed_price 一口价，caller 在 prepare 阶段就能算清"这次任务最多花我多少钱"，不需要等 result 落地才知道账单。这对 caller agent 的 budget 决策至关重要。
4. **抗 cost shock**。OpenAI 涨价 30% 不会立即传递给 caller。是 OPC 主动承担的成本风险——这正是 OPC 作为"经营者"的角色定义。caller 看到的价格保持稳定，市场更可预期。

### 2.3 这一立场的产品后果

#### 2.3.1 协议层不引入"成本透传"字段

协议层 wire 上**不会**出现：

- LLM provider 的 raw token cost。
- GPU-second / Lambda-millisecond / S3-egress-byte 等基础设施 unit cost。
- responder 内部分包 / 转单的成本结构。

这些都属于 responder 的内部经营，协议层不关心也不暴露。

#### 2.3.2 三种定价模式都是"价值定价"的形式（§3）

包括 `base_plus_duration` 与 `base_plus_tokens`——它们只是"基础价 + 变动量"的报价形式，不是 cost pass-through。`tokens` 是 hotline 自定义的 unit 语义（可以是 LLM token / 文档页数 / 生成图片张数），不绑定到任何 LLM provider 的实际计费单位。

#### 2.3.3 caller 同意只锁定"金额上界"，不锁定"内部 unit"

caller 在 prepare 阶段同意一个 max_charge_cents（金额上界）。这是对"价值"的同意，不是对"消耗多少 token"的同意。responder 上报的 usage 必须落在这个金额范围内，超过自动封顶或进 UNVERIFIED 自动退（详见 §5）。

### 2.4 立场的边界条件

存在少量场景里"按市场需求分配"不再合适：

- caller 是平台自身的 internal service，调用 hotline 时希望成本透明（用于内部财务结转）。
- 某些受监管行业要求"成本可追溯"。
- responder 与 caller 之间存在长期合同关系，明确商定成本透传。

这些是边界情况，**不在 v0.2 协议层默认支持**。如未来确实需要，应当作为单独的"cost-pass-through 模式 RFC"立项，并明确：

- 该模式不能成为协议层默认。
- 该模式必须由 hotline 在 onboarding 时显式声明，caller 在 prepare 阶段显式同意。
- 该模式的 caller 必须为 verified tier 或更高（§6）。

在 v0.2 之前，本协议层只承认"价值定价"。

---

## 3. 三种定价模式（方向，不冻结字段名）

协议层为 hotline 提供三种定价模式表达。每个 hotline 必须选其中之一，不允许混合。

### 3.1 fixed_price（主流默认）

一口价。hotline 声明 "这件事值多少钱"，caller 同意，做完按声明价付款。

- 是协议层的**主流默认**——hotline onboarding 不显式声明定价模式时按 fixed_price 处理（caller 仍需同意金额）。
- 适合大多数标准化交付（客户客诉分诊、文档分类、合同条款抽取、固定形式的报告生成）。
- caller 端体验最简单：一次同意一个金额，做完就这个金额。

### 3.2 base_plus_duration（基础价 + 实际工作时长）

base 起步费 + responder 自报"实际工作时长"。

- 用于"任务量级有显著波动但工时可估"的场景（数据清洗、长文档处理、多步工作流）。
- "实际工作时长"由 **responder 自报**，平台不强制 wall clock 计时。caller 不应也不需关心 wall clock——caller 同意了 max_charge_cents 上限，超过自动封顶。
- responder 虚报上限内的时长 = 平台不管（这本来就是 OPC 的定价权）；超上限 = 进 UNVERIFIED 自动全额退。
- 时长的 unit 由 hotline 在 pricing_hint 里以人话解释（minute / hour / 自定义工时单位）。

### 3.3 base_plus_tokens（基础价 + 自定义 token 量）

base 起步费 + responder 自报"实际 token 量"。

- 这里的 "token" **不是 LLM token 的代名词**，是 hotline 自定义的 unit 语义。可以是：
  - LLM 推理输入输出 token 数（这种情况下与 LLM 物理 token 重合）。
  - 处理的文档页数。
  - 生成的图片张数。
  - 生成的字节数 / 字数。
  - 任何 hotline 自报的整数计量单位。
- hotline 必须在 pricing_hint 里用人话解释 token unit 的语义（比如 `"variable_unit": "token"` 配 `"variable_unit_description": "1 token = 1 page processed"`）。
- 同样由 responder 自报、上限封顶、超上限自动退。

> 与 §2.3.1 一致：这里的"token"**不是 cost pass-through**。hotline 内部即使没有跑 LLM，只要"token 数"这个度量对它的产能模型有意义，就可以使用 base_plus_tokens。

### 3.4 三种模式的共同要求

- **hotline 必须声明硬上限**（暂称 max_total_cents 或同义字段）。这是 caller 安全锚点：caller 同意时锁定的最大金额覆盖 hotline 声明范围内的全部可能值，超出自动封顶。
- **caller 同意金额必须 >= hotline 声明硬上限**——否则 hotline 可能在合理范围内做完任务却被 caller 反向限额，违背"做完就付"承诺。
- **hotline 内部用什么手段交付，caller 不感知，平台不审查**（合规审查除外）。

### 3.5 fixed_price 是协议层的"无声明默认"

如果 hotline onboarding 不显式声明定价模式，协议层默认按 fixed_price 处理。这有两个效果：

1. 简化绝大多数 hotline 的 onboarding——他们只需声明 "$50/call"。
2. 鼓励 OPC 把工作流标准化到一口价表达，符合"价值定价"的哲学锚点。

如果 OPC 真的需要 base + variable，必须显式声明，进入额外的"我会上报变量量"承诺。

---

## 4. 责任边界

### 4.1 caller 不感知 responder 内部实现

caller 看到的承诺只有：

- hotline 的能力声明（input schema / output schema / attachments）。
- hotline 的定价（fixed_price 或 base + variable 上限）。
- hotline 的可信度等级（trust_tier，§6）。
- result 是否通过签名 + schema 验证。

caller 看不到：

- responder 内部用了什么 LLM / 工具 / 流程。
- responder 是否分包给其他 hotline / 其他 OPC。
- responder 单次任务的实际成本结构。

这是协议层的硬边界。本 RFC 的所有方向决策都遵守这条。

### 4.2 hotline 自报、上限封顶

承接 §3.4 的共同要求：

- 变量类（duration / tokens）由 responder 自报。
- hotline 自声明 max_total_cents 硬上限。
- 实际金额超上限 → 协议层自动封顶到上限，caller 不会被超约。
- 实际金额低于上限 → 按 responder 上报的实际值结算（不强制按上限收）。

平台不计时、不监督内部实现。这是"价值定价 + 上限保护"组合的核心：把信任放在"上限承诺"，不放在"过程透明"。

### 4.3 平台抽佣的核心价值

由 §2.3.1 与 §1.4 的差异表导出，平台在 Agent 市场的核心价值是：

- 计量真实性（drift detection、双盲采样）—— §6 反刷熔断方向。
- 自动结算与自动退款。
- zero-trust 准入。

而**不是**：

- 流量分发（marketplace 是 brand-site 的事，不是 platform）。
- 主观仲裁（绝大多数判定靠协议状态机机器化完成）。
- 信任建设（callers 与 responders 直接通过签名建立技术信任，平台只 attest 不 endorse）。

平台抽佣比例的具体数字属于商业决策，不在协议层 RFC 范围。

---

## 5. 结算与退款（方向）

### 5.1 预扣 + 单次结算

协议层结算的方向：

- caller 在调用前必须有"预扣余额"或"信用额度"。
- 每次 token 签发时**预扣** caller 同意的最大金额。
- result 落地后**实扣** responder 上报的实际金额，差额自动回滚到 caller 余额。
- 默认走预扣模式（prepaid）；postpaid invoice 仅作为高信用 caller 的可选优化。

不走人类外包式的"周/月级 escrow + 阶段验收"——单次结算颗粒度足够细，状态机已经替代人审。

### 5.2 自动退款覆盖机器可判定的失败

协议层规定下列失败由 platform 自动全额退款，无需 caller 申诉：

- result 进入 `UNVERIFIED`（签名失败 / schema 失败 / 价格不一致）。
- request 进入 `TIMED_OUT`（hard_timeout 触发）。
- result 进入 `FAILED` 且 `error.retryable = false`。
- hotline 在 caller prepared 期间被 frozen。
- result 在落地前被平台内容审查拒绝（针对 §6.5 风险线 B）。

这些都是签名 + 状态机 + 内容审查可机器判定的失败类别。具体退款金额、回滚目标账户、事件命名属于实现细节，由附录 A 提议、由后续 RFC 冻结。

### 5.3 主观不满意走人工 dispute（受限）

caller 端"result 走 SUCCEEDED 但主观不满意"是少数情形。协议层立场：

- 进人工 dispute 队列。
- 仅对低 trust tier 的 hotline 受理。
- verified tier 的 hotline **不受理**单边主观申诉（防止滥用）。
- caller 端单边申诉率超阈值时自动暂停申诉权限。

具体阈值（哪个 tier 受理 / 何时停权 / 处理时长）属于运营 SLA，不在协议层冻结。

### 5.4 不引入"半退款 / 部分退款"

机器判定的失败一律全额退。"Responder 完成了 60% 工作所以退 40% 钱" 这种语义在 Agent 市场不可机器证明，本 RFC 不在协议层引入半退款。如 hotline 想表达"任务做了一半也值钱"，应当通过拆分 hotline（"做一半 hotline" + "完整做完 hotline"）或 base_plus_duration 模式自然表达。

---

## 6. 零信任 Hotline（方向）

### 6.1 为什么需要

任何用户都可以通过 onboarding API 提交一个 hotline。Agent 时代单一恶意 actor 可以批量自动化提交 10,000 个虚假 hotline_id，远超人类外包平台的 spam 上限。即使有现有的双 admin review + 隐藏 review test（v0.1 已有），也不足以应对两条不同的风险线。

#### 风险线 A：行为不可信（金额 / SLA / 上报欺诈）

- 声明的金额合理。
- 实际上报真实（不刷计费单位）。
- 长时间运行后行为不发生漂移。
- 不在节假日前夕集中改价收割老 caller。

#### 风险线 B：输出不可信（内容本身有害）

签名验证只能证明"这个内容**确实**是该 hotline 发的"，schema validation 只能证明"这个内容**形式上**符合声明结构"——它们都不能证明"这个内容**对 caller 安全**"。即使两者都通过，hotline 仍可能返回：

- **Prompt injection / jailbreak 载荷**——伪装成合法 result，但内嵌指令试图操纵 caller agent 的后续行为。
- **可执行恶意代码 / 命令注入**——返回的字符串含 shell command / SQL injection / XSS payload，caller agent 直接消费会被攻击。
- **误导性内容伪装成合法 schema**——金融建议反向、医疗建议有害、法律意见错误，但 schema 完全合法。
- **PII / 第三方数据泄漏**——结果中夹带其他 caller 的隐私数据，或训练数据中泄漏出的个人信息。
- **版权 / 监管违规内容**——未授权图片、文字、代码；涉及监管类目（医疗、金融、武器）的违规生成。
- **隐写 / 后门载荷**——result 中嵌入水印或隐藏指令，影响下游 caller 处理或回链漏报。
- **时效性误导**——结果声称是新鲜数据，实际是从旧库捞的过期内容。

#### 零信任的核心立场

**任何新 hotline 默认不可信**，即使审批通过，也不立即获得：

- 高金额收费权（针对风险线 A）。
- 人工申诉豁免权（针对风险线 A）。
- 内容风险类别豁免（针对风险线 B）。

必须在长时间内通过可签名的客观指标 + 平台内容审查累积信任，才能逐步放权。

### 6.2 分级方向（仅说明阶梯存在）

协议层承认 hotline 的 trust 是分级的，至少存在三个语义档位 + 一个冻结状态：

- **untrusted**：默认初始状态，新 hotline 无论是否过审都属此档。低金额上限、严格自动退、接受单边申诉、收入有落账延迟。
- **trusted**：累积达标后由平台自动升级。中等金额上限、降低自动监控强度。
- **verified**：通过实名 KYC 或更强的人工审核 + 累积量后由平台手动升级。无强制单次上限、不受单边申诉、收入实时落账。
- **frozen**：因风险事件冻结，禁止新 caller 调用，老 prepared request 仍可走完。

具体上限值（untrusted 单次最多多少钱、trusted 单次最多多少钱、各档落账延迟天数）**不在本 RFC 主体冻结**——属于运营级参数，在附录 A.3 给出推荐初值，由 platform RFC 冻结最终值。

### 6.3 升降级靠机器化指标，不靠刷好评

升降级的方向：

- **升级**靠累积可签名指标：verified runs 数、dispute_rate 阈值、unverified_rate 阈值、responder owner 邮箱/手机/身份验证状态。
- **降级**靠机器化告警：dispute_rate 异常、unverified_rate 异常、pricing/SLA drift 触发、双盲采样不一致率超阈值。
- 不引入"人类好评分"作为升级路径——避免人类外包市场的刷分/养号问题。

具体阈值数字归附录 A.6。

### 6.4 反刷熔断方向

协议层承认平台必须实现机器化熔断，包括四个方向：

1. **声明-实际偏差熔断**：hotline 声明的定价模式 / SLA / 估算金额 与实际长期偏差超阈值 → 降级或冻结。
2. **双盲一致性采样**：平台对低 trust tier hotline 的部分 request 做 hidden dual-call，结果不一致 → 降级或冻结。
3. **速率与并发熔断**：caller 滥发或 hotline 异常飙升 → 限速。
4. **preflight 滥用熔断**：caller 用 preflight 白嫖业务 → 限速。

具体采样比例、阈值、熔断动作归附录 A.5。

### 6.5 内容安全方向（针对风险线 B）

针对 §6.1 中"输出不可信"的风险线，协议层承认**三层应对方向**。每一层都是必要不充分——只有三层叠加，零信任的内容维度才有意义。

#### 6.5.1 第一层：协议层硬约束（已生效）

v0.1 已有的两道防线：

- **Schema validation**：result 必须符合声明 output_schema，不符合 → `UNVERIFIED` 自动全额退。
- **签名验证**：result 必须由 hotline 注册私钥签名，否则 `UNVERIFIED`。

这两层只能拒绝"形式不合规"的内容，**不能**拒绝"形式合规但实质有害"的内容（schema 合法的 prompt injection、签名合法的恶意代码——签名只证来源，不证安全）。

#### 6.5.2 第二层：平台内容审查作为 trust_tier 升级条件

- `untrusted → trusted` 升级路径中应当包含"通过平台内容安全审查"作为**硬性必经条件**之一，与 §6.3 的累积可签名指标并列。
- `verified` tier 必须维持持续审查（采样回查 + 高风险类目重审），偏离阈值触发降级。
- 审查方式（机器扫 / 人工抽审 / 第三方审计 / hidden dual-call 内容比对）属于平台运维细节，归 platform RFC。
- 审查失败的 hotline 不能进入更高 tier，并视严重程度直接进入 `frozen`。

#### 6.5.3 第三层：Hotline 输出风险声明（disclaimer）

- Hotline onboarding 时**必须声明** output 类型可能涉及的风险类别（建议初值清单见附录 A.8）。
- caller 在 prepare_request 阶段可见 disclaimer，作为知情同意的一部分；caller 可基于自身策略拒绝调用某些 disclaimer 类别的 hotline。
- disclaimer 错填或漏填，等同于 §6.4 中的"声明-实际偏差熔断"——平台对 result 内容做分类抽样，与 hotline 自报 disclaimer 不一致 → `hotline.disclaimer_drift` → 降级或冻结。
- disclaimer 的类目体系不在协议层冻结（具体由 platform RFC 决议），但协议层规定"hotline 必须声明 + 不可空 + 错报有惩罚"。

#### 6.5.4 caller-side 责任边界

协议层显式声明：**签名验证通过 ≠ 内容安全**。caller agent 必须把 result 视为不可信输入处理，包括但不限于：

- 调用层 sandbox 隔离（不要直接 `eval` 来自 hotline 的字符串）。
- output filtering（接入二级 content moderation）。
- human-in-the-loop（高风险类目 disclaimer 触发 caller 主人审核）。
- 拒绝执行 result 中嵌入的"指令"——除非 hotline 是显式声明的代码生成类。

具体 caller-side content shield 的实现（默认拒绝清单、UI 提示、override 路径）是 client RFC 的事。协议层只承诺"会让 caller 看到 disclaimer + result 必须按不可信输入处理"。

### 6.6 与现有 admin review 的协同

trust_tier 与 v0.1 现有的 review_status / status 是**正交维度**：

- review_status / status 决定"是否出现在目录"。
- trust_tier 决定"出现后能收多少钱、走多严的退款规则、被多严盯防"。
- 一个 hotline 可以是 `approved/enabled/untrusted`（默认初始态），也可以是 `approved/enabled/verified`（成熟商家）。

trust_tier 不替代 admin review，只是给 admin review 之后再加一层"行为持续合规"的累积验证。

### 6.7 治理立场：不区分主观恶意与模型不可控输出

一个真实存在但实操艰难的问题：当 hotline 返回有害内容（风险线 B）或上报偏差（风险线 A）时，**协议层是否要区分**这是 responder owner 的"主观恶意"还是 hotline 内部模型的"不可控输出"？

本 RFC 的立场是：**不区分，全部按行为指标统一处理**。

#### 6.7.1 不区分的理由

1. **意图不可机器证明**。"故意"是 responder owner 的心理状态，平台只能看到 result 内容、上报偏差、dispute_rate、drift、dual-call 不一致率等可观测指标。强行打"主观 / 客观"标签等于把不可证明的状态写进协议。
2. **caller 端伤害对称**。不管是 prompt injection 故意攻击还是 LLM 偶发抽风，caller 受到的伤害一样大；caller 不应被要求"先证明对方是故意的"才能拿到自动退款。
3. **责任不应转移给 LLM**。如果允许"我不是故意的，是 GPT 抽风"作为豁免理由，会形成 OPC 的逃避策略。§2 已经定的立场是"我不管你用什么手段，做完按约定付"——它的对偶面就是"你用了什么手段，你为它的输出负责"。
4. **过度细分加重治理负担**。每次降级 / 冻结都要做"主观 vs 客观"判断，引发申诉、上诉、人工审核排队，治理变慢且易腐败。**奥卡姆剃刀**：协议越简单越容易被遵守。
5. **协议层抽佣价值是计量真实性 + 自动退款 + zero-trust 准入**（§4.3），**不是法律仲裁**。让协议层做意图判定就跑偏了。

#### 6.7.2 OPC 的责任承担

按本立场，responder owner（OPC）必须承担：

- 选什么 LLM / 工具 / 流程是它的事，结果好坏也是它的事。
- LLM 抽风导致 result 进 UNVERIFIED → caller 自动全额退（OPC 损失收入）。
- LLM 长期 drift 触发熔断 → 降级（OPC 损失收费上限与单边申诉豁免权）。
- 严重事件触发 frozen → 冻结收入 → 解冻后 trust_tier 重置（§6.4）。

LLM 是 OPC 选用的工具，**不是 OPC 的免责事由**。这是 OPC 作为"经营者"的角色定义。

#### 6.7.3 例外：平台运营层可以做事后人工判断

虽然协议层不区分，但平台运营层可以在 hotline 被冻结后做事后判断：

- 看是否有"批量恶意 hotline 关联同一身份" → 走法务追责。
- 看是否是"善意 OPC + LLM 偶发抽风" → 给一次重新走 untrusted → trusted 升级路径的机会。

这是 **platform RFC 的运营 SLA 范畴**，不进协议层。协议层只承诺"按行为指标自动处理"，事后修复机制由运营自决。

#### 6.7.4 实操后果

- 协议层不引入 `intent` 字段、`malicious_flag` 字段、`subjective_evaluation` 类字段。
- 错误码不带"故意 / 无意"语义（不会有 `ERR_HOTLINE_MALICIOUS` 这种）。
- 事件（如 `hotline.frozen`）的 `reason` 字段只描述客观触发器（"dispute_rate >= 10%" / "dual-call inconsistency 35%"），**不**评判意图。
- caller 端的人工申诉接口**不**要求 caller 表达"我觉得这是故意的"——只要求描述客观结果不符。
- 平台财务结算（responder 收入冻结 / 解冻 / 退款赔付）按客观触发器自动执行，不依赖意图判定。

---

## 7. 与 v0.1 协议骨架的关系

### 7.1 不动 v0.1 已冻结字段

`docs/current/spec/defaults-v0.1.md` 已冻结的所有参数与字段语义在本 RFC 主体方向下都不变。本 RFC 提议的所有新字段都是**加性 optional**，旧 caller / responder / platform 实现忽略后必须仍能完成 L0 闭环。

### 7.2 L0-L3 模式不变性

`docs/current/spec/architecture.md §2.2A` 定义"L0-L3 是同一系统的运行模式，不得改变核心协议语义"。本 RFC 在以下方面遵守该不变量：

- 计费方向不影响 TransportAdapter 接口与 envelope `meta`。
- 计费判定与 quota 阻断只在控制面 API 阶段发生，与 transport 模式无关。
- 同一付费 hotline 在 L0 / L2 / L3 三种模式下应当产生**完全一致的计费结果**。
- trust_tier 强制上限对所有 transport 模式同等生效——L3 外部桥接器不能"绕过"协议层 trust 上限。

### 7.3 与多轮会话储备的协调

`evolution-roadmap.md §3` 储备了多轮会话的 `session_id / turn_id` 字段。本 RFC 的协调方向：

- 单 turn / 单 request 计费仍以 `request_id` 为单位。
- 多轮会话进入实现时，session 级计费**扩展**本 RFC 的字段，不另起炉灶。
- 具体怎么扩展（`session_scope` 字段、cumulative `total_cents` 语义、session-scoped token 上限）留给"多轮会话 RFC"统一处理。

---

## 8. 不在本 RFC 范围

下列内容明确不属于协议层 billing RFC 的方向定位：

| 内容 | 归属 |
| :--- | :--- |
| 支付商接入（Stripe / Paddle / 国内支付）、invoicing 实现、对账周期 | platform RFC |
| 计量数据从 platform 流向账务系统的具体管道 | platform RFC |
| caller 同意收费的 UI 文案、最低交互门槛、`max_charge_cents` 默认值建议 | client RFC |
| responder 收益分配、平台抽佣比例、税务处理 | platform RFC |
| 退款、争议、欠费冻结的运营 SLA（响应时长、上报通道） | platform RFC |
| Marketplace 公网展示侧 `pricing_hint` / `trust_tier` 文案、Pricing 页 | brand-site 自有规划 |
| trust_tier 升级的人工 KYC / 法务审核流程 | platform RFC |
| trust_tier 各档具体金额上限、落账延迟天数、采样比例 | 附录 A 提议 + platform RFC 冻结 |
| 升降级 verified runs / dispute_rate 阈值 | 附录 A 提议 + platform RFC 冻结 |
| 内容审查具体类目体系、审查工具链（机器扫 / 人审 / 第三方）、disclaimer 类目最终列表 | 附录 A.8 草案 + platform RFC 冻结 |
| caller-side content shield 默认拒绝清单、UI 提示、override 路径 | client RFC |

本 RFC 主体只承诺方向："价值定价 vs 成本透传 边界、三种定价模式、责任边界、自动退款覆盖范围、零信任分级机制存在、与 v0.1 骨架的兼容性"在三个仓库间统一。

---

## 9. 后续具体 RFC 路线图

按 v0.2+ 实现节奏，建议下游 RFC 的承接顺序（不冻结时间）：

1. **本 RFC 主体方向** + **附录 A 草案** 作为下游设计起点。
2. `repos/platform/docs/planned/design/billing-design-rfc.md`（T6-2）：支付商决策、计量数据流、附录 A.3 / A.4 / A.5 / A.6 中的具体数字冻结、操作 SLA。
3. `repos/client/docs/planned/design/billing-caller-consent.md`（T6-3）：caller 端同意 UI、prepaid balance 充值入口、ops-console / caller-skill 的 trust_tier 展示规则。
4. contracts 包内追加附录 A.1 字段、A.2 错误码与事件名常量（minor 版本，如 0.2.0）。
5. 平台先实现"免费 hotline + 付费 hotline 共存 + 全部默认 untrusted"的 token 签发分支，引入 prepaid balance 但暂不接支付商。
6. caller-skill 与 ops-console 增加 pricing_hint + trust_tier 展示 + caller-side acknowledged 同意流。
7. responder runtime 提供标准 usage 上报 helper。
8. 实现附录 A.5 反刷熔断的最小可机器化版本。
9. 进入 platform invoicing-only 阶段。
10. 视市场需要再接入支付商。

第 1–4 步是协议层动作，5–10 是实现层动作。

---

## 附录 A：实现层提议（草案，不冻结）

> 本附录是基于 §1–§9 方向的"下一步规则起点"。任何与本附录冲突的具体规则提议都可以重新议；任何与主体方向冲突的提议都不能成立。
>
> 字段名、错误码名、事件名、阈值数字、上限值、采样比例 **全部不冻结**，由后续 platform RFC 与 protocol minor 决议。

### A.1 协议字段提议

#### A.1.1 hotline 的 `pricing_hint`

放在 hotline 目录条目（`/v2/hotlines` 与 `/marketplace/hotlines/:id` 返回结构）以及 `template-bundle` 内：

```json
{
  "pricing_hint": {
    "pricing_model": "fixed_price",
    "currency": "USD",
    "fixed_price_cents": 5000,
    "base_price_cents": null,
    "variable_unit": null,
    "variable_unit_description": null,
    "variable_unit_price_cents": null,
    "max_total_cents": 5000,
    "free_tier": { "calls_per_month": 1 },
    "billing_disclosure_url": "https://callanything.xyz/marketplace/responders/foxlab",
    "trust_tier": "untrusted"
  }
}
```

base_plus_duration 示例：

```json
{
  "pricing_hint": {
    "pricing_model": "base_plus_duration",
    "currency": "USD",
    "base_price_cents": 1000,
    "variable_unit": "minute",
    "variable_unit_description": "responder 自报的实际工作分钟数",
    "variable_unit_price_cents": 20,
    "max_total_cents": 10000,
    "trust_tier": "untrusted"
  }
}
```

base_plus_tokens 示例（hotline 自定义 token 语义）：

```json
{
  "pricing_hint": {
    "pricing_model": "base_plus_tokens",
    "currency": "USD",
    "base_price_cents": 500,
    "variable_unit": "token",
    "variable_unit_description": "1 token = 1 处理的 PDF 页",
    "variable_unit_price_cents": 5,
    "max_total_cents": 5000,
    "trust_tier": "untrusted"
  }
}
```

约束建议（草案）：

- `pricing_model` 缺省时按 `fixed_price` 处理（§3.5）。
- `pricing_model = fixed_price` 时只读 `fixed_price_cents`，其他变量字段忽略。
- 非 fixed_price 时 `max_total_cents` 必填，`base_price_cents + variable_unit_price_cents * estimated_max_units <= max_total_cents`。
- `trust_tier` 由平台写入，hotline 自报值会被忽略。

#### A.1.2 caller 端 token claims `billing` 子对象

```json
{
  "billing": {
    "acknowledged": true,
    "pricing_model": "fixed_price",
    "currency": "USD",
    "max_charge_cents": 5000,
    "consent_at": "2026-05-05T10:30:00Z",
    "trust_tier_seen": "untrusted"
  }
}
```

约束建议（草案）：

- `max_charge_cents` 必须 `>= hotline.pricing_hint.max_total_cents`（caller 同意覆盖 hotline 声明范围全部可能值）。
- `pricing_model` 必须与 hotline 当前 pricing_hint 一致。
- 当 hotline 当前 trust_tier 与 `trust_tier_seen` 不一致时按主方向 §6.5 处理（升级时按旧 tier 上限保守处理；降级时拒签新 token 要求重新 prepare）。

#### A.1.3 result package `usage` 扩展

fixed_price：

```json
{
  "usage": {
    "pricing_model": "fixed_price",
    "total_cents": 5000
  }
}
```

base_plus_duration：

```json
{
  "usage": {
    "pricing_model": "base_plus_duration",
    "base_price_cents": 1000,
    "variable_unit": "minute",
    "variable_units": 25,
    "variable_unit_price_cents": 20,
    "variable_subtotal_cents": 500,
    "total_cents": 1500
  }
}
```

约束建议（草案）：

- responder 上报的 `pricing_model / base_price_cents / variable_unit / variable_unit_price_cents` 必须与 token claims 中冻结的 hotline pricing 一致；不一致 → result 进入 `UNVERIFIED` 并触发自动全额退。
- `total_cents` 必须 `<= billing.max_charge_cents`，超出按封顶规则（按 `max_charge_cents` 实扣）。
- responder 现有的自定义统计字段（`tokens_in / tokens_out / pages_processed`）保持兼容，不强制替换；但**不**作为计费证据，仅作信息性披露。

#### A.1.4 平台内部 `tenant_quota` 与 `prepaid_balance`

```json
{
  "tenant_id": "user_acme",
  "scope": "caller",
  "prepaid_balance_cents": 50000,
  "currency": "USD",
  "windows": [
    { "window_kind": "daily",   "max_amount_cents": 100000, "used_amount_cents": 25000 },
    { "window_kind": "monthly", "max_amount_cents": 2000000, "used_amount_cents": 350000 }
  ],
  "rate_limit_per_second": 2,
  "credit_mode": "prepaid",
  "hard_block_on_exceed": true
}
```

提议要点（草案）：

- 默认 `credit_mode = prepaid`。
- `window_kind` 至少支持 `daily | monthly | total`。
- `rate_limit_per_second` 新 caller 默认低值（建议 2/s 或更低，因为单次任务量级大、执行秒到分钟级）。
- responder-scope quota 表示"该 responder 单位时间内最多能产生多少计费收入"。

### A.2 错误码与事件提议

#### A.2.1 错误码（追加，不替换 v0.1）

| 错误码 | HTTP | retryable | 触发场景 |
| :--- | ---: | :--- | :--- |
| `ERR_BILLING_CONSENT_REQUIRED` | 402 | false | hotline 计费但 caller 未提供 acknowledged |
| `ERR_BILLING_PRICING_MODEL_MISMATCH` | 400 | false | caller 提交的 pricing_model 与 hotline 不一致 |
| `ERR_BILLING_MAX_CHARGE_TOO_LOW` | 400 | false | caller 同意 max_charge_cents < hotline max_total_cents |
| `ERR_QUOTA_EXCEEDED` | 429 | true（窗口翻页后） | tenant quota 超限且 hard_block 开启 |
| `ERR_PREPAID_BALANCE_INSUFFICIENT` | 402 | true（充值后） | prepaid 模式但余额不足 |
| `ERR_BILLING_CURRENCY_UNSUPPORTED` | 400 | false | currency 不在平台允许列表 |
| `ERR_TRUST_TIER_LIMIT_EXCEEDED` | 403 | false | caller max_charge_cents 超 hotline trust_tier 上限 |
| `ERR_HOTLINE_FROZEN` | 423 | false | hotline 处于 frozen，不再签发新 token |
| `ERR_RATE_LIMIT_PER_SECOND` | 429 | true | 超 caller rate_limit_per_second |
| `ERR_PREFLIGHT_UNAVAILABLE` | 503 | false | responder 拒绝 preflight quote |

#### A.2.2 事件（追加到 v0.1 最小事件集）

| 事件名 | 说明 |
| :--- | :--- |
| `caller.request.billing_capped` | 实际金额封顶 |
| `caller.request.refunded_unverified` | UNVERIFIED 自动全额退 |
| `caller.request.refunded_timeout` | TIMED_OUT 自动全额退 |
| `caller.request.refunded_failed` | FAILED 自动全额退 |
| `caller.request.refunded_hotline_frozen` | 老 prepared 在 hotline frozen 后自动全额退 |
| `hotline.pricing_drift` | 声明-实际偏差熔断 |
| `hotline.sla_drift` | SLA 偏差熔断 |
| `hotline.tier_changed` | trust_tier 升降级 |
| `hotline.frozen` | 因风险事件冻结 |
| `caller.dispute_filed` | caller 提交人工申诉 |
| `caller.dispute_resolved` | 人工申诉决议 |

`defaults-v0.1.md` 中冻结的 `caller_event_required / responder_event_required` 不变；新事件为"v0.2+ 选实现"。

### A.3 trust_tier 上限初值与设计依据

| Tier | caller 单次 max_charge_cents 上限 | quota 必带窗口 | 自动退款 | 单边申诉 | 收入落账延迟 |
| :--- | ---: | :--- | :--- | :--- | :--- |
| `untrusted` | 2,000 cents/call ($20)、10,000 cents/day ($100) | 必带 daily + monthly | UNVERIFIED / TIMED_OUT / FAILED 全额自动退 | 受理 | 7 天 |
| `trusted` | 50,000 cents/call ($500)、自定义 monthly | 必带 monthly | 同上 | 受理，单边申诉率 > 5% 触发降级 | 3 天 |
| `verified` | 无强制单次上限 | 任意 | 同上；单边申诉**不**受理 | 不受理 | 实时 |
| `frozen` | 拒签新 token | — | — | — | — |

设计依据：

- untrusted $20/call ≈ caller 一次"低风险测试"心理账户，落在主流价格段（$1–500）下沿。
- untrusted $100/day ≈ caller 单日做 5 次测试调用的预算。
- trusted $500/call 覆盖主流上沿，与 OPC 单次交付能力对齐。
- verified 不再设单次硬上限，回到 caller 自身 max_charge_cents 与 quota 控制。

最终值由 platform RFC 在结合实际市场数据后冻结。

### A.4 自动退款触发器表

| 触发场景 | 退款金额 | 事件 |
| :--- | :--- | :--- |
| Result `UNVERIFIED`（签名失败 / schema 失败 / pricing_model 或 unit_price 不一致） | 全额（已预扣的 max_charge_cents） | `caller.request.refunded_unverified` |
| Request `TIMED_OUT`（hard_timeout 触发） | 全额 | `caller.request.refunded_timeout` |
| Result `FAILED` 且 `error.retryable = false` | 全额 | `caller.request.refunded_failed` |
| Result `FAILED` 且 `error.retryable = true` | caller 选退款则全额 | `caller.request.refunded_failed_retryable` |
| Hotline 在 prepared 期间被 frozen | 全额 | `caller.request.refunded_hotline_frozen` |

### A.5 反刷熔断细则

- **声明-实际偏差**：hotline 声明 fixed_price，但 7 天内 result usage `total_cents` 中位数偏离声明值 > 200% → `hotline.pricing_drift` → 降级。
- **SLA drift**：声明 `eta_hint.exec_p95_s` 实际 7 天 p95 > 声明 × 5 → `hotline.sla_drift` → 降级。
- **双盲一致性**：untrusted 1% / trusted 0.1% request 派 hidden dual-call，不一致率超阈值 → 降级或冻结。
- **速率熔断**：caller × hotline 在 10s 滑窗内 > 5× rate_limit_per_second → caller 限速。
- **preflight 滥用**：caller 端 preflight:invoke > 10:1 持续 1h → preflight 限流。

具体阈值最终值由 platform RFC 冻结。

### A.6 升降级阈值初值

升级建议：

- `untrusted → trusted`：≥ 200 verified runs（不含自动退）+ 7 天连续 dispute_rate < 1% + responder owner 邮箱+手机验证 + 窗口内未触发任一 §6.4 熔断。
- `trusted → verified`：≥ 10,000 verified runs + 法人/身份 KYC + 平台 admin 手动审核 + 类目合规要求满足。

降级建议：

- `verified → trusted`：30 天滑窗 dispute_rate >= 3% 或触发任一熔断。
- `trusted → untrusted`：30 天滑窗 dispute_rate >= 5% 或单边申诉率 > 5%。
- 任意 → `frozen`：24h 滑窗 dispute_rate >= 10% / unverified_rate >= 5% / pricing drift / dual-call 不一致率 >= 30%。

### A.7 worked example：hotline 提价兼容性

> Hotline `foxlab.text.classifier.v1` 现价 5000 cents（$50）/call。Caller A 在 10:00 走 prepare_request，拿到 prepared_request_id 与 task token，token claims 中冻结 max_charge_cents = 5000，exp = 10:05。Responder owner 在 10:02 把价格改成 10000 cents（$100）/call。
>
> 1. Caller A 在 10:00–10:05 之间 send_request 必须按老价 $50 成交。Responder 上报必须保持与 token 一致，否则 result 进 UNVERIFIED 自动全额退。
> 2. Caller A 在 10:05 之后须重新 prepare_request，看到新价 $100。token 未过期前的"老价权益窗口"最长 = `token_ttl_seconds = 300`。
> 3. Caller B 在 10:03 第一次 prepare_request 直接看到新价 $100。
> 4. 平台向近 24h 调用过该 hotline 的 caller agent 发出 `hotline.pricing_changed` 通知。
> 5. 在主流 $50/call 价格段，100% 提价 caller 高度敏感，正好支撑"涨价应走 v1→v2 后缀变更"的推荐方向。

兼容性建议：

- **强建议**把"提价"与"降价"放在 hotline_id 后缀变更上：`foxlab.text.classifier.v1` → `foxlab.text.classifier.v2`，老 id 保留至少 90 天作为兼容窗口，价格不变。
- 仅在紧急事故 / 监管要求 / 修复 onboarding 误填（变更幅度 ≤ 50%）时允许原 id 内变更。
- 任何原 id 内的提价 > 20% 必须经平台 admin 手动审批。

### A.8 Hotline 输出风险声明（disclaimer）字段草案

针对 §6.5.3 的 hotline 必声明义务，建议在 hotline 目录条目（与 `pricing_hint` 同级）以及 `template-bundle` 内引入独立 `disclaimer` 字段：

```json
{
  "disclaimer": {
    "risk_categories": [
      "professional_advice",
      "creative_generation"
    ],
    "category_details": {
      "professional_advice": {
        "domains": ["legal", "medical", "financial"],
        "human_review_required": true
      },
      "creative_generation": {
        "may_contain_copyrighted_material": false,
        "ai_generated_disclosure_required": true
      }
    },
    "version": "0.2.0"
  }
}
```

提议初值（草案，最终归 platform RFC 冻结）：

| `risk_category` | 含义 | 典型类目 |
| :--- | :--- | :--- |
| `professional_advice` | 涉及专业建议（监管类目） | 法律 / 医疗 / 金融 / 税务 |
| `creative_generation` | 生成式内容，可能含版权风险 | 文本生成 / 图像生成 / 音乐生成 |
| `code_generation` | 生成代码，需 sandbox 执行 | 代码补全 / 脚本生成 / SQL 生成 |
| `executable_payload` | 含可执行命令 / 系统指令 | shell / SQL / 系统调用 |
| `personal_data_exposure` | 可能含 PII | 含联系方式 / 身份信息的提取或合成 |
| `regulated_content` | 涉及监管类目 | 医疗器械 / 金融产品 / 武器 / 药物 |
| `time_sensitive` | 结果有时效性，超时使用可能错误 | 实时数据 / 价格 / 库存 |

约束建议（草案）：

- `risk_categories` 不可为空（即使是免费、纯计算类 hotline，也至少应声明 `[]` 显式表达"无已知风险"）。
- `category_details.<category>` 是 hotline 自定义子声明，schema 不在协议层强制，由各类目语义决定。
- caller agent 在 prepare_request 阶段必须能拿到 disclaimer；ops-console 默认对每个类目展示一行人话标签。
- caller-side 可对每个 risk_category 设置 "always_acknowledge / always_reject / ask_human"。

### A.9 内容审查相关错误码与事件（追加，不替换 A.2）

错误码（追加到 A.2.1）：

| 错误码 | HTTP | retryable | 触发场景 |
| :--- | ---: | :--- | :--- |
| `ERR_HOTLINE_CONTENT_REVIEW_PENDING` | 423 | true（审查通过后） | hotline 仍在内容审查中，暂不允许签发 token |
| `ERR_HOTLINE_DISCLAIMER_NOT_ACKNOWLEDGED` | 402 | false | caller 未对 hotline disclaimer 中需要的类别表达同意 |
| `ERR_RESULT_CONTENT_REJECTED` | 451 | false | result 在落地前被平台内容审查拒绝（对应 §5.2 自动退款） |

事件（追加到 A.2.2）：

| 事件名 | 说明 |
| :--- | :--- |
| `hotline.content_review_passed` | 内容审查通过（首次升级到 trusted 的必要条件之一） |
| `hotline.content_review_failed` | 内容审查失败 |
| `hotline.disclaimer_drift` | 实际 result 内容分类与 hotline 自报 disclaimer 不一致（§6.5.3 熔断） |
| `hotline.content_quarantine` | 因内容风险暂时下架（介于 trusted 与 frozen 之间的中间态） |
| `caller.request.refunded_content_rejected` | result 被平台内容审查拒绝，自动全额退 |

---

## 附录 B：引用

- `docs/current/spec/architecture.md`：v0.1 协议骨架与状态机
- `docs/current/spec/defaults-v0.1.md`：v0.1 冻结参数
- `docs/current/spec/platform-api-v0.1.md`：现有控制面 API
- `docs/planned/roadmap/evolution-roadmap.md §2.4`：tenant_quota 已迁出至 v0.2+
- `docs/planned/roadmap/evolution-roadmap.md §3`：多轮会话储备
- `docs/planned/design/repo-split-plan.md`：仓库拆分边界
