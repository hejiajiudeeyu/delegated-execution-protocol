# Implemented Call Flow

本图只描述当前仓库已经实现并验证通过的最小闭环：

- Caller Agent（Caller Agent / Local Agent）通过 Caller Controller 编排协议调用
- Platform API 负责目录、token、delivery-meta、ACK events、heartbeat、metrics
- Delivery Channel 当前实例是本地参考 transport
- Responder Controller 负责为 Responder（Responder）侧完成解码、鉴权、ACK、队列、执行器调度、签名回包
- Remote Hotline 在当前已实现基线中表现为 Responder Runtime 内部挂载的 executor / workflow / code facility

```mermaid
sequenceDiagram
    autonumber
    participant BU as "Caller User (Caller User)"
    participant BA as "Caller Agent (Caller Agent / Local Agent)"
    participant BC as "Caller Controller"
    participant P as "Platform API"
    participant BTA as "Caller Transport Adapter"
    participant DC as "Delivery Channel (local reference transport)"
    participant STA as "Responder Transport Adapter"
    participant SC as "Responder Controller (Responder Control)"
    participant RS as "Remote Hotline Runtime"

    BU->>BA: submit goal and constraints
    BA->>BC: create local request record
    BC->>P: GET /v2/hotlines
    P-->>BC: candidate Hotlines (catalog hotlines)
    BC-->>BA: Hotline candidates + template_ref + signer key

    BA->>BC: select Responder + Hotline target (responder_id + hotline_id)
    BC->>P: GET /v2/hotlines/{hotline_id}/template-bundle
    P-->>BC: input_schema + output_schema
    BC-->>BA: template bundle

    BA->>BC: submit task contract draft
    BC->>P: POST /v1/tokens/task
    P-->>BC: task token
    BC->>P: POST /v1/requests/{request_id}/delivery-meta
    P-->>BC: task_delivery + result_delivery + verification + responder_public_key_pem
    BC-->>BA: prepared request

    BA->>BC: POST /controller/requests/{request_id}/dispatch
    BC->>P: POST /v1/metrics/events (caller.request.dispatched)
    BC->>BTA: send request envelope
    BTA->>DC: deliver envelope
    DC->>STA: route envelope
    STA->>SC: POST /controller/inbox/pull

    SC->>P: POST /v1/metrics/events (responder.task.received)
    SC->>P: POST /v1/tokens/introspect
    P-->>SC: token active + claims
    SC->>SC: guardrail check + idempotency check

    alt token invalid or guardrail rejected
        SC->>P: POST /v1/metrics/events (responder.task.rejected)
        SC->>STA: signed error result
    else accepted
        SC->>P: POST /v1/requests/{request_id}/ack
        P-->>SC: ACK accepted
        SC->>P: POST /v1/metrics/events (responder.task.accepted)
        SC->>RS: execute task context
        RS-->>SC: output or execution error
        SC->>P: POST /v1/metrics/events (responder.task.succeeded / responder.task.failed)
        SC->>STA: signed result package
    end

    STA->>DC: deliver result envelope
    DC->>BTA: route result envelope
    BTA->>BC: POST /controller/inbox/pull
    BC->>P: GET /v1/requests/{request_id}/events
    P-->>BC: ACKED / COMPLETED / FAILED event stream
    BC->>P: POST /v1/metrics/events (caller.request.acked)
    BC->>BC: verify signer binding + signature + schema

    alt result verified and status=ok
        BC->>P: POST /v1/metrics/events (caller.request.succeeded)
        BC-->>BA: SUCCEEDED + result_package
        BA-->>BU: final output
    else result verified and status=error
        BC->>P: POST /v1/metrics/events (caller.request.failed)
        BC-->>BA: FAILED + error result
        BA-->>BU: failure returned
    else signature/schema/context invalid
        BC->>P: POST /v1/metrics/events (caller.request.unverified)
        BC-->>BA: UNVERIFIED + evidence
        BA-->>BU: verification failure
    end

    opt no ACK before ack_deadline_s
        BC->>P: POST /v1/metrics/events (caller.request.timed_out)
        BC-->>BA: TIMED_OUT (DELIVERY_OR_ACCEPTANCE_TIMEOUT)
    end

    opt no final result before hard_timeout_s
        BC->>P: POST /v1/metrics/events (caller.request.timed_out)
        BC-->>BA: TIMED_OUT (EXEC_TIMEOUT_HARD)
    end
```
