// End-to-end smoke test + screenshot capture against a running preview server.
//   npm run build && npx vite preview --port 4173   (in another terminal)
//   node scripts/e2e-screenshots.mjs [baseUrl]
// Uses an installed Chrome/Edge via playwright-core (no browser download).
import { chromium } from "playwright-core";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.argv[2] ?? "http://localhost:4173/";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "..", "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const candidates = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error("No Chrome/Edge found; set CHROME_PATH");

const browser = await chromium.launch({ executablePath, headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const check = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
};
const shot = (name) => page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });

console.log(`Testing ${BASE}`);
await page.goto(BASE);
await page.getByText("Portfolio dashboard").waitFor();
check(await page.getByText("Forecast late").isVisible(), "dashboard renders KPIs");
await shot("01-dashboard");

// Multi-step agent run from a sample question
await page.goto(`${BASE}#/assistant`);
await page.getByRole("button", { name: /most delayed and what is its liquidated/ }).click();
await page.getByText("is the most delayed project").waitFor({ timeout: 10000 });
check(true, "multi-step answer rendered");
const traceText = await page.locator("main aside").innerText();
check(traceText.includes("get_delayed_projects") && traceText.includes("calculate_project_delay") && traceText.includes("search_knowledge_base"), "trace shows 3 chained tools");
await page.getByRole("button", { name: "Show source 1", exact: true }).first().click();
await shot("02-assistant-multistep");

// Memory follow-up
await page.fill("#ask", "What does the contract say about its recovery schedule?");
await page.keyboard.press("Enter");
await page.waitForFunction(() => document.body.innerText.includes("resolved from conversation memory") || document.querySelectorAll("blockquote").length > 1, null, { timeout: 10000 });
check((await page.locator("main aside").innerText()).includes("memory"), "follow-up uses memory");

// Knowledge base: real PDF upload through PDF.js
await page.goto(`${BASE}#/knowledge`);
await page.getByText("Documents (").waitFor();
await page.setInputFiles('input[type="file"]', join(root, "public", "samples", "BM-107-Metro-Line-3-Delay-Notice.pdf"));
await page.getByText(/Indexed “BM-107-Metro-Line-3-Delay-Notice.pdf”/).waitFor({ timeout: 15000 });
check(true, "PDF uploaded, extracted with PDF.js and indexed");
await page.fill('input[placeholder^="e.g. excavation"]', "unmapped fiber optic duct banks");
await page.getByRole("button", { name: "Search" }).click();
await page.getByText("page 2").first().waitFor();
check(true, "BM25 retrieves the uploaded PDF chunk with page number");
await shot("03-knowledge-base");

// Ask the agent about the uploaded document; then reload to prove persistence
await page.goto(`${BASE}#/assistant`);
await page.fill("#ask", "What caused the delay described in the BM-107 delay notice?");
await page.keyboard.press("Enter");
await page.getByText("BM-107-Metro-Line-3-Delay-Notice.pdf").first().waitFor({ timeout: 10000 });
check(true, "agent cites the uploaded PDF");
await page.reload();
await page.getByText("What caused the delay described").first().waitFor();
check(true, "conversation persists after reload (IndexedDB)");

await page.goto(`${BASE}#/projects/BM-101`);
await page.getByRole("heading", { name: "Milestones" }).waitFor();
await shot("04-projects");

await page.goto(`${BASE}#/trace`);
await page.getByText("Event timeline").first().waitFor();
await shot("05-trace");

await page.goto(`${BASE}#/architecture`);
await page.getByRole("heading", { name: "System overview" }).waitFor();
await shot("06-architecture");

// Mobile layout
const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
const m = await mobile.newPage();
await m.goto(`${BASE}#/assistant`);
await m.getByRole("heading", { name: "AI Assistant" }).waitFor();
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 0, `no horizontal overflow on mobile (${overflow}px)`);
await m.screenshot({ path: join(outDir, "07-mobile.png") });

check(errors.length === 0, `no console/page errors${errors.length ? `: ${errors.join(" | ")}` : ""}`);
await browser.close();
console.log(`Screenshots written to ${outDir}`);
