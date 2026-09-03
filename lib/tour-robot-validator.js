import { existsSync } from "node:fs";
import { access } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { diagnostic, readJson, readYaml, report, workspacePath } from "./io.js";
import { validateYamlModel } from "./schema-validation.js";

const REQUIRED_FILES = ["map_config.yaml", "scene_config.yaml", "explain_config.yaml"];
const SPECIAL_KEYS = {
  start_stop: "start_stop1",
  standby: "standby1",
  welcome: "welcome1",
  farewell: "farewell1",
  photo: "photo1",
  toilet: "toilet1",
  elevator: "elevator1"
};

function sourceRole(name) {
  const value = name.toLowerCase();
  return Object.keys(SPECIAL_KEYS).find((role) => value.includes(role)) ?? null;
}

function collectExplainPoints(explainConfig, diagnostics) {
  const result = new Map();
  const areas = explainConfig.areas;
  if (!areas || typeof areas !== "object" || Array.isArray(areas) || !Object.keys(areas).length) {
    diagnostics.push(diagnostic("RSF_EXPLAIN_AREAS_REQUIRED", "error", "explain_config.yaml:$.areas", "areas must be a non-empty object.", "Create Area -> Explain Point -> Segment structure."));
    return result;
  }
  const segmentLimit = Number(explainConfig.max_segments_per_point ?? 16);
  for (const [areaKey, area] of Object.entries(areas)) {
    const points = area?.points;
    if (!points || typeof points !== "object" || Array.isArray(points) || !Object.keys(points).length) {
      diagnostics.push(diagnostic("RSF_EXPLAIN_POINTS_REQUIRED", "error", `explain_config.yaml:$.areas.${areaKey}.points`, "points must be a non-empty object.", "Add logical explain points to the area."));
      continue;
    }
    for (const [pointKey, point] of Object.entries(points)) {
      if (result.has(pointKey)) diagnostics.push(diagnostic("RSF_EXPLAIN_POINT_DUPLICATE", "error", `explain_config.yaml:$.areas.${areaKey}.points.${pointKey}`, `Duplicate logical Explain Point ${pointKey}.`, "Explain Point keys must be globally unique."));
      result.set(pointKey, point);
      if (point?.id && point.id !== pointKey) diagnostics.push(diagnostic("RSF_EXPLAIN_POINT_ID_MISMATCH", "error", `explain_config.yaml:$.areas.${areaKey}.points.${pointKey}.id`, "Point id must equal its YAML key.", "Use one stable logical Explain Point identifier."));
      const segments = point?.segments;
      if (!segments || typeof segments !== "object" || Array.isArray(segments) || !Object.keys(segments).length) diagnostics.push(diagnostic("RSF_SEGMENTS_REQUIRED", "error", `explain_config.yaml:$.areas.${areaKey}.points.${pointKey}.segments`, "segments must be a non-empty object.", "Split the narration into ordered, reviewable segments."));
      else {
        if (Object.keys(segments).length > segmentLimit) diagnostics.push(diagnostic("RSF_SEGMENT_LIMIT_EXCEEDED", "error", `explain_config.yaml:$.areas.${areaKey}.points.${pointKey}.segments`, `Segment count exceeds ${segmentLimit}.`, "Split the content across logical Explain Points or increase the confirmed limit."));
        for (const [segmentKey, segment] of Object.entries(segments)) if (!segment || typeof segment.content !== "string" || !segment.content.trim()) diagnostics.push(diagnostic("RSF_SEGMENT_CONTENT_REQUIRED", "error", `explain_config.yaml:$.areas.${areaKey}.points.${pointKey}.segments.${segmentKey}.content`, "Segment content must be non-empty text.", "Restore narration from the source material."));
      }
    }
  }
  return result;
}

function validatePrograms(sceneConfig, mapPoints, explainPoints, explainConfig, diagnostics) {
  const programs = sceneConfig.programs;
  if (!programs || typeof programs !== "object" || Array.isArray(programs) || !Object.keys(programs).length) {
    diagnostics.push(diagnostic("RSF_PROGRAMS_REQUIRED", "error", "scene_config.yaml:$.programs", "At least one program is required.", "Create a full program with confirmed Explain Point order."));
    return;
  }
  const reachablePointKeys = new Set();
  for (const [programKey, program] of Object.entries(programs)) {
    const pointKeys = program?.explain_point_keys;
    if (!Array.isArray(pointKeys) || !pointKeys.length) {
      diagnostics.push(diagnostic("RSF_PROGRAM_POINTS_REQUIRED", "error", `scene_config.yaml:$.programs.${programKey}.explain_point_keys`, "explain_point_keys must be a non-empty list.", "List logical Explain Points in execution order."));
      continue;
    }
    if (new Set(pointKeys).size !== pointKeys.length) diagnostics.push(diagnostic("RSF_PROGRAM_POINT_DUPLICATE", "error", `scene_config.yaml:$.programs.${programKey}.explain_point_keys`, "Program repeats a logical Explain Point.", "Keep each logical Explain Point once unless the runtime workflow explicitly supports repetition."));
    const missing = pointKeys.filter((key) => !explainPoints.has(key));
    if (missing.length) diagnostics.push(diagnostic("RSF_PROGRAM_POINT_UNKNOWN", "error", `scene_config.yaml:$.programs.${programKey}.explain_point_keys`, `Unknown Explain Points: ${missing.join(", ")}.`, "Fix the route instead of relying on tour_robot to silently omit unknown points."));
    for (const key of pointKeys) if (explainPoints.has(key)) reachablePointKeys.add(key);
    if (!program.photo_point) diagnostics.push(diagnostic("RSF_PROGRAM_PHOTO_POINT_MISSING", "warning", `scene_config.yaml:$.programs.${programKey}.photo_point`, "Program does not explicitly configure photo_point; tour_robot will log a configuration warning.", "Set photo_point to a confirmed map point even when automatic photography is disabled."));
    else if (!mapPoints?.[program.photo_point]) diagnostics.push(diagnostic("RSF_PROGRAM_PHOTO_POINT_UNKNOWN", "error", `scene_config.yaml:$.programs.${programKey}.photo_point`, `Unknown map point: ${program.photo_point}.`, "Use a map point key from map_config.yaml."));
    if (program.photo_before_explain === true && program.photo_after_explain === true) diagnostics.push(diagnostic("RSF_PROGRAM_PHOTO_MODE_CONFLICT", "warning", `scene_config.yaml:$.programs.${programKey}`, "photo_before_explain and photo_after_explain are both enabled; tour_robot gives photo_before_explain precedence.", "Enable only one automatic photo phase."));
    const maxPoints = Number(explainConfig.max_explain_points ?? Infinity);
    if (pointKeys.length > maxPoints) diagnostics.push(diagnostic("RSF_PROGRAM_POINT_LIMIT_EXCEEDED", "error", `scene_config.yaml:$.programs.${programKey}.explain_point_keys`, `Program contains ${pointKeys.length} points but max_explain_points is ${maxPoints}.`, "Increase the confirmed limit or revise the route without silently dropping points."));
    const maxSessionPoints = Number(explainConfig.planning_rules?.max_points_per_session ?? Infinity);
    if (pointKeys.length > maxSessionPoints) diagnostics.push(diagnostic("RSF_PROGRAM_SESSION_LIMIT_EXCEEDED", "error", `scene_config.yaml:$.programs.${programKey}.explain_point_keys`, `Program contains ${pointKeys.length} points but planning limit is ${maxSessionPoints}.`, "Align program and planning limits."));
    const duration = pointKeys.reduce((sum, key) => sum + Number(explainPoints.get(key)?.estimated_duration ?? 0), 0);
    const maxDuration = Number(explainConfig.planning_rules?.max_duration_limit ?? Infinity);
    if (duration > maxDuration) diagnostics.push(diagnostic("RSF_PROGRAM_DURATION_LIMIT_EXCEEDED", "error", `scene_config.yaml:$.programs.${programKey}`, `Estimated duration ${duration}s exceeds ${maxDuration}s.`, "Confirm a longer duration or revise content explicitly."));
    if (program.point_sequence && JSON.stringify(program.point_sequence) !== JSON.stringify(pointKeys)) diagnostics.push(diagnostic("RSF_PROGRAM_INERT_SEQUENCE_MISMATCH", "error", `scene_config.yaml:$.programs.${programKey}.point_sequence`, "point_sequence differs from the runtime-authoritative explain_point_keys.", "Remove point_sequence or make it exactly match explain_point_keys."));
  }
  const unreachable = [...explainPoints.keys()].filter((key) => !reachablePointKeys.has(key));
  if (unreachable.length) diagnostics.push(diagnostic("RSF_EXPLAIN_POINTS_UNREACHABLE", "warning", "scene_config.yaml:$.programs", `Explain Points are not included in any program and will never execute: ${unreachable.join(", ")}.`, "Add them to the intended program in confirmed execution order, or remove intentionally unused content."));
}

export async function validateTourRobotScene({ scene_directory, points_path }) {
  const directory = workspacePath(scene_directory, "scene_directory");
  const diagnostics = [];
  for (const file of REQUIRED_FILES) {
    try { await access(resolve(directory, file)); }
    catch { diagnostics.push(diagnostic("RSF_TARGET_FILE_MISSING", "error", file, `${file} is required.`, `Create ${file} in the scene directory.`)); }
  }
  if (diagnostics.length) return report("validate_tour_robot_scene", scene_directory, diagnostics);

  let mapConfig, sceneConfig, explainConfig;
  try { [mapConfig, sceneConfig, explainConfig] = await Promise.all(REQUIRED_FILES.map((file) => readYaml(resolve(directory, file)))); }
  catch (error) {
    diagnostics.push(diagnostic("RSF_TARGET_YAML_INVALID", "error", scene_directory, error.message, "Fix YAML syntax and duplicate keys."));
    return report("validate_tour_robot_scene", scene_directory, diagnostics);
  }
  const configs = { "map_config.yaml": mapConfig, "scene_config.yaml": sceneConfig, "explain_config.yaml": explainConfig };
  const receptionPath = resolve(directory, "reception_pack.yaml");
  if (existsSync(receptionPath)) {
    try { configs["reception_pack.yaml"] = await readYaml(receptionPath); }
    catch (error) { diagnostics.push(diagnostic("RSF_TARGET_YAML_INVALID", "error", "reception_pack.yaml", error.message, "Fix YAML syntax and duplicate keys.")); }
  }
  for (const [fileName, value] of Object.entries(configs)) diagnostics.push(...await validateYamlModel(fileName, value));
  const sceneIds = Object.values(configs).map((value) => value.scene_id);
  if (sceneIds.some((value) => !value) || new Set(sceneIds).size !== 1) diagnostics.push(diagnostic("RSF_SCENE_ID_MISMATCH", "error", scene_directory, "All YAML files must share one non-empty scene_id.", "Use the confirmed scene name as directory and scene_id."));
  else if (basename(directory) !== sceneIds[0]) diagnostics.push(diagnostic("RSF_SCENE_DIRECTORY_MISMATCH", "error", scene_directory, `Scene directory name ${basename(directory)} does not match scene_id ${sceneIds[0]}; tour_robot resolves scenes by exact directory name.`, `Rename the directory to ${sceneIds[0]} before import.`));

  const sourcePoints = await readJson(points_path, "points_path");
  if (!Array.isArray(sourcePoints)) diagnostics.push(diagnostic("RSF_POINT_INPUT_NOT_ARRAY", "error", points_path, "points.json must be an array.", "Use the authoritative point export."));
  const mapPoints = mapConfig.points;
  if (!mapPoints || typeof mapPoints !== "object" || Array.isArray(mapPoints) || !Object.keys(mapPoints).length) diagnostics.push(diagnostic("RSF_MAP_POINTS_REQUIRED", "error", "map_config.yaml:$.points", "points must be a non-empty object.", "Map every source point to a logical map key."));
  else if (Array.isArray(sourcePoints)) {
    const sourceIds = new Set(sourcePoints.map((point) => String(point.id)));
    const mappedIds = new Set(Object.values(mapPoints).map((point) => String(point?.point_id)));
    const unknown = [...mappedIds].filter((id) => !sourceIds.has(id));
    const omitted = [...sourceIds].filter((id) => !mappedIds.has(id));
    if (unknown.length) diagnostics.push(diagnostic("RSF_MAP_POINT_ID_UNKNOWN", "error", "map_config.yaml:$.points", `Navigation ids not found in points.json: ${unknown.join(", ")}.`, "Never invent or renumber navigation point ids."));
    if (omitted.length) diagnostics.push(diagnostic("RSF_SOURCE_POINTS_OMITTED", "error", "map_config.yaml:$.points", `Source point ids omitted from map_config: ${omitted.join(", ")}.`, "Account for every source point, including waypoints and service destinations."));
    for (const point of sourcePoints) {
      const role = sourceRole(String(point.name ?? ""));
      if (!role) continue;
      const expectedKey = SPECIAL_KEYS[role];
      const actual = mapPoints[expectedKey];
      if (!actual || String(actual.point_id) !== String(point.id)) diagnostics.push(diagnostic("RSF_SPECIAL_POINT_MAPPING_REQUIRED", "error", `map_config.yaml:$.points.${expectedKey}`, `Source point ${point.name} (${point.id}) must be reviewed for reserved role ${expectedKey}.`, `Confirm the role and map ${expectedKey} to point_id ${point.id}, or rename the source point if the semantic hint is wrong.`));
    }
  }

  const explainPoints = collectExplainPoints(explainConfig, diagnostics);
  for (const [pointKey, point] of explainPoints) {
    if (!point?.map_point || !mapPoints?.[point.map_point]) diagnostics.push(diagnostic("RSF_EXPLAIN_MAP_POINT_UNKNOWN", "error", `explain_config.yaml:${pointKey}.map_point`, "Navigable Explain Point must reference an existing map point.", "Confirm the content-to-point mapping."));
    else if (String(point.point_id ?? "") !== String(mapPoints[point.map_point].point_id ?? "")) diagnostics.push(diagnostic("RSF_EXPLAIN_PHYSICAL_ID_MISMATCH", "error", `explain_config.yaml:${pointKey}.point_id`, "Explain point_id must equal its map point physical point_id.", "Copy the authoritative point_id; tour_robot navigates using the Explain Point value."));
  }
  validatePrograms(sceneConfig, mapPoints, explainPoints, explainConfig, diagnostics);
  return report("validate_tour_robot_scene", scene_directory, diagnostics, { scene_id: sceneIds[0], map_point_count: mapPoints ? Object.keys(mapPoints).length : 0, explain_point_count: explainPoints.size });
}
