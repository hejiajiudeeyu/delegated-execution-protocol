权限生命周期和 RBAC 调用流程

> 英文版：[permission-lifecycle-and-rbac.md](permission-lifecycle-and-rbac.md)
> 说明：中文文档为准。

# 权限生命周期和 RBAC 调用流程

## 目标

- 将权限模型从业务主流程中拆分，独立描述“权限从哪里来、何时变化、如何校验”。
- 主流程图仅保留鉴权闸门，细节与本文件相似。

## 核心对象

- `user_id`：用户主体
- `role_scopes`：角色权限集合（`buyer`、`seller`）
- `resource_binding`：资源归属（关系`owner_user_id -> seller_id -> subagent_id`）
- `api_key_fingerprint`：API Key指纹（明文密钥仅在签名时返回）

## 权限状态机

```mermaid
stateDiagram-v2
    [*] --> BUYER_ACTIVE
    BUYER_ACTIVE --> SELLER_PENDING_REVIEW: 提交 remote subagent 草案
    SELLER_PENDING_REVIEW --> BUYER_ACTIVE: 审核拒绝/撤回
    SELLER_PENDING_REVIEW --> SELLER_ACTIVE: 审核通过 + 导入成功 + 资源绑定写入
    SELLER_ACTIVE --> SELLER_SUSPENDED: 审计封禁/违规/手动暂停
    SELLER_SUSPENDED --> SELLER_ACTIVE: 申诉通过/手动恢复
    SELLER_ACTIVE --> BUYER_ACTIVE: 下线全部 remote subagent + 回收 seller scope
    SELLER_SUSPENDED --> BUYER_ACTIVE: 永久回收 seller scope
```

## 触发事件与变更规则

- `USER_REGISTERED`（来源：平台API）  
  变更：创建`user_id`，初始化`role_scopes={buyer}`。
- `REMOTE_SUBAGENT_SUBMITTED`（来源：卖家用户/门户）  
  变更：进入 `SELLER_PENDING_REVIEW`（不绑定卖家范围）。
- `REMOTE_SUBAGENT_APPROVED` + `CATALOG_IMPORTED`（来源：审阅者 + 导入管道）  
  变更：写入`resource_binding`，激活`seller`范围，进入`SELLER_ACTIVE`。
- `REMOTE_SUBAGENT_REJECTED`（来源：评论者）  
  变更：保持/回到`BUYER_ACTIVE`。
- `SELLER_ACCESS_SUSPENDED`（来源：风险/操作）  
  变更：`SELLER_ACTIVE -> SELLER_SUSPENDED`。
- `SELLER_ACCESS_RESTORED`（来源：Ops）  
  变更：`SELLER_SUSPENDED -> SELLER_ACTIVE`。
- `SELLER_SCOPE_REVOKED`（来源：Ops/Policy）  
  变更：删除`seller`范围，回到`BUYER_ACTIVE`。

## 权限变更图（v1.1）

编号后缀：

- `-REQ`：请求消息
- `-RES`：响应消息
- `-ACT`：本地动作
- `-S*`：成功分支事件
- `-F*`：失败分支事件
- `-END_SUCCESS | -END_FAIL`：终态

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant P as Platform API
    participant IAM as IAM / RBAC
    participant RV as Reviewer
    participant IMP as Import Pipeline
    participant AUD as Audit Log

    U->>P: [A1-REQ] USER_REGISTERED
    P->>IAM: [A2-REQ] 初始化 role_scopes={buyer}
    IAM-->>P: [A2-RES] buyer scope active
    P->>AUD: [A3-ACT] 记录权限初始化事件

    U->>P: [B1-REQ] REMOTE_SUBAGENT_SUBMITTED (owner_user_id)
    P->>AUD: [B2-ACT] 记录 pending_review

    RV->>P: [C1-REQ] REMOTE_SUBAGENT_APPROVED
    P->>IMP: [C2-REQ] 触发导入
    alt 导入失败
        IMP-->>P: [C2-F1] IMPORT_FAILED
        P->>AUD: [C2-F2] 记录审批通过但导入失败
        P-->>U: [C2-END_FAIL] seller 未激活
    else 导入成功
        IMP-->>P: [C2-RES] IMPORT_SUCCEEDED
        P->>IAM: [C3-REQ] 写 resource_binding(owner_user_id->seller_id->subagent_id)
        IAM-->>P: [C3-RES] binding persisted
        P->>IAM: [C4-REQ] 激活 seller scope
        IAM-->>P: [C4-RES] role_scopes={buyer,seller}
        P->>AUD: [C5-ACT] 记录 SELLER_ACTIVE
        P-->>U: [C5-END_SUCCESS] seller 激活成功
    end

    P->>IAM: [D1-REQ] 鉴权校验（API key + seller scope + resource_binding）
    alt 任一校验失败
        IAM-->>P: [D1-F1] AUTH_SCOPE_FORBIDDEN / AUTH_RESOURCE_FORBIDDEN
    else 校验通过
        IAM-->>P: [D1-RES] allow
    end
```

## 接口权限矩阵（最小集）

- `GET /v1/catalog/subagents`：需要`buyer`
- `POST /v1/tokens/task`：需要`buyer`
- `GET /v1/requests/{request_id}/events`：需要`buyer`
- `POST /v1/tokens/introspect`：需要`seller` + 资源归属命中
- `POST /v1/requests/{request_id}/ack`：需要`seller` + 资源归属命中
- `POST /v1/sellers/{seller_id}/heartbeat`：需要 `seller` + `owner_user_id -> seller_id` 命中
- `POST /v1/metrics/events`：`buyer` 或 `seller`（按 `source` 与资源归属校验）
