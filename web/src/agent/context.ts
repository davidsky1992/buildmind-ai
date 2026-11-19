import { findProject, type DelayAnalysis, type Project } from "../tools/projectData";
import type { DelayedProjectsResult, ProjectDetailsResult, SearchProjectsResult } from "../tools/projectTools";
import type { MemoryState } from "./memory";
import type { Goal, IntentAnalysis } from "./planner";
import type { ExecutionTrace } from "./trace";
import type { ToolCallRecord } from "./types";

/** Mutable state for one agent run: the plan, every tool call and the trace. */
export class ExecutionContext {
  readonly calls: ToolCallRecord[] = [];
  goals: Goal[] = [];

  constructor(
    readonly request: string,
    readonly analysis: IntentAnalysis,
    readonly memory: Readonly<MemoryState>,
    readonly trace: ExecutionTrace,
    readonly maxSteps: number,
  ) {}

  get stepsUsed(): number {
    return this.calls.length;
  }

  get stepsRemaining(): number {
    return this.maxSteps - this.calls.length;
  }

  /** Most recent successful result of a tool. */
  latest<T>(tool: string): T | undefined {
    for (let i = this.calls.length - 1; i >= 0; i--) {
      const c = this.calls[i];
      if (c.tool === tool && c.status === "success") return c.result as T;
    }
    return undefined;
  }

  /** The single project the conversation is currently about, if one can be determined. */
  focusProject(): Project | undefined {
    const ids = this.analysis.entities.projectIds;
    if (ids.length === 1) return findProject(ids[0]);
    const calc = this.latest<DelayAnalysis>("calculate_project_delay");
    if (calc) return findProject(calc.projectId);
    const details = this.latest<ProjectDetailsResult>("get_project_details");
    if (details) return details.project;
    const search = this.latest<SearchProjectsResult>("search_projects");
    if (search?.total === 1) return findProject(search.projects[0].id);
    const delayed = this.latest<DelayedProjectsResult>("get_delayed_projects");
    if (delayed?.count && this.analysis.entities.superlative) return findProject(delayed.projects[0].id);
    return undefined;
  }

  /** Project ids touched by this run, most specific first (fed back into memory). */
  referencedProjectIds(): string[] {
    const out: string[] = [];
    const push = (id?: string) => id && !out.includes(id) && out.push(id);
    for (const c of this.calls) {
      if (c.status !== "success") continue;
      if (c.tool === "calculate_project_delay") push((c.result as DelayAnalysis).projectId);
      if (c.tool === "get_project_details") push((c.result as ProjectDetailsResult).project.id);
    }
    for (const c of this.calls) {
      if (c.status !== "success") continue;
      if (c.tool === "get_delayed_projects") (c.result as DelayedProjectsResult).projects.forEach((p) => push(p.id));
      if (c.tool === "search_projects") (c.result as SearchProjectsResult).projects.forEach((p) => push(p.id));
    }
    return out;
  }
}
