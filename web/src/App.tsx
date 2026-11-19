import { useEffect, useState } from "react";
import { useRoute, type Route } from "./app/router";
import { AppStateProvider, useAppState } from "./app/state";
import { Icon } from "./ui/components/ui";
import { DashboardPage } from "./ui/pages/DashboardPage";
import { AssistantPage } from "./ui/pages/AssistantPage";
import { KnowledgePage } from "./ui/pages/KnowledgePage";
import { ProjectsPage } from "./ui/pages/ProjectsPage";
import { TracePage } from "./ui/pages/TracePage";
import { ArchitecturePage } from "./ui/pages/ArchitecturePage";

const NAV: { page: Route["page"]; label: string; icon: string }[] = [
  { page: "dashboard", label: "Dashboard", icon: "dashboard" },
  { page: "assistant", label: "AI Assistant", icon: "chat" },
  { page: "knowledge", label: "Knowledge Base", icon: "book" },
  { page: "projects", label: "Projects", icon: "building" },
  { page: "trace", label: "Execution Trace", icon: "trace" },
  { page: "architecture", label: "Architecture", icon: "layers" },
];


export default function App() {
  return (
    <AppStateProvider>
      <Shell />
    </AppStateProvider>
  );
}

function Shell() {
  const route = useRoute();
  const { ready, error } = useAppState();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    setMenuOpen(false);
  }, [route]);
  useEffect(() => {
    document.title = `${NAV.find((n) => n.page === route.page)?.label ?? "BuildMind"} · BuildMind AI`;
  }, [route.page]);

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button className="btn-ghost px-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation" aria-expanded={menuOpen}>
          <Icon name={menuOpen ? "x" : "menu"} className="h-5 w-5" />
        </button>
      </header>

      <aside
        className={`${menuOpen ? "block" : "hidden"} fixed inset-x-0 top-[57px] z-20 border-b border-slate-200 bg-white p-3 shadow-lg lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r lg:p-4 lg:shadow-none`}
      >
        <div className="mb-6 hidden lg:block"><Brand /></div>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = route.page === n.page;
            return (
              <a
                key={n.page}
                href={`#/${n.page}`}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={n.icon} className={`h-4 w-4 ${active ? "text-brand-700" : "text-slate-400"}`} />
                {n.label}
              </a>
            );
          })}
        </nav>
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 lg:absolute lg:bottom-4 lg:left-4 lg:right-4">
          <p className="font-semibold text-slate-800">100% in your browser</p>
          <p className="mt-1">Deterministic agent, no LLM, no API keys, no backend. Data is stored in IndexedDB on this device.</p>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        {error ? (
          <div className="card mx-auto max-w-xl p-6 text-sm text-rose-700">{error}</div>
        ) : !ready ? (
          <div className="flex h-64 items-center justify-center text-sm text-slate-500">Loading knowledge base…</div>
        ) : (
          <Page route={route} />
        )}
      </main>
    </div>
  );
}

function Brand() {
  return (
    <a href="#/dashboard" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white">
        <Icon name="building" className="h-4.5 w-4.5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold text-slate-900">BuildMind AI</span>
        <span className="block text-[11px] text-slate-500">Construction project assistant</span>
      </span>
    </a>
  );
}

function Page({ route }: { route: Route }) {
  switch (route.page) {
    case "dashboard":
      return <DashboardPage />;
    case "assistant":
      return <AssistantPage ask={route.ask} />;
    case "knowledge":
      return <KnowledgePage />;
    case "projects":
      return <ProjectsPage selectedId={route.id} />;
    case "trace":
      return <TracePage selectedId={route.id} />;
    case "architecture":
      return <ArchitecturePage />;
  }
}
