import { useState } from "react";
import type { TraceEvent, TraceEventKind, TraceRecord } from "../../agent/trace";
import type { ToolCallRecord } from "../../agent/types";
import { Icon, JsonView, Pill } from "./ui";

const KIND_META: Record<TraceEventKind, { label: string; icon: string; color: string }> = {
  request: { label: "Request", icon: "chat", color: "bg-slate-500" },
  memory: { label: "Memory", icon: "database", color: "bg-slate-400" },
  intent: { label: "Intent analysis", icon: "brain", color: "bg-violet-500" },
  plan: { label: "Planning", icon: "layers", color: "bg-indigo-500" },
  tool_selection: { label: "Tool selection", icon: "tool", color: "bg-sky-500" },
  validation: { label: "Validation", icon: "check", color: "bg-teal-500" },
  tool_result: { label: "Tool result", icon: "file", color: "bg-emerald-500" },
  replan: { label: "Replanning", icon: "refresh", color: "bg-amber-500" },
  limit: { label: "Step limit", icon: "alert", color: "bg-rose-500" },
  final: { label: "Final answer", icon: "sparkle", color: "bg-brand-700" },
};

export function TraceView({ trace, compact = false }: { trace: TraceRecord; compact?: boolean }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-xs">
        <Pill tone="brand">{trace.stepsUsed} / {trace.maxSteps} steps</Pill>
        <Pill>{trace.durationMs} ms</Pill>
        <Pill tone="violet">{trace.analysis.intents.join(" + ")}</Pill>
        {trace.stoppedByLimit && <Pill tone="rose">stopped by step limit</Pill>}
        <Pill tone="sky">deterministic · no LLM</Pill>
      </div>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Plan</h4>
        {trace.plan.length === 0 ? (
          <p className="text-sm text-slate-500">No tools were needed.</p>
        ) : (
          <ol className="space-y-1.5">
            {trace.plan.map((s, i) => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <PlanStatus status={s.status} />
                <div className="min-w-0">
                  <span className="text-slate-800">{i + 1}. {s.goal}</span>{" "}
                  <code className="rounded bg-slate-100 px-1 font-mono text-[11px] text-slate-700">{s.tool}</code>
                  {s.origin === "replan" && <span className="ml-1"><Pill tone="amber">added by replanning</Pill></span>}
                  {s.note && <p className="text-xs text-slate-500">{s.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Tool calls</h4>
        {trace.calls.length === 0 ? (
          <p className="text-sm text-slate-500">None.</p>
        ) : (
          <div className="space-y-2">{trace.calls.map((c) => <ToolCallCard key={c.id} call={c} />)}</div>
        )}
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Event timeline</h4>
        <ol className="relative space-y-3 border-l border-slate-200 pl-5">
          {trace.events.map((e, i) => <EventRow key={i} e={e} compact={compact} />)}
        </ol>
      </section>
    </div>
  );
}

function PlanStatus({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "bg-emerald-500 text-white",
    failed: "bg-rose-500 text-white",
    skipped: "bg-slate-300 text-slate-700",
    pending: "bg-white text-slate-400 ring-1 ring-slate-300",
  };
  const icon = status === "done" ? "check" : status === "failed" ? "x" : status === "skipped" ? "chevron" : "info";
  return (
    <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${map[status]}`} title={status}>
      <Icon name={icon} className="h-2.5 w-2.5" />
    </span>
  );
}

export function ToolCallCard({ call }: { call: ToolCallRecord }) {
  const [open, setOpen] = useState(false);
  const tone = call.status === "success" ? "text-emerald-700 bg-emerald-50" : call.status === "error" ? "text-rose-700 bg-rose-50" : "text-amber-800 bg-amber-50";
  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start gap-3 p-3 text-left">
        <span className="mt-0.5 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-white">#{call.step}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-[13px] font-semibold text-slate-900">{call.tool}</code>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${tone}`}>{call.status}</span>
            <span className="text-[11px] text-slate-400">{call.durationMs} ms</span>
          </span>
          <span className="mt-0.5 block break-all font-mono text-[11px] text-slate-500">{JSON.stringify(call.args)}</span>
          <span className="mt-1 block text-xs text-slate-700">→ {call.summary}</span>
        </span>
        <Icon name="chevron" className={`mt-1 h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-100 p-3">
          <p className="text-xs text-slate-600"><span className="font-medium text-slate-800">Why:</span> {call.rationale}</p>
          {call.validationErrors.length > 0 && <p className="text-xs text-amber-800">Validation: {call.validationErrors.join("; ")}</p>}
          <p className="text-xs font-medium text-slate-800">Raw result returned by the TypeScript function</p>
          <JsonView value={call.result ?? { error: call.error }} />
        </div>
      )}
    </div>
  );
}

function EventRow({ e, compact }: { e: TraceEvent; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = KIND_META[e.kind];
  const hasData = e.data !== undefined && !compact && e.kind !== "tool_result";
  return (
    <li className="relative">
      <span className={`absolute -left-[27px] top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white ${meta.color}`} />
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{meta.label}</span>
        <span className="text-[11px] text-slate-400">+{e.atMs} ms</span>
      </div>
      <p className="text-sm font-medium text-slate-800">{e.title}</p>
      {e.detail && <p className="whitespace-pre-line break-words text-xs text-slate-600">{e.detail}</p>}
      {hasData && (
        <button type="button" className="mt-1 text-[11px] font-medium text-brand-700 hover:underline" onClick={() => setOpen(!open)}>
          {open ? "Hide data" : "Show data"}
        </button>
      )}
      {open && hasData && <div className="mt-1"><JsonView value={e.data} maxHeight="max-h-56" /></div>}
    </li>
  );
}
