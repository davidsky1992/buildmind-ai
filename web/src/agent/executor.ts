import type { ToolRegistry } from "./registry";
import { ToolError, type ToolArgs, type ToolCallRecord, type ToolRuntime } from "./types";
import { validateArgs } from "./validation";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Validates arguments, runs a registered tool and records the outcome. Never throws. */
export class ToolExecutor {
  private counter = 0;

  constructor(
    private readonly registry: ToolRegistry,
    private readonly runtime: ToolRuntime,
  ) {}

  async execute(step: number, toolName: string, rawArgs: ToolArgs, rationale: string): Promise<ToolCallRecord> {
    const id = `call_${++this.counter}`;
    const base = { id, step, tool: toolName, args: rawArgs, rationale };
    const tool = this.registry.get(toolName);
    if (!tool) {
      return { ...base, status: "invalid", validationErrors: [`unknown tool "${toolName}"`], summary: "Tool not found", durationMs: 0 };
    }

    const validation = validateArgs(tool.parameters, rawArgs);
    if (!validation.ok) {
      return {
        ...base,
        status: "invalid",
        validationErrors: validation.errors,
        summary: `Rejected: ${validation.errors.join("; ")}`,
        durationMs: 0,
      };
    }

    const started = now();
    try {
      const result = await tool.execute(validation.value, this.runtime);
      return {
        ...base,
        args: validation.value,
        status: "success",
        validationErrors: [],
        result,
        summary: tool.summarize(result),
        durationMs: Math.round((now() - started) * 100) / 100,
      };
    } catch (e) {
      const message = e instanceof ToolError ? e.message + (e.hint ? ` ${e.hint}` : "") : `Unexpected error: ${(e as Error).message}`;
      return {
        ...base,
        args: validation.value,
        status: "error",
        validationErrors: [],
        error: message,
        summary: message,
        durationMs: Math.round((now() - started) * 100) / 100,
      };
    }
  }
}
