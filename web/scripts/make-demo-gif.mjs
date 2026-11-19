// Records docs/demo.gif from the running preview server.
//   npm run build && npx vite preview --port 4173
//   node scripts/make-demo-gif.mjs [baseUrl]
import { chromium } from "playwright-core";
import gifenc from "gifenc";
import { PNG } from "pngjs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { GIFEncoder, quantize, applyPalette } = gifenc;
const BASE = process.argv[2] ?? "http://localhost:4173/";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "demo.gif");
mkdirSync(dirname(out), { recursive: true });

const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome"]
  .filter(Boolean)
  .find((p) => existsSync(p));
const W = 1200;
const H = 750;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const gif = GIFEncoder();

async function frame(delayMs) {
  const png = PNG.sync.read(await page.screenshot());
  const palette = quantize(png.data, 256, { format: "rgb565" });
  gif.writeFrame(applyPalette(png.data, palette, "rgb565"), png.width, png.height, { palette, delay: delayMs });
}

await page.goto(BASE);
await page.getByText("Portfolio dashboard").waitFor();
await frame(2200);

await page.goto(`${BASE}#/assistant`);
await page.getByRole("heading", { name: "AI Assistant" }).waitFor();
await page.getByRole("button", { name: "Clear" }).click().catch(() => {});
await frame(1200);

const q = "Which project is most delayed and what is its liquidated damages exposure?";
await page.click("#ask");
for (let i = 8; i <= q.length; i += 12) {
  await page.fill("#ask", q.slice(0, i));
  await frame(90);
}
await page.fill("#ask", q);
await frame(500);
await page.keyboard.press("Enter");
await page.getByText("is the most delayed project").waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await page.locator("main section").first().evaluate((el) => el.querySelector(".overflow-y-auto")?.scrollTo(0, 0));
await frame(2600);

// scroll the answer, then expand the first citation
const scroller = page.locator("main section .overflow-y-auto").first();
for (const y of [300, 600, 900]) {
  await scroller.evaluate((el, top) => el.scrollTo({ top }), y);
  await frame(900);
}
await page.getByRole("button", { name: "Show source 1", exact: true }).first().click();
await page.waitForTimeout(150);
await frame(2200);

// trace panel: open first tool call
await page.locator("main aside button").filter({ hasText: "get_delayed_projects" }).first().click();
await page.locator("main aside").evaluate((el) => el.scrollTo({ top: 260 }));
await frame(2400);

await page.goto(`${BASE}#/knowledge`);
await page.fill('input[placeholder^="e.g. excavation"]', "excavation protective system depth");
await page.getByRole("button", { name: "Search" }).click();
await page.waitForTimeout(150);
await frame(2400);

await page.goto(`${BASE}#/architecture`);
await page.getByRole("heading", { name: "System overview" }).waitFor();
await frame(2600);

gif.finish();
writeFileSync(out, gif.bytes());
await browser.close();
console.log(`wrote ${out} (${(gif.bytes().length / 1024 / 1024).toFixed(1)} MB)`);
