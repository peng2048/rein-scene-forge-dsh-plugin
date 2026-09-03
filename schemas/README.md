# Schema assets

This self-contained plugin bundles the public contracts used by its deterministic Node runtime:

- `scene-requirement.schema.json` for `validate_scene_requirement`;
- `scene-ir.schema.json` for `validate_scene_ir` and compilation input checks;
- `dynamic-authoring-output.schema.json` for `verify_scene_package` manifest checks.

These files are synchronized from the Rein Scene Forge root `Schemas/` directory for plugin version `0.1.0`. The plugin uses AJV Draft 2020-12 validation and does not require the source repository or a Python environment at runtime.
