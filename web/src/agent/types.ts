import type { SearchHit } from "../rag/types";

/** Subset of JSON Schema used to declare and validate tool inputs. */
export interface ParamSchema {
  type: "string" | "number" | "integer" | "boolean";
  description: string;
  enum?: readonly string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  default?: string | number | boolean;
}

export interface ToolInputSchema {
  type: "object";
  properties: Record<string, ParamSchema>;
  required: string[];
  additionalProperties: false;
}

export type ToolArgs = Record<string, string | number | boolean | undefined>;

/** Services a tool can use at execution time. */
export interface ToolRuntime {
  searchKnowledge(query: string, topK: number): SearchHit[];
  knowledgeChunkCount(): number;
}

export interface ToolDefinition<TResult = unknown> {
  name: string;
  description: string;
  category: "projects" | "knowledge";
  parameters: ToolInputSchema;
  execute(args: ToolArgs, runtime: ToolRuntime): TResult | Promise<TResult>;
  /** One-line, human-readable summary of a result (shown in the trace as the observation). */
  summarize(result: TResult): string;
}

/** Thrown by tools for expected, user-facing failures (e.g. unknown project id). */
export class ToolError extends Error {
  constructor(
    message: string,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "ToolError";
  }
}

export interface ToolCallRecord {
  id: string;
  step: number;
  tool: string;
  args: ToolArgs;
  rationale: string;
  status: "success" | "error" | "invalid";
  validationErrors: string[];
  result?: unknown;
  error?: string;
  summary: string;
  durationMs: number;
}
