import { useMemo } from "react";
import { askHref } from "../../app/router";
import { SAMPLE_QUESTIONS, knowledgeBase } from "../../app/services";
import { useAppState } from "../../app/state";
import { AS_OF_DATE, PROJECTS, PROJECT_STATUSES, computeDelay, formatDate, formatUSD, formatUSDFull } from "../../tools/projectData";
import { Icon, PageHeader, StatusBadge } from "../components/ui";

export function DashboardPage() {
  const { kbVersion, traces } = useAppState();
  const rows = useMemo(() => PROJECTS.map((p) => ({ p, d: computeDelay(p) })), []);
  const active = rows.filter(({ p }) => p.status !== "Completed");
  const delayed = active.filter(({ d }) => d.delayDays > 0).sort((a, b) => b.d.delayDays - a.d.delayDays);
  const totalValue = PROJECTS.reduce((s, p) => s + p.contractValue, 0);
  const exposure = delayed.reduce((s, { d }) => s + d.liquidatedDamagesExposureCapped, 0);
  const maxDelay = Math.max(...rows.map(({ d }) => Math.abs(d.delayDays)), 1);
  const docs = useMemo(() => knowledgeBase.listDocuments(), [kbVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mx-auto max-w-7xl">
      <section className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Runs entirely in your browser · no login · no API key
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Construction portfolio assistant with a transparent agent engine</h1>
            <p className="mt-3 text-sm text-brand-100/90 sm:text-base">
              Ask a question and watch a <strong className="text-white">deterministic, rule-based agent</strong> plan, call real TypeScript tools,
              retrieve document passages with BM25 and cite its sources. There is no LLM, so every step is reproducible.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#/assistant" className="btn bg-white text-brand-900 hover:bg-brand-50"><Icon name="chat" /> Open assistant</a>
            <a href="#/architecture" className="btn border border-white/30 text-white hover:bg-white/10"><Icon name="layers" /> How it works</a>
          </div>
        </div>
      </section>

      <PageHeader title="Portfolio dashboard" subtitle={`Seeded demo data for 10 fictional projects · schedule figures as of ${formatDate(AS_OF_DATE)}`} />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Active projects" value={String(active.length)} hint={`${PROJECTS.length} total in portfolio`} icon="building" />
        <Kpi label="Forecast late" value={String(delayed.length)} hint={`${delayed.filter(({ d }) => d.delayDays > 14).length} more than 14 days late`} icon="alert" tone="rose" />
        <Kpi label="Portfolio value" value={formatUSD(totalValue)} hint="sum of contract values" icon="layers" />
        <Kpi label="LD exposure" value={formatUSD(exposure)} hint="capped at 10% per project" icon="trace" tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Schedule variance by project</h2>
            <span className="text-xs text-slate-500">days vs contract completion</span>
          </div>
          <ul className="space-y-2.5">
            {[...rows].sort((a, b) => b.d.delayDays - a.d.delayDays).map(({ p, d }) => (
              <li key={p.id} className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-3 text-sm sm:grid-cols-[13rem_1fr_3.5rem]">
                <a href={`#/projects/${p.id}`} className="truncate font-medium text-slate-700 hover:text-brand-700" title={p.name}>
                  <span className="text-slate-900">{p.id}</span>
                  <span className="hidden text-slate-500 sm:inline"> · {p.name.split(" ").slice(0, 2).join(" ")}</span>
                </a>
                <div className="relative h-5 rounded bg-slate-100">
                  <div className="absolute inset-y-0 left-1/4 w-px bg-slate-300" />
                  {d.delayDays > 0 ? (
                    <div className={`absolute inset-y-0 left-1/4 rounded-r ${d.delayDays > 14 ? "bg-rose-500" : "bg-amber-400"}`} style={{ width: `${(d.delayDays / maxDelay) * 75}%` }} />
                  ) : d.delayDays < 0 ? (
                    <div className="absolute inset-y-0 rounded-l bg-emerald-500" style={{ right: "75%", width: `${(-d.delayDays / maxDelay) * 25 * 3}%`, maxWidth: "25%" }} />
                  ) : (
                    <div className="absolute inset-y-1 left-1/4 w-1 -translate-x-1/2 rounded bg-emerald-500" />
                  )}
                </div>
                <span className={`text-right font-mono text-xs ${d.delayDays > 14 ? "text-rose-600" : d.delayDays > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {d.delayDays > 0 ? `+${d.delayDays}` : d.delayDays}d
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
            <Legend color="bg-emerald-500" label="On time / early" />
            <Legend color="bg-amber-400" label="1-14 days late" />
            <Legend color="bg-rose-500" label="> 14 days late (recovery schedule)" />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Try a sample question</h2>
          <div className="space-y-2">
            {SAMPLE_QUESTIONS.slice(0, 6).map((s) => (
              <a key={s.q} href={askHref(s.q)} className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm transition hover:border-brand-500 hover:bg-brand-50/50">
                <Icon name="chat" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                <span className="flex-1 text-slate-700 group-hover:text-slate-900">{s.q}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{s.tag}</span>
              </a>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-semibold text-slate-900">Projects forecast to finish late</h2>
            <a href="#/projects" className="text-xs font-medium text-brand-700 hover:underline">All projects →</a>
          </div>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-2 text-left font-medium">Project</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Days late</th>
                  <th className="px-3 py-2 text-left font-medium">Forecast</th>
                  <th className="px-5 py-2 text-right font-medium">LD exposure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {delayed.map(({ p, d }) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-5 py-2.5"><a href={`#/projects/${p.id}`} className="font-medium text-slate-900 hover:text-brand-700">{p.id} · {p.name}</a></td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5 text-right font-mono">{d.delayDays}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-slate-600">{formatDate(d.completionDate)}</td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right">{formatUSDFull(d.liquidatedDamagesExposureCapped)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">At a glance</h2>
          <dl className="space-y-3 text-sm">
            {PROJECT_STATUSES.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <dt><StatusBadge status={s} /></dt>
                <dd className="font-mono text-slate-700">{PROJECTS.filter((p) => p.status === s).length}</dd>
              </div>
            ))}
            <div className="border-t border-slate-100 pt-3" />
            <div className="flex justify-between"><dt className="text-slate-600">Knowledge base documents</dt><dd className="font-mono">{docs.length}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Indexed chunks</dt><dd className="font-mono">{knowledgeBase.chunkCount}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-600">Agent runs saved</dt><dd className="font-mono">{traces.length}</dd></div>
          </dl>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, icon, tone = "brand" }: { label: string; value: string; hint: string; icon: string; tone?: "brand" | "rose" | "amber" }) {
  const tones = { brand: "bg-brand-50 text-brand-700", rose: "bg-rose-50 text-rose-600", amber: "bg-amber-50 text-amber-700" };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <span className={`rounded-md p-1.5 ${tones[tone]}`}><Icon name={icon} className="h-3.5 w-3.5" /></span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${color}`} />{label}</span>;
}
