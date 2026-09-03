import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import {
  compileTourRobotScene,
  validateSceneIr,
  validateSceneRequirement,
  verifyScenePackage
} from "./runtime.js";

export const name = "rein-scene-forge";
export const inject = ["skills", "tools"];

const skillDirectoryUrl = new URL("../skills/robot-scene-authoring/", import.meta.url);
const skillMarkdownUrl = new URL("SKILL.md", skillDirectoryUrl);
const skillDirectoryPath = fileURLToPath(skillDirectoryUrl);
const skillMarkdownPath = fileURLToPath(skillMarkdownUrl);
const skillContent = readFileSync(skillMarkdownUrl, "utf8");

const validationParameters = {
  input_path: { type: "string", required: true, description: "Workspace-relative or absolute path to the input JSON file. The resolved path must stay inside the current workspace." },
  output_path: { type: "string", required: true, description: "Workspace path for the JSON validation report." },
  force: { type: "boolean", description: "Overwrite the output report when it exists. Defaults to false." }
};

function jsonOutput() {
  return {
    schema: { type: "object", additionalProperties: true },
    render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
  };
}

export function apply(ctx) {
  ctx.skills.register({
    name: "robot-scene-authoring",
    description:
      "Guide traceable robot scene authoring through Scene IR, deterministic validation, target compilation, and scene package checks.",
    whenToUse:
      "Use when a user asks to create or revise a robot guide, reception, showroom, museum, or tour scene from source material, point input, and scene requirements.",
    source: "rein-scene-forge-dsh-plugin",
    path: skillMarkdownPath,
    resourceBase: { kind: "directory", path: skillDirectoryPath },
    content: skillContent
  });

  ctx.tools.register(defineTool({
    name: "validate_scene_requirement",
    description: "Validate a scene requirement JSON file with the bundled contract and write a structured JSON report.",
    parameters: validationParameters,
    output: jsonOutput(),
    execute: validateSceneRequirement
  }));
  ctx.tools.register(defineTool({
    name: "validate_scene_ir",
    description: "Validate a Scene IR JSON file with bundled JSON Schema and deterministic cross-reference rules, then write a JSON report.",
    parameters: validationParameters,
    output: jsonOutput(),
    execute: validateSceneIr
  }));
  ctx.tools.register(defineTool({
    name: "compile_tour_robot_scene",
    description: "Compile a validated Scene IR JSON file into a deterministic tour_robot scene package. Refuses non-empty output directories unless force is true.",
    parameters: {
      scene_ir_path: { type: "string", required: true, description: "Workspace path to a Scene IR JSON file." },
      output_directory: { type: "string", required: true, description: "Workspace directory where the scene package will be written." },
      force: { type: "boolean", description: "Overwrite generated files in an existing output directory. Defaults to false." }
    },
    output: jsonOutput(),
    execute: compileTourRobotScene
  }));
  ctx.tools.register(defineTool({
    name: "verify_scene_package",
    description: "Revalidate a compiled scene package manifest and every manifest-listed SHA-256 file hash, then write a JSON report.",
    parameters: {
      package_directory: { type: "string", required: true, description: "Workspace path to the scene package directory containing manifest.json." },
      output_path: { type: "string", required: true, description: "Workspace path for the JSON verification report; keep it outside the package when repeatable package contents are required." },
      force: { type: "boolean", description: "Overwrite the output report when it exists. Defaults to false." }
    },
    output: jsonOutput(),
    execute: verifyScenePackage
  }));
}
