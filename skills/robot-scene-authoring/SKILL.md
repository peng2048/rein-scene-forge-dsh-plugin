---
name: robot-scene-authoring
description: Generate tour_robot YAML from points.json and narration material, preserving physical and logical point identities and validating the final scene directory.
---

# Robot Scene Authoring

Use the installed plugin to turn an authoritative `points.json` and narration document into a minimal `tour_robot` scene directory. The AI understands and structures content; deterministic tools analyze point geometry and validate the final YAML.

## Required Workflow

1. Locate and read `points.json` and all narration material. Do not modify either source.
2. Ask the user for a scene name. Derive a stable lowercase snake_case `scene_id` and confirm it.
3. Invoke `analyze_point_input` on `points.json`.
4. Inventory every source point. Never renumber, merge, or silently omit a point.
5. Treat `id` as the physical navigation ID. Treat the YAML map key and Explain Point key as separate logical identities.
6. Review exact and near-pose groups with the user. Equal `x`, `y`, and `yaw` does not mean duplicate. For example, welcome and farewell may share one pose but remain different logical points.
7. Match narration sections to point candidates by meaning and route context. If names and narration do not reliably match, stop and ask the user; do not guess.
8. Confirm at least: scene identity, point-to-content mapping, route order, welcome/standby/farewell/photo roles, inaccessible or unused points, narration preservation/optimization policy, and optional reception behavior.
9. Read `references/model-catalog.md` before selecting any field, then read `references/tour-robot-data-model.md` and fill the bundled templates. The catalog is authoritative: never invent a target field.
10. Create exactly one output directory named by the confirmed `scene_id`.
11. Write only:
    - `map_config.yaml`
    - `scene_config.yaml`
    - `explain_config.yaml`
    - `reception_pack.yaml` only when dynamic reception/personas are explicitly requested and confirmed
12. Build the internal authoring envelope and invoke `validate_authoring_model`; fix all model errors before writing YAML.
13. Invoke `validate_tour_robot_scene` with the scene directory and original `points.json`.
14. Resolve every unreachable Explain Point and loader compatibility warning. Ask before changing point roles, Program execution order, photo behavior, content, or other semantics.
15. Report the output directory and remaining uncertainties. Do not call a scene usable when validation fails.

## Content Rules

- Preserve all facts, numbers, proper nouns, qualifications, and conclusions unless the user explicitly approves an omission or rewrite.
- Split large narration sections into reviewable segments; do not flatten many exhibits into one monologue.
- Do not invent spatial language such as “left side” or “ahead” from coordinates alone.
- Do not invent gestures, robot model, audience, duration, Q&A, photo, personas, joke level, accessibility, or runtime capabilities.
- A source section with no reliable point match is a blocking mismatch and must be reported.
- A source point with no confirmed purpose remains in `map_config.yaml`; report it and ask whether it is a waypoint, service destination, explain stop, or unused point.

## Tools

- `analyze_point_input`: validates raw points and reports exact/near physical poses without merging logical points.
- `validate_authoring_model`: validates the complete internal envelope and the exact four target YAML models.
- `validate_tour_robot_scene`: validates the final YAML directory against `points.json` and real `tour_robot` runtime rules.

The source repository, Scene IR, requirement JSON, manifest, traceability report, summary, and import guide are not user inputs or default outputs.
