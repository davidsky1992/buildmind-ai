import { describe, expect, it } from "vitest";
import { ToolExecutor } from "./executor";
import { validateArgs } from "./validation";
import { createDefaultRegistry } from "../tools";
import { computeDelay, findProject, PROJECTS } from "../tools/projectData";
import type { DelayedProjectsResult, SearchProjectsResult } from "../tools/projectTools";

const runtime = { searchKnowledge: () => [], knowledgeChunkCount: () => 0 };
const exec = () => new ToolExecutor(createDefaultRegistry(), runtime);

describe("project dataset", () => {
  it("has 10 projects with consistent statuses", () => {
    expect(PROJECTS).toHaveLength(10);
    for (const p of PROJECTS) {
      const d = computeDelay(p).delayDays;
      if (p.status === "On Track" || p.status === "Completed") expect(d).toBeLessThanOrEqual(0);
      if (p.status === "Delayed") expect(d).toBeGreaterThan(14);
    }
  });

  it("computes delay and capped LD exposure", () => {
    const d = computeDelay(findProject("BM-101")!);
    expect(d.delayDays).toBe(77);
    expect(d.liquidatedDamagesExposure).toBe(77 * 25000);
    expect(d.liquidatedDamagesCap).toBe(18_450_000);
    expect(d.recoveryScheduleRequired).toBe(true);
    expect(d.worstMilestone?.name).toBe("Building envelope dry-in");
  });
});

describe("validation", () => {
  const registry = createDefaultRegistry();
  it("applies defaults", () => {
    const r = validateArgs(registry.get("get_delayed_projects")!.parameters, {});
    expect(r).toEqual({ ok: true, value: { min_delay_days: 1, include_completed: false, sort_by: "delay_days" } });
  });
  it("rejects missing, unknown, wrongly typed and out-of-range arguments", () => {
    const schema = registry.get("get_delayed_projects")!.parameters;
    const r = validateArgs(schema, { min_delay_days: 0, sort_by: "cost", foo: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toHaveLength(3);
    const r2 = validateArgs(registry.get("get_project_details")!.parameters, {});
    expect(r2.ok).toBe(false);
    const r3 = validateArgs(registry.get("get_project_details")!.parameters, { project_id: "hospital" });
    expect(r3.ok).toBe(false);
  });
});

describe("ToolExecutor", () => {
  it("executes a valid call", async () => {
    const c = await exec().execute(1, "get_delayed_projects", { min_delay_days: 30 }, "test");
    expect(c.status).toBe("success");
    const r = c.result as DelayedProjectsResult;
    expect(r.projects.map((p) => p.id)).toEqual(["BM-107", "BM-101", "BM-110", "BM-103"]);
  });
  it("marks invalid calls without running them", async () => {
    const c = await exec().execute(1, "calculate_project_delay", { project_id: 101 }, "test");
    expect(c.status).toBe("invalid");
  });
  it("captures tool errors", async () => {
    const c = await exec().execute(1, "get_project_details", { project_id: "BM-555" }, "test");
    expect(c.status).toBe("error");
    expect(c.error).toMatch(/not found/);
  });
  it("rejects unknown tools", async () => {
    const c = await exec().execute(1, "delete_everything", {}, "test");
    expect(c.status).toBe("invalid");
  });
  it("search_projects filters by type and free text", async () => {
    const a = (await exec().execute(1, "search_projects", { project_type: "Healthcare" }, "t")).result as SearchProjectsResult;
    expect(a.projects.map((p) => p.id)).toEqual(["BM-101"]);
    const b = (await exec().execute(1, "search_projects", { query: "Granite Peak" }, "t")).result as SearchProjectsResult;
    expect(b.projects[0].id).toBe("BM-101");
  });
  it("sorts delayed projects by LD exposure", async () => {
    const r = (await exec().execute(1, "get_delayed_projects", { sort_by: "ld_exposure" }, "t")).result as DelayedProjectsResult;
    expect(r.projects[0].id).toBe("BM-101");
  });
});
