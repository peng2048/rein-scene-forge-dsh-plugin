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

- `skills/robot-scene-authoring/references/model-catalog.md`（字段选择的权威清单）
- `skills/robot-scene-authoring/references/tour-robot-data-model.md`
- `skills/robot-scene-authoring/references/validation-sop.md`（生成后强制验收流程）
- `skills/robot-scene-authoring/templates/*.template.yaml`

确定性工具使用：

- `schemas/authoring/authoring-model.schema.json`
- `schemas/tour-robot/map-config.schema.json`
- `schemas/tour-robot/scene-config.schema.json`
- `schemas/tour-robot/explain-config.schema.json`
- `schemas/tour-robot/reception-pack.schema.json`

内部作者模型直接包含四份目标配置对象，不做字段翻译。目标 Schema 的字段来自真实 `tour_robot` 配置和消费者；未知目标字段会被拒绝。模板只提供默认骨架，可选能力只有在用户输入或确认要求时才使用。

## 工具

- `analyze_point_input`：检查原始点位，识别完全共址和近似共址点，不合并不同逻辑点。
- `validate_authoring_model`：在写 YAML 前校验完整内部作者模型和四份目标配置对象。
- `validate_tour_robot_scene`：校验最终 YAML、跨文件引用、物理导航 ID、源点覆盖和程序限制。

只有最终校验返回 `is_publishable: true` 才能标记为可导入；仅有 `is_valid: true` 但仍有 warning 时不能交付。

## 开发验证

```sh
pnpm test
pnpm run smoke
pnpm pack --dry-run
```
