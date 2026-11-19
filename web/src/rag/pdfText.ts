export interface TextItemLike {
  str?: string;
  hasEOL?: boolean;
}

/** Joins PDF.js text items, preserving line breaks reported by `hasEOL`. */
export function joinTextItems(items: TextItemLike[]): string {
  let text = "";
  for (const item of items) {
    if (typeof item.str !== "string") continue;
    text += item.str;
    if (item.hasEOL) text += "\n";
    else if (item.str && !item.str.endsWith(" ")) text += " ";
  }
  return text.replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}
