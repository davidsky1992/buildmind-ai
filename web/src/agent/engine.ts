import { ResponseComposer } from "./composer";
import { ExecutionContext } from "./context";
import { ToolExecutor } from "./executor";
import type { AgentMemory } from "./memory";
import { AgentPlanner } from "./planner";
import type { ToolRegistry } from "./registry";
import { ExecutionTrace, type TraceRecord } from "./trace";
import type { ToolRuntime } from "./types";

export const MAX_STEPS = 5;

export interface AgentEngineOptions {
  registry: ToolRegistry;
  runtime: ToolRuntime;
  memory: AgentMemory;
  maxSteps?: number;
  onTrace?: (record: TraceRecord) => Promise<void> | void;
}

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Deterministic agent loop (no LLM):
 * request → intent analysis → plan → [select tool → validate → execute → observe → replan]* → compose answer.
 * The loop is bounded by `maxSteps` tool calls.
 */
export class AgentEngine {
  readonly planner = new AgentPlanner();
  private readonly composer = new ResponseComposer();
  private readonly executor: ToolExecutor;
  readonly maxSteps: number;

  constructor(private readonly opts: AgentEngineOptions) {
    this.executor = new ToolExecutor(opts.registry, opts.runtime);
    this.maxSteps = opts.maxSteps ?? MAX_STEPS;
  }

  get registry(): ToolRegistry {
    return this.opts.registry;
  }

  async run(request: string): Promise<TraceRecord> {
    const startedAt = new Date().toISOString();
    const trace = new ExecutionTrace();
    const memory = this.opts.memory;
    const mem = memory.snapshot;

    trace.add("request", "Received request", request);
    trace.add(
      "memory",
      "Loaded working memory",
      mem.lastProjectIds.length ? `Last referenced projects: ${mem.lastProjectIds.slice(0, 4).join(", ")}` : "No prior project context",
      { ...mem },
    );

    // 2. Intent analysis
    const analysis = this.planner.analyze(request, mem);
    trace.add("intent", `Intent: ${analysis.intents.join(" + ")}`, analysis.signals.join("\n"), analysis);

    // 3. Plan
    const ctx = new ExecutionContext(request, analysis, mem, trace, this.maxSteps);
    ctx.goals = this.planner.createPlan(analysis);
    trace.add(
      "plan",
      `Execution plan: ${ctx.goals.length} step${ctx.goals.length === 1 ? "" : "s"}`,
      ctx.goals.map((g, i) => `${i + 1}. ${g.step.goal} → ${g.step.tool}`).join("\n") || "No tools required",
      ctx.goals.map((g) => ({ ...g.step })),
    );

    // 4-8. Tool loop
    let stoppedByLimit = false;
    while (true) {
      const next = this.planner.nextAction(ctx);
      if (next.type === "finish") break;
      if (ctx.stepsRemaining <= 0) {
        stoppedByLimit = true;
        for (const g of ctx.goals.filter((g) => g.step.status === "pending")) {
          g.step.status = "skipped";
          g.step.note = `Step budget of ${this.maxSteps} reached`;
        }
        trace.add("limit", `Stopped at the ${this.maxSteps}-step limit`, "Remaining goals were skipped.");
        break;
      }
      const step = ctx.stepsUsed + 1;
      trace.add("tool_selection", `Step ${step}: ${next.tool}`, next.rationale, { args: next.args });
      const call = await this.executor.execute(step, next.tool, next.args, next.rationale);
      ctx.calls.push(call);
      next.goal.step.callId = call.id;
      next.goal.step.status = call.status === "success" ? "done" : "failed";
      trace.add(
        "validation",
        call.status === "invalid" ? "Arguments rejected" : "Arguments valid",
        call.status === "invalid" ? call.validationErrors.join("\n") : JSON.stringify(call.args),
      );
      if (call.status !== "invalid") {
        trace.add("tool_result", `${call.tool} → ${call.status}`, call.summary, call.result ?? { error: call.error });
      }
      this.planner.observe(ctx, call);
    }

    // 9. Final response
    const answer = this.composer.compose(ctx);
    trace.add("final", "Composed final answer", `${answer.blocks.length} blocks, ${answer.citations.length} citation(s)`);

    const record: TraceRecord = {
      id: uid(),
      request,
      startedAt,
      durationMs: trace.elapsed(),
      analysis,
      plan: ctx.goals.map((g) => ({ ...g.step })),
      calls: ctx.calls,
      events: trace.events,
      answer,
      stepsUsed: ctx.stepsUsed,
      maxSteps: this.maxSteps,
      stoppedByLimit,
    };

    // Update memory so follow-ups ("what about its budget?") resolve.
    const projectIds = ctx.referencedProjectIds();
    await memory.remember({
      lastProjectIds: projectIds.length ? projectIds : mem.lastProjectIds,
      lastIntents: analysis.intents,
      lastQuery: request,
      lastDocNames: [...new Set(answer.citations.map((c) => c.docName))],
    });
    await memory.appendMessage({ id: `u-${record.id}`, role: "user", text: request, createdAt: startedAt });
    await memory.appendMessage({
      id: `a-${record.id}`,
      role: "assistant",
      text: answer.plainText,
      createdAt: new Date().toISOString(),
      traceId: record.id,
      answer,
    });
    await this.opts.onTrace?.(record);
    return record;
  }
}
