import type { ToolDefinition } from "./types";

/** Holds the set of tools the agent is allowed to call. */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register<T>(tool: ToolDefinition<T>): this {
    if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) throw new Error(`Invalid tool name "${tool.name}"`);
    if (this.tools.has(tool.name)) throw new Error(`Tool "${tool.name}" is already registered`);
    this.tools.set(tool.name, tool as ToolDefinition);
    return this;
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }
}
