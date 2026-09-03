import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { compileTourRobotScene, validateSceneIr, verifyScenePackage } from "../lib/runtime.js";

const previous = process.cwd();
const workspace = await mkdtemp(resolve(tmpdir(), "rein-scene-forge-smoke-"));
try {
  const sceneIr = await readFile(resolve(previous, "examples/dynamic-corporate-showroom/scene-ir.json"), "utf8");
  process.chdir(workspace);
  await writeFile("scene-ir.json", sceneIr);
  const validation = await validateSceneIr({ input_path: "scene-ir.json", output_path: "scene-ir-validation.json" });
  if (!validation.is_valid) throw new Error(JSON.stringify(validation));
  const compiled = await compileTourRobotScene({ scene_ir_path: "scene-ir.json", output_directory: "package" });
  const verification = await verifyScenePackage({ package_directory: "package", output_path: "verification.json" });
  if (!verification.is_valid) throw new Error(JSON.stringify(verification));
  console.log(JSON.stringify({ validation: validation.is_valid, compiled_files: compiled.files.length, verification: verification.is_valid }, null, 2));
} finally {
  process.chdir(previous);
  await rm(workspace, { recursive: true, force: true });
}
