import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const rulesUrl = new URL("../rules/tour-robot-authoring.rules.json", import.meta.url);
const schemaUrl = new URL("../rules/ruleset.schema.json", import.meta.url);
let cachedRules;

export async function loadAuthoringRules() {
  if (!cachedRules) {
    const [rules, schema] = await Promise.all([rulesUrl, schemaUrl].map(async (url) => JSON.parse(await readFile(fileURLToPath(url), "utf8"))));
    const validate = new Ajv2020({ allErrors: true }).compile(schema);
    if (!validate(rules)) throw new Error(`Invalid bundled authoring rules: ${JSON.stringify(validate.errors)}`);
    const ids = rules.rules.map((rule) => rule.rule_id);
    if (new Set(ids).size !== ids.length) throw new Error("Invalid bundled authoring rules: duplicate rule_id");
    cachedRules = rules;
  }
  return structuredClone(cachedRules);
}

export async function getAuthoringRules({ category, enforcement } = {}) {
  const ruleset = await loadAuthoringRules();
  ruleset.rules = ruleset.rules.filter((rule) => (!category || rule.category === category) && (!enforcement || rule.enforcement === enforcement));
  return ruleset;
}
