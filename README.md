# Rein Scene Forge DeepSeek Harness Plugin

Generates and validates `tour_robot` YAML from an authoritative `points.json` and narration material.

The bundled Skill uses `references/model-catalog.md` as its field-selection authority. The internal authoring envelope embeds the exact target objects defined by `schemas/tour-robot/*.schema.json`; unknown target YAML fields are rejected.

The plugin exposes three deterministic tools:

- `analyze_point_input`
- `validate_authoring_model`
- `validate_tour_robot_scene`

Default output is one `<scene_id>/` directory containing `map_config.yaml`, `scene_config.yaml`, and `explain_config.yaml`; `reception_pack.yaml` is optional for confirmed dynamic reception.

Development checks:

```sh
pnpm test
pnpm run smoke
pnpm pack --dry-run
```
