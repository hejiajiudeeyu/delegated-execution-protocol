# pixel.product.renderer.v1

**Pixel Product Renderer** — Upload a product photo and receive high-quality rendered e-commerce visuals. The fine-tuned rendering model, brand style pipeline, background synthesis algorithms, and post-processing chain all run on the Responder side and are never exposed to the Caller.

## Basic Info

| Field | Value |
|-------|-------|
| `hotline_id` | `pixel.product.renderer.v1` |
| `responder_id` | `responder_pixel` |
| `task_types` | `["product_render", "image_compositing"]` |
| `capabilities` | `["image.render", "background.synthesis", "product.retouch"]` |
| `tags` | `["ecommerce", "product-photo", "rendering", "image-ai"]` |

## Why This Is a Hotline

The Caller provides only a product photo and a text description. The Responder's core IP — the proprietary fine-tuned rendering model trained on commercial product photography, background synthesis algorithms, multi-pass compositing pipeline, and post-processing presets — never leaves the Responder's environment. The source product photo is not stored after processing. This is textbook Hotline design: **the product is public, the rendering intelligence is private**.

## Recommended For

- E-commerce platform product listing visuals
- Marketing asset production for product launches
- Multi-angle product rendering for catalogue generation
- Rapid visual A/B testing for advertising campaigns
- White-label product photography for resellers

## Not Recommended For

- Products requiring physical tactile detail accuracy (e.g. fabric texture certification)
- Strict photorealistic technical drawings or engineering diagrams
- Videos or animated product renders (this hotline produces static images only)
- Tasks requiring on-brand color-matching certification without human review

## Known Limitations

- Maximum source photo size: 15MB
- Supported input formats: JPEG, PNG, WebP
- Maximum output quantity: 4 renders per call
- `background_removal_applied: false` in metadata indicates the source photo may have had a complex background that reduced render quality — consider pre-cropping

## Input

Provide a product description (required, max 1,500 characters) and a `product_photo` attachment (required, max 15MB). Optionally specify `background_style`, `angle`, `resolution`, and `quantity`.

## Output

Returns a `renders` array (one entry per rendered image) with attachment role references and applied style details. All image files are returned as output attachments (`rendered_image_1` through `rendered_image_4`). At least one render is always returned when the call succeeds.

## Quick Start

```json
{
  "input": {
    "product_description": "A matte black aluminum Bluetooth headphone with soft ear cushions and a metal logo on the side. Premium, tech-forward aesthetic.",
    "background_style": "dark_premium",
    "angle": "three_quarter",
    "resolution": "1500x1500",
    "quantity": 2
  }
}
```

Attach your product photo with role `product_photo`. See `example-contract.json` for a complete call contract and `example-result.json` for the full result structure.
