import type { ReactNode } from "react";
import { engine } from "../../app/services";
import { REPO_URL } from "../../config";
import { Icon, PageHeader, Pill } from "../components/ui";

const LOOP = [
  ["Receive request", "User question + working memory loaded from IndexedDB"],
  ["Analyse intent", "Regex/lexicon rules extract intents and entities (project ids, names, filters, thresholds)"],
  ["Create plan", "Ordered goals, each with an argument resolver"],
  ["Select tool", "Next pending goal; arguments resolved from earlier tool results"],
  ["Validate arguments", "JSON-schema-style checks: types, enums, ranges, patterns, unknown keys"],
  ["Execute tool", "Real TypeScript function over the dataset or BM25 index"],
  ["Read result", "Observation recorded; planner may add goals (replanning)"],
  ["Continue / stop", "Loop until goals are done or the 5-step budget is used"],
  ["Compose answer", "Template-based text, tables and extractive quotes with citations"],
  ["Show trace", "Every event is persisted and displayed"],
];

export function ArchitecturePage() {
  const tools = engine.registry.list();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Architecture"
        subtitle="A static React app with a deterministic agent engine and local RAG. There is no backend, no external model and no API key."
        actions={<a className="btn-secondary" href={REPO_URL} target="_blank" rel="noreferrer"><Icon name="github" /> Source code</a>}
      />

      <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">What this demo is, and what it is not</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>The agent is <strong>deterministic and rule-based</strong>. It does not use a large language model, and the same input always produces the same plan and answer.</li>
          <li>Answers are assembled from tool outputs and quoted document passages. The engine does not write free-form prose.</li>
          <li>The public site does <strong>not</strong> connect to the MCP server. The MCP server is a separate Python project that you run locally.</li>
          <li>This is a portfolio demo, not a production-grade autonomous AI system. All project data and documents are fictional.</li>
        </ul>
      </section>

      <section className="card mb-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-900">System overview</h2>
        <div className="grid gap-4 lg:grid-cols-[1fr_auto_16rem]">
          <div className="rounded-xl border-2 border-brand-600/30 bg-brand-50/40 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900"><Icon name="layers" /> Browser (static site on Vercel / GitHub Pages)</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Box title="React UI" icon="dashboard">Dashboard · Assistant · Knowledge Base · Projects · Trace</Box>
              <Box title="Agent Engine" icon="brain">AgentPlanner · ToolRegistry · ToolExecutor · ExecutionContext · AgentMemory · ExecutionTrace</Box>
              <Box title="Business tools" icon="tool">search_projects · get_project_details · get_delayed_projects · calculate_project_delay</Box>
              <Box title="RAG engine" icon="search">PDF.js extraction → chunker → BM25 index → search_knowledge_base</Box>
              <Box title="Seed data" icon="building">10 projects (JSON) + 7 sample documents</Box>
              <Box title="IndexedDB" icon="database">documents · chunks · conversation · memory · traces</Box>
            </div>
          </div>
          <div className="flex items-center justify-center text-xs text-slate-400 lg:flex-col">
            <span className="rounded-full border border-dashed border-slate-300 px-3 py-1">no connection</span>
          </div>
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800"><Icon name="server" /> Local only: Python MCP server</p>
            <Box title="buildmind-mcp" icon="server">Official MCP Python SDK (FastMCP) over stdio, exposing search_projects, get_project_details and get_delayed_projects from the same JSON seed data.</Box>
            <p className="mt-3 text-xs text-slate-500">Test it with MCP Inspector or any MCP client. See <code className="font-mono">mcp-server/README.md</code>.</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Agent loop (max {engine.maxSteps} tool steps)</h2>
          <ol className="space-y-2.5">
            {LOOP.map(([t, d], i) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold text-white">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{t}</p>
                  <p className="text-xs text-slate-600">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">RAG pipeline</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {["PDF/TXT upload", "PDF.js text per page", "Paragraph chunking (~110 words, page-bounded)", "Tokenise + stem", "BM25 (k1 = 1.4, b = 0.75)", "Top-k chunks", "Extractive quotes + citations"].map((s, i, a) => (
                <span key={s} className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-1 font-medium text-slate-700">{s}</span>
                  {i < a.length - 1 && <Icon name="chevron" className="h-3 w-3 text-slate-400" />}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-600">Each citation keeps the chunk id, document, page (for PDFs) and section heading, and the UI shows the exact chunk text that was retrieved.</p>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Registered tools</h2>
            <ul className="space-y-3">
              {tools.map((t) => (
                <li key={t.name}>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="font-mono text-sm font-semibold text-slate-900">{t.name}</code>
                    <Pill tone={t.category === "knowledge" ? "violet" : "brand"}>{t.category}</Pill>
                  </div>
                  <p className="text-xs text-slate-600">{t.description}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                    ({Object.entries(t.parameters.properties).map(([k, p]) => `${k}${t.parameters.required.includes(k) ? "" : "?"}: ${p.enum ? p.enum.join("|") : p.type}`).join(", ")})
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Stack</h2>
            <div className="flex flex-wrap gap-1.5">
              {["React 19", "TypeScript", "Vite", "Tailwind CSS 4", "IndexedDB (idb)", "PDF.js", "Vitest", "Python 3.12+", "MCP Python SDK", "pytest"].map((s) => <Pill key={s}>{s}</Pill>)}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Box({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Icon name={icon} className="h-3.5 w-3.5 text-brand-700" /> {title}</p>
      <p className="mt-1 text-xs text-slate-600">{children}</p>
    </div>
  );
}
