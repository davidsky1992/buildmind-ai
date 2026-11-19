import type { ToolArgs, ToolInputSchema } from "./types";

export type ValidationResult = { ok: true; value: ToolArgs } | { ok: false; errors: string[] };

/**
 * Validates tool arguments against the tool's declared schema and applies defaults.
 * Unknown keys, missing required keys and type / range / enum / pattern violations are rejected.
 */
export function validateArgs(schema: ToolInputSchema, input: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["arguments must be an object"] };
  }
  const args = input as Record<string, unknown>;
  const value: ToolArgs = {};

  for (const key of Object.keys(args)) {
    if (!(key in schema.properties) && args[key] !== undefined) errors.push(`unknown argument "${key}"`);
  }

  for (const [key, prop] of Object.entries(schema.properties)) {
    let v = args[key];
    if (v === undefined || v === null || v === "") {
      if (schema.required.includes(key)) errors.push(`"${key}" is required`);
      else if (prop.default !== undefined) value[key] = prop.default;
      continue;
    }
    switch (prop.type) {
      case "string":
        if (typeof v !== "string") {
          errors.push(`"${key}" must be a string`);
          continue;
        }
        v = v.trim();
        if (prop.minLength !== undefined && (v as string).length < prop.minLength)
          errors.push(`"${key}" must be at least ${prop.minLength} characters`);
        if (prop.maxLength !== undefined && (v as string).length > prop.maxLength)
          errors.push(`"${key}" must be at most ${prop.maxLength} characters`);
        if (prop.pattern && !new RegExp(prop.pattern).test(v as string))
          errors.push(`"${key}" does not match the required format ${prop.pattern}`);
        if (prop.enum && !prop.enum.includes(v as string))
          errors.push(`"${key}" must be one of: ${prop.enum.join(", ")}`);
        break;
      case "number":
      case "integer":
        if (typeof v !== "number" || Number.isNaN(v)) {
          errors.push(`"${key}" must be a number`);
          continue;
        }
        if (prop.type === "integer" && !Number.isInteger(v)) errors.push(`"${key}" must be an integer`);
        if (prop.minimum !== undefined && v < prop.minimum) errors.push(`"${key}" must be ≥ ${prop.minimum}`);
        if (prop.maximum !== undefined && v > prop.maximum) errors.push(`"${key}" must be ≤ ${prop.maximum}`);
        break;
      case "boolean":
        if (typeof v !== "boolean") errors.push(`"${key}" must be a boolean`);
        break;
    }
    value[key] = v as string | number | boolean;
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}
