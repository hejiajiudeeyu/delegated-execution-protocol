# delegated-execution-protocol

> **Part of [CALL ANYTHING](https://callanything.xyz/)** — the open protocol that lets any AI agent dial any external capability.
> This repository is the **protocol truth-source**: it defines what a Hotline is, how Caller and Responder communicate, and the standard `result_package` shape every agent can parse.
>
> 📖 [Docs](https://callanything.xyz/docs/) · [Glossary](https://callanything.xyz/glossary/) · [FAQ](https://callanything.xyz/faq/) · [Blog](https://callanything.xyz/blog/) · [Marketplace](https://callanything.xyz/marketplace/) · [Compare vs MCP](https://callanything.xyz/compare/hotline-vs-mcp/)

---

## What is CALL ANYTHING?

CALL ANYTHING is an open protocol for **delegated execution** between AI agents and external capability providers. Three concepts you only need to learn once:

- **Hotline** — one standardized contract that bundles identity, billing, approval, observability and routing into a single dial-able capability. Not an API, not an MCP server, not a Skill — it can be **exposed as** any of those, but it's a product form of its own.
- **Caller / Responder** — the two ends of every Hotline call. A Caller is usually an AI agent or agent team; a Responder is usually a **One-Person Company (OPC)** — an individual operator turning private expertise into a 7×24 agent-callable, per-call-billable service.
- **`result_package`** — the protocol-level return shape. Every Hotline answers in the same structure, so an agent learns to parse once and can call anything.

This repository owns the **stable cross-repository protocol surface** — schemas, validation helpers, error registry, signing/canonicalization rules, bundled templates, and compatibility guidance. The companion repositories build on top of it:

- 🛠️ **Client runtime & CLI** — [delegated-execution-client](https://github.com/hejiajiudeeyu/delegated-execution-client) (`@delexec/ops` + `delexec-ops` CLI)
- 🚀 **Self-hosted platform & operator console** — [delegated-execution-platform-selfhost](https://github.com/hejiajiudeeyu/delegated-execution-platform-selfhost)
- 🌐 **Marketing / GEO surface, public marketplace, docs** — [callanything.xyz](https://callanything.xyz/)

If you're new here, start with the [Quick Start for Callers](https://callanything.xyz/docs/quick-start-caller/) or [Quick Start for Responders](https://callanything.xyz/docs/quick-start-responder/) on the brand site, then come back here to read the actual protocol definitions.

---

## AI Collaboration

- `CLAUDE.md` defines the repository-specific development and validation rules.
- `AGENTS.md` gives a minimal routing and ownership summary for AI coding agents.

## Repository Responsibility

This repository owns the stable cross-repository protocol surface:

- protocol objects, schemas, and validation helpers
- error registry, status enums, and signing/canonicalization rules
- bundled templates and protocol documentation snapshots
- compatibility guidance for client and platform implementers

This repository does not own caller runtime behavior, responder runtime behavior, operator deployment, or application-specific storage implementations.

## Publish Target

- npm package: `@delexec/contracts`
- access: public
- runtime: Node.js 20+

## How To Develop Here

- Change this repository first when you need to alter protocol shape, request/result semantics, schema validation, or template payloads.
- Keep implementation details out of this repository. If a change only affects CLI UX, deployment, persistence strategy, or operator workflows, it belongs in another repository.
- Treat every change as an upstream compatibility change. Update docs, bundled assets, and release notes together with code.

Recommended change flow:

1. Modify protocol code and docs in this repository.
2. Release a new `@delexec/contracts` version.
3. Update `delegated-execution-client` and `delegated-execution-platform-selfhost` to consume the new version.

## Local Validation

```bash
npm install
npm test
```
