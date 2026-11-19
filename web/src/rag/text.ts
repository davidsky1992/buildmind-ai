/** Tokenization + light stemming shared by indexing and querying. */

const STOPWORDS = new Set(
  (
    "a an and are as at be been but by can could did do does for from had has have how i if in into is it its " +
    "me my of on or our should so such than that the their them then there these they this those to was we were " +
    "what when where which who whom why will with would you your about any all also each may must not no only " +
    "other over per shall some up us very tell show give find list please say says said"
  ).split(/\s+/),
);

/** Very small suffix-stripping stemmer (deterministic, good enough for BM25 recall). */
export function stem(word: string): string {
  if (word.length <= 3 || /^\d/.test(word)) return word;
  const rules: [RegExp, string][] = [
    [/ies$/, "y"],
    [/(ss)es$/, "$1"],
    [/ments?$/, "ment"],
    [/ations?$/, "ate"],
    [/ing$/, ""],
    [/ed$/, ""],
    [/ly$/, ""],
    [/es$/, "e"],
    [/([^s])s$/, "$1"],
  ];
  let out = word;
  for (const [re, rep] of rules) {
    if (re.test(word)) {
      const candidate = word.replace(re, rep);
      if (candidate.length >= 3) out = candidate;
      break;
    }
  }
  // "require" / "required" / "requires" all normalise to "requir"
  if (out.length > 4 && out.endsWith("e")) out = out.slice(0, -1);
  return out;
}

/** Raw lowercase word tokens (numbers such as "8.4" are kept intact). */
export function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+(?:\.[0-9]+)*/g) ?? [];
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

/** Index/query terms: lowercase, stopwords removed, stemmed. */
export function tokenize(text: string): string[] {
  return words(text)
    .filter((w) => !STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w)))
    .map(stem);
}

export function countWords(text: string): number {
  return words(text).length;
}

/** Split text into sentences (used for extractive answers). */
export function sentences(text: string): string[] {
  const raw = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?;])\s+(?=[A-Z0-9(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // Merge clause titles / numbers ("3.4 Cold-Weather Concreting.", "2.") into the next sentence.
  const out: string[] = [];
  let carry = "";
  for (const s of raw) {
    if (countWords(s) <= 5 && !/\d+\s*(days?|hours?|feet|percent|psi)\b/i.test(s)) {
      carry = carry ? `${carry} ${s}` : s;
      continue;
    }
    out.push(carry ? `${carry} ${s}` : s);
    carry = "";
  }
  if (carry) out.push(carry);
  return out;
}
