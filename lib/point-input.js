import { diagnostic, readJson, report } from "./io.js";

function angleDistance(left, right) {
  const distance = Math.abs(left - right) % 360;
  return Math.min(distance, 360 - distance);
}

function roleCandidate(name) {
  const value = name.toLowerCase();
  if (value.includes("start_stop")) return "start_stop1";
  if (value.includes("standby")) return "standby1";
  if (value.includes("welcome")) return "welcome1";
  if (value.includes("farewell")) return "farewell1";
  if (value.includes("photo")) return "photo1";
  if (value.includes("toilet")) return "toilet1";
  if (value.includes("elevator")) return "elevator1";
  return null;
}

function normalizePoint(value, index, diagnostics) {
  const path = `$[${index}]`;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    diagnostics.push(diagnostic("RSF_POINT_INVALID", "error", path, "Point must be an object.", "Provide id, name, x, y and yaw."));
    return null;
  }
  const missing = ["id", "name", "x", "y", "yaw"].filter((key) => !(key in value));
  for (const key of missing) diagnostics.push(diagnostic("RSF_POINT_FIELD_MISSING", "error", `${path}.${key}`, `Missing ${key}.`, `Restore ${key} from the authoritative point export.`));
  if (missing.length) return null;
  if (![value.x, value.y, value.yaw].every((item) => Number.isFinite(Number(item)))) {
    diagnostics.push(diagnostic("RSF_POINT_POSE_INVALID", "error", path, "x, y and yaw must be numbers.", "Use the numeric values from the point export."));
    return null;
  }
  return { id: value.id, name: String(value.name), x: Number(value.x), y: Number(value.y), yaw: Number(value.yaw), suggested_map_key: roleCandidate(String(value.name)) };
}

export async function analyzePointInput({ input_path, pose_tolerance_meters = 0.1, yaw_tolerance_degrees = 5 }) {
  const input = await readJson(input_path);
  const diagnostics = [];
  if (!Array.isArray(input)) diagnostics.push(diagnostic("RSF_POINT_INPUT_NOT_ARRAY", "error", "$", "Point input must be a JSON array.", "Export points as a JSON array."));
  const points = Array.isArray(input) ? input.map((value, index) => normalizePoint(value, index, diagnostics)).filter(Boolean) : [];
  const identities = new Set();
  for (const point of points) {
    const identity = `${typeof point.id}:${String(point.id)}`;
    if (identities.has(identity)) diagnostics.push(diagnostic("RSF_POINT_ID_DUPLICATE", "error", "$", `Duplicate point id ${point.id}.`, "Point ids must be unique; shared poses remain separate ids."));
    identities.add(identity);
  }

  const exactGroups = [];
  const nearPairs = [];
  for (let leftIndex = 0; leftIndex < points.length; leftIndex += 1) {
    const left = points[leftIndex];
    const exact = [left];
    for (let rightIndex = leftIndex + 1; rightIndex < points.length; rightIndex += 1) {
      const right = points[rightIndex];
      const distance = Math.hypot(left.x - right.x, left.y - right.y);
      const yawDifference = angleDistance(left.yaw, right.yaw);
      if (distance === 0 && yawDifference === 0) exact.push(right);
      else if (distance <= pose_tolerance_meters && yawDifference <= yaw_tolerance_degrees) {
        nearPairs.push({ point_ids: [left.id, right.id], point_names: [left.name, right.name], distance_meters: Number(distance.toFixed(4)), yaw_difference_degrees: Number(yawDifference.toFixed(2)) });
      }
    }
    if (exact.length > 1 && !exactGroups.some((group) => group.point_ids.includes(left.id))) {
      exactGroups.push({ point_ids: exact.map((point) => point.id), point_names: exact.map((point) => point.name), pose: { x: left.x, y: left.y, yaw: left.yaw }, rule: "Do not merge. Confirm a separate logical role for every point id." });
    }
  }

  return report("analyze_point_input", input_path, diagnostics, {
    point_count: points.length,
    points,
    exact_pose_groups: exactGroups,
    near_pose_pairs: nearPairs,
    requires_user_confirmation: exactGroups.length > 0 || nearPairs.length > 0
  });
}
