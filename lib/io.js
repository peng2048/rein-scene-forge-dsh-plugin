import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parseDocument } from "yaml";

export function workspacePath(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty path`);
  const workspace = resolve(process.cwd());
  const path = resolve(workspace, value);
  const rel = relative(workspace, path);
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`${label} must stay inside the current workspace: ${value}`);
  }
  return path;
}

export async function readJson(pathValue, label = "input_path") {
  const path = workspacePath(pathValue, label);
  const text = await readFile(path, "utf8");
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in ${pathValue}: ${error.message}`);
  }
}

export async function readYaml(path) {
  const text = await readFile(path, "utf8");
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors.map((error) => error.message).join("; "));
  return document.toJS() ?? {};
}

export function report(tool, inputPath, diagnostics, extra = {}) {
  const errorCount = diagnostics.filter((item) => item.severity === "error").length;
  const warningCount = diagnostics.filter((item) => item.severity === "warning").length;
  return {
    tool,
    tool_runtime_version: "0.4.0",
    input_path: inputPath,
    is_valid: errorCount === 0,
    is_publishable: errorCount === 0 && warningCount === 0,
    error_count: errorCount,
    warning_count: warningCount,
    diagnostics,
    ...extra
  };
}

export function diagnostic(code, severity, objectPath, message, fixSuggestion) {
  return { code, severity, object_path: objectPath, message, fix_suggestion: fixSuggestion };
}
