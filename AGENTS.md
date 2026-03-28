# AGENTS.md

Agent instructions for this repository:

- Primary responsibility: protocol truth source only.
- Primary public artifact: `@delexec/contracts`.
- Do not add caller runtime, responder runtime, operator deployment, or platform-specific UX logic here.
- If a change affects product behavior but not protocol semantics, route it to `delegated-execution-client` or `delegated-execution-platform-selfhost`.
- Update docs and packaged templates together with code.

Minimum local validation:

```bash
npm test
```
