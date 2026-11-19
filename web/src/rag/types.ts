export type DocumentSource = "sample" | "upload";

export interface KnowledgeDocument {
  id: string;
  name: string;
  mimeType: "application/pdf" | "text/plain";
  category: string;
  source: DocumentSource;
  sizeBytes: number;
  pageCount: number | null;
  chunkCount: number;
  wordCount: number;
  addedAt: string; // ISO timestamp
}

export interface DocumentChunk {
  id: string; // `${docId}#${index}`
  docId: string;
  docName: string;
  index: number;
  page: number | null; // 1-based page for PDFs, null for TXT
  heading: string | null; // nearest preceding heading, if detected
  text: string;
  wordCount: number;
}

export interface SearchHit {
  chunk: DocumentChunk;
  score: number;
  matchedTerms: string[];
}

export interface PageText {
  page: number | null;
  text: string;
}
