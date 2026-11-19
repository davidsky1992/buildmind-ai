import { tokenize } from "./text";
import type { DocumentChunk, SearchHit } from "./types";

interface IndexedChunk {
  chunk: DocumentChunk;
  tf: Map<string, number>;
  length: number;
}

/**
 * Okapi BM25 over document chunks.
 *   score(q, d) = Σ IDF(t) · tf(t,d)·(k1+1) / (tf(t,d) + k1·(1 − b + b·|d|/avgdl))
 *   IDF(t)      = ln(1 + (N − df(t) + 0.5) / (df(t) + 0.5))
 * The document name and section heading are indexed with the chunk body so a query
 * like "safety manual fall protection" can match on both.
 */
export class BM25Index {
  private docs: IndexedChunk[] = [];
  private df = new Map<string, number>();
  private totalLength = 0;

  constructor(
    private readonly k1 = 1.4,
    private readonly b = 0.75,
  ) {}

  get size(): number {
    return this.docs.length;
  }

  clear(): void {
    this.docs = [];
    this.df.clear();
    this.totalLength = 0;
  }

  addAll(chunks: DocumentChunk[]): void {
    for (const c of chunks) this.add(c);
  }

  add(chunk: DocumentChunk): void {
    const title = chunk.docName.replace(/\.(txt|pdf)$/i, "");
    const terms = tokenize(`${title} ${chunk.heading ?? ""} ${chunk.text}`);
    const tf = new Map<string, number>();
    for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.docs.push({ chunk, tf, length: terms.length });
    this.totalLength += terms.length;
  }

  idf(term: string): number {
    const n = this.docs.length;
    const df = this.df.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  search(query: string, topK = 5, filter?: (c: DocumentChunk) => boolean): SearchHit[] {
    const qTerms = [...new Set(tokenize(query))];
    if (!qTerms.length || !this.docs.length) return [];
    const avgdl = this.totalLength / this.docs.length;
    const hits: SearchHit[] = [];
    for (const d of this.docs) {
      if (filter && !filter(d.chunk)) continue;
      let score = 0;
      const matched: string[] = [];
      for (const t of qTerms) {
        const f = d.tf.get(t);
        if (!f) continue;
        matched.push(t);
        score += (this.idf(t) * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.length) / avgdl));
      }
      if (score > 0) hits.push({ chunk: d.chunk, score, matchedTerms: matched });
    }
    hits.sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));
    return hits.slice(0, topK);
  }
}
