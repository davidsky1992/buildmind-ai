import { describe, expect, it } from "vitest";
import { createTestEngine } from "../test/setup";
import type { DelayAnalysis } from "../tools/projectData";
import type { KnowledgeSearchResult } from "../tools/knowledgeTool";

const tools = (r: { calls: { tool: string }[] }) => r.calls.map((c) => c.tool);

describe("AgentEngine (deterministic)", () => {
  it("lists delayed projects with a single tool call", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("Which projects are delayed?");
    expect(tools(r)).toEqual(["get_delayed_projects"]);
    expect(r.calls[0].status).toBe("success");
    expect(r.answer.plainText).toContain("BM-107");
  });

  it("chains tools: ranks delays, then analyses the top project with its id taken from the first result", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("Which project is most delayed and what is its liquidated damages exposure?");
    expect(tools(r)).toEqual(["get_delayed_projects", "calculate_project_delay", "search_knowledge_base"]);
    expect(r.calls[1].args.project_id).toBe("BM-107");
    const calc = r.calls[1].result as DelayAnalysis;
    expect(calc.delayDays).toBe(126);
    expect(calc.liquidatedDamagesExposureCapped).toBe(126 * 15000);
    // knowledge query was enriched with the project discovered at step 2
    expect(String(r.calls[2].args.query)).toContain("BM-107");
    expect(r.answer.plainText).toContain("most delayed project");
    expect(r.answer.citations.length).toBeGreaterThan(0);
  });

  it("calls search_knowledge_base for document questions and cites real chunks", async () => {
    const { engine, kb } = await createTestEngine();
    const r = await engine.run("What does the contract require when a project is more than 14 days behind schedule?");
    expect(tools(r)).toEqual(["search_knowledge_base"]);
    const res = r.calls[0].result as KnowledgeSearchResult;
    expect(res.hits[0].docName).toContain("General Conditions");
    expect(res.hits[0].text).toContain("Recovery Schedule");
    for (const c of r.answer.citations) {
      const chunk = kb.getChunk(c.chunkId)!;
      expect(chunk.text).toBe(c.text);
    }
  });

  it("answers project questions without touching the knowledge base", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("Show me details for BM-104");
    expect(tools(r)).toEqual(["get_project_details"]);
    expect(r.answer.plainText).toContain("Northgate Logistics Distribution Center");
  });

  it("resolves a project name and combines delay calculation with document retrieval", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("How late is the Cedar Creek bridge and why?");
    expect(tools(r)).toEqual(["calculate_project_delay", "search_knowledge_base"]);
    expect((r.calls[0].result as DelayAnalysis).delayDays).toBe(42);
    const kbRes = r.calls[1].result as KnowledgeSearchResult;
    expect(kbRes.hits[0].docName).toContain("BM-103");
  });

  it("searches the portfolio with extracted filters", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("Which projects are in North Carolina?");
    expect(tools(r)).toEqual(["search_projects"]);
    expect(r.calls[0].args).toMatchObject({ location: "north carolina" });
    expect(r.answer.plainText).toContain("BM-109");
    expect(r.answer.plainText).toContain("BM-110");
  });

  it("replans when a search returns exactly one project", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("What is the status of the water treatment project?");
    expect(tools(r)).toEqual(["search_projects", "get_project_details"]);
    expect(r.plan.some((s) => s.origin === "replan")).toBe(true);
    expect(r.calls[1].args.project_id).toBe("BM-108");
  });

  it("uses persisted memory to resolve follow-up pronouns", async () => {
    const { engine, memory } = await createTestEngine();
    await engine.run("Tell me about BM-101");
    expect(memory.snapshot.lastProjectIds[0]).toBe("BM-101");
    const r = await engine.run("How many days late is it?");
    expect(r.analysis.entities.projectSource).toBe("memory");
    expect(tools(r)).toEqual(["calculate_project_delay"]);
    expect((r.calls[0].result as DelayAnalysis).delayDays).toBe(77);
  });

  it("reports tool errors instead of inventing data", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("Show details for BM-999");
    expect(r.calls[0].status).toBe("error");
    expect(r.answer.plainText).toContain("not found");
  });

  it("never exceeds the 5-step limit", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("How late are BM-101, BM-102, BM-103 and BM-107 and what are their details?");
    expect(r.stepsUsed).toBe(5);
    expect(r.stoppedByLimit).toBe(true);
    expect(r.plan.some((s) => s.status === "skipped")).toBe(true);
  });

  it("records a full trace in order", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("Which project is most delayed?");
    const kinds = r.events.map((e) => e.kind);
    expect(kinds.slice(0, 4)).toEqual(["request", "memory", "intent", "plan"]);
    expect(kinds).toContain("tool_selection");
    expect(kinds).toContain("validation");
    expect(kinds).toContain("tool_result");
    expect(kinds.at(-1)).toBe("final");
  });

  it("is deterministic", async () => {
    const a = await (await createTestEngine()).engine.run("What are the cold-weather concreting requirements?");
    const b = await (await createTestEngine()).engine.run("What are the cold-weather concreting requirements?");
    expect(a.answer.plainText).toBe(b.answer.plainText);
    expect(a.answer.plainText).toContain("40 degrees F");
  });

  it("handles greetings without tools", async () => {
    const { engine } = await createTestEngine();
    const r = await engine.run("hello");
    expect(r.calls).toHaveLength(0);
    expect(r.answer.plainText).toContain("not an LLM");
  });
});
