import { useAppState } from "../../app/state";
import { AnswerView } from "../components/AnswerView";
import { TraceView } from "../components/TraceView";
import { EmptyState, Icon, PageHeader } from "../components/ui";

export function TracePage({ selectedId }: { selectedId?: string }) {
  const { traces } = useAppState();
  const trace = traces.find((t) => t.id === selectedId) ?? traces[0];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Agent Execution Trace"
        subtitle="Every run is recorded: intent analysis, plan, tool selection with rationale, argument validation, raw tool results, replanning and the final answer. The last 50 runs are kept in IndexedDB."
      />
      {traces.length === 0 ? (
        <div className="card">
          <EmptyState icon="trace" title="No agent runs yet">
            <a className="text-brand-700 hover:underline" href="#/assistant">Ask the assistant a question</a> to record a trace.
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <nav className="card h-fit divide-y divide-slate-100 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto" aria-label="Recorded runs">
            {traces.map((t) => (
              <a key={t.id} href={`#/trace/${t.id}`} className={`block px-4 py-3 ${t.id === trace?.id ? "bg-brand-50/70" : "hover:bg-slate-50"}`}>
                <p className="line-clamp-2 text-sm font-medium text-slate-800">{t.request}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {new Date(t.startedAt).toLocaleTimeString()} · {t.stepsUsed} step{t.stepsUsed === 1 ? "" : "s"} · {t.calls.map((c) => c.tool).join(" → ") || "no tools"}
                </p>
              </a>
            ))}
          </nav>
          {trace && (
            <div className="min-w-0 space-y-6">
              <section className="card p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Request</p>
                <p className="mt-1 text-lg font-medium text-slate-900">“{trace.request}”</p>
                <div className="mt-4 rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                  <p className="mb-1 flex items-center gap-1.5 font-medium"><Icon name="brain" className="h-4 w-4" /> Intent analysis (rule-based)</p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs">
                    {trace.analysis.signals.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              </section>
              <section className="card p-5">
                <TraceView trace={trace} />
              </section>
              <section className="card p-5">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Final answer</p>
                <AnswerView answer={trace.answer} />
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
