---
name: robot-scene-authoring
description: Author traceable robot tour or reception scenes from source material, point input, and business requirements. Use when an AI Agent must inventory inputs, interview the user, choose preserve/optimize/mixed content handling, generate Scene IR, and produce a verified tour_robot scene package through plugin-registered tools.
---

# Robot Scene Authoring

Act as an Agent-first scene author. Understand and confirm the job before generating anything. AI performs source understanding and semantic planning; plugin-registered deterministic tools validate, compile, and verify.

## Mandatory Order

1. **Inventory inputs.** Locate or request source material, point input, scene requirement, target runtime, and output expectations. Record what is present, missing, unreadable, conflicting, or unverified.
2. **Restate understanding.** Summarize the scene, audience, route, duration, required and forbidden topics, interaction/photo policy, target runtime, and known constraints. Separate verified facts from assumptions and open questions.
3. **Ask sufficient questions.** Resolve every high-impact uncertainty before generating publishable Scene IR. Group concise questions by blocking priority; do not treat silence as approval.
4. **Confirm content mode.** Obtain `preserve`, `optimize`, or `mixed`. For `mixed`, confirm the mode for each affected source, point, or segment; unspecified items remain blocked.
5. **Validate requirements.** Invoke the plugin-registered `validate_scene_requirement` tool. Resolve its errors and high-impact warnings with the user before proceeding.
6. **Generate Scene IR.** Build a traceable candidate from confirmed inputs only. Do not write target YAML directly.
7. **Validate Scene IR.** Invoke `validate_scene_ir`. Automatically repair only low-risk structural diagnostics, revalidate after every repair, and ask before any high-impact change.
8. **Compile.** Invoke `compile_tour_robot_scene` only for Scene IR that passes validation and has no unresolved high-impact decision.
9. **Verify the package.** Invoke `verify_scene_package`. A package is publishable only when verification succeeds under the applicable warning policy.
10. **Report.** List inputs, confirmed decisions, content modes, source coverage, automatic repairs, diagnostics, output artifacts, verification status, and remaining risks.

Do not skip inventory, restatement, or questions merely because input files already exist or appear complete. Read `references/workflow.md` for the decision boundaries and detailed procedure.

## Content Modes

- **`preserve` — original-text preservation:** Preserve facts, numbers, proper nouns, conclusions, stance, and wording. Only split by point or duration, merge fragments, adjust punctuation, and add minimal fact-free transitions. Make every omission visible. Do not polish, expand, summarize away qualifications, or silently reorder meaning.
- **`optimize` — constrained optimization:** Improve spoken clarity, structure, pacing, audience fit, and tone without changing or adding facts, numbers, proper nouns, conclusions, or stance. Retain source references and record the transformation.
- **`mixed` — explicit per-item selection:** Apply `preserve` or `optimize` at the confirmed source, point, or segment scope. Ask about every uncovered item; never choose a global fallback.

No mode permits invented awards, specifications, history, customers, partnerships, contact details, navigation identifiers, gestures, robot capabilities, or target-runtime fields.

## Decision Boundary

Automatically fix a diagnostic only when the repair is deterministic, reversible, fact-neutral, and does not change route intent, point identity, content meaning, or business policy. Examples include canonical formatting, deterministic ordering, duplicate removal where identity and retained value are identical, and a uniquely resolvable internal reference.

Ask the user before changing or supplying any:

- source fact, number, proper noun, claim, conclusion, or conflict resolution;
- `map_point_key`, navigation point ID, point-to-content match, accessibility, or route order;
- audience, duration, language, tone, mandatory/forbidden topic, interaction, dwell, Q&A, photo, handoff, or publication policy;
- robot gesture, capability, target compatibility assumption, or unsupported-feature downgrade;
- ambiguous reference, deletion with semantic impact, or choice among multiple valid repairs.

Never suppress a diagnostic, convert an error to a warning, or claim that an unconfirmed decision is validated.

## Tool Boundary and Degraded Mode

Invoke tools by their plugin-registered names only:

- `validate_scene_requirement`
- `validate_scene_ir`
- `compile_tour_robot_scene`
- `verify_scene_package`

Do not assume a source-repository checkout, repository-relative executable, shell command, global Python installation, or global CLI. Do not reproduce compiler or Schema logic in the prompt.

If any required tool is unavailable, fails to return a trustworthy result, or cannot complete the applicable stage:

- stop the publishable workflow;
- do not hand-write or improvise target YAML or a scene package;
- output only an explicitly labeled **unverified, not-publishable draft** and the information collected so far;
- state which tool and stage were unavailable and what must be rerun after tool restoration.

## Output Standard

A successful report must state that all four applicable tool stages completed, identify any allowed warnings, and distinguish a verified scene package from drafts or intermediate Scene IR. Never describe a draft, unchecked file set, or model-generated configuration as publishable.
