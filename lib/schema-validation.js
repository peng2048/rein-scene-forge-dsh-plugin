import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { diagnostic } from "./io.js";

const schemaDirectory = fileURLToPath(new URL("../schemas/tour-robot/", import.meta.url));
const authoringSchemaDirectory = fileURLToPath(new URL("../schemas/authoring/", import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map();

function objectPath(instancePath) {
  return instancePath ? `$${instancePath.replaceAll("/", ".")}` : "$";
}

async function validatorFor(fileName) {
  if (!validators.has(fileName)) {
    const schemaName = fileName.replace(".yaml", ".schema.json").replaceAll("_", "-");
    const schema = JSON.parse(await readFile(resolve(schemaDirectory, schemaName), "utf8"));
    validators.set(fileName, ajv.compile(schema));
  }
  return validators.get(fileName);
}

async function authoringValidator() {
  const cacheKey = "authoring-model";
  if (!validators.has(cacheKey)) {
    for (const fileName of ["map-config.schema.json", "scene-config.schema.json", "explain-config.schema.json", "reception-pack.schema.json"]) {
      const targetSchema = JSON.parse(await readFile(resolve(schemaDirectory, fileName), "utf8"));
      if (!ajv.getSchema(targetSchema.$id)) ajv.addSchema(targetSchema);
    }
    const schema = JSON.parse(await readFile(resolve(authoringSchemaDirectory, "authoring-model.schema.json"), "utf8"));
    validators.set(cacheKey, ajv.compile(schema));
  }
  return validators.get(cacheKey);
}

export async function validateYamlModel(fileName, value) {
  const validate = await validatorFor(fileName);
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => diagnostic(
    "RSF_TARGET_SCHEMA_INVALID",
    "error",
    `${fileName}:${objectPath(error.instancePath)}`,
    error.message ?? "Schema validation failed.",
    `Follow the bundled ${fileName} data model and template.`
  ));
}

export async function validateAuthoringModel(value) {
  const validate = await authoringValidator();
  if (validate(value)) return [];
  return (validate.errors ?? []).map((error) => diagnostic(
    "RSF_AUTHORING_MODEL_INVALID",
    "error",
    objectPath(error.instancePath),
    error.message ?? "Authoring model validation failed.",
    "Follow the bundled authoring model catalog and schema."
  ));
}
