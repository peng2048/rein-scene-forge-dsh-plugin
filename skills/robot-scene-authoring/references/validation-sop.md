# Generated Scene Validation SOP

Execute this SOP after every generation or revision. Do not skip a gate and do not describe output as import-ready unless all gates pass.

## Gate 1: Input Integrity

1. Re-read the authoritative `points.json` and source material.
2. Invoke `analyze_point_input`.
3. Confirm every source point ID is preserved and every exact or near-pose logical role is resolved.
4. Confirm the output directory basename exactly equals the lowercase snake_case `scene_id` used by every YAML file.

Failure at this gate blocks delivery.

## Gate 2: Authoring Contract

1. Build the authoring envelope from the final candidate objects.
2. Invoke `validate_authoring_model`.
3. Fix every diagnostic. Never bypass an unknown target field by moving it into an extension object.

Failure at this gate blocks YAML writing.

## Gate 3: Target Files

1. Write `map_config.yaml`, `scene_config.yaml`, and `explain_config.yaml` into `<scene_id>/`.
2. Write `reception_pack.yaml` and enable `scene_config.dynamic_tour` by default. Never interpret missing user instructions as a request to disable dynamic PAD reception.
3. Invoke `validate_tour_robot_scene` with the final directory and original `points.json`.
4. Require valid YAML with unique keys, valid target schemas, one shared `scene_id`, and an exact directory-name match.

Any error blocks import.

## Gate 4: Point And Reference Integrity

Verify the tool reports no errors for:

- invented, renumbered, or omitted source navigation IDs;
- reserved workflow point mapping;
- duplicate Explain Point keys;
- missing map point references;
- Explain Point and map point physical ID mismatch;
- missing or empty Segment content;
- configured point and Segment limits.

Any error blocks import.

## Gate 5: Program Execution

For every Program, review `explain_point_keys` as the runtime-authoritative execution order.

1. Confirm every key exists and appears once.
2. Confirm welcome is placed where the tour must begin and farewell where it must end.
3. Confirm every intended Explain Point belongs to at least one Program. An unreachable point will never execute.
4. Confirm the full Program contains every required source section in the agreed physical route order.
5. Confirm quick or focused Programs omit content intentionally rather than accidentally.
6. Configure a valid `photo_point` for every Program as required by the real loader. Keep photo behavior disabled unless explicitly requested.
7. Never enable both `photo_before_explain` and `photo_after_explain`.
8. When `point_sequence` is present for legacy compatibility, require it to equal `explain_point_keys` exactly.

Any unknown reference or route-limit violation blocks import. Any unreachable content, missing photo point, or conflicting photo mode blocks publication until resolved.

## Gate 6: Content Fidelity

Compare the final Segments against the source material section by section.

1. Account for every source section as included, intentionally omitted, or unresolved.
2. Preserve names, numbers, dates, qualifications, quotations, and conclusions.
3. Flag generated facts, generic replacement text, changed identities, and unsupported spatial instructions.
4. Confirm Segment order preserves the source narrative unless reordering was approved.
5. Confirm estimated durations are plausible for the actual text and Program totals.

6. Confirm the dynamic authoring model has the fixed nine Personas, PAD compiler enabled, and no audience-specific static YAML copies.
7. Confirm each atomic fact has short base and Variant content of at most 40 characters; inspect Variants for semantic equivalence and Conditions for justified optionality.
8. Review formal level 0, relaxed level 1, and humorous level 2 wording separately. Do not require artificial differences where the source or audience does not justify them.

Unresolved source omissions, factual changes, or invented content block publication.

## Gate 7: Publication Decision

Interpret the final tool result as follows:

- `is_valid: false`: structurally or referentially invalid; do not import.
- `is_valid: true`, `is_publishable: false`: loadable in some paths but has unresolved runtime or workflow warnings; do not declare import-ready.
- `is_publishable: true`: deterministic checks passed; report that robot/PAD hardware behavior is still unverified unless an actual target smoke test was run.

The final report must state the scene directory, `scene_id`, file list, map and Explain Point counts, each Program route, error count, warning count, content omissions or changes, and whether a real robot/PAD test was performed.
