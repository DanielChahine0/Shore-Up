/**
 * Opens a fresh incognito browser context against a site, runs a set of tasks, closes it, and
 * repeats. Built for testing our own rate limiter and abuse protections: every run starts with
 * no cookies or storage, so the server sees a brand-new visitor from the same IP each time.
 *
 * Usage: pnpm loop:incognito [url] [--runs 20] [--concurrency 1] [--delay 0] [--headed]
 * Only point this at sites we own.
 */
import { chromium, type Page, type Response } from "@playwright/test";

const DEFAULT_URL = `http://localhost:${process.env.E2E_PORT ?? 3000}`;

/** The steps one visitor performs. Edit this to exercise whatever is under test. */
async function tasks(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
}

type RunResult = { run: number; ms: number; statuses: Map<number, number>; retryAfter?: string; error?: string };

function parseArgs(argv: string[]) {
  const opts = { url: DEFAULT_URL, runs: 20, concurrency: 1, delay: 0, headed: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--headed") opts.headed = true;
    else if (arg === "--runs" || arg === "--concurrency" || arg === "--delay") {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 0) throw new Error(`${arg} needs a non-negative integer`);
      opts[arg.slice(2) as "runs" | "concurrency" | "delay"] = value;
    } else if (arg.startsWith("--")) throw new Error(`Unknown option ${arg}`);
    else opts.url = arg;
  }
  if (opts.concurrency < 1) throw new Error("--concurrency must be at least 1");
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const origin = new URL(opts.url).origin;
  const browser = await chromium.launch({ headless: !opts.headed });

  async function runOnce(run: number): Promise<RunResult> {
    // A new context is Playwright's incognito: its own cookies, cache, and storage, discarded on close.
    const context = await browser.newContext();
    const result: RunResult = { run, ms: 0, statuses: new Map() };
    const started = Date.now();
    try {
      const page = await context.newPage();
      // Same-origin only, so third-party tiles and analytics do not drown out our own responses.
      page.on("response", (res: Response) => {
        if (new URL(res.url()).origin !== origin) return;
        result.statuses.set(res.status(), (result.statuses.get(res.status()) ?? 0) + 1);
        if (res.status() === 429) result.retryAfter ??= res.headers()["retry-after"];
      });
      await tasks(page, opts.url);
    } catch (err) {
      result.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
    } finally {
      await context.close();
    }
    result.ms = Date.now() - started;
    return result;
  }

  const results: RunResult[] = [];
  let next = 1;
  async function worker() {
    while (next <= opts.runs) {
      const result = await runOnce(next++);
      results.push(result);
      const statuses = [...result.statuses].sort(([a], [b]) => a - b).map(([code, n]) => `${code}x${n}`).join(" ");
      const notes = [result.retryAfter && `retry-after ${result.retryAfter}s`, result.error && `error: ${result.error}`].filter(Boolean).join(", ");
      console.log(`run ${String(result.run).padStart(3)}  ${String(result.ms).padStart(6)}ms  ${statuses || "no responses"}${notes ? `  (${notes})` : ""}`);
      if (opts.delay) await new Promise((resolve) => setTimeout(resolve, opts.delay));
    }
  }

  try {
    await Promise.all(Array.from({ length: Math.min(opts.concurrency, opts.runs) }, worker));
  } finally {
    await browser.close();
  }

  const limited = results.filter((r) => r.statuses.has(429));
  const failed = results.filter((r) => r.error);
  console.log(`\n${results.length} runs against ${opts.url}: ${limited.length} rate limited, ${failed.length} errored`);
  if (limited.length) console.log(`first 429 on run ${Math.min(...limited.map((r) => r.run))}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
