import { useEffect, useMemo, useRef, useState } from "react";
import { navigate } from "../../app/router";
import { SAMPLE_QUESTIONS, memory } from "../../app/services";
import { useAppState } from "../../app/state";
import { AnswerView } from "../components/AnswerView";
import { TraceView } from "../components/TraceView";
import { EmptyState, Icon, Pill } from "../components/ui";

export function AssistantPage({ ask }: { ask?: string }) {
  const { messages, traces, running, ask: run, clearConversation } = useAppState();
  const [input, setInput] = useState("");
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const handledAsk = useRef<string | null>(null);

  const send = async (q: string) => {
    setInput("");
    const record = await run(q);
    if (record) setSelectedTrace(record.id);
  };

  // Sample question links (#/assistant?ask=…) run once, then the URL is cleaned up.
  useEffect(() => {
    if (ask && handledAsk.current !== ask) {
      handledAsk.current = ask;
      navigate("assistant");
      void send(ask);
    }
  }, [ask]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, running]);

  const trace = useMemo(() => {
    const id = selectedTrace ?? [...messages].reverse().find((m) => m.traceId)?.traceId;
    return traces.find((t) => t.id === id) ?? null;
  }, [selectedTrace, messages, traces]);

  const mem = memory.snapshot;

  return (
    <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="card flex min-h-[70vh] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h1 className="font-semibold text-slate-900">AI Assistant</h1>
            <p className="text-xs text-slate-500">Deterministic agent engine · max 5 tool steps per request · not an LLM</p>
          </div>
          <div className="flex items-center gap-2">
            {mem.lastProjectIds.length > 0 && (
              <span title="Working memory used to resolve follow-ups like “how late is it?”">
                <Pill tone="violet"><Icon name="database" className="h-3 w-3" /> memory: {mem.lastProjectIds.slice(0, 3).join(", ")}</Pill>
              </span>
            )}
            {messages.length > 0 && (
              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => void clearConversation()}>
                <Icon name="trash" className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </header>

        <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          {messages.length === 0 && (
            <div>
              <EmptyState icon="chat" title="Ask about projects, delays or documents">
                Every answer comes from real tool calls against the seeded dataset or from BM25 retrieval over the knowledge base. Open the trace to see each step.
              </EmptyState>
              <div className="grid gap-2 sm:grid-cols-2">
                {SAMPLE_QUESTIONS.map((s) => (
                  <button key={s.q} onClick={() => void send(s.q)} disabled={running} className="flex items-start gap-2 rounded-lg border border-slate-200 p-3 text-left text-sm text-slate-700 transition hover:border-brand-500 hover:bg-brand-50/50">
                    <span className="flex-1">{s.q}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{s.tag}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-sm text-white">{m.text}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                  <Icon name="building" className="h-3.5 w-3.5" />
                </span>
                <div className={`min-w-0 flex-1 rounded-2xl rounded-tl-md border bg-white p-4 ${trace?.id === m.traceId ? "border-brand-500/60" : "border-slate-200"}`}>
                  {m.answer ? <AnswerView answer={m.answer} /> : <p className="text-sm">{m.text}</p>}
                  {m.traceId && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                      <button className="btn-secondary px-2.5 py-1 text-xs" onClick={() => setSelectedTrace(m.traceId!)}>
                        <Icon name="trace" className="h-3.5 w-3.5" /> Show execution trace
                      </button>
                      <a className="btn-ghost px-2.5 py-1 text-xs" href={`#/trace/${m.traceId}`}>Open full trace →</a>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
          {running && (
            <div className="flex items-center gap-2 pl-10 text-sm text-slate-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" /> Planning and executing tools…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="flex gap-2 border-t border-slate-200 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="ask" className="sr-only">Ask a question</label>
          <input
            id="ask"
            className="input"
            placeholder="e.g. How late is BM-101 and what does the contract say about recovery schedules?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={500}
            autoComplete="off"
          />
          <button className="btn-primary" disabled={running || !input.trim()} aria-label="Send">
            <Icon name="send" /> <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </section>

      <aside className="card h-fit p-4 xl:sticky xl:top-8 xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Agent execution trace</h2>
          {trace && <a href={`#/trace/${trace.id}`} className="text-xs font-medium text-brand-700 hover:underline">Expand</a>}
        </div>
        {trace ? (
          <>
            <p className="mb-4 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600">“{trace.request}”</p>
            <TraceView trace={trace} compact />
          </>
        ) : (
          <EmptyState icon="trace" title="No run selected">The plan, tool calls, validation results and observations for each answer appear here.</EmptyState>
        )}
      </aside>
    </div>
  );
}
