import { useMemo, useRef, useState } from "react";
import { knowledgeBase } from "../../app/services";
import { useAppState } from "../../app/state";
import { MAX_UPLOAD_BYTES } from "../../rag/knowledgeBase";
import type { KnowledgeDocument, SearchHit } from "../../rag/types";
import { EmptyState, Highlighted, Icon, PageHeader, Pill } from "../components/ui";

const BASE = import.meta.env.BASE_URL;

export function KnowledgePage() {
  const { kbVersion } = useAppState();
  const docs = useMemo(() => knowledgeBase.listDocuments(), [kbVersion]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedDoc = docs.find((d) => d.id === selected) ?? null;
  const chunks = useMemo(() => (selected ? knowledgeBase.chunksFor(selected) : []), [selected, kbVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  async function upload(files: FileList | File[]) {
    setMessage(null);
    for (const file of Array.from(files)) {
      setBusy(`Extracting and indexing ${file.name}…`);
      try {
        const doc = await knowledgeBase.addFile(file);
        setSelected(doc.id);
        setMessage({ tone: "ok", text: `Indexed “${doc.name}”: ${doc.chunkCount} chunks${doc.pageCount ? ` from ${doc.pageCount} pages` : ""}. Ask the assistant about it.` });
      } catch (e) {
        setMessage({ tone: "err", text: `${file.name}: ${(e as Error).message}` });
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
    if (query) setHits(knowledgeBase.search(query, 6));
  }

  async function remove(d: KnowledgeDocument) {
    if (!confirm(`Remove “${d.name}” from the knowledge base?`)) return;
    await knowledgeBase.removeDocument(d.id);
    if (selected === d.id) setSelected(null);
    if (query) setHits(knowledgeBase.search(query, 6));
  }

  async function reset() {
    if (!confirm("Delete all uploaded documents and restore the sample set?")) return;
    setBusy("Restoring samples…");
    await knowledgeBase.resetToSamples();
    setSelected(null);
    setHits(null);
    setBusy(null);
    setMessage({ tone: "ok", text: "Knowledge base restored to the 7 sample documents." });
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Knowledge Base"
        subtitle="Upload PDF or TXT files. Text is extracted in the browser (PDF.js), split into chunks, indexed with BM25 and saved in IndexedDB, so nothing is uploaded to a server."
        actions={<button className="btn-secondary" onClick={() => void reset()}><Icon name="refresh" /> Reset to samples</button>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <div className="space-y-6">
          <section
            className={`card border-2 border-dashed p-5 text-center transition ${drag ? "border-brand-500 bg-brand-50" : "border-slate-300"}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }}
          >
            <Icon name="upload" className="mx-auto h-7 w-7 text-brand-600" />
            <p className="mt-2 text-sm font-medium text-slate-800">Drop PDF / TXT files here</p>
            <p className="text-xs text-slate-500">Up to {MAX_UPLOAD_BYTES / 1024 / 1024} MB each · text-based PDFs (no OCR)</p>
            <input ref={fileRef} type="file" accept=".pdf,.txt,.md,application/pdf,text/plain" multiple className="hidden" onChange={(e) => e.target.files && void upload(e.target.files)} />
            <button className="btn-primary mt-3" disabled={!!busy} onClick={() => fileRef.current?.click()}>Choose files</button>
            <div className="mt-4 border-t border-slate-100 pt-3 text-left text-xs text-slate-600">
              <p className="mb-1 font-medium text-slate-700">Need a file to test with?</p>
              <a className="flex items-center gap-1.5 text-brand-700 hover:underline" href={`${BASE}samples/BM-107-Metro-Line-3-Delay-Notice.pdf`} download>
                <Icon name="download" className="h-3.5 w-3.5" /> BM-107 Delay Notice (2-page PDF)
              </a>
              <a className="mt-1 flex items-center gap-1.5 text-brand-700 hover:underline" href={`${BASE}samples/Site-Logistics-Plan-Harbor-Point.txt`} download>
                <Icon name="download" className="h-3.5 w-3.5" /> Harbor Point Site Logistics Plan (TXT)
              </a>
              <p className="mt-2 text-slate-500">After uploading the PDF, ask: <em>“What caused the delay in the BM-107 delay notice?”</em></p>
            </div>
          </section>

          {busy && <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{busy}</p>}
          {message && (
            <p className={`rounded-lg p-3 text-sm ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{message.text}</p>
          )}

          <section className="card divide-y divide-slate-100">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-900">Documents ({docs.length})</h2>
              <span className="text-xs text-slate-500">{knowledgeBase.chunkCount} chunks indexed</span>
            </div>
            {docs.map((d) => (
              <div key={d.id} className={`group flex items-start gap-3 px-4 py-3 ${selected === d.id ? "bg-brand-50/60" : "hover:bg-slate-50"}`}>
                <button className="flex min-w-0 flex-1 items-start gap-3 text-left" onClick={() => setSelected(d.id)}>
                  <span className={`mt-0.5 rounded p-1 ${d.mimeType === "application/pdf" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"}`}>
                    <Icon name="file" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900" title={d.name}>{d.name}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1">
                      <Pill tone={d.source === "upload" ? "brand" : "slate"}>{d.source === "upload" ? "uploaded" : "sample"}</Pill>
                      <Pill>{d.category}</Pill>
                      <Pill>{d.chunkCount} chunks</Pill>
                    </span>
                  </span>
                </button>
                <button className="rounded p-1 text-slate-400 opacity-60 hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100" onClick={() => void remove(d)} aria-label={`Remove ${d.name}`}>
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>
            ))}
          </section>
        </div>

        <div className="min-w-0 space-y-6">
          <section className="card p-5">
            <h2 className="mb-1 font-semibold text-slate-900">Test retrieval</h2>
            <p className="mb-3 text-xs text-slate-500">Runs the same BM25 search that the agent's <code className="font-mono">search_knowledge_base</code> tool uses.</p>
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setHits(knowledgeBase.search(query, 6)); }}>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. excavation protective system depth" />
              <button className="btn-primary" disabled={!query.trim()}><Icon name="search" /> Search</button>
            </form>
            {hits && (
              <div className="mt-4 space-y-3">
                {hits.length === 0 && <p className="text-sm text-slate-500">No chunk contains any of the query terms.</p>}
                {hits.map((h, i) => (
                  <div key={h.chunk.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-slate-900">#{i + 1}</span>
                      <button className="font-medium text-brand-700 hover:underline" onClick={() => setSelected(h.chunk.docId)}>{h.chunk.docName}</button>
                      <span className="text-slate-500">chunk {h.chunk.index}{h.chunk.page ? ` · page ${h.chunk.page}` : ""}{h.chunk.heading ? ` · ${h.chunk.heading}` : ""}</span>
                      <Pill tone="amber">BM25 {h.score.toFixed(3)}</Pill>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700"><Highlighted text={h.chunk.text} terms={h.matchedTerms} /></p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card p-5">
            {selectedDoc ? (
              <>
                <div className="mb-4 flex flex-col gap-1">
                  <h2 className="font-semibold text-slate-900">{selectedDoc.name}</h2>
                  <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span>Type: {selectedDoc.mimeType === "application/pdf" ? "PDF" : "Text"}</span>
                    <span>Size: {(selectedDoc.sizeBytes / 1024).toFixed(1)} KB</span>
                    {selectedDoc.pageCount && <span>Pages: {selectedDoc.pageCount}</span>}
                    <span>Words: {selectedDoc.wordCount.toLocaleString()}</span>
                    <span>Chunks: {selectedDoc.chunkCount}</span>
                    <span>Added: {new Date(selectedDoc.addedAt).toLocaleString()}</span>
                  </dl>
                </div>
                <ol className="space-y-2">
                  {chunks.map((c) => (
                    <li key={c.id} className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-1 font-mono text-[11px] text-slate-500">{c.id}{c.page ? ` · p.${c.page}` : ""}{c.heading ? ` · ${c.heading}` : ""} · {c.wordCount} words</p>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{c.text}</p>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <EmptyState icon="book" title="Select a document">See its metadata and the exact chunks the retriever can cite.</EmptyState>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
