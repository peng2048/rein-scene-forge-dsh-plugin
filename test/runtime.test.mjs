import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { parse, stringify } from "yaml";
import { analyzePointInput, validateAuthoringModel, validateTourRobotScene } from "../lib/runtime.js";

const points = [
  { id: 3, name: "welcome", x: -0.49, y: -28.3, yaw: 180 },
  { id: 4, name: "farewell", x: -0.49, y: -28.3, yaw: 180 }
];

async function workspace(run) {
  const previous = process.cwd();
  const directory = await mkdtemp(resolve(tmpdir(), "rein-scene-forge-"));
  process.chdir(directory);
  try { await run(); } finally { process.chdir(previous); await rm(directory, { recursive: true, force: true }); }
}

async function writeScene({ farewellPointId = "4", includeFarewell = true } = {}) {
  await mkdir("demo", { recursive: true });
  await writeFile("points.json", JSON.stringify(points));
  const mapPoints = {
    welcome1: { name: "迎宾", point_id: "3", type: "base", accessible: true }
  };
  if (includeFarewell) mapPoints.farewell1 = { name: "送别", point_id: "4", type: "base", accessible: true };
  await writeFile("demo/map_config.yaml", stringify({ version: "1.0", scene_id: "demo", points: mapPoints }));
  await writeFile("demo/scene_config.yaml", stringify({ version: "1.0", scene_id: "demo", scene_name: "演示场景", programs: { full: { name: "完整导览", explain_point_keys: ["welcome_start", "farewell_end"] } } }));
  await writeFile("demo/explain_config.yaml", stringify({
    version: "2.0", scene_id: "demo", max_explain_points: 2, max_segments_per_point: 16,
    areas: { main: { id: "main", name: "主区", description: "", narrator: "robot", points: {
      welcome_start: { id: "welcome_start", name: "迎宾", map_point: "welcome1", point_id: "3", narrator: "robot", estimated_duration: 10, priority: 1, after_point_explain: "direct", segments: { opening: { id: "opening", name: "欢迎", content: "欢迎参观。", estimated_duration: 10, is_mandatory: true } } },
      farewell_end: { id: "farewell_end", name: "送别", map_point: "farewell1", point_id: farewellPointId, narrator: "robot", estimated_duration: 10, priority: 2, after_point_explain: "direct", segments: { ending: { id: "ending", name: "送别", content: "感谢参观。", estimated_duration: 10, is_mandatory: true } } }
    } } }
  }));
}

test("point analysis preserves distinct logical points at one pose", async () => {
  await workspace(async () => {
    await writeFile("points.json", JSON.stringify(points));
    const result = await analyzePointInput({ input_path: "points.json" });
    assert.equal(result.is_valid, true);
    assert.equal(result.point_count, 2);
    assert.deepEqual(result.exact_pose_groups[0].point_ids, [3, 4]);
    assert.equal(result.points[0].suggested_map_key, "welcome1");
    assert.equal(result.points[1].suggested_map_key, "farewell1");
  });
});

test("validates a minimal scene against bundled model", async () => {
  await workspace(async () => {
    await writeScene();
    const result = await validateTourRobotScene({ scene_directory: "demo", points_path: "points.json" });
    assert.equal(result.is_valid, true, JSON.stringify(result.diagnostics));
    assert.equal(result.is_publishable, false);
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_PROGRAM_PHOTO_POINT_MISSING"));
  });
});

test("reports loader warnings and unreachable explain points", async () => {
  await workspace(async () => {
    await writeScene();
    const scene = parse(await readFile("demo/scene_config.yaml", "utf8"));
    scene.programs.full.explain_point_keys = ["welcome_start"];
    scene.programs.full.photo_before_explain = true;
    scene.programs.full.photo_after_explain = true;
    await writeFile("demo/scene_config.yaml", stringify(scene));
    const result = await validateTourRobotScene({ scene_directory: "demo", points_path: "points.json" });
    assert.equal(result.is_valid, true);
    assert.equal(result.is_publishable, false);
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_PROGRAM_PHOTO_MODE_CONFLICT"));
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_EXPLAIN_POINTS_UNREACHABLE" && item.message.includes("farewell_end")));
  });
});

test("reports misplaced welcome and farewell execution points", async () => {
  await workspace(async () => {
    await writeScene();
    const scene = parse(await readFile("demo/scene_config.yaml", "utf8"));
    scene.programs.full.explain_point_keys = ["farewell_end", "welcome_start"];
    await writeFile("demo/scene_config.yaml", stringify(scene));
    const result = await validateTourRobotScene({ scene_directory: "demo", points_path: "points.json" });
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_PROGRAM_WELCOME_NOT_FIRST"));
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_PROGRAM_FAREWELL_NOT_LAST"));
    assert.equal(result.is_publishable, false);
  });
});

test("rejects a scene directory that does not match scene_id", async () => {
  await workspace(async () => {
    await writeScene();
    await mkdir("wrong-name");
    for (const file of ["map_config.yaml", "scene_config.yaml", "explain_config.yaml"]) {
      await writeFile(`wrong-name/${file}`, await readFile(`demo/${file}`));
    }
    const result = await validateTourRobotScene({ scene_directory: "wrong-name", points_path: "points.json" });
    assert.equal(result.is_valid, false);
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_SCENE_DIRECTORY_MISMATCH"));
  });
});

test("rejects omitted source points and explain physical id mismatch", async () => {
  await workspace(async () => {
    await writeScene({ farewellPointId: "3", includeFarewell: false });
    const result = await validateTourRobotScene({ scene_directory: "demo", points_path: "points.json" });
    assert.equal(result.is_valid, false);
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_SOURCE_POINTS_OMITTED"));
    assert.ok(result.diagnostics.some((item) => item.code === "RSF_EXPLAIN_MAP_POINT_UNKNOWN"));
  });
});

test("validates an authoring envelope composed from exact target models", async () => {
  await workspace(async () => {
    await writeScene();
    const readYaml = async (name) => parse(await readFile(`demo/${name}`, "utf8"));
    const model = {
      model_version: "1.0",
      point_input: points,
      source_materials: [{ source_material_id: "source_main", file_path: "narration.md", media_type: "markdown", sha256: "a".repeat(64) }],
      map_config: await readYaml("map_config.yaml"),
      scene_config: await readYaml("scene_config.yaml"),
      explain_config: await readYaml("explain_config.yaml"),
      content_trace: [],
      authoring_decisions: []
    };
    assert.deepEqual(await validateAuthoringModel(model), []);
    model.scene_config.invented_field = true;
    assert.ok((await validateAuthoringModel(model)).some((item) => item.code === "RSF_AUTHORING_MODEL_INVALID"));
  });
});
