import type { ToolCallRecord } from "./types";
import type { IntentAnalysis, PlanStep } from "./planner";
import type { AgentAnswer } from "./composer";

export type TraceEventKind =
  | "request"
  | "memory"
  | "intent"
  | "plan"
  | "tool_selection"
  | "validation"
  | "tool_result"
  | "replan"
  | "limit"
  | "final";

export interface TraceEvent {
  kind: TraceEventKind;
  title: string;
  detail?: string;
  data?: unknown;
  atMs: number; // ms since the run started
}

/** Persisted record of one agent run. */
export interface TraceRecord {
  id: string;
  request: string;
  startedAt: string;
  durationMs: number;
  analysis: IntentAnalysis;
  plan: PlanStep[];
  calls: ToolCallRecord[];
  events: TraceEvent[];
  answer: AgentAnswer;
  stepsUsed: number;
  maxSteps: number;
  stoppedByLimit: boolean;
}

/** Append-only event log for a single run. */
export class ExecutionTrace {
  readonly events: TraceEvent[] = [];
  private readonly t0 = Date.now();

  add(kind: TraceEventKind, title: string, detail?: string, data?: unknown): void {
    this.events.push({ kind, title, detail, data, atMs: Date.now() - this.t0 });
  }

  elapsed(): number {
    return Date.now() - this.t0;
  }
}
