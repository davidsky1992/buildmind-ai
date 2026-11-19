import { useState } from "react";
import type { AgentAnswer, Citation } from "../../agent/composer";
import { Highlighted, Icon, RichText } from "./ui";

export function AnswerView({ answer }: { answer: AgentAnswer }) {
  const [active, setActive] = useState<number | null>(null);
  const cite = (n: number) => setActive((cur) => (cur === n ? null : n));

  return (
    <div className="space-y-3 text-sm leading-relaxed text-slate-700">
      {answer.blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return <h3 key={i} className="pt-1 text-[15px] font-semibold text-slate-900">{b.text}</h3>;
          case "text":
            return <p key={i}><RichText text={b.text} onCite={cite} /></p>;
          case "warning":
            return (
              <div key={i} className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
                <span><RichText text={b.text} /></span>
              </div>
            );
          case "bullets":
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {b.items.map((it, j) => <li key={j}><RichText text={it} onCite={cite} /></li>)}
              </ul>
            );
          case "kv":
            return (
              <dl key={i} className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-lg bg-slate-50 p-3 sm:grid-cols-[minmax(0,12rem)_1fr]">
                {b.rows.map(([k, v], j) => (
                  <div key={j} className="contents">
                    <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 sm:pt-0.5">{k}</dt>
                    <dd className="text-slate-800">{v}</dd>
                  </div>
                ))}
              </dl>
            );
          case "table":
            return (
              <div key={i} className="scrollbar-thin overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>{b.columns.map((c) => <th key={c} className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">{c}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {b.rows.map((r, j) => (
                      <tr key={j}>{r.map((c, k) => <td key={k} className={`px-3 py-2 ${k === 0 ? "font-medium text-slate-900" : "whitespace-nowrap"}`}>{c}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case "quote":
            return (
              <blockquote key={i} className="rounded-r-lg border-l-4 border-brand-500 bg-brand-50/60 py-2 pl-3 pr-2 text-slate-800">
                “{b.text}” <RichText text={`[${b.citation}]`} onCite={cite} />
              </blockquote>
            );
        }
      })}

      {answer.citations.length > 0 && (
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Retrieved sources: click to show the exact chunk</p>
          {answer.citations.map((c) => (
            <CitationCard key={c.n} c={c} open={active === c.n} onToggle={() => cite(c.n)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CitationCard({ c, open, onToggle }: { c: Citation; open: boolean; onToggle: () => void }) {
  return (
    <div className={`rounded-lg border ${open ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200"} bg-white`}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 p-2.5 text-left">
        <span className="mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand-100 px-1 text-[11px] font-semibold text-brand-800">{c.n}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-slate-900">{c.docName}</span>
          <span className="block text-[11px] text-slate-500">
            chunk #{c.chunkId.split("#")[1]}
            {c.page ? ` · page ${c.page}` : ""}
            {c.heading ? ` · ${c.heading}` : ""} · BM25 {c.score.toFixed(2)}
          </span>
        </span>
        <Icon name="chevron" className={`mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 px-3 pb-3 pt-2 text-xs leading-relaxed text-slate-700">
          <p className="whitespace-pre-line"><Highlighted text={c.text} terms={c.matchedTerms} /></p>
          <p className="mt-2 text-[11px] text-slate-500">Matched terms: {c.matchedTerms.join(", ")}</p>
        </div>
      )}
    </div>
  );
}
