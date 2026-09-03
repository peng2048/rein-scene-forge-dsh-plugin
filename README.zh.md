# Rein Scene Forge DeepSeek Harness 插件

这是一个预构建 ESM DeepSeek Harness 插件，提供 `robot-scene-authoring` Skill 和四个本地确定性工具。

## 工具

所有路径均以当前 Workspace 为边界解析，不能逃逸到 Workspace 外。默认不覆盖已有报告或生成文件，只有显式传入 `force: true` 才允许覆盖。

- `validate_scene_requirement`：校验 Scene Requirement JSON，并写出 JSON 报告。
- `validate_scene_ir`：使用随包 JSON Schema 和跨引用规则校验 Scene IR。
- `compile_tour_robot_scene`：把已校验 Scene IR 编译为 `tour_robot` 动态作者场景包。
- `verify_scene_package`：复验 `manifest.json`，并校验 manifest 所列目标文件的 SHA-256 哈希。

场景包包含 `map_config.yaml`、`scene_config.yaml`、`explain_config.yaml`、`reception_pack.yaml`、`pad-profile-schema.json`、`manifest.json`、`scene-ir.json`、`validation-report.json`、`summary.json`、`traceability.json` 和 `import-guide.md`。

## Runtime

npm 包可独立运行，需要 Node.js 20 或更高版本，仅依赖 `ajv`、`yaml` 和 Node 标准库；运行时不依赖 Rein Scene Forge 源码仓库或 Python 环境。

当前最小 Adapter 会保留动态作者配置中的 Conditions 和 Variants，并在 manifest 中声明 Session Compiler 由目标 Runtime 提供；插件不包含完整动态 Session Compiler。

## 开发验证

```sh
npm install --legacy-peer-deps
npm test
npm run smoke
npm pack --dry-run
```

随包示例位于 `examples/dynamic-corporate-showroom/scene-ir.json`。

## 许可证

MIT，见 `LICENSE`。
