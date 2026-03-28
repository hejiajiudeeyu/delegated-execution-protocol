# starlight.creative.studio.v1

**Starlight AI Creative Studio** — Submit a natural-language prompt and receive AI-generated creative images. The multi-model orchestration pipeline, prompt engineering strategy, style library, and post-processing logic run entirely on the Responder side.

## Basic Info

| Field | Value |
|-------|-------|
| `hotline_id` | `starlight.creative.studio.v1` |
| `responder_id` | `responder_starlight` |
| `task_types` | `["creative_generation", "image_synthesis"]` |
| `capabilities` | `["image.generate", "style.transfer", "multi_model.orchestrate"]` |
| `tags` | `["creative", "image", "ai-generation", "design"]` |

## Why This Is a Hotline

The Caller only provides a text prompt and optional style hint. The Responder's core IP — the multi-stage model pipeline, proprietary prompt augmentation templates, style-transfer algorithms, and fine-tuned models — never leaves the Responder's environment. This is the defining characteristic of a Hotline: **the interface is public, the brain is private**.

## Recommended For

- Product photography and e-commerce visuals
- Marketing banner and social media content generation
- Concept art and creative exploration
- Brand-consistent visual asset production
- Rapid prototyping of visual campaigns

## Not Recommended For

- Tasks requiring real-time revision loops (synchronous editing workflows)
- Outputs requiring strict legal accuracy (medical, legal, financial diagrams)
- Very high-resolution print production (> 4K) without a dedicated agreement
- Generation of content subject to regulatory restrictions

## Known Limitations

- Maximum prompt length: 2,000 characters
- Maximum quantity per call: 4 variations
- Reference image is used as a soft style signal, not a direct conditioning input
- `pipeline_stage_count` in the output metadata does not reveal stage details

## Input

Provide a creative prompt (required, max 2,000 characters). Optionally specify `style_preset`, `output_format`, `quantity`, and `aspect_ratio`. An optional `reference_image` attachment can be provided as compositional or style guidance.

## Output

Returns a `generated_items` array (one entry per generated asset) with attachment role references and dimensions. All image files are returned as output attachments (`generated_asset_1` through `generated_asset_4`). At least one asset is always generated when the call succeeds.

## Quick Start

```json
{
  "input": {
    "prompt": "A luxury skincare serum product shot, clean white background, soft studio lighting, high-end editorial feel",
    "style_preset": "product_clean",
    "output_format": "jpeg",
    "quantity": 2,
    "aspect_ratio": "1:1"
  }
}
```

See `example-contract.json` for a complete call contract and `example-result.json` for the full result structure.
