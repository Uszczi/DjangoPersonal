#!/usr/bin/env node
/**
 * Screenshot pages of the running web app, signed in as a seeded user.
 *
 * Meant for prototyping with an agent: `just proto-up` starts an isolated
 * stack, then `just shot /tasks` shows what a change looks like. Uses the
 * system Chromium through playwright-core, so no browser download is needed.
 *
 *   node scripts/screenshot.mjs /tasks /expenses
 *   node scripts/screenshot.mjs /projects --viewport mobile --full-page
 *   node scripts/screenshot.mjs /counters --click "Nowy licznik" --out /tmp/modal.png
 *   node scripts/screenshot.mjs /tasks --steps ./my-steps.mjs
 *
 * Browser console errors and failed requests are printed, so a blank page
 * explains itself.
 */
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { chromium } from "playwright-core";

const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 800 },
  tablet: { width: 820, height: 1180 },
  mobile: { width: 390, height: 844 },
};

const HELP = `Usage: screenshot.mjs <path...> [options]

  --base-url URL       app URL (default $PROTO_URL or http://127.0.0.1:5180)
  --out FILE           output file (one path only; default .proto/shots/<path>.png)
  --out-dir DIR        output directory (default <repo>/.proto/shots)
  --viewport NAME|WxH  desktop, laptop, tablet, mobile or e.g. 1024x768 (default desktop)
  --full-page          capture the whole scrollable page
  --color-scheme S     light or dark (prefers-color-scheme)
  --user NAME          seeded user to sign in as (default demo)
  --password PASS      password (default devpass123, the seed's)
  --anon               do not sign in
  --wait-for SELECTOR  wait for this CSS selector before the capture
  --click TEXT         click the button/link/text with this name (repeatable, in order)
  --steps FILE         module whose default export is async (page) => {} run before the capture
  --delay MS           extra wait before the capture (default 300)
  --selector SELECTOR  capture only this element
  -h, --help`;

const { values: opts, positionals: paths } = parseArgs({
  allowPositionals: true,
  options: {
    "base-url": { type: "string" },
    out: { type: "string" },
    "out-dir": { type: "string" },
    viewport: { type: "string", default: "desktop" },
    "full-page": { type: "boolean", default: false },
    "color-scheme": { type: "string" },
    user: { type: "string", default: "demo" },
    password: { type: "string", default: "devpass123" },
    anon: { type: "boolean", default: false },
    "wait-for": { type: "string" },
    click: { type: "string", multiple: true, default: [] },
    steps: { type: "string" },
    delay: { type: "string", default: "300" },
    selector: { type: "string" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (opts.help || paths.length === 0) {
  console.log(HELP);
  process.exit(opts.help ? 0 : 1);
}
if (opts.out && paths.length > 1) {
  fail("--out takes a single path; use --out-dir for several");
}

const repoRoot = resolve(import.meta.dirname, "../..");
// `just` runs recipes from the repo root; INIT_CWD keeps relative paths the
// caller's when going through `npm run`.
const callerCwd = process.env.INIT_CWD ?? process.cwd();
const baseUrl = (
  opts["base-url"] ??
  process.env.PROTO_URL ??
  "http://127.0.0.1:5180"
).replace(/\/$/, "");
const outDir = resolve(
  callerCwd,
  opts["out-dir"] ?? resolve(repoRoot, ".proto/shots"),
);
const viewport = parseViewport(opts.viewport);

function fail(message) {
  console.error(`screenshot: ${message}`);
  process.exit(1);
}

function parseViewport(value) {
  if (VIEWPORTS[value]) return VIEWPORTS[value];
  const match = /^(\d+)x(\d+)$/.exec(value);
  if (!match) fail(`unknown viewport "${value}"`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

function chromiumPath() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  const found = candidates.find((path) => path && existsSync(path));
  if (!found) {
    fail("no Chromium found; install one or set CHROMIUM_PATH");
  }
  return found;
}

/** Sign in through the API and return the auth store's persisted state. */
async function signIn() {
  const post = await fetch(`${baseUrl}/api/v1/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: opts.user, password: opts.password }),
  }).catch((error) =>
    fail(
      `cannot reach ${baseUrl} (${error.cause?.code ?? error.message}); is \`just proto-up\` running?`,
    ),
  );
  if (!post.ok) {
    fail(`login as "${opts.user}" failed: ${post.status} ${await post.text()}`);
  }
  const { access, refresh } = await post.json();
  const me = await fetch(`${baseUrl}/api/v1/auth/me/`, {
    headers: { Authorization: `Bearer ${access}` },
  });
  const user = await me.json();
  // The shape zustand's persist middleware writes under the "auth" key.
  return JSON.stringify({ state: { user, access, refresh }, version: 0 });
}

function outFile(path) {
  if (opts.out) return resolve(callerCwd, opts.out);
  const slug =
    path.replace(/^\/+|\/+$/g, "").replace(/[^\w.-]+/g, "_") || "index";
  return resolve(outDir, `${slug}.png`);
}

async function clickByName(page, name) {
  const candidates = [
    page.getByRole("button", { name, exact: false }),
    page.getByRole("link", { name, exact: false }),
    page.getByRole("tab", { name, exact: false }),
    page.getByText(name, { exact: false }),
  ];
  for (const locator of candidates) {
    if ((await locator.count()) > 0) {
      await locator.first().click();
      return;
    }
  }
  throw new Error(`nothing to click named "${name}"`);
}

const authState = opts.anon ? null : await signIn();
const browser = await chromium.launch({ executablePath: chromiumPath() });
let failed = false;

try {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: opts["color-scheme"],
    locale: "pl-PL",
  });
  if (authState) {
    await context.addInitScript((value) => {
      if (!window.localStorage.getItem("auth")) {
        window.localStorage.setItem("auth", value);
      }
    }, authState);
  }

  for (const path of paths) {
    const page = await context.newPage();
    const problems = [];
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        problems.push(`console.${message.type()}: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) =>
      problems.push(`pageerror: ${error.message}`),
    );
    page.on("response", (response) => {
      if (response.status() >= 400) {
        problems.push(
          `HTTP ${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });

    try {
      const url = path.startsWith("http")
        ? path
        : `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;
      await page.goto(url, { waitUntil: "networkidle" });
      if (opts["wait-for"]) {
        await page.waitForSelector(opts["wait-for"], { timeout: 10_000 });
      }
      for (const name of opts.click) {
        await clickByName(page, name);
        await page.waitForLoadState("networkidle");
      }
      if (opts.steps) {
        const module = await import(
          pathToFileURL(resolve(callerCwd, opts.steps)).href
        );
        await module.default(page);
        await page.waitForLoadState("networkidle");
      }
      await page.waitForTimeout(Number(opts.delay));

      const file = outFile(path);
      mkdirSync(dirname(file), { recursive: true });
      const target = opts.selector ? page.locator(opts.selector).first() : page;
      await target.screenshot({
        path: file,
        fullPage: opts.selector ? undefined : opts["full-page"],
      });
      console.log(`${file}  (${page.url().replace(baseUrl, "")})`);
    } catch (error) {
      failed = true;
      console.error(`screenshot: ${path}: ${error.message}`);
    }
    for (const problem of problems) console.log(`  ! ${problem}`);
    await page.close();
  }
} finally {
  await browser.close();
}

process.exit(failed ? 1 : 0);
