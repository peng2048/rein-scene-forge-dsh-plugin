import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { analyzePointInput } from "../lib/runtime.js";

const previous = process.cwd();
const workspace = await mkdtemp(resolve(tmpdir(), "rein-scene-forge-smoke-"));
try {
  const points = await readFile("/Users/mac/Desktop/rein-scene-forge-acceptance-test/points.json", "utf8");
  process.chdir(workspace);
  await writeFile("points.json", points);
  const result = await analyzePointInput({ input_path: "points.json" });
  if (!result.is_valid || result.point_count !== 39) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify({ point_count: result.point_count, exact_pose_groups: result.exact_pose_groups.length, near_pose_pairs: result.near_pose_pairs.length }, null, 2));
} finally {
  process.chdir(previous);
  await rm(workspace, { recursive: true, force: true });
}
