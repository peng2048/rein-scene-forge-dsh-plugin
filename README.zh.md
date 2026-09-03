# Rein Scene Forge DeepSeek Harness 插件

插件帮助 AI 根据用户提供的 `points.json` 和讲解词生成符合 `tour_robot` 数据模型的 YAML。

## 默认输入与输出

输入：

- `points.json`
- 讲解词 Markdown 或文本
- 用户确认的场景名称和歧义项

输出目录：

```text
<scene_id>/
├── map_config.yaml
├── scene_config.yaml
├── explain_config.yaml
└── reception_pack.yaml  # 仅启用动态接待时
```

插件不默认生成 Scene IR、Requirement JSON、manifest、traceability、summary 或 import guide。

## 内置数据模型

AI 可读取：

- `skills/robot-scene-authoring/references/tour-robot-data-model.md`
- `skills/robot-scene-authoring/templates/*.template.yaml`

确定性工具使用：

- `schemas/tour-robot/map-config.schema.json`
- `schemas/tour-robot/scene-config.schema.json`
- `schemas/tour-robot/explain-config.schema.json`
- `schemas/tour-robot/reception-pack.schema.json`

模板提供默认骨架；Schema 同时描述运行时支持的可选字段。可选能力只有在用户输入或确认要求时才使用。

## 工具

- `analyze_point_input`：检查原始点位，识别完全共址和近似共址点，不合并不同逻辑点。
- `validate_tour_robot_scene`：校验最终 YAML、跨文件引用、物理导航 ID、源点覆盖和程序限制。

## 开发验证

```sh
pnpm test
pnpm run smoke
pnpm pack --dry-run
```
