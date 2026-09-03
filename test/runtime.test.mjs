import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  compileTourRobotScene,
  validateSceneIr,
  verifyScenePackage
} from "../lib/runtime.js";

const fixture = resolve("examples/dynamic-corporate-showroom/scene-ir.json");

async function inTemporaryWorkspace(run) {
  const previous = process.cwd();
  const directory = await mkdtemp(resolve(tmpdir(), "rein-scene-forge-"));
  process.chdir(directory);
  try { await run(directory); } finally { process.chdir(previous); await rm(directory, { recursive: true, force: true }); }
}

test("validates and compiles the dynamic corporate showroom", async () => {
  await inTemporaryWorkspace(async () => {
    const sceneIr = JSON.parse(await readFile(fixture, "utf8"));
    await writeFile("scene-ir.json", `${JSON.stringify(sceneIr, null, 2)}\n`);
    const validation = await validateSceneIr({ input_path: "scene-ir.json", output_path: "scene-ir-validation.json" });
    assert.equal(validation.is_valid, true);
    const compiled = await compileTourRobotScene({ scene_ir_path: "scene-ir.json", output_directory: "package" });
    assert.equal(compiled.is_valid, true);
    for (const path of [
      "Target/tour_robot/map_config.yaml", "Target/tour_robot/scene_config.yaml",
      "Target/tour_robot/explain_config.yaml", "Target/tour_robot/reception_pack.yaml",
      "Target/tour_robot/pad-profile-schema.json", "manifest.json", "validation-report.json",
      "summary.json", "traceability.json", "import-guide.md"
    ]) assert.ok(compiled.files.includes(path), path);
    const verification = await verifyScenePackage({ package_directory: "package", output_path: "verification.json" });
    assert.equal(verification.is_valid, true);
  });
});

test("verification detects a modified manifest-listed file", async () => {
  await inTemporaryWorkspace(async () => {
    const sceneIr = JSON.parse(await readFile(fixture, "utf8"));
    await writeFile("scene-ir.json", JSON.stringify(sceneIr));
    await compileTourRobotScene({ scene_ir_path: "scene-ir.json", output_directory: "package" });
    await writeFile("package/Target/tour_robot/map_config.yaml", "tampered: true\n");
    const verification = await verifyScenePackage({ package_directory: "package", output_path: "verification.json" });
    assert.equal(verification.is_valid, false);
    assert.ok(verification.diagnostics.some((item) => item.code === "RSF_PACKAGE_HASH_MISMATCH"));
  });
});

test("compile refuses a non-empty output directory without force", async () => {
  await inTemporaryWorkspace(async () => {
    const sceneIr = JSON.parse(await readFile(fixture, "utf8"));
    await writeFile("scene-ir.json", JSON.stringify(sceneIr));
    await compileTourRobotScene({ scene_ir_path: "scene-ir.json", output_directory: "package" });
    await assert.rejects(
      compileTourRobotScene({ scene_ir_path: "scene-ir.json", output_directory: "package" }),
      /force=true/
    );
  });
});
