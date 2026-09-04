# Model Catalog

This catalog is the field-selection authority for the plugin. Target fields come only from the real `tour_robot` scene files and their Python consumers. Do not add a target YAML field that is absent from the bundled target schemas.

## Authoring Model

The internal model is a workspace envelope. Its `map_config`, `scene_config`, `explain_config`, and `reception_pack` values are the exact objects written to the same-named YAML files; there is no field translation.

| Field | Required | Meaning |
|---|---:|---|
| `model_version` | yes | Internal envelope contract version, currently `1.0`. |
| `point_input` | yes | Verbatim point objects. Runtime-known fields are `id`, `name`, `x`, `y`, `yaw`; preserve other exporter fields unchanged. |
| `source_materials` | yes | Input file identity and SHA-256. Never copy source files into the plugin. |
| `map_config` | yes | Exact `map_config.yaml` object. |
| `scene_config` | yes | Exact `scene_config.yaml` object. |
| `explain_config` | yes | Exact `explain_config.yaml` object. |
| `reception_pack` | yes | Exact `reception_pack.yaml` object for dynamic PAD reception; the model requires the fixed nine Persona IDs. |
| `content_trace` | yes | Non-runtime sentence/source records keyed by exact YAML paths. |
| `authoring_decisions` | yes | Non-runtime point, route, content and capability decisions. |
| `unresolved_items` | no | Blocking and non-blocking questions. |

## map_config.yaml

Top level: `version`, `scene_id`, `points`.

Each `points.<map_point_key>` supports exactly: `name`, `point_id`, `dbg_point_id`, `type`, `description`, `accessible`. `point_id` is the physical `point_input[*].id` serialized as a string. `type` is `base`, `business`, or `waypoint`.

## scene_config.yaml

Top level fields used by `tour_robot`: `version`, `scene_id`, `scene_name`, `prompt_context`, `role`, `language_style`, `default_language`, `basic_templates`, `obstacle_speech`, `standby_vision_responses`, `dancegongfu_list`, `dynamic_tour`, `programs`, `special_configs`. `prompt_context` supports `venue_name`, `venue_highlight`, `curator_name`, and `curator_title`.

`basic_templates` supports: `welcome_prefix`, `farewell_suffix`, `busy_prompt`, `pause_resume`, `position_guide`, `unknown_intent`.

`programs.<program_id>` supports: `name`, `duration_mode`, `explain_point_keys`, legacy `point_sequence`, `photo_enabled`, `photo_before_explain`, `photo_after_explain`, `photo_after_explain_use_profile`, `photo_point`. New generated tours require `name` and `explain_point_keys`; legacy workflow-only programs may omit them.

`dynamic_tour` and `special_configs` are fully enumerated in `schemas/tour-robot/scene-config.schema.json`. Select a field only when the corresponding runtime workflow is enabled and the value is sourced or confirmed.

## explain_config.yaml

Top level fields: `version`, `scene_id`, `max_explain_points`, `max_segments_per_point`, legacy `max_duration_limit`, `human_companion_name`, `planning_rules`, `areas`; runtime snapshots may also contain `metadata`, `runtime_config_version`, and `runtime_config_session_id`.

The structural hierarchy is `areas.<area_key>.points.<explain_point_key>.segments.<segment_key>`.

Area fields: `id`, `name`, `description`, `narrator`, `points`.

Explain Point fields: `id`, `name`, `map_point`, `point_id`, `dbg_point_id`, `narrator`, `tags`, `keywords`, `estimated_duration`, `priority`, `after_point_explain`, `dwell_continue_intro`, `dwell_continue_seconds`, `dwell_continue_outro`, `conditions`, `approach`, `passing`, `segments`.

Segment fields: `id`, `name`, `content`, legacy `narrator`, `gesture`, `tags`, `estimated_duration`, `is_mandatory`, `conditions`, `dynamic_only`, `variants`, `pause_after_seconds`, `wait_for_continue_prompt`, `actions`, `shuffle_group`, `shuffle_keep`, `shuffle_pick`.

Conditions: `group_types`, `perspectives`, `duration_modes`, `pacing_modes`, `interaction_enabled`, `photo_enabled`, `min_joke_level`, `max_joke_level`, `jieqi`, `festivals`, `jieqi_on_day`, `min_days_to_festival`, `max_days_to_festival`.

Variant fields: `id`, `content`, `conditions`, `weight`, `gesture`.

Movement mode fields: `default`, `overrides`. Each route supports `from` on overrides, `waypoints`, `dbg_waypoints`, `switch_threshold`, and `segments`. A movement segment supports `id`, `content`, `trigger`, `gesture`, `conditions`, `variants`. Trigger syntax is `on_start`, `on_waypoint:N`, or `on_progress:x` where `x` is from 0 to 1.

Planning fields are enumerated in `schemas/tour-robot/explain-config.schema.json`; they cover route limits, duration prompts, question timing, dwell behavior, random sampling, stale-intent handling, and content matching.

## reception_pack.yaml

Top level: `scene_id`, `scene_name`, `languages`, `region_greetings`, `condition_aliases`, `legacy_group_types`, `personas`.

Persona fields: `id`, `label`, `group`, `audience_title`, `focus`, `defaults`. Defaults support `priority`, `joke_level`, `photo_enabled`, `interaction_enabled`, `duration_mode`, `pacing`, and `perspective`.

## Required Versus Recommended

New authoring output is dynamic by default: `reception_pack.personas` contains exactly nine fixed IDs (`government`, `industry`, `experts`, `university`, `middle_school`, `primary_school`, `family_with_child`, `adult`, `senior`). Expression intensity is the existing runtime `joke_level` with values `0` formal, `1` relaxed, and `2` humorous. Audience and intensity variation is represented by target fields `conditions` and `variants`, not by separate YAML files. Missing user instructions never imply static output.

Schema-required means the real runtime cannot safely consume the object without the field. The Skill may require additional fields for newly generated scenes to avoid legacy fallbacks. In particular, new Explain Points always set `after_point_explain`; new Segments always set `is_mandatory`; new Programs always set `name` and `explain_point_keys`.

Unknown target fields are errors. Do not use `extra`, `metadata`, or an invented extension field to bypass the target schemas.
