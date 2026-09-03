import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { analyzePointInput, validateAuthoringModel, validateTourRobotScene } from "./runtime.js";

export const name = "rein-scene-forge";
export const inject = ["skills", "tools"];

const skillDirectoryUrl = new URL("../skills/robot-scene-authoring/", import.meta.url);
const skillMarkdownUrl = new URL("SKILL.md", skillDirectoryUrl);

function jsonOutput() {
  return {
    schema: { type: "object", additionalProperties: true },
    render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
  };
}

export function apply(ctx) {
  ctx.skills.register({
    name: "robot-scene-authoring",
    description: "Generate and validate tour_robot YAML from points.json and narration material.",
    whenToUse: "Use when a user wants robot tour YAML generated from a point export and narration material.",
    source: "rein-scene-forge-dsh-plugin",
    path: fileURLToPath(skillMarkdownUrl),
    resourceBase: { kind: "directory", path: fileURLToPath(skillDirectoryUrl) },
    content: readFileSync(skillMarkdownUrl, "utf8")
  });

  ctx.tools.register(defineTool({
    name: "validate_authoring_model",
    description: "Validate the complete internal authoring model before rendering tour_robot YAML.",
    parameters: {
      model: { type: "object", additionalProperties: true, required: true, description: "Complete internal authoring model object." }
    },
    output: jsonOutput(),
    execute: async ({ model }) => {
      const diagnostics = await validateAuthoringModel(model);
      return { is_valid: diagnostics.length === 0, diagnostics };
    }
  }));

  ctx.tools.register(defineTool({
    name: "analyze_point_input",
    description: "Analyze points.json without merging distinct logical points that share the same physical pose.",
    parameters: {
      input_path: { type: "string", required: true, description: "Workspace path to points.json." },
      pose_tolerance_meters: { type: "number", description: "Near-pose distance threshold; default 0.1." },
      yaw_tolerance_degrees: { type: "number", description: "Near-pose yaw threshold; default 5." }
    },
    output: jsonOutput(),
    execute: analyzePointInput
  }));

  ctx.tools.register(defineTool({
    name: "validate_tour_robot_scene",
    description: "Validate map_config.yaml, scene_config.yaml and explain_config.yaml against points.json and tour_robot runtime rules.",
    parameters: {
      scene_directory: { type: "string", required: true, description: "Workspace scene directory containing the YAML files." },
      points_path: { type: "string", required: true, description: "Workspace path to the authoritative points.json." }
    },
    output: jsonOutput(),
    execute: validateTourRobotScene
  }));
}
