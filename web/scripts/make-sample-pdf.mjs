// Generates public/samples/BM-107-Metro-Line-3-Delay-Notice.pdf — a real, text-based
// two-page PDF that visitors can download and upload to test PDF.js extraction.
// Run: node scripts/make-sample-pdf.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const pages = [
  [
    ["B", 16, "NOTICE OF DELAY AND REQUEST FOR TIME EXTENSION"],
    ["R", 11, "Project: BM-107 Metro Line 3 Station Upgrades, Phoenix AZ"],
    ["R", 11, "From: Desert Transit Constructors    To: Valley Metro Rail"],
    ["R", 11, "Date: September 2, 2026    Reference: General Conditions Paragraph 8.5"],
    ["R", 11, ""],
    ["B", 12, "1. SUMMARY"],
    ["R", 11, "The Contractor gives written notice of delay to the revenue service acceptance"],
    ["R", 11, "milestone. The current schedule update forecasts acceptance on January 29, 2027,"],
    ["R", 11, "which is 126 calendar days after the contractual date of September 25, 2026."],
    ["R", 11, "The Contractor requests an extension of 98 calendar days for excusable delay."],
    ["R", 11, ""],
    ["B", 12, "2. AFFECTED ACTIVITIES"],
    ["R", 11, "Utility relocations, platform extensions at Stations 3 to 6, and train-control"],
    ["R", 11, "integration testing are on the critical path. Night track-access windows were"],
    ["R", 11, "reduced from five to three nights per week by the Owner in March 2026."],
  ],
  [
    ["B", 12, "3. CAUSE OF DELAY"],
    ["R", 11, "During excavation at Stations 1 and 2 the crews encountered unmapped fiber optic"],
    ["R", 11, "duct banks and an abandoned 12-inch water main that were not shown on the"],
    ["R", 11, "contract drawings. Relocation by the utility owners added 113 days to the"],
    ["R", 11, "utility relocation milestone. This is a differing site condition under"],
    ["R", 11, "General Conditions Paragraph 8.4(c)."],
    ["R", 11, ""],
    ["B", 12, "4. MITIGATION"],
    ["R", 11, "The Contractor has added a second excavation crew, pre-assembled canopy modules"],
    ["R", 11, "off site, and proposes weekend track closures in December 2026 to recover up to"],
    ["R", 11, "28 days. A Recovery Schedule will be submitted within 10 working days."],
    ["R", 11, ""],
    ["B", 12, "5. COST IMPACT"],
    ["R", 11, "Extended general conditions are estimated at $41,500 per week. A Change Order"],
    ["R", 11, "Request with a fragnet schedule analysis will follow within 21 days."],
  ],
];

const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function contentStream(lines) {
  let y = 760;
  const ops = ["BT"];
  for (const [font, size, text] of lines) {
    ops.push(`/${font === "B" ? "F2" : "F1"} ${size} Tf`, `1 0 0 1 60 ${y} Tm`, `(${esc(text)}) Tj`);
    y -= size + 7;
  }
  ops.push("ET");
  return ops.join("\n");
}

const objects = [];
const add = (body) => objects.push(body) && objects.length;

const catalogId = add(null);
const pagesId = add(null);
const f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
const f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
const pageIds = pages.map((lines) => {
  const stream = contentStream(lines);
  const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
  return add(
    `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${contentId} 0 R >>`,
  );
});
objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
const infoId = add("<< /Title (BM-107 Notice of Delay) /Author (BuildMind AI sample data) /Producer (make-sample-pdf.mjs) >>");

let pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf, "latin1"));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "samples", "BM-107-Metro-Line-3-Delay-Notice.pdf");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, Buffer.from(pdf, "latin1"));
console.log(`wrote ${out} (${pdf.length} bytes)`);
