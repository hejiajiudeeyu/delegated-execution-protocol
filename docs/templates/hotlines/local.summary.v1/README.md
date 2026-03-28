# local.summary.v1

`local.summary.v1` is the official local demo hotline bundled with the ops client.

Use it to:

- learn the expected responder-side hotline shape
- validate local caller -> responder self-call flow
- bootstrap coding agents with a stable, zero-dependency example

Input:

```json
{
  "text": "Summarize this local example request."
}
```

Output:

```json
{
  "summary": "Summarize this local example request."
}
```

Default metadata:

- `hotline_id`: `local.summary.v1`
- `task_types`: `["text_summarize"]`
- `capabilities`: `["text.summarize"]`
- `tags`: `["local", "example", "demo"]`
- `adapter_type`: `process`

The bundled worker is provided by:

- [example-hotline-worker.js](/Users/hejiajiudeeyu/Documents/Projects/remote-hotline-protocol/apps/ops/src/example-hotline-worker.js)
