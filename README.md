# Rein Scene Forge DeepSeek Harness Plugin

A prebuilt ESM DeepSeek Harness plugin for the `robot-scene-authoring` Skill and four deterministic local tools.

## Tools

All paths are resolved against the active workspace and must remain inside it. Existing reports and generated package files are protected unless `force: true` is passed.

- `validate_scene_requirement`: validate a Scene Requirement JSON file and write a JSON report.
- `validate_scene_ir`: validate Scene IR with bundled JSON Schema and cross-reference rules.
- `compile_tour_robot_scene`: compile validated Scene IR into a `tour_robot` authoring package.
- `verify_scene_package`: revalidate `manifest.json` and SHA-256 hashes for every manifest-listed target file.

The compiled package includes `map_config.yaml`, `scene_config.yaml`, `explain_config.yaml`, `reception_pack.yaml`, `pad-profile-schema.json`, `manifest.json`, `scene-ir.json`, `validation-report.json`, `summary.json`, `traceability.json`, and `import-guide.md`.

## Runtime

The npm package is self-contained and requires Node.js 20 or newer. It uses `ajv`, `yaml`, and Node standard-library APIs; it does not require the Rein Scene Forge source repository or a Python environment.

The minimal adapter preserves dynamic authoring conditions and variants and declares the compatible Session Compiler as provided by the target runtime. It does not bundle the full dynamic Session Compiler.

## Development checks

```sh
npm install --legacy-peer-deps
npm test
npm run smoke
npm pack --dry-run
```

The fixture at `examples/dynamic-corporate-showroom/scene-ir.json` is included in the package for a minimal offline example.

## License

MIT. See `LICENSE`.
