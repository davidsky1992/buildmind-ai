import type { ToolDefinition } from "../agent/types";

export interface KnowledgeSearchResult {
  query: string;
  indexedChunks: number;
  hits: {
    chunkId: string;
    docId: string;
    docName: string;
    page: number | null;
    heading: string | null;
    score: number;
    matchedTerms: string[];
    text: string;
  }[];
}

export const searchKnowledgeBase: ToolDefinition<KnowledgeSearchResult> = {
  name: "search_knowledge_base",
  description:
    "BM25 keyword search over the chunks of every document in the local knowledge base (sample documents plus uploaded PDF/TXT files). Returns the matching chunk text with source references.",
  category: "knowledge",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query", minLength: 2, maxLength: 300 },
      top_k: { type: "integer", description: "Number of chunks to return", minimum: 1, maximum: 8, default: 4 },
    },
    required: ["query"],
    additionalProperties: false,
  },
  execute(args, runtime) {
    const query = args.query as string;
    const hits = runtime.searchKnowledge(query, args.top_k as number).map((h) => ({
      chunkId: h.chunk.id,
      docId: h.chunk.docId,
      docName: h.chunk.docName,
      page: h.chunk.page,
      heading: h.chunk.heading,
      score: Math.round(h.score * 1000) / 1000,
      matchedTerms: h.matchedTerms,
      text: h.chunk.text,
    }));
    return { query, indexedChunks: runtime.knowledgeChunkCount(), hits };
  },
  summarize: (r) =>
    r.hits.length === 0
      ? `No chunks matched (searched ${r.indexedChunks}).`
      : `${r.hits.length} chunk(s) retrieved from ${new Set(r.hits.map((h) => h.docName)).size} document(s); top score ${r.hits[0].score}`,
};
