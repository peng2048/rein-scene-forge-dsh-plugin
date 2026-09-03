# Agent-first Authoring Workflow

Use this procedure after loading the sibling `SKILL.md`. Preserve original inputs and keep the Authoring Workspace separate from the installed plugin and resulting Robot Scene Package.

## 1. Inventory Before Interpretation

Create an input inventory before proposing content or calling a compiler:

| Input | Record | Blocking checks |
|---|---|---|
| source material | file or stable identifier, media type, readable scope, approval status | missing pages, unreadable content, conflicting versions, uncertain authority |
| point input | file or stable identifier; available `map_point_key`, `display_name`, `navigation_point_id`, accessibility and route hints | missing/duplicate IDs, ambiguous labels, unknown accessibility, content-to-point uncertainty |
| scene requirement | explicit values, defaults proposed by the user, and still-open fields | scene identity, robot role, audience, duration, language, style, mandatory/forbidden topics, interaction/photo policy, target runtime |
| generation context | requested outputs, content mode, explicit seed and relevant versions when provided | absent content mode, unclear deliverable, unsupported target assumption |

Do not alter source files. Create stable source references using a file identifier and the most precise available locator, such as section, page, table row, or character range. Classify statements as source fact, business rule, approved template, constrained transformation, inference, or open question.

## 2. Restate the Job

Before generating Scene IR, present a short confirmation summary containing:

1. scene and venue identity;
2. robot role and target runtime;
3. intended audience and relationship to the host;
4. route and known point mapping;
5. target duration and any full/short Program expectations;
6. required, forbidden, and optional topics;
7. language, tone, professional depth, humor, and promotional intensity;
8. interaction, Q&A, dwell, movement narration, photo, and human-handoff policies;
9. selected content mode and its scope;
10. verified facts, assumptions, conflicts, and missing decisions.

Ask the user to correct the summary. A plausible interpretation is not a confirmation.

## 3. Ask Questions by Impact

Ask all blocking questions needed for a trustworthy result, preferably in one grouped round. Follow up until high-impact uncertainty is resolved.

Priority order:

1. **Facts and authority:** Which source/version is authoritative? How should a contradiction be resolved? Is a claim approved for external speech?
2. **Points and route:** Which `map_point_key` matches each topic? Are navigation point IDs supplied by point input? Which points are inaccessible, optional, welcome, standby, or photo points? What route order is intended?
3. **Business decisions:** Audience, duration, content mode, mandatory/forbidden topics, language/tone, interaction, Q&A, dwell, photo, handoff, and publication warning policy.
4. **Target capabilities:** Is the requested gesture or behavior supported and verified? Should an unsupported feature be removed, replaced, or left blocked?

Never invent an answer. Never infer navigation point IDs from display names or sequence. When the user cannot decide, retain an explicit unresolved item and produce at most a draft.

## 4. Resolve Content Mode

Apply exactly one confirmed policy:

- `preserve`: permit only point/duration splitting, fragment merging, punctuation correction, and minimal transitions containing no new fact. Show omissions and retain qualifications. No stylistic rewrite or factual expansion.
- `optimize`: permit spoken-language, structure, pacing, audience, and tone improvements while preserving facts, numbers, proper nouns, conclusions, and stance. Attach source references and transformation metadata to rewritten content.
- `mixed`: record `preserve` or `optimize` for each specified source, explain point, or segment. Ask about uncovered items; do not inherit an implicit global default.

Transitions must be recognizable as authored connective text and must not contain source claims. In every mode, claims without a locatable source remain excluded from publishable content or explicitly blocked for confirmation.

## 5. Validate the Requirement

Invoke the plugin-registered tool `validate_scene_requirement` with the collected requirement and decision record in the form requested by the tool.

Handle results as follows:

- fix fact-neutral serialization or structural issues only when the intended value is already explicit;
- ask the user about missing or conflicting high-impact values;
- retain the tool's diagnostic code, level, stage, object path, message, and suggested action when available;
- do not proceed to publishable Scene IR while requirement errors or unresolved high-impact decisions remain.

If the tool is unavailable, mark the requirement and all downstream work **unverified and not publishable**. Do not substitute hand-written validation logic.

## 6. Generate Scene IR

Generate Scene IR (场景中间表示) only from confirmed requirements, point input, source facts, and allowed transformations. Follow the contract exposed by the installed plugin and its registered tools; do not rely on a source checkout or copy a Schema into the prompt.

Maintain these semantic boundaries:

- point input is the sole source of `navigation_point_id`;
- explain points use confirmed `map_point_key` references;
- multiple logical explain points may share one physical navigation point when explicitly intended;
- ordered Programs contain confirmed explain-point choices;
- source facts and transformations remain traceable through source references;
- Approach and Passing remain distinct;
- route photo checkpoints remain distinct from before/after Program photo behavior;
- authoring choices and conditions are not misrepresented as an immutable runtime snapshot;
- target YAML fields do not leak into Scene IR as improvised passthrough data.

## 7. Validate, Repair, and Revalidate

Invoke `validate_scene_ir`. Classify every diagnostic before acting.

### Automatic low-risk repair

Repair automatically only when all are true:

- the repair is deterministic and has a single valid result;
- it is reversible and fact-neutral;
- it preserves wording within the selected content mode;
- it does not choose or change a point, route, policy, capability, or source authority;
- it does not conceal deletion, downgrade, conflict, or warning.

Examples: canonical formatting; deterministic ordering required by the contract; removing byte-identical duplicate entries; correcting a uniquely resolvable internal reference; normalizing a value when the contract and explicit user value determine one representation.

Record the before/after path and diagnostic code, then invoke `validate_scene_ir` again. Do not assume the repair succeeded.

### Mandatory user confirmation

Ask before any repair involving facts, content meaning, deletion, multiple valid options, point identity/mapping, navigation ID, route order, accessibility, audience, duration, mode, tone, mandatory/forbidden topics, interaction, Q&A, dwell, photo, handoff, robot capability, target support, or warning acceptance.

Use the failure categories consistently: `input_error`, `source_conflict`, `planning_uncertainty`, `contract_error`, `compile_error`, `target_incompatibility`, and `package_error`.

## 8. Compile and Verify

Only after requirement and Scene IR validation succeed:

1. invoke `compile_tour_robot_scene` through the plugin registration;
2. preserve compiler diagnostics and do not edit generated target files to bypass them;
3. invoke `verify_scene_package` on the compiler output;
4. treat any verification error as not publishable; apply warnings only according to an explicit target or user-approved policy.

Do not call repository scripts, construct repository-relative command paths, invoke a presumed global Python CLI, or assume the current directory is a source repository. Tool names are the public execution boundary.

If either compilation or verification is unavailable or untrustworthy, stop and provide only a clearly labeled **draft**. A collection of target-looking YAML files is not a verified Robot Scene Package.

## 9. Final Report

Report in a compact, auditable structure:

- input inventory and exact inputs used;
- restated requirement and user-confirmed decisions;
- `preserve`/`optimize`/`mixed` selection and per-item overrides;
- source-reference coverage, excluded unsupported claims, and unresolved conflicts;
- automatic low-risk repairs with diagnostic codes and affected paths;
- outstanding questions, warnings, and high-impact confirmations;
- requirement-validation and Scene-IR-validation status;
- target runtime and compilation status;
- scene-package location or identifier and verification status;
- unverified hardware or runtime capabilities;
- final label: **verified publishable package** or **unverified not-publishable draft**.

Use the publishable label only when `validate_scene_requirement`, `validate_scene_ir`, `compile_tour_robot_scene`, and `verify_scene_package` completed successfully for the applicable artifacts and no blocking decision remains.
