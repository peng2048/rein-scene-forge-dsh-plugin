# tour_robot YAML Data Model

This target model is derived from the real `tour_robot` runtime and the rich `hz_embodied` scene. Generate only fields that are supported and justified by user input.

## Identity Layers

Keep these identities separate:

1. Source point ID: `points.json[*].id`; authoritative physical navigation ID.
2. Map point key: key under `map_config.yaml -> points`; logical venue or workflow identity.
3. Explain Point key: key under `explain_config.yaml -> areas.*.points`; logical narration/state identity.

Multiple logical map or Explain Points may share one physical navigation ID. Never merge points merely because `x`, `y`, and `yaw` are equal.

## Output Directory

```text
<scene_id>/
├── map_config.yaml
├── scene_config.yaml
├── explain_config.yaml
└── reception_pack.yaml  # optional
```

Use lowercase snake_case for `scene_id`. All YAML files must use the same `scene_id`.

## map_config.yaml

```yaml
version: "1.0"
scene_id: "example_scene"
points:
  welcome1:
    name: "迎宾点"
    point_id: "3"
    type: "business"
    description: "迎宾逻辑点"
    accessible: true
```

Rules:

- Preserve every ID from `points.json` in one map point entry; do not renumber or silently omit it.
- `point_id` is the source `id`, serialized as a string.
- `name` and `description` are display metadata, not physical identity.
- `accessible` requires user confirmation; point presence does not prove accessibility.
- `type` is `base`, `business`, or `waypoint` and must reflect confirmed use.
- Reserved workflow keys are:
  - `start_stop1`
  - `standby1`
  - `welcome1`
  - `farewell1`
  - `photo1`
- Use `toilet1` and `elevator1` when those service destinations are present.
- Other confirmed points use descriptive lowercase snake_case keys.
- Equal poses remain separate entries when source IDs or logical roles differ.

## scene_config.yaml

Minimal static scene:

```yaml
version: "1.0"
scene_id: "example_scene"
scene_name: "示例展厅智能讲解员"
prompt_context:
  venue_name: "示例展厅"
role: "展厅讲解员"
language_style: "中文、专业、准确、亲切"
default_language: "zh"
basic_templates:
  welcome_prefix: "您好，欢迎参观。"
  farewell_suffix: "感谢您的参观。"
  busy_prompt: "抱歉，我正在执行讲解任务，请稍候。"
  pause_resume: "讲解已暂停，您可以说继续恢复讲解。"
  position_guide: "请跟我前往{target_point_name}。"
  unknown_intent: "抱歉，我暂时没有理解您的需求。"
programs:
  full:
    name: "完整导览"
    duration_mode: "full"
    photo_enabled: false
    photo_point: "photo1"
    photo_before_explain: false
    photo_after_explain: false
    photo_after_explain_use_profile: false
    explain_point_keys:
      - welcome_start
      - exhibit_one
```

Rules:

- `programs.*.explain_point_keys` is the actual runtime route and order.
- Do not emit `point_sequence`; the current Python runtime does not use it.
- Every listed Explain Point must exist.
- Set `photo_point` explicitly to a confirmed map point because the real loader warns when it is absent. When no photo workflow is requested, keep `photo_enabled`, `photo_before_explain`, `photo_after_explain`, and `photo_after_explain_use_profile` false. Do not infer a photo location.
- Add `dynamic_tour` only when dynamic reception compilation is actually used.
- Add `special_configs`, standby vision, gestures, work hours, battery speech, and similar features only when explicitly supported and confirmed.

## explain_config.yaml

```yaml
version: "2.0"
scene_id: "example_scene"
max_explain_points: 10
max_segments_per_point: 16
areas:
  area_main:
    id: "area_main"
    name: "主展厅"
    description: "主参观路线"
    narrator: "robot"
    points:
      welcome_start:
        id: "welcome_start"
        name: "迎宾开场"
        map_point: "welcome1"
        point_id: "3"
        narrator: "robot"
        tags: ["必讲", "开场"]
        estimated_duration: 30
        priority: 1
        after_point_explain: "direct"
        segments:
          seg_01:
            id: "seg_01"
            name: "欢迎词"
            content: "欢迎来到示例展厅。"
            estimated_duration: 10
            is_mandatory: true
```

Rules:

- Structure is Area -> Explain Point -> Segment.
- Explain Point key is the logical execution/state identity.
- `map_point` must resolve to `map_config.yaml`.
- Explain `point_id` must equal the resolved map point `point_id`; the runtime navigates with the Explain Point value.
- Never allow the runtime's legacy fallback physical ID `8` to hide missing data.
- Segment order is YAML insertion order. Keep source narration order unless the user confirms reordering.
- Every segment requires non-empty `content`.
- Split distinct exhibits or claims into separate segments for review and duration control.
- `after_point_explain` supports `direct`, `ask_questions`, and `dwell_continue`; use non-direct behavior only when confirmed.
- `approach` is optional narration while moving toward a station stop.
- `passing` is optional narration for flowing/cruise mode and requires dynamic reception compilation.
- Shared physical IDs are valid. Consecutive logical points at one physical ID execute without redundant movement in the current runtime.

## reception_pack.yaml

Generate only when the user explicitly requests dynamic audiences/personas or PAD selection. At minimum:

```yaml
scene_id: "example_scene"
scene_name: "示例展厅"
languages: ["zh"]
personas:
  - id: "adult"
    label: "成年访客"
    audience_title: "各位来宾"
    defaults:
      duration_mode: "full"
      pacing: "station"
```

Do not invent personas, aliases, perspectives, humor, interaction, photo defaults, or languages.

## Publication Errors

Treat these as errors, not warnings:

- source point ID invented, changed, or omitted;
- unresolved narration-to-point mapping;
- missing reserved workflow point after that workflow is enabled;
- Explain Point map key missing;
- Explain Point physical ID differing from its map point;
- unknown or duplicated program Explain Point;
- route exceeding declared point or duration limits;
- malformed YAML or duplicate keys;
- required content silently omitted;
- invented gestures, capabilities, accessibility, spatial direction, or runtime behavior.
