import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { stringify as stringifyYaml } from "yaml";

export const TOOL_RUNTIME_VERSION = "0.1.0";
export const ADAPTER_ID = "tour_robot_adapter";
export const ADAPTER_VERSION = "0.1.0-node";
export const RULES_VERSION = "tour-robot-dynamic-authoring-0.1";

const schemaDirectory = fileURLToPath(new URL("../schemas/", import.meta.url));
const schemaCache = new Map();
const ajv = new Ajv2020({ allErrors: true, strict: false });

function diagnostic(code, severity, stage, objectPath, message, fixSuggestion) {
  return { code, severity, stage, object_path: objectPath, message, fix_suggestion: fixSuggestion };
}

function jsonPath(instancePath) {
  if (!instancePath) return "$";
  return `$${instancePath.replaceAll("/", ".")}`;
}

async function loadSchema(filename) {
  if (!schemaCache.has(filename)) {
    const schema = JSON.parse(await readFile(resolve(schemaDirectory, filename), "utf8"));
    schemaCache.set(filename, ajv.compile(schema));
  }
  return schemaCache.get(filename);
}

function workspacePath(value, kind) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${kind} must be a non-empty workspace path`);
  const workspace = resolve(process.cwd());
  const path = resolve(workspace, value);
  const rel = relative(workspace, path);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${kind} must stay inside the current workspace: ${value}`);
  }
  return path;
}

async function readJsonWorkspace(inputPath) {
  const path = workspacePath(inputPath, "input_path");
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`Cannot read JSON input ${inputPath}: ${error.message}`);
  }
  try {
    return { path, value: JSON.parse(text) };
  } catch (error) {
    throw new Error(`Invalid JSON in ${inputPath}: ${error.message}`);
  }
}

async function writeJsonWorkspace(outputPath, value, force = false) {
  const path = workspacePath(outputPath, "output_path");
  if (existsSync(path) && !force) throw new Error(`Output already exists: ${outputPath}; set force=true to overwrite`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return path;
}

function schemaDiagnostics(validate, value) {
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => diagnostic(
    "RSF_CONTRACT_SCHEMA_INVALID",
    "error",
    "schema_validation",
    jsonPath(error.instancePath),
    error.message ?? "Schema validation failed",
    "Update the instance to satisfy the bundled versioned contract schema."
  ));
}

function duplicateValues(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

function visit(value, path, callback) {
  callback(value, path);
  if (Array.isArray(value)) value.forEach((child, index) => visit(child, `${path}[${index}]`, callback));
  else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) visit(child, `${path}.${key}`, callback);
  }
}

function sceneIrSemanticDiagnostics(sceneIr) {
  const diagnostics = [];
  const mapPoints = sceneIr.map_points ?? [];
  const areas = sceneIr.areas ?? [];
  const programs = sceneIr.programs ?? [];
  const personas = sceneIr.personas ?? [];
  const references = sceneIr.source_references ?? [];
  const points = [];
  const segmentIds = [];
  areas.forEach((area, areaIndex) => (area.explain_points ?? []).forEach((point, pointIndex) => {
    points.push({ point, path: `$.areas[${areaIndex}].explain_points[${pointIndex}]` });
    for (const segment of point.segments ?? []) if (segment.segment_id) segmentIds.push(segment.segment_id);
  }));
  const groups = {
    map_point_key: mapPoints.map((point) => point.map_point_key).filter(Boolean),
    explain_point_id: points.map(({ point }) => point.explain_point_id).filter(Boolean),
    segment_id: segmentIds,
    program_id: programs.map((program) => program.program_id).filter(Boolean),
    persona_id: personas.map((persona) => persona.persona_id).filter(Boolean),
    source_reference_id: references.map((reference) => reference.source_reference_id).filter(Boolean)
  };
  for (const [name, values] of Object.entries(groups)) {
    for (const duplicate of duplicateValues(values)) diagnostics.push(diagnostic(
      "RSF_SCENE_IR_DUPLICATE_ID", "error", "semantic_validation", "$", `Duplicate ${name}: ${duplicate}`,
      `Assign a unique stable ${name} within its contract scope.`
    ));
  }
  const mapPointSet = new Set(groups.map_point_key);
  const pointSet = new Set(groups.explain_point_id);
  const programSet = new Set(groups.program_id);
  const personaSet = new Set(groups.persona_id);
  const referenceSet = new Set(groups.source_reference_id);
  if (sceneIr.scene?.default_program_id && !programSet.has(sceneIr.scene.default_program_id)) diagnostics.push(diagnostic(
    "RSF_SCENE_IR_UNKNOWN_DEFAULT_PROGRAM", "error", "semantic_validation", "$.scene.default_program_id",
    `Unknown default program: ${sceneIr.scene.default_program_id}`, "Reference an existing programs[*].program_id."
  ));
  for (const { point, path } of points) {
    if (point.map_point_key && !mapPointSet.has(point.map_point_key)) diagnostics.push(diagnostic(
      "RSF_SCENE_IR_UNKNOWN_MAP_POINT", "error", "semantic_validation", `${path}.map_point_key`,
      `Unknown map point: ${point.map_point_key}`, "Reference an existing map_points[*].map_point_key."
    ));
    for (const mode of ["approach", "passing"]) {
      const movement = point.movement_narration?.[mode];
      if (!movement) continue;
      const routes = [];
      if (movement.default_route) routes.push([`${path}.movement_narration.${mode}.default_route`, movement.default_route]);
      (movement.predecessor_overrides ?? []).forEach((route, index) => {
        const routePath = `${path}.movement_narration.${mode}.predecessor_overrides[${index}]`;
        routes.push([routePath, route]);
        if (!pointSet.has(route.predecessor_explain_point_id)) diagnostics.push(diagnostic(
          "RSF_SCENE_IR_UNKNOWN_PREDECESSOR", "error", "semantic_validation", `${routePath}.predecessor_explain_point_id`,
          `Unknown predecessor Explain Point: ${route.predecessor_explain_point_id}`, "Reference an existing explain_point_id."
        ));
      });
      for (const [routePath, route] of routes) (route.waypoint_map_point_keys ?? []).forEach((key, index) => {
        if (!mapPointSet.has(key)) diagnostics.push(diagnostic(
          "RSF_SCENE_IR_UNKNOWN_MAP_POINT", "error", "semantic_validation", `${routePath}.waypoint_map_point_keys[${index}]`,
          `Unknown movement waypoint: ${key}`, "Reference an existing map_points[*].map_point_key."
        ));
      });
    }
  }
  programs.forEach((program, programIndex) => {
    (program.explain_point_ids ?? []).forEach((id, index) => {
      if (!pointSet.has(id)) diagnostics.push(diagnostic(
        "RSF_SCENE_IR_UNKNOWN_EXPLAIN_POINT", "error", "semantic_validation",
        `$.programs[${programIndex}].explain_point_ids[${index}]`, `Unknown explain point: ${id}`,
        "Reference an existing logical Explain Point."
      ));
    });
    const photoKey = program.photo_policy?.photo_map_point_key;
    if (photoKey && !mapPointSet.has(photoKey)) diagnostics.push(diagnostic(
      "RSF_SCENE_IR_UNKNOWN_MAP_POINT", "error", "semantic_validation",
      `$.programs[${programIndex}].photo_policy.photo_map_point_key`, `Unknown photo map point: ${photoKey}`,
      "Reference an existing map_points[*].map_point_key."
    ));
    if (program.default_pacing_mode === "flowing") {
      for (const id of program.explain_point_ids ?? []) {
        const entry = points.find(({ point }) => point.explain_point_id === id);
        if (entry && !entry.point.movement_narration?.passing) diagnostics.push(diagnostic(
          "RSF_SCENE_IR_FLOWING_PASSING_REQUIRED", "error", "semantic_validation",
          `${entry.path}.movement_narration`, `Flowing-reachable Explain Point lacks Passing narration: ${id}`,
          "Define movement_narration.passing or remove the point from Flowing programs."
        ));
      }
    }
  });
  const dimensions = sceneIr.dynamic_authoring?.profile_dimensions ?? [];
  for (const dimension of dimensions) {
    const allowed = dimension.allowed_values ?? [];
    if (dimension.profile_dimension_id === "persona_id") for (const id of allowed) if (!personaSet.has(id)) diagnostics.push(diagnostic(
      "RSF_SCENE_IR_UNKNOWN_PERSONA", "error", "semantic_validation", "$.dynamic_authoring.profile_dimensions",
      `Profile allows unknown persona: ${id}`, "Define the persona or remove it from allowed_values."
    ));
    if (dimension.profile_dimension_id === "program_id") for (const id of allowed) if (!programSet.has(id)) diagnostics.push(diagnostic(
      "RSF_SCENE_IR_UNKNOWN_PROGRAM", "error", "semantic_validation", "$.dynamic_authoring.profile_dimensions",
      `Profile allows unknown program: ${id}`, "Define the program or remove it from allowed_values."
    ));
  }
  visit(sceneIr, "$", (value, path) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    (value.source_reference_ids ?? []).forEach((id, index) => {
      if (!referenceSet.has(id)) diagnostics.push(diagnostic(
        "RSF_SCENE_IR_UNKNOWN_SOURCE_REFERENCE", "error", "semantic_validation", `${path}.source_reference_ids[${index}]`,
        `Unknown source reference: ${id}`, "Reference an existing source_references[*].source_reference_id."
      ));
    });
    (value.persona_ids ?? []).forEach((id, index) => {
      if (!personaSet.has(id)) diagnostics.push(diagnostic(
        "RSF_SCENE_IR_UNKNOWN_PERSONA", "error", "semantic_validation", `${path}.persona_ids[${index}]`,
        `Condition references unknown persona: ${id}`, "Reference an existing personas[*].persona_id."
      ));
    });
  });
  return diagnostics;
}

function validationReport(tool, inputPath, diagnostics) {
  return {
    tool,
    tool_runtime_version: TOOL_RUNTIME_VERSION,
    input_path: inputPath,
    is_valid: !diagnostics.some((item) => item.severity === "error"),
    error_count: diagnostics.filter((item) => item.severity === "error").length,
    warning_count: diagnostics.filter((item) => item.severity === "warning").length,
    diagnostics
  };
}

export async function validateSceneRequirement({ input_path, output_path, force = false }) {
  const { value } = await readJsonWorkspace(input_path);
  const report = validationReport("validate_scene_requirement", input_path, schemaDiagnostics(await loadSchema("scene-requirement.schema.json"), value));
  const written = await writeJsonWorkspace(output_path, report, force);
  return { ...report, output_path: relative(process.cwd(), written) || "." };
}

export async function validateSceneIr({ input_path, output_path, force = false }) {
  const { value } = await readJsonWorkspace(input_path);
  const schemaErrors = schemaDiagnostics(await loadSchema("scene-ir.schema.json"), value);
  const diagnostics = schemaErrors.length ? schemaErrors : sceneIrSemanticDiagnostics(value);
  const report = validationReport("validate_scene_ir", input_path, diagnostics);
  const written = await writeJsonWorkspace(output_path, report, force);
  return { ...report, output_path: relative(process.cwd(), written) || "." };
}

function targetLanguage(language) { return language.split("-", 1)[0].toLowerCase(); }
function conditions(value = {}) {
  const mapping = { persona_ids: "group_types", perspective_ids: "perspectives", duration_mode_ids: "duration_modes", minimum_joke_level: "min_joke_level", maximum_joke_level: "max_joke_level" };
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [mapping[key] ?? key, child]));
}
function trigger(value) {
  if (value.trigger_type === "on_start") return "on_start";
  if (value.trigger_type === "on_waypoint") return `on_waypoint:${value.waypoint_index}`;
  return `on_progress:${value.progress_ratio}`;
}
function movementRoute(route, mapPoints) {
  const output = {
    waypoints: route.waypoint_map_point_keys.map((key) => String(mapPoints[key].navigation_point_id)),
    segments: Object.fromEntries(route.segments.map((segment) => [segment.movement_segment_id, {
      content: segment.content.text,
      trigger: trigger(segment.trigger),
      ...(segment.conditions ? { conditions: conditions(segment.conditions) } : {}),
      ...(segment.variants ? { variants: segment.variants.map((variant) => ({ id: variant.variant_id, conditions: conditions(variant.conditions), weight: variant.weight, content: variant.content.text })) } : {})
    }]))
  };
  const debugIds = route.waypoint_map_point_keys.map((key) => mapPoints[key].debug_navigation_point_id);
  if (debugIds.length && debugIds.every((id) => id !== undefined)) output.dbg_waypoints = debugIds.map(String);
  return output;
}
function movementMode(mode, mapPoints) {
  return {
    ...(mode.default_route ? { default: movementRoute(mode.default_route, mapPoints) } : {}),
    ...(mode.predecessor_overrides ? { overrides: mode.predecessor_overrides.map((route) => ({ from: route.predecessor_explain_point_id, ...movementRoute(route, mapPoints) })) } : {})
  };
}
function mapConfig(sceneIr) {
  return { version: "1.0", scene_id: sceneIr.scene.scene_id, points: Object.fromEntries(sceneIr.map_points.map((point) => [point.map_point_key, {
    name: point.display_name, point_id: String(point.navigation_point_id), type: point.point_type,
    description: point.description ?? point.display_name, accessible: point.is_accessible,
    ...(point.debug_navigation_point_id !== undefined ? { dbg_point_id: String(point.debug_navigation_point_id) } : {})
  }])) };
}
function sceneConfig(sceneIr) {
  const dimensions = Object.fromEntries(sceneIr.dynamic_authoring.profile_dimensions.map((dimension) => [dimension.profile_dimension_id, dimension]));
  const defaultProgram = sceneIr.programs.find((program) => program.program_id === sceneIr.scene.default_program_id);
  const defaultPersona = sceneIr.personas?.find((persona) => persona.persona_id === dimensions.persona_id?.scene_default) ?? sceneIr.personas?.[0] ?? {};
  const recommendations = defaultPersona.profile_recommendations ?? {};
  const perspectives = [...new Set((sceneIr.personas ?? []).map((persona) => persona.profile_recommendations?.perspective_id).filter(Boolean))].sort();
  return {
    version: "1.0", scene_id: sceneIr.scene.scene_id, scene_name: sceneIr.scene.display_name,
    prompt_context: { venue_name: sceneIr.scene.venue_name }, role: sceneIr.scene.robot_role,
    language_style: sceneIr.scene.language_style, default_language: targetLanguage(sceneIr.scene.default_content_language),
    dynamic_tour: {
      enabled: true, compiler_required: true, startup_source: "pad_compiler", default_program: defaultProgram.program_id,
      default_duration_mode: defaultProgram.duration_mode_id, default_group_type: dimensions.persona_id?.scene_default,
      default_perspective: recommendations.perspective_id ?? perspectives[0] ?? "overview", default_joke_level: recommendations.joke_level ?? 0,
      default_interaction_enabled: dimensions.interaction_enabled?.scene_default ?? false,
      supported_group_types: dimensions.persona_id?.allowed_values ?? [], supported_perspectives: perspectives.length ? perspectives : ["overview"],
      supported_duration_modes: [...new Set(sceneIr.programs.map((program) => program.duration_mode_id))].sort(),
      session_overrides: { photo_enabled: dimensions.photo_enabled?.scene_default ?? false, allow_photo_enable: dimensions.photo_enabled?.allow_session_override ?? false }
    },
    programs: Object.fromEntries(sceneIr.programs.map((program) => [program.program_id, {
      name: program.display_name, duration_mode: program.duration_mode_id, photo_enabled: false,
      photo_before_explain: program.photo_policy.photo_subgraph_timing === "before_program",
      photo_after_explain: program.photo_policy.photo_subgraph_timing === "after_program",
      photo_after_explain_use_profile: program.photo_policy.allow_session_override,
      explain_point_keys: program.explain_point_ids, point_sequence: program.explain_point_ids,
      ...(program.photo_policy.photo_map_point_key ? { photo_point: program.photo_policy.photo_map_point_key } : {})
    }]))
  };
}
function segmentConfig(segment) {
  const output = { id: segment.segment_id, name: segment.display_name, content: segment.content.text, narrator: segment.narrator, tags: segment.tags, estimated_duration: segment.estimated_duration_seconds, is_mandatory: segment.is_mandatory };
  if (segment.gesture_id) output.gesture = segment.gesture_id;
  if (segment.conditions) { output.conditions = conditions(segment.conditions); output.dynamic_only = true; }
  if (segment.variants) output.variants = segment.variants.map((variant) => ({ id: variant.variant_id, conditions: conditions(variant.conditions), weight: variant.weight, content: variant.content.text, ...(variant.gesture_id ? { gesture: variant.gesture_id } : {}) }));
  if (segment.completion_policy.mode === "wait_for_continue") output.wait_for_continue_prompt = segment.completion_policy.prompt_content?.text ?? (segment.completion_policy.is_silent_wait ? "。" : "准备好后请对我说继续。");
  if (segment.completion_policy.mode === "pause_after") output.pause_after_seconds = segment.completion_policy.pause_after_seconds ?? 0;
  return output;
}
function explainConfig(sceneIr) {
  const mapPoints = Object.fromEntries(sceneIr.map_points.map((point) => [point.map_point_key, point]));
  let maxSegments = 1;
  const areas = {};
  for (const area of sceneIr.areas) {
    const points = {};
    for (const point of area.explain_points) {
      const segments = Object.fromEntries(point.segments.map((segment) => [segment.segment_id, segmentConfig(segment)]));
      maxSegments = Math.max(maxSegments, point.segments.length);
      const target = { id: point.explain_point_id, name: point.display_name, description: point.description ?? point.display_name, narrator: point.narrator, tags: point.tags, estimated_duration: point.estimated_duration_seconds, priority: point.priority, after_point_explain: point.after_point_policy.action, segments };
      if (point.map_point_key) { target.map_point = point.map_point_key; target.point_id = String(mapPoints[point.map_point_key].navigation_point_id); if (mapPoints[point.map_point_key].debug_navigation_point_id !== undefined) target.dbg_point_id = String(mapPoints[point.map_point_key].debug_navigation_point_id); }
      if (point.conditions) target.conditions = conditions(point.conditions);
      if (point.movement_narration?.approach) target.approach = movementMode(point.movement_narration.approach, mapPoints);
      if (point.movement_narration?.passing) target.passing = movementMode(point.movement_narration.passing, mapPoints);
      if (point.after_point_policy.dwell_seconds !== undefined) target.dwell_continue_seconds = point.after_point_policy.dwell_seconds;
      if (point.after_point_policy.intro_content) target.dwell_continue_intro = point.after_point_policy.intro_content.text;
      if (point.after_point_policy.outro_content) target.dwell_continue_outro = point.after_point_policy.outro_content.text;
      points[point.explain_point_id] = target;
    }
    areas[area.area_id] = { id: area.area_id, name: area.display_name, description: area.description, narrator: area.narrator, points };
  }
  return { version: "2.0", scene_id: sceneIr.scene.scene_id, max_explain_points: Math.max(...sceneIr.programs.map((program) => program.explain_point_ids.length)), max_segments_per_point: maxSegments, areas,
    planning_rules: { mandatory_tags: ["opening"], duration_matching: true, max_points_per_session: sceneIr.scene.runtime_policy.session_max_explain_points, max_duration_limit: sceneIr.scene.runtime_policy.session_max_estimated_duration_seconds, after_point_explain_default: sceneIr.scene.runtime_policy.default_after_point_action } };
}
function receptionPack(sceneIr) {
  return { scene_id: sceneIr.scene.scene_id, scene_name: sceneIr.scene.display_name,
    languages: sceneIr.dynamic_authoring.language_capabilities.pad_selectable_languages.map(targetLanguage),
    condition_aliases: Object.fromEntries((sceneIr.personas ?? []).map((persona) => [persona.persona_id, [...new Set([persona.persona_id, ...persona.condition_aliases])].sort()])),
    personas: (sceneIr.personas ?? []).map((persona) => { const r = persona.profile_recommendations; return { id: persona.persona_id, label: persona.display_name, group: "Scene Forge", audience_title: persona.audience_title,
      defaults: { priority: "medium", joke_level: r.joke_level ?? 0, photo_enabled: r.recommended_photo_enabled ?? false, interaction_enabled: r.recommended_interaction_enabled ?? false, duration_mode: r.duration_mode_id ?? "full", pacing: r.pacing_mode ?? "station", perspective: r.perspective_id ?? "overview" },
      ...(r.perspective_id ? { focus: [{ id: r.perspective_id, label: r.perspective_id }] } : {}) }; }) };
}
function padProfileSchema(sceneIr) {
  const recommendations = Object.fromEntries((sceneIr.personas ?? []).map((persona) => [persona.persona_id, persona.profile_recommendations]));
  return { schema_version: "1.0-draft", fields: sceneIr.dynamic_authoring.profile_dimensions.map((dimension) => ({ field_id: dimension.profile_dimension_id, display_name: dimension.profile_dimension_id, value_type: dimension.value_type, is_required: dimension.is_required, is_visible: dimension.pad_exposure.is_visible, is_editable: dimension.pad_exposure.is_editable, allow_session_override: dimension.allow_session_override, pii_classification: dimension.pii_classification,
    ...Object.fromEntries(["allowed_values", "minimum", "maximum", "scene_default"].filter((key) => key in dimension).map((key) => [key, dimension[key]])), ...(dimension.profile_dimension_id !== "persona_id" ? { persona_recommendations: recommendations } : {}) })),
    cross_field_constraints: ["session explicit values override persona recommendations, program defaults, then scene defaults"] };
}
function validateTarget(map, scene, explain, reception) {
  const ids = new Set([map.scene_id, scene.scene_id, explain.scene_id, reception.scene_id]);
  if (ids.size !== 1 || ids.has(undefined)) throw new Error("tour_robot target files must share one non-empty scene_id");
  const explainPoints = new Set();
  for (const [areaKey, area] of Object.entries(explain.areas)) {
    if (area.id !== areaKey) throw new Error(`Area key/id mismatch: ${areaKey}`);
    for (const [pointKey, point] of Object.entries(area.points)) {
      if (point.id !== pointKey || !Object.keys(point.segments).length) throw new Error(`Invalid Explain Point: ${pointKey}`);
      if (point.map_point && (!map.points[point.map_point] || String(point.point_id) !== String(map.points[point.map_point].point_id))) throw new Error(`Invalid target map point mapping: ${pointKey}`);
      explainPoints.add(pointKey);
    }
  }
  for (const [programId, program] of Object.entries(scene.programs)) {
    if (!program.explain_point_keys.length || program.explain_point_keys.some((id) => !explainPoints.has(id))) throw new Error(`Program references invalid Explain Points: ${programId}`);
  }
  const personas = reception.personas.map((persona) => persona.id);
  if (!personas.length || new Set(personas).size !== personas.length) throw new Error("Reception Pack requires unique non-empty personas");
}
function sha256(content) { return createHash("sha256").update(content).digest("hex"); }
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function jsonBytes(value) { return Buffer.from(`${JSON.stringify(value, null, 2)}\n`); }
function yamlBytes(value) { return Buffer.from(stringifyYaml(value, { lineWidth: 120, sortMapEntries: false })); }
function traceability(sceneIr) {
  const entries = [];
  sceneIr.areas.forEach((area, areaIndex) => area.explain_points.forEach((point, pointIndex) => point.segments.forEach((segment, segmentIndex) => entries.push({
    scene_ir_path: `$.areas[${areaIndex}].explain_points[${pointIndex}].segments[${segmentIndex}]`,
    target_file_path: "Target/tour_robot/explain_config.yaml",
    target_object_path: `$.areas.${area.area_id}.points.${point.explain_point_id}.segments.${segment.segment_id}`,
    source_reference_ids: segment.content.source_reference_ids
  }))));
  return entries;
}
async function writePackageFiles(outputDirectory, files, force) {
  const output = workspacePath(outputDirectory, "output_directory");
  if (existsSync(output)) {
    const info = await stat(output);
    if (!info.isDirectory()) throw new Error(`Output is not a directory: ${outputDirectory}`);
    if (!force && (await readdir(output)).length) throw new Error(`Output directory is not empty: ${outputDirectory}; set force=true to overwrite generated files`);
  }
  const written = [];
  for (const [path, content] of Object.entries(files)) {
    const target = resolve(output, path);
    if (existsSync(target) && !force) throw new Error(`Output already exists: ${path}; set force=true to overwrite`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    written.push(path);
  }
  return written.sort();
}

export async function compileTourRobotScene({ scene_ir_path, output_directory, force = false }) {
  const { value: sceneIr } = await readJsonWorkspace(scene_ir_path);
  const schemaErrors = schemaDiagnostics(await loadSchema("scene-ir.schema.json"), sceneIr);
  const diagnostics = schemaErrors.length ? schemaErrors : sceneIrSemanticDiagnostics(sceneIr);
  if (diagnostics.some((item) => item.severity === "error")) throw new Error(`Scene IR validation failed: ${JSON.stringify(diagnostics)}`);
  for (const program of sceneIr.programs) {
    if (!new Set(["full", "express"]).has(program.program_id) || program.program_id !== program.duration_mode_id) throw new Error(`tour_robot requires full/express program IDs matching duration_mode_id: ${program.program_id}`);
  }
  if (sceneIr.calendar_contents?.length) throw new Error("Calendar content is not supported by the bundled minimal adapter");
  if (sceneIr.dynamic_authoring.template_slots?.length) throw new Error("Template slots are not supported by the bundled minimal adapter");
  const map = mapConfig(sceneIr), scene = sceneConfig(sceneIr), explain = explainConfig(sceneIr), reception = receptionPack(sceneIr), pad = padProfileSchema(sceneIr);
  validateTarget(map, scene, explain, reception);
  const targetFiles = {
    "Target/tour_robot/map_config.yaml": yamlBytes(map), "Target/tour_robot/scene_config.yaml": yamlBytes(scene),
    "Target/tour_robot/explain_config.yaml": yamlBytes(explain), "Target/tour_robot/reception_pack.yaml": yamlBytes(reception),
    "Target/tour_robot/pad-profile-schema.json": jsonBytes(pad)
  };
  const targetFileEntries = Object.entries(targetFiles).map(([path, content]) => ({ path, media_type: path.endsWith(".json") ? "application/json" : "application/yaml", sha256: sha256(content), purpose: ({ "map_config.yaml": "map", "scene_config.yaml": "scene", "explain_config.yaml": "explain_authoring", "reception_pack.yaml": "reception_pack" })[path.split("/").at(-1)] ?? "other" }));
  const sceneIrBytes = jsonBytes(sceneIr);
  const manifestBase = {
    contract_version: "1.0-draft", authoring_package_id: `${sceneIr.scene.scene_id}_tour_robot`, scene_id: sceneIr.scene.scene_id,
    scene_ir_schema_version: sceneIr.schema_version, scene_ir_sha256: sha256(Buffer.from(stableJson(sceneIr))),
    target_adapter: { component_id: ADAPTER_ID, component_version: ADAPTER_VERSION },
    target_runtime: { target_runtime_id: "tour_robot", supported_version_range: ">=hz_embodied_dynamic_reference" }, rules_version: RULES_VERSION,
    compiler_capability: { session_compiler: { component_id: "tour_robot_reception_compiler", component_version: "reference-v1" }, selection_algorithm_version: "tour_robot_reception_sha256_weighted_v1", supported_authoring_contract_versions: ["1.0-draft"], supported_scene_ir_versions: ["1.0-draft"], provided_by: "target_runtime", reference: "tour_robot.reception.compiler.compile_explain_config", required_context_fields: ["effective_date", "timezone", "calendar_data_version", "anti_repeat_history", "target_capability_snapshot"], features: { conditions: "supported", variants: "supported", station_approach: "supported", flowing_passing: "supported", calendar_hooks: "degraded", runtime_snapshot_envelope: "supported" } },
    pad_profile_schema: pad, target_files: targetFileEntries, traceability: traceability(sceneIr), diagnostics: [],
    release_policy: { warning_policy: "require_approval", require_confirmed_high_impact_values: true, is_publishable: true }
  };
  const manifest = { ...manifestBase, authoring_package_sha256: sha256(Buffer.from(stableJson(manifestBase))) };
  const validationReportValue = { tool: "compile_tour_robot_scene", tool_runtime_version: TOOL_RUNTIME_VERSION, is_valid: true, error_count: 0, warning_count: 0, diagnostics: [] };
  const summary = { scene_id: sceneIr.scene.scene_id, display_name: sceneIr.scene.display_name, adapter: manifest.target_adapter, generated_target_files: targetFileEntries.map((entry) => entry.path), explain_point_count: sceneIr.areas.reduce((count, area) => count + area.explain_points.length, 0), program_ids: sceneIr.programs.map((program) => program.program_id), dynamic_session_compiler_bundled: false };
  const files = { ...targetFiles, "manifest.json": jsonBytes(manifest), "scene-ir.json": sceneIrBytes, "validation-report.json": jsonBytes(validationReportValue), "summary.json": jsonBytes(summary), "traceability.json": jsonBytes(manifest.traceability), "import-guide.md": Buffer.from(`# ${sceneIr.scene.display_name} import guide\n\n1. Verify this directory with the \`verify_scene_package\` DSH tool.\n2. Import the files under \`Target/tour_robot/\` into the compatible tour_robot runtime.\n3. The package declares an external target-runtime Session Compiler; this plugin does not bundle the full dynamic Session Compiler.\n`) };
  const written = await writePackageFiles(output_directory, files, force);
  return { tool: "compile_tour_robot_scene", is_valid: true, scene_id: sceneIr.scene.scene_id, output_directory, files: written, manifest_sha256: sha256(files["manifest.json"]), limitations: ["Full dynamic Session Compiler is not bundled; manifest declares target_runtime capability."] };
}

export async function verifyScenePackage({ package_directory, output_path, force = false }) {
  const root = workspacePath(package_directory, "package_directory");
  const manifestPath = resolve(root, "manifest.json");
  let manifest;
  try { manifest = JSON.parse(await readFile(manifestPath, "utf8")); } catch (error) { throw new Error(`Cannot read package manifest: ${error.message}`); }
  const diagnostics = schemaDiagnostics(await loadSchema("dynamic-authoring-output.schema.json"), manifest);
  for (const entry of manifest.target_files ?? []) {
    const path = resolve(root, entry.path);
    const rel = relative(root, path);
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      diagnostics.push(diagnostic("RSF_PACKAGE_PATH_ESCAPE", "error", "package_validation", entry.path, "Manifest path escapes package directory", "Use a package-relative target file path."));
      continue;
    }
    try {
      const actual = sha256(await readFile(path));
      if (actual !== entry.sha256) diagnostics.push(diagnostic("RSF_PACKAGE_HASH_MISMATCH", "error", "package_validation", entry.path, `SHA-256 mismatch: expected ${entry.sha256}, got ${actual}`, "Restore the compiled file or recompile the package."));
    } catch (error) {
      diagnostics.push(diagnostic("RSF_PACKAGE_FILE_MISSING", "error", "package_validation", entry.path, error.message, "Restore the manifest-listed file or recompile the package."));
    }
  }
  try {
    const sceneIr = JSON.parse(await readFile(resolve(root, "scene-ir.json"), "utf8"));
    const actual = sha256(Buffer.from(stableJson(sceneIr)));
    if (actual !== manifest.scene_ir_sha256) diagnostics.push(diagnostic("RSF_PACKAGE_SCENE_IR_HASH_MISMATCH", "error", "package_validation", "scene-ir.json", `Scene IR SHA-256 mismatch: expected ${manifest.scene_ir_sha256}, got ${actual}`, "Restore scene-ir.json or recompile the package."));
  } catch (error) {
    diagnostics.push(diagnostic("RSF_PACKAGE_FILE_MISSING", "error", "package_validation", "scene-ir.json", error.message, "Restore scene-ir.json or recompile the package."));
  }
  const { authoring_package_sha256, ...manifestBase } = manifest;
  const actualPackageHash = sha256(Buffer.from(stableJson(manifestBase)));
  if (authoring_package_sha256 && actualPackageHash !== authoring_package_sha256) diagnostics.push(diagnostic("RSF_PACKAGE_MANIFEST_HASH_MISMATCH", "error", "package_validation", "manifest.json", `Authoring package SHA-256 mismatch: expected ${authoring_package_sha256}, got ${actualPackageHash}`, "Restore manifest.json or recompile the package."));
  const report = validationReport("verify_scene_package", package_directory, diagnostics);
  const written = await writeJsonWorkspace(output_path, report, force);
  return { ...report, output_path: relative(process.cwd(), written) || ".", checked_file_count: manifest.target_files?.length ?? 0 };
}
