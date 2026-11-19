import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { BM25Index } from "./bm25";
import { chunkDocument } from "./chunker";
import { KnowledgeBase } from "./knowledgeBase";
import { joinTextItems } from "./pdfText";
import { stem, tokenize } from "./text";
import type { PageText } from "./types";

describe("text processing", () => {
  it("stems consistently", () => {
    expect(stem("required")).toBe(stem("requires"));
    expect(stem("delays")).toBe(stem("delay"));
    expect(tokenize("What are the requirements?")).toEqual(["requirement"]);
  });
});

describe("chunker", () => {
  it("keeps page numbers and headings", () => {
    const pages: PageText[] = [
      { page: 1, text: "SECTION 1 - SCOPE\n\nThis applies to all work.\n\nSECTION 2 - TESTING\n\n2.1 Test cylinders weekly." },
      { page: 2, text: "2.2 Report results within 24 hours." },
    ];
    const chunks = chunkDocument("d1", "Spec.pdf", pages);
    expect(chunks.map((c) => [c.page, c.heading])).toEqual([
      [1, "SECTION 1 - SCOPE"],
      [1, "SECTION 2 - TESTING"],
      [2, "SECTION 2 - TESTING"],
    ]);
  });
  it("splits long paragraphs with bounded size", () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} talks about concrete placement.`).join(" ");
    const chunks = chunkDocument("d2", "x.txt", [{ page: null, text: long }]);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.wordCount).toBeLessThanOrEqual(170);
  });
});

describe("BM25", () => {
  it("ranks the most relevant chunk first", () => {
    const idx = new BM25Index();
    idx.addAll(
      chunkDocument("a", "a.txt", [{ page: null, text: "Fall protection is required above 6 feet." }]).concat(
        chunkDocument("b", "b.txt", [{ page: null, text: "Concrete shall be cured for 7 days." }]),
        chunkDocument("c", "c.txt", [{ page: null, text: "Concrete cylinders are tested at 28 days. Concrete slump is 4 inches." }]),
      ),
    );
    const hits = idx.search("how long must concrete be cured", 3);
    expect(hits[0].chunk.docId).toBe("b");
    expect(hits[0].matchedTerms).toContain("cur");
    expect(idx.search("zebra", 3)).toEqual([]);
  });
});

describe("KnowledgeBase (IndexedDB)", () => {
  it("seeds sample documents, persists uploads and survives a reload", async () => {
    const kb = new KnowledgeBase();
    await kb.init();
    expect(kb.listDocuments().length).toBe(7);
    const before = kb.chunkCount;

    const file = new File(["CRANE POLICY\n\nThe zeppelin hoist must be inspected every 30 days by a qualified rigger."], "crane.txt", { type: "text/plain" });
    const doc = await kb.addFile(file);
    expect(doc.chunkCount).toBe(1);
    expect(kb.chunkCount).toBe(before + 1);

    const fresh = new KnowledgeBase();
    await fresh.init();
    const hits = fresh.search("zeppelin hoist inspection");
    expect(hits[0].chunk.docId).toBe(doc.id);
    expect(hits[0].chunk.heading).toBe("CRANE POLICY");

    await fresh.removeDocument(doc.id);
    expect(fresh.search("zeppelin")).toEqual([]);
  });

  it("rejects unsupported files", async () => {
    const kb = new KnowledgeBase();
    await kb.init();
    await expect(kb.addFile(new File(["x"], "a.docx", { type: "application/msword" }))).rejects.toThrow(/PDF and TXT/);
  });
});

describe("PDF extraction", () => {
  it("joins PDF.js text items with line breaks", () => {
    expect(joinTextItems([{ str: "Hello", hasEOL: false }, { str: "world", hasEOL: true }, { str: "Next" }])).toBe("Hello world\nNext");
  });

  it("extracts text from the bundled sample PDF with the real PDF.js parser", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const data = new Uint8Array(await readFile(new URL("../../public/samples/BM-107-Metro-Line-3-Delay-Notice.pdf", import.meta.url)));
    const doc = await pdfjs.getDocument({ data }).promise;
    expect(doc.numPages).toBe(2);
    const page = await doc.getPage(2);
    const text = joinTextItems((await page.getTextContent()).items as { str: string; hasEOL: boolean }[]);
    expect(text).toContain("unmapped");
  });
});
