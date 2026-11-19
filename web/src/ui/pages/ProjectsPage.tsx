import { useMemo, useState } from "react";
import { askHref } from "../../app/router";
import { PROJECTS, PROJECT_STATUSES, computeDelay, findProject, formatDate, formatUSD, formatUSDFull, type Project } from "../../tools/projectData";
import { EmptyState, Icon, PageHeader, StatusBadge } from "../components/ui";

export function ProjectsPage({ selectedId }: { selectedId?: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const selected = selectedId ? findProject(selectedId) : undefined;

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return PROJECTS.filter(
      (p) =>
        (!status || p.status === status) &&
        (!needle || [p.id, p.name, p.type, p.city, p.state, p.client, p.projectManager].join(" ").toLowerCase().includes(needle)),
    );
  }, [q, status]);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="Projects" subtitle="The seeded dataset that the agent's project tools query. Select a project for milestones, risks and the delay calculation." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="card overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-slate-200 p-3 sm:flex-row">
            <input className="input" placeholder="Filter by name, city, client…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter projects" />
            <select className="input sm:w-40" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter">
              <option value="">All statuses</option>
              {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <ul className="divide-y divide-slate-100">
            {list.map((p) => {
              const d = computeDelay(p);
              return (
                <li key={p.id}>
                  <a href={`#/projects/${p.id}`} className={`block px-4 py-3 transition ${selected?.id === p.id ? "bg-brand-50/70" : "hover:bg-slate-50"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{p.id} · {p.name}</p>
                        <p className="text-xs text-slate-500">{p.type} · {p.city}, {p.state} · {formatUSD(p.contractValue)}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                        <div className="h-1.5 rounded-full bg-brand-600" style={{ width: `${p.percentComplete}%` }} />
                      </div>
                      <span className="w-10 text-right text-xs text-slate-600">{p.percentComplete}%</span>
                      <span className={`w-14 text-right font-mono text-xs ${d.delayDays > 14 ? "text-rose-600" : d.delayDays > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                        {d.delayDays > 0 ? `+${d.delayDays}d` : `${d.delayDays}d`}
                      </span>
                    </div>
                  </a>
                </li>
              );
            })}
            {list.length === 0 && <li><EmptyState icon="search" title="No projects match" /></li>}
          </ul>
        </section>

        <section className="card p-5">
          {selected ? <ProjectDetail p={selected} /> : <EmptyState icon="building" title="Select a project">Details come from the same functions the agent tools call.</EmptyState>}
        </section>
      </div>
    </div>
  );
}

function ProjectDetail({ p }: { p: Project }) {
  const d = computeDelay(p);
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{p.name}</h2>
          <StatusBadge status={p.status} />
        </div>
        <p className="text-xs text-slate-500">{p.id} · {p.type} · {p.city}, {p.state} · Client: {p.client}</p>
        <p className="mt-2 text-sm text-slate-700">{p.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Contract value" value={formatUSD(p.contractValue)} />
        <Stat label="Cost to date" value={formatUSD(p.costToDate)} />
        <Stat label="Complete" value={`${p.percentComplete}%`} sub={`${d.timeElapsedPercent}% time elapsed`} />
        <Stat label="Schedule" value={d.delayDays > 0 ? `+${d.delayDays} days` : d.delayDays === 0 ? "On time" : `${-d.delayDays}d early`} tone={d.delayDays > 14 ? "rose" : d.delayDays > 0 ? "amber" : "emerald"} />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Row k="Project manager" v={p.projectManager} />
        <Row k="General contractor" v={p.generalContractor} />
        <Row k="Start" v={formatDate(p.startDate)} />
        <Row k="Contract completion" v={formatDate(p.plannedCompletion)} />
        <Row k={d.completionBasis === "actual" ? "Actual completion" : "Forecast completion"} v={formatDate(d.completionDate)} />
        <Row k="Liquidated damages" v={`${formatUSDFull(p.liquidatedDamagesPerDay)} / day`} />
        {d.delayDays > 0 && <Row k="Estimated LD exposure" v={`${formatUSDFull(d.liquidatedDamagesExposureCapped)} (cap ${formatUSD(d.liquidatedDamagesCap)})`} />}
        <Row k="Contract terms" v={p.contractDocument} />
      </dl>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Milestones</h3>
        <ol className="relative space-y-3 border-l border-slate-200 pl-5">
          {d.milestones.map((m) => (
            <li key={m.name} className="relative">
              <span className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${m.finished ? (m.delayDays > 0 ? "bg-amber-500" : "bg-emerald-500") : "bg-white ring-slate-300 ring-2"}`} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-slate-800">{m.name}</p>
                <p className={`font-mono text-xs ${m.delayDays > 0 ? "text-rose-600" : "text-emerald-700"}`}>{m.delayDays > 0 ? `+${m.delayDays}d` : `${m.delayDays}d`}</p>
              </div>
              <p className="text-xs text-slate-500">
                Planned {formatDate(m.planned)} · {m.finished ? "Actual" : "Forecast"} {formatDate(m.date)}
              </p>
            </li>
          ))}
        </ol>
      </div>

      {p.risks.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">Risks</h3>
          <ul className="space-y-1.5">
            {p.risks.map((r) => (
              <li key={r.title} className="flex items-start gap-2 text-sm text-slate-700">
                <span className={`mt-0.5 rounded px-1.5 text-[10px] font-semibold uppercase ${r.severity === "High" ? "bg-rose-50 text-rose-700" : r.severity === "Medium" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{r.severity}</span>
                {r.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <a className="btn-primary" href={askHref(`How late is ${p.id} and what is the liquidated damages exposure?`)}><Icon name="chat" /> Ask about delay</a>
        <a className="btn-secondary" href={askHref(`Tell me about ${p.id}`)}>Ask for details</a>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "rose" | "amber" | "emerald" }) {
  const c = tone === "rose" ? "text-rose-600" : tone === "amber" ? "text-amber-700" : tone === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-base font-semibold ${c}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1.5">
      <dt className="text-slate-500">{k}</dt>
      <dd className="text-right font-medium text-slate-800">{v}</dd>
    </div>
  );
}
