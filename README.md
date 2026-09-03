# Rein Scene Forge DeepSeek Harness Plugin

Generates and validates `tour_robot` YAML from an authoritative `points.json` and narration material.

The bundled Skill contains the target data model and fill-in templates. The plugin exposes two deterministic tools:

- `analyze_point_input`
- `validate_tour_robot_scene`

Default output is one `<scene_id>/` directory containing `map_config.yaml`, `scene_config.yaml`, and `explain_config.yaml`; `reception_pack.yaml` is optional for confirmed dynamic reception.

Development checks:

```sh
pnpm test
pnpm run smoke
pnpm pack --dry-run
```
