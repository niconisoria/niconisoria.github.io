#!/usr/bin/env node
// Prints a URL to a single continuous PDF page (height fits content, no
// page breaks) via the Chrome DevTools Protocol, with small margins.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const PREVIEW_URL = process.argv[2] ?? "http://localhost:4322/resume/";
const OUT = process.argv[3] ?? "public/resume/nicolas-nisoria.pdf";
const DEBUG_PORT = 9333;
const CHROME_BIN =
  process.env.CHROME_BIN ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const MARGIN_IN = 0.1;
const PAPER_WIDTH_IN = 8.5;

const chrome = spawn(
  CHROME_BIN,
  [
    "--headless",
    "--disable-gpu",
    `--remote-debugging-port=${DEBUG_PORT}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);
process.on("exit", () => chrome.kill());

async function waitForDebugger() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${DEBUG_PORT}/json/version`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error("Chrome debugger never became ready");
}

function connect(webSocketDebuggerUrl) {
  const ws = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const eventWaiters = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    } else if (msg.method && eventWaiters.has(msg.method)) {
      const resolve = eventWaiters.get(msg.method);
      eventWaiters.delete(msg.method);
      resolve(msg.params);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, (msg) => {
        if (msg.error) {
          reject(new Error(`CDP ${method} failed: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  // Registers interest in a one-off CDP event *before* triggering whatever
  // causes it - avoids racing a JS-evaluated readiness check against a
  // navigation that may not have started yet (the actual cause of the
  // occasional blank/short PDF: we were measuring the pre-navigation page).
  const waitForEvent = (method) =>
    new Promise((resolve) => eventWaiters.set(method, resolve));
  return { ws, send, waitForEvent };
}

async function main() {
  await waitForDebugger();

  // Open a blank target and navigate ourselves (rather than /json/new?url=,
  // which starts navigating immediately) so we can register the
  // Page.loadEventFired listener before triggering it - no race.
  const created = await fetch(`http://localhost:${DEBUG_PORT}/json/new`, {
    method: "PUT",
  }).then((res) => res.json());

  const { ws, send, waitForEvent } = connect(created.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve));

  await send("Page.enable");
  const loadFired = waitForEvent("Page.loadEventFired");
  await send("Page.navigate", { url: PREVIEW_URL });
  await loadFired;

  await send("Runtime.evaluate", {
    expression: "document.fonts.ready",
    awaitPromise: true,
  });

  // Match the print-time layout exactly before measuring height, otherwise
  // scrollHeight reflects screen media (e.g. the grid's `md:` column split
  // may not apply at the headless default viewport width) while the actual
  // PDF renders under `print:` overrides - height mismatch = blank tail.
  // Height is deliberately tiny: body has min-h-screen (min-height: 100vh),
  // and 100vh resolves against this override - a tall override makes
  // scrollHeight measure the override, not the real content.
  // Measure at the printed content-box width (paper minus side margins), not
  // the full paper width - otherwise longer text (e.g. the PL resume) rewraps
  // narrower at print time and spills onto a second page.
  const widthPx = Math.round((PAPER_WIDTH_IN - MARGIN_IN * 2) * 96);
  await send("Emulation.setDeviceMetricsOverride", {
    width: widthPx,
    height: 100,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Emulation.setEmulatedMedia", { media: "print" });

  const heightResult = await send("Runtime.evaluate", {
    expression: "document.documentElement.scrollHeight",
  });
  const heightPx = heightResult.result.value;
  if (heightPx < 500) {
    throw new Error(
      `Measured page height (${heightPx}px) looks broken - expected real resume content. Aborting instead of writing a bad PDF.`,
    );
  }
  // Small safety buffer for sub-pixel rounding between measure and print.
  const paperHeightIn = heightPx / 96 + MARGIN_IN * 2 + 0.15;

  // Re-point the override's height at the actual paper height so the
  // viewport used for print layout matches what we measured against -
  // an unrelated override height (e.g. a generic 1080) confuses printToPDF's
  // own pagination and truncates the output.
  await send("Emulation.setDeviceMetricsOverride", {
    width: widthPx,
    height: Math.round(paperHeightIn * 96),
    deviceScaleFactor: 1,
    mobile: false,
  });

  const printResult = await send("Page.printToPDF", {
    printBackground: true,
    preferCSSPageSize: false,
    paperWidth: PAPER_WIDTH_IN,
    paperHeight: paperHeightIn,
    marginTop: MARGIN_IN,
    marginBottom: MARGIN_IN,
    marginLeft: MARGIN_IN,
    marginRight: MARGIN_IN,
  });

  writeFileSync(OUT, Buffer.from(printResult.data, "base64"));
  console.log(`Wrote ${OUT} (single page, ${paperHeightIn.toFixed(2)}in tall)`);

  ws.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
