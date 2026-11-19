import type { ReactNode } from "react";
import type { ProjectStatus } from "../../tools/projectData";

const PATHS: Record<string, string> = {
  dashboard: "M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z",
  chat: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
  book: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5",
  building: "M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01",
  trace: "M3 12h4l3-9 4 18 3-9h4",
  layers: "m12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5",
  send: "m22 2-7 20-4-9-9-4zM22 2 11 13",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35",
  check: "M20 6 9 17l-5-5",
  x: "M18 6 6 18M6 6l12 12",
  alert: "M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01",
  menu: "M3 12h18M3 6h18M3 18h18",
  chevron: "m9 18 6-6-6-6",
  tool: "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z",
  brain: "M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18zm0 0a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18z",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  github: "M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-6v-4m0-4h.01",
  database: "M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5",
  server: "M2 4h20v6H2zm0 10h20v6H2zM6 7h.01M6 17h.01",
};

export function Icon({ name, className = "h-4 w-4" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.info} />
    </svg>
  );
}

const STATUS_STYLES: Record<ProjectStatus, string> = {
  "On Track": "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "At Risk": "bg-amber-50 text-amber-800 ring-amber-600/20",
  Delayed: "bg-rose-50 text-rose-700 ring-rose-600/20",
  Completed: "bg-sky-50 text-sky-700 ring-sky-600/20",
  "On Hold": "bg-slate-100 text-slate-700 ring-slate-500/20",
};

export function StatusBadge({ status }: { status: ProjectStatus | string }) {
  const cls = STATUS_STYLES[status as ProjectStatus] ?? "bg-slate-100 text-slate-700 ring-slate-500/20";
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}>{status}</span>;
}

export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "brand" | "amber" | "rose" | "violet" | "sky" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    brand: "bg-brand-50 text-brand-800",
    amber: "bg-amber-50 text-amber-800",
    rose: "bg-rose-50 text-rose-700",
    violet: "bg-violet-50 text-violet-700",
    sky: "bg-sky-50 text-sky-700",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Renders **bold**, *italic*, `code` and [n] citation markers. */
export function RichText({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\d+\])/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold text-slate-900">{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]">{p.slice(1, -1)}</code>;
        const m = /^\[(\d+)\]$/.exec(p);
        if (m && onCite) return <CiteChip key={i} n={Number(m[1])} onClick={() => onCite(Number(m[1]))} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

export function CiteChip({ n, onClick }: { n: number; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-brand-100 px-1 align-text-top text-[11px] font-semibold text-brand-800 hover:bg-brand-500 hover:text-white"
      title={`Show source [${n}]`}
      aria-label={`Show source ${n}`}
    >
      {n}
    </button>
  );
}

export function JsonView({ value, maxHeight = "max-h-72" }: { value: unknown; maxHeight?: string }) {
  return (
    <pre className={`scrollbar-thin overflow-auto rounded-lg bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-100 ${maxHeight}`}>
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">
        <Icon name={icon} className="h-6 w-6" />
      </div>
      <p className="font-medium text-slate-800">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

/** Highlights words whose stem appears in `terms` (BM25 matched terms). */
export function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  if (!terms.length) return <>{text}</>;
  const set = terms.map((t) => t.toLowerCase());
  const tokens = text.split(/([A-Za-z0-9]+(?:\.[0-9]+)*)/);
  return (
    <>
      {tokens.map((tok, i) => {
        const lower = tok.toLowerCase();
        const hit = /[a-z0-9]/i.test(tok) && set.some((t) => lower === t || (t.length >= 3 && lower.startsWith(t)));
        return hit ? (
          <mark key={i} className="rounded bg-amber-100 px-0.5 text-slate-900">
            {tok}
          </mark>
        ) : (
          <span key={i}>{tok}</span>
        );
      })}
    </>
  );
}
