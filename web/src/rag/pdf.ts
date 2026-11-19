import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PageText } from "./types";
import { joinTextItems, type TextItemLike } from "./pdfText";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Extracts text per page with PDF.js. Pages without a text layer are skipped. */
export async function extractPdfPages(data: ArrayBuffer): Promise<{ pages: PageText[]; pageCount: number }> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data) });
  const doc = await task.promise;
  const pages: PageText[] = [];
  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      const text = joinTextItems(content.items as TextItemLike[]);
      if (text) pages.push({ page: p, text });
      page.cleanup();
    }
    return { pages, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}
