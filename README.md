# delegated-execution-protocol

Protocol definitions, schemas, templates, and compatibility docs for delegated execution.

This repository is the protocol-side split from the original monorepo and contains the publishable `@delexec/contracts` package plus protocol truth-source docs and template assets.

## AI Collaboration

- `CLAUDE.md` defines the repository-specific development and validation rules.
- `AGENTS.md` gives a minimal routing and ownership summary for AI coding agents.

## Repository Responsibility

This repository owns the stable cross-repository protocol surface:

- protocol objects, schemas, and validation helpers
- error registry, status enums, and signing/canonicalization rules
- bundled templates and protocol documentation snapshots
- compatibility guidance for client and platform implementers

This repository does not own buyer runtime behavior, seller runtime behavior, operator deployment, or application-specific storage implementations.

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
