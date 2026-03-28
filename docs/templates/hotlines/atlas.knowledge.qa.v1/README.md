# atlas.knowledge.qa.v1

**Atlas Enterprise Knowledge QA** — Ask a question in natural language and receive a grounded answer with source citations. The private knowledge base, retrieval strategy, domain-tuned embedding models, and ranking logic all run on the Responder side and are never exposed to the Caller.

## Basic Info

| Field | Value |
|-------|-------|
| `hotline_id` | `atlas.knowledge.qa.v1` |
| `responder_id` | `responder_atlas` |
| `task_types` | `["knowledge_qa", "rag_retrieval"]` |
| `capabilities` | `["knowledge.retrieve", "qa.grounded", "multilingual"]` |
| `tags` | `["enterprise", "rag", "knowledge-base", "qa"]` |

## Why This Is a Hotline

The Caller sends only a question string. The Responder's core IP — the private knowledge corpus, chunking strategy, embedding model fine-tuned on domain vocabulary, and re-ranking algorithms — stays entirely within the Responder's environment. The knowledge itself never flows outward. This is textbook Hotline design: **the question is public, the knowledge is private**.

## Recommended For

- Internal HR, policy, and compliance Q&A
- Customer support knowledge base lookups
- Technical documentation assistant for engineering teams
- Onboarding knowledge queries for new employees
- Research synthesis across proprietary document collections

## Not Recommended For

- Questions requiring real-time external data (stock prices, live news)
- Tasks requiring strict verbatim legal citation (use a dedicated legal review service)
- Open-domain general knowledge questions (better served by general LLMs)
- Multi-turn conversational reasoning with long shared context

## Known Limitations

- Maximum question length: 1,000 characters
- `retrieval_coverage: "none"` indicates the knowledge base has no relevant coverage for this question
- Confidence scores below 0.6 suggest partial or low-quality coverage — treat answers cautiously
- `sources[].excerpt` may be omitted if the Responder's policy restricts raw text exposure

## Input

Provide a natural language question (required, max 1,000 characters). Optionally specify `language`, `max_sources`, and `context_hint` to guide retrieval focus. No file attachments.

## Output

Returns `answer` (grounded natural language response), `confidence` (0.0–1.0), `sources` (citation list), optional `follow_up_questions`, and `retrieval_coverage`. No file attachments.

## Quick Start

```json
{
  "input": {
    "question": "What is the reimbursement limit for hotel stays in tier-2 cities?",
    "language": "zh-CN",
    "max_sources": 3,
    "context_hint": "HR policy"
  }
}
```

See `example-contract.json` for a complete call contract and `example-result.json` for the full result structure.
