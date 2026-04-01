# local.delegated-execution.workspace-summary.v1

`local.delegated-execution.workspace-summary.v1` is the official local workspace-summary hotline bundled with the ops client.

Use it to:

- review a local-first hotline draft from the Caller's point of view
- validate local caller -> responder self-call flow
- provide a stable workspace-summary example for coding agents and local onboarding

Input:

```json
{
  "text": "CHG-2026-003 is in progress. The local onboarding flow is now stable, and platform publishing remains a later optional step.",
  "instruction": "Summarize the current progress in 2-3 sentences and mention the next step."
}
```

Output:

```json
{
  "summary": "The local onboarding flow is now stable and can complete caller registration, responder enablement, draft review, and local self-call without platform bootstrap. The next step is refining local hotline management before expanding platform and community publishing."
}
```

Default metadata:

- `hotline_id`: `local.delegated-execution.workspace-summary.v1`
- `task_types`: `["text_summarize"]`
- `capabilities`: `["text.summarize", "workspace.status"]`
- `tags`: `["local", "workspace", "summary"]`
- `adapter_type`: `process`
