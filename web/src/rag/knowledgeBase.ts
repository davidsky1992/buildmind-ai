import { SAMPLE_DOCUMENTS } from "../data/sampleDocuments";
import { getDb, kvGet, kvSet } from "../storage/db";
import { BM25Index } from "./bm25";
import { chunkDocument } from "./chunker";
import { countWords } from "./text";
import type { DocumentChunk, KnowledgeDocument, PageText, SearchHit } from "./types";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const SEED_KEY = "kb-seed-version";
const SEED_VERSION = 1;

type PdfExtractor = (data: ArrayBuffer) => Promise<{ pages: PageText[]; pageCount: number }>;

/**
 * Local knowledge base: documents and chunks persisted in IndexedDB,
 * BM25 index rebuilt in memory on load and after every change.
 */
export class KnowledgeBase {
  private index = new BM25Index();
  private documents: KnowledgeDocument[] = [];
  private chunks = new Map<string, DocumentChunk>();
  private listeners = new Set<() => void>();
  private ready: Promise<void> | null = null;

  /** PDF extraction is injected lazily so PDF.js is only loaded when needed. */
  constructor(private readonly pdfExtractor: () => Promise<PdfExtractor> = async () => (await import("./pdf")).extractPdfPages) {}

  init(): Promise<void> {
    this.ready ??= (async () => {
      if ((await kvGet<number>(SEED_KEY)) !== SEED_VERSION) await this.seedSamples();
      await this.reload();
    })();
    return this.ready;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  listDocuments(): KnowledgeDocument[] {
    return [...this.documents].sort((a, b) => (a.source === b.source ? a.name.localeCompare(b.name) : a.source === "upload" ? -1 : 1));
  }

  get chunkCount(): number {
    return this.index.size;
  }

  getChunk(id: string): DocumentChunk | undefined {
    return this.chunks.get(id);
  }

  chunksFor(docId: string): DocumentChunk[] {
    return [...this.chunks.values()].filter((c) => c.docId === docId).sort((a, b) => a.index - b.index);
  }

  search(query: string, topK = 4): SearchHit[] {
    return this.index.search(query, topK);
  }

  /** Adds a user-uploaded PDF or TXT file. */
  async addFile(file: File): Promise<KnowledgeDocument> {
    if (file.size > MAX_UPLOAD_BYTES) throw new Error(`File is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isTxt = file.type.startsWith("text/") || /\.(txt|md)$/i.test(file.name);
    if (!isPdf && !isTxt) throw new Error("Only PDF and TXT files are supported.");

    if (isPdf) {
      const extract = await this.pdfExtractor();
      const { pages, pageCount } = await extract(await file.arrayBuffer());
      if (!pages.length) throw new Error("No extractable text found. The PDF may be a scanned image (OCR is not supported).");
      return this.addPages({ name: file.name, mimeType: "application/pdf", category: "Uploaded", source: "upload", sizeBytes: file.size, pageCount }, pages);
    }
    const text = await file.text();
    if (!text.trim()) throw new Error("The text file is empty.");
    return this.addPages({ name: file.name, mimeType: "text/plain", category: "Uploaded", source: "upload", sizeBytes: file.size, pageCount: null }, [{ page: null, text }]);
  }

  async addPages(
    meta: Omit<KnowledgeDocument, "id" | "chunkCount" | "wordCount" | "addedAt"> & { id?: string },
    pages: PageText[],
  ): Promise<KnowledgeDocument> {
    const id = meta.id ?? `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const chunks = chunkDocument(id, meta.name, pages);
    const doc: KnowledgeDocument = {
      ...meta,
      id,
      chunkCount: chunks.length,
      wordCount: pages.reduce((n, p) => n + countWords(p.text), 0),
      addedAt: new Date().toISOString(),
    };
    const db = await getDb();
    const tx = db.transaction(["documents", "chunks"], "readwrite");
    await tx.objectStore("documents").put(doc);
    for (const c of chunks) await tx.objectStore("chunks").put(c);
    await tx.done;
    await this.reload();
    return doc;
  }

  async removeDocument(id: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["documents", "chunks"], "readwrite");
    await tx.objectStore("documents").delete(id);
    const keys = await tx.objectStore("chunks").index("byDoc").getAllKeys(id);
    for (const k of keys) await tx.objectStore("chunks").delete(k);
    await tx.done;
    await this.reload();
  }

  /** Deletes every document (including uploads) and restores the sample set. */
  async resetToSamples(): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(["documents", "chunks"], "readwrite");
    await tx.objectStore("documents").clear();
    await tx.objectStore("chunks").clear();
    await tx.done;
    await this.seedSamples();
    await this.reload();
  }

  private async seedSamples(): Promise<void> {
    for (const s of SAMPLE_DOCUMENTS) {
      const chunks = chunkDocument(s.id, s.name, [{ page: null, text: s.text }]);
      const doc: KnowledgeDocument = {
        id: s.id,
        name: s.name,
        mimeType: "text/plain",
        category: s.category,
        source: "sample",
        sizeBytes: new TextEncoder().encode(s.text).length,
        pageCount: null,
        chunkCount: chunks.length,
        wordCount: countWords(s.text),
        addedAt: new Date().toISOString(),
      };
      const db = await getDb();
      const tx = db.transaction(["documents", "chunks"], "readwrite");
      await tx.objectStore("documents").put(doc);
      for (const c of chunks) await tx.objectStore("chunks").put(c);
      await tx.done;
    }
    await kvSet(SEED_KEY, SEED_VERSION);
  }

  private async reload(): Promise<void> {
    const db = await getDb();
    this.documents = await db.getAll("documents");
    const chunks = await db.getAll("chunks");
    this.chunks = new Map(chunks.map((c) => [c.id, c]));
    this.index = new BM25Index();
    this.index.addAll(chunks.sort((a, b) => a.id.localeCompare(b.id)));
    this.listeners.forEach((fn) => fn());
  }
}
