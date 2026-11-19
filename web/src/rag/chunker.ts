import { countWords, sentences } from "./text";
import type { DocumentChunk, PageText } from "./types";

export interface ChunkOptions {
  targetWords: number; // pack paragraphs until roughly this size
  maxWords: number; // hard cap for a single chunk
  overlapWords: number; // overlap when a long paragraph must be split
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { targetWords: 110, maxWords: 170, overlapWords: 25 };

/** All-caps line, or a short line starting with a structural keyword. */
export function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 4 || t.length > 100 || !/[A-Z]{2}/.test(t)) return false;
  if (/[.;:]$/.test(t) && !/^(ARTICLE|SECTION|PART|CHAPTER)\b/.test(t)) return false;
  const allCaps = t === t.toUpperCase();
  const keyword = /^(ARTICLE|SECTION|PART|CHAPTER)\b/i.test(t) && countWords(t) <= 10;
  return allCaps || keyword;
}

/** Splits a long paragraph into overlapping windows on sentence boundaries. */
function splitLong(paragraph: string, opts: ChunkOptions): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let curWords = 0;
  for (const s of sentences(paragraph)) {
    const w = countWords(s);
    if (curWords + w > opts.maxWords && cur.length) {
      out.push(cur.join(" "));
      const carry: string[] = [];
      let carryWords = 0;
      for (let i = cur.length - 1; i >= 0 && carryWords < opts.overlapWords; i--) {
        carry.unshift(cur[i]);
        carryWords += countWords(cur[i]);
      }
      // never carry the whole buffer, or we would loop forever
      if (carry.length === cur.length) carry.shift();
      cur = carry;
      curWords = carry.reduce((n, c) => n + countWords(c), 0);
    }
    cur.push(s);
    curWords += w;
  }
  if (cur.length) out.push(cur.join(" "));
  // a single sentence longer than maxWords: hard split by whitespace
  return out.flatMap((c) => {
    const ws = c.split(/\s+/);
    if (ws.length <= opts.maxWords) return [c];
    const parts: string[] = [];
    const step = opts.maxWords - opts.overlapWords;
    for (let i = 0; i < ws.length; i += step) {
      parts.push(ws.slice(i, i + opts.maxWords).join(" "));
      if (i + opts.maxWords >= ws.length) break;
    }
    return parts;
  });
}

/**
 * Converts page texts into retrieval chunks. Paragraphs are packed together up to
 * `targetWords`; chunks never cross page boundaries so page citations stay exact.
 */
export function chunkDocument(
  docId: string,
  docName: string,
  pages: PageText[],
  opts: ChunkOptions = DEFAULT_CHUNK_OPTIONS,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let heading: string | null = null;

  const emit = (text: string, page: number | null, chunkHeading: string | null) => {
    const clean = text.replace(/[ \t]+/g, " ").trim();
    if (!clean) return;
    const index = chunks.length;
    chunks.push({
      id: `${docId}#${index}`,
      docId,
      docName,
      index,
      page,
      heading: chunkHeading,
      text: clean,
      wordCount: countWords(clean),
    });
  };

  for (const { page, text } of pages) {
    const paragraphs = text
      .replace(/\r\n?/g, "\n")
      // blank lines, or a new line that starts a numbered clause ("8.3 ", "A.1 ", "2. ")
      .split(/\n\s*\n|\n(?=\s*(?:\d+(?:\.\d+)*\.?|[A-Z]\.\d+)\s)/)
      .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
      .filter(Boolean);

    let buf: string[] = [];
    let bufWords = 0;
    let bufHeading = heading;
    const flush = () => {
      if (buf.length) emit(buf.join("\n"), page, bufHeading);
      buf = [];
      bufWords = 0;
      bufHeading = heading;
    };

    for (const para of paragraphs) {
      if (isHeading(para)) {
        flush();
        heading = para;
        bufHeading = heading;
        continue;
      }
      const w = countWords(para);
      if (w > opts.maxWords) {
        flush();
        for (const part of splitLong(para, opts)) emit(part, page, heading);
        continue;
      }
      if (bufWords + w > opts.targetWords && buf.length) flush();
      buf.push(para);
      bufWords += w;
    }
    flush();
  }
  return chunks;
}
