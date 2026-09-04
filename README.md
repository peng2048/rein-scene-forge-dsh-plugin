# Rein Scene Forge DeepSeek Harness Plugin

Generates and validates `tour_robot` YAML from an authoritative `points.json` and narration material.

The bundled Skill uses `references/model-catalog.md` as its field-selection authority. The internal authoring envelope embeds the exact target objects defined by `schemas/tour-robot/*.schema.json`; unknown target YAML fields are rejected.
Every generated scene must complete `references/validation-sop.md`. Only `is_publishable: true` is import-ready; `is_valid: true` with warnings is not.

The plugin includes a versioned machine-readable Rule Set under `rules/` and exposes four deterministic tools:

- `get_authoring_rules`
- `analyze_point_input`
- `validate_authoring_model`
- `validate_tour_robot_scene`

Default output is one `<scene_id>/` directory containing `map_config.yaml`, `scene_config.yaml`, `explain_config.yaml`, and `reception_pack.yaml`. New scenes enable dynamic PAD reception by default; missing user instructions must not silently disable it.

Development checks:

```sh
pnpm test
pnpm run smoke
pnpm pack --dry-run
```
