/** Production interaction checks. RPC and wallet fixtures are confined to this script. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const TOKEN = "0x5501e1fa81be1c3f49225fa7668da0245d07db60";
// A real public signer address, used only to emulate a wallet without sending a transaction.
const OWNER = "0x4168D958C147b626c16C2e6B3124B4412cA7CE05";
const OTHER = "0xB4f55d6C56F43Ae94850B096A9d13280C3ebAaa9";
const TX = "0xa47ddbc53426ae143ca73d9281ecd02a6afa9fce8b655829b13adc44c69574fa";
const TOPIC =
  "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
const NOW = Date.parse("2026-10-31T08:30:00Z"),
  HEAD = 12032650n;
const hex = (n) => `0x${BigInt(n).toString(16)}`;
const word = (address) =>
  `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
const valueWord = (n) => `0x${BigInt(n).toString(16).padStart(64, "0")}`;
const day = "2026-10-31";
const bucket = (date, work = 400, blocks = 20) => ({
  startAt: `${date}T00:00:00Z`,
  endAt: `${date}T01:00:00Z`,
  workAdded: String(work),
  settlementCount: "6",
  completedBlockCount: String(blocks),
});
const status = {
  generatedAt: new Date(NOW).toISOString(),
  measurement: {
    coreStatus: "SPINNING",
    rpmMilli: 12345,
    speedMmPerSecond: 210,
    cumulativeWorkUnits: "58518",
    observedAt: new Date(NOW).toISOString(),
    freshness: "online",
  },
  builder: { anchor: { blockHeight: "5204", blockProgress: "637347328" } },
};
const hourly = {
  generatedAt: new Date(NOW).toISOString(),
  window: { startAt: "2026-10-30T09:00:00Z", endAt: "2026-10-31T09:00:00Z" },
  recentSettlements: [{ blockHeight: "5204" }],
  buckets: [bucket(day)],
};
const history = {
  ...hourly,
  buckets: Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.parse(`${day}T00:00:00Z`) - (i + 1) * 864e5)
      .toISOString()
      .slice(0, 10);
    return {
      ...bucket(date),
      startAt: `${date}T12:00:00Z`,
      endAt: new Date(Date.parse(`${date}T12:00:00Z`) + 864e5).toISOString(),
    };
  }).reverse(),
};
const economy = {
  generatedAt: new Date(NOW).toISOString(),
  supply: { totalMintedBaseUnits: "20709575486483509966868467" },
};
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};
const root = resolve("dist");
const results = [];
const output = resolve("test/scratch/validation");
await mkdir(output, { recursive: true });
const check = (name, details) => {
  results.push({ name, passed: true, details });
  console.log(`PASS ${name}${details ? `: ${details}` : ""}`);
};
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://local").pathname,
    );
    assert(pathname.startsWith("/preview/"));
    const file = resolve(
      root,
      pathname.slice("/preview/".length) || "index.html",
    );
    assert(file.startsWith(`${root}/`));
    res.setHeader(
      "Content-Type",
      mime[extname(file)] ?? "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const browsers = [];
async function fixture(context, { wallet = false } = {}) {
  const state = {
    offline: false,
    rpcOffline: false,
    signed: false,
    receiptReady: true,
    releaseReceipt: undefined,
    calls: [],
    statusCalls: 0,
    chainCalls: [],
    reject: false,
  };
  await context.route("https://api.squeekchain.com/**", async (route) => {
    if (state.offline) return route.fulfill({ status: 503, body: "{}" });
    const u = new URL(route.request().url());
    let response;
    if (u.pathname.endsWith("/status")) {
      state.statusCalls++;
      response = status;
    } else if (u.pathname.endsWith("/economy/state")) response = economy;
    else response = u.searchParams.get("range") === "30d" ? history : hourly;
    return route.fulfill({ json: response });
  });
  await context.route(
    /https:\/\/(rpc\.sepolia\.ethpandaops\.io|public\.1rpc\.io|ethereum-sepolia-rpc\.publicnode\.com)\/?(sepolia)?$/,
    async (route) => {
      if (state.rpcOffline)
        return route.fulfill({ status: 503, body: "RPC unavailable" });
      const { method, params, id } = route.request().postDataJSON();
      let result;
      const block = (n) => ({
        number: hex(n),
        timestamp: hex(BigInt(NOW / 1000) - (HEAD - n) * 12n),
        hash: TX,
        transactions: [],
        gasLimit: hex(30_000_000),
        gasUsed: "0x0",
        difficulty: "0x0",
        extraData: "0x",
        baseFeePerGas: "0x1",
      });
      const log = (
        owner,
        spender = owner,
        value = 0n,
        blockNumber = HEAD - 1n,
      ) => ({
        address: TOKEN,
        topics: [TOPIC, word(owner), word(spender)],
        data: valueWord(value),
        blockNumber: hex(blockNumber),
        transactionHash: TX,
        transactionIndex: "0x0",
        blockHash: TX,
        logIndex: "0x0",
        removed: false,
      });
      if (method === "eth_chainId") result = "0xaa36a7";
      else if (method === "eth_blockNumber") result = hex(HEAD);
      else if (method === "eth_getBlockByNumber")
        result = block(params[0] === "latest" ? HEAD : BigInt(params[0]));
      else if (method === "eth_getLogs") {
        assert.equal(params[0].address.toLowerCase(), TOKEN);
        const from = BigInt(params[0].fromBlock),
          to = BigInt(params[0].toBlock);
        result = [];
        const previousDay = HEAD - 2551n; // 23:59:48 UTC, just before today's boundary.
        if (from <= previousDay && to >= previousDay)
          result.push(log(OWNER, OWNER, 0n, previousDay));
        if (from <= HEAD - 1n && to >= HEAD - 1n) {
          // Dedup, owner != spender, and nonzero amount filters must all be exercised.
          result.push(
            log(OTHER),
            log(OTHER),
            log(OWNER, OTHER),
            log(OWNER, OWNER, 1n),
          );
          if (state.signed) result.push(log(OWNER));
        }
      } else if (method === "eth_getTransactionReceipt") {
        if (!state.receiptReady)
          await new Promise((resolve) => {
            state.releaseReceipt = resolve;
          });
        result = {
          transactionHash: TX,
          blockHash: TX,
          blockNumber: hex(HEAD - 1n),
          transactionIndex: "0x0",
          from: OWNER,
          to: TOKEN,
          cumulativeGasUsed: hex(50000),
          gasUsed: hex(50000),
          effectiveGasPrice: "0x1",
          logs: [log(OWNER)],
          logsBloom: `0x${"0".repeat(512)}`,
          status: "0x1",
          type: "0x2",
          contractAddress: null,
        };
      } else if (method === "eth_getTransactionByHash") result = null;
      else throw new Error(`Unexpected RPC method ${method}`);
      return route.fulfill({ json: { jsonrpc: "2.0", id, result } });
    },
  );
  if (wallet)
    await context.addInitScript(
      ({ OWNER, TX }) => {
        const listeners = new Map();
        let connected = false,
          chain = "0x1",
          added = false;
        window.__walletCalls = [];
        window.__rejectSend = false;
        const emit = (name, value) =>
          (listeners.get(name) ?? []).forEach((fn) => fn(value));
        const provider = {
          on(name, fn) {
            listeners.set(name, [...(listeners.get(name) ?? []), fn]);
          },
          removeListener(name, fn) {
            listeners.set(
              name,
              (listeners.get(name) ?? []).filter((f) => f !== fn),
            );
          },
          async request({ method, params }) {
            window.__walletCalls.push({ method, params });
            if (method === "eth_accounts") return connected ? [OWNER] : [];
            if (method === "eth_requestAccounts") {
              connected = true;
              return [OWNER];
            }
            if (method === "eth_chainId") return chain;
            if (method === "wallet_switchEthereumChain") {
              if (!added)
                throw Object.assign(new Error("Unknown chain"), { code: 4902 });
              chain = params[0].chainId;
              emit("chainChanged", chain);
              return null;
            }
            if (method === "wallet_addEthereumChain") {
              added = true;
              return null;
            }
            if (method === "eth_sendTransaction") {
              if (window.__rejectSend)
                throw Object.assign(new Error("User rejected"), { code: 4001 });
              return TX;
            }
            if (method === "wallet_requestPermissions")
              return [{ parentCapability: "eth_accounts" }];
            if (method === "wallet_getPermissions")
              return connected ? [{ parentCapability: "eth_accounts" }] : [];
            if (method === "wallet_revokePermissions") {
              connected = false;
              return null;
            }
            throw Object.assign(new Error(`Unsupported method ${method}`), {
              code: 4200,
            });
          },
        };
        window.ethereum = provider;
        const announce = () =>
          dispatchEvent(
            new CustomEvent("eip6963:announceProvider", {
              detail: {
                info: {
                  uuid: "b239d2ee-7bfa-4c67-a143-d80a83cff843",
                  name: "Validation wallet",
                  icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
                  rdns: "org.wheel.validation",
                },
                provider,
              },
            }),
          );
        addEventListener("eip6963:requestProvider", announce);
        announce();
      },
      { OWNER, TX },
    );
  return state;
}
try {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  browsers.push(browser);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const state = await fixture(context, { wallet: true });
  const page = await context.newPage();
  const errors = [],
    missing = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400) missing.push(r.url());
  });
  await page.clock.install({ time: NOW });
  await page.goto(url);
  await page.waitForFunction(
    () => document.querySelector(".signer-count")?.textContent === "1",
  );
  assert.equal(await page.locator(".wheel-state").innerText(), "Spinning");
  assert.match(
    await page.locator(".live-stats").innerText(),
    /0\.210[\s\S]*12\.3 rpm[\s\S]*5,204[\s\S]*63\.7%[\s\S]*20,709,575/,
  );
  check(
    "Live parsing and verified signer filters",
    "speed, RPM, /1e9 progress, exact /1e18 supply; duplicate/unequal/nonzero approvals excluded",
  );
  const action = await page.locator(".sign-button").boundingBox();
  assert(action.y + action.height <= 844);
  check(
    "390px first screen",
    `primary action ends at ${Math.round(action.y + action.height)}px`,
  );
  for (const width of [320, 390, 650, 720, 900, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      `overflow at ${width}`,
    );
  }
  check(
    "Responsive reflow",
    "no horizontal overflow at 320, 390, 650, 720, 900, 1440",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: `${output}/text-200.png`, fullPage: true });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "";
  });
  check(
    "200% text enlargement",
    "root text enlarged to 200% at 390px without horizontal overflow; not native browser zoom",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".sign-button").click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Browser wallet", exact: true })
      .count(),
    0,
  );
  assert.equal(
    await page.getByRole("button", { name: "Validation wallet" }).count(),
    1,
  );
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(
        () =>
          !!document.activeElement?.closest("dialog") ||
          document.activeElement === document.body,
      ),
      true,
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.classList.contains("sign-button"),
    ),
    true,
  );
  check(
    "Wallet dialog accessibility",
    "named EIP-6963 discovery; generic row suppressed; Escape closes and restores focus",
  );
  await page.locator(".sign-button").click();
  await page.getByRole("button", { name: "Validation wallet" }).click();
  await page
    .getByRole("button", { name: "Switch to Sepolia", exact: true })
    .last()
    .waitFor();
  await page.locator(".sign-button").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".sign-button")
      ?.textContent.includes("Sign tonight"),
  );
  let calls = await page.evaluate(() => window.__walletCalls);
  const add = calls.find((c) => c.method === "wallet_addEthereumChain");
  assert(add);
  assert.equal(add.params[0].chainId, "0xaa36a7");
  assert(
    calls.filter((c) => c.method === "wallet_switchEthereumChain").length >= 2,
  );
  check(
    "Sepolia switch",
    "4902 falls back to add chain, then switches; no transaction on the wrong network",
  );
  await page.evaluate(() => {
    window.__rejectSend = true;
  });
  await page.locator(".sign-button").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".signature-feedback")
      ?.textContent.includes("declined"),
  );
  assert.equal(await page.locator(".sign-button").isEnabled(), true);
  check(
    "Rejected transaction recovery",
    "inline explanation and signing action enabled for retry",
  );
  await page.evaluate(() => {
    window.__rejectSend = false;
  });
  state.signed = true;
  state.receiptReady = false;
  await page.locator(".sign-button").click();
  await page.waitForFunction(() =>
    document
      .querySelector(".sign-button")
      ?.textContent.includes("Waiting for confirmation"),
  );
  assert.equal(await page.locator(".sign-button").isDisabled(), true);
  const receiptDeadline = Date.now() + 3000;
  while (!state.releaseReceipt && Date.now() < receiptDeadline)
    await new Promise((done) => setTimeout(done, 10));
  assert.equal(
    typeof state.releaseReceipt,
    "function",
    "receipt request must reach the public client",
  );
  state.receiptReady = true;
  state.releaseReceipt();
  check(
    "Pending transaction state",
    "disabled action, confirmation label and explorer link while receipt is pending",
  );
  await page.waitForFunction(() =>
    document.querySelector(".sign-button")?.textContent.includes("You signed"),
  );
  calls = await page.evaluate(() => window.__walletCalls);
  const tx = calls.filter((c) => c.method === "eth_sendTransaction").at(-1)
    .params[0];
  assert.equal(tx.to.toLowerCase(), TOKEN);
  assert.equal(tx.from.toLowerCase(), OWNER.toLowerCase());
  assert.equal(
    tx.data.toLowerCase(),
    `0x095ea7b3${OWNER.slice(2).toLowerCase().padStart(64, "0")}${"0".repeat(64)}`,
  );
  assert(!tx.value || BigInt(tx.value) === 0n);
  assert.equal(
    calls.some((c) =>
      ["personal_sign", "eth_sign", "eth_signTypedData_v4"].includes(c.method),
    ),
    false,
  );
  assert.equal(await page.locator(".signer-count").innerText(), "2");
  check(
    "Exact signing transaction and confirmation",
    "approve(own address, 0) on the supplied SQK address; zero ETH; matching receipt event; signer added once; no message signing",
  );
  const pngEvent = page.waitForEvent("download");
  await page
    .locator(".below-canvas")
    .getByRole("button", { name: "Download PNG" })
    .click();
  const png = await pngEvent;
  await png.saveAs(`${output}/signed-card.png`);
  const bytes = await readFile(`${output}/signed-card.png`);
  assert.equal(bytes.readUInt32BE(16), 1600);
  assert.equal(bytes.readUInt32BE(20), 1200);
  check(
    "PNG download",
    "real PNG, 1600×1200, artwork/date/work/blocks/signers and signed-address footer",
  );
  const share = await page
    .locator(".below-canvas")
    .getByRole("link", { name: "Share on X" })
    .getAttribute("href");
  assert(decodeURIComponent(share).includes("I signed"));
  assert(decodeURIComponent(share).includes("#night/2026-10-31"));
  check("Share on X", "prefilled signed text and nightly hash link");
  await page.getByRole("button", { name: "Explore all 30 nights" }).click();
  assert.equal(await page.locator(".night-card").count(), 30);
  await page.locator(".night-open").first().click();
  await page.getByRole("dialog").waitFor();
  assert.match(page.url(), /#night\/2026-10-30$/);
  await page.getByRole("button", { name: "← Earlier night" }).click();
  await page.waitForFunction(() => location.hash.endsWith("2026-10-29"));
  await page.getByText("Signatures & artwork data", { exact: true }).click();
  const jsonEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save artwork data" }).click();
  const jsonDownload = await jsonEvent;
  await jsonDownload.saveAs(`${output}/night-data.json`);
  assert.equal(
    JSON.parse(await readFile(`${output}/night-data.json`, "utf8")).night.date,
    "2026-10-29",
  );
  await page.keyboard.press("Escape");
  check(
    "Gallery and reproduction data",
    "30 nights, full-size dialog, earlier/later navigation, hash links, JSON snapshot",
  );
  await page.getByRole("button", { name: "Pause canvas animation" }).click();
  assert.equal(
    await page
      .getByRole("button", { name: "Resume canvas animation" })
      .getAttribute("aria-pressed"),
    "true",
  );
  check(
    "Motion control",
    "pause/resume state exposed; reduced-motion context renders static frames",
  );
  const oldCalls = state.statusCalls;
  await page.clock.runFor(15020);
  await page.waitForFunction(() =>
    document.querySelector(".data-status")?.textContent.includes("Live data"),
  );
  assert(state.statusCalls > oldCalls);
  state.offline = true;
  await page.clock.runFor(15020);
  await page.waitForFunction(() =>
    document
      .querySelector(".data-status")
      ?.textContent.includes("Keeping the last good data"),
  );
  assert.match(await page.locator(".live-stats").innerText(), /5,204/);
  check(
    "15-second polling and outage retention",
    "previous stats retained, stale cue shown, retry action present",
  );
  await page.reload();
  await page.waitForFunction(() =>
    document
      .querySelector(".data-status")
      ?.textContent.includes("Keeping the last good data"),
  );
  assert.match(await page.locator(".live-stats").innerText(), /5,204/);
  check(
    "Offline reload",
    "last good data survives a reload through the optional local cache",
  );
  state.offline = false;
  await page
    .locator(".data-status")
    .getByRole("button", { name: "Retry", exact: true })
    .click();
  await page.waitForFunction(() =>
    document.querySelector(".data-status")?.textContent.includes("Live data"),
  );
  check("API recovery", "retry replaces stale state with fresh data");
  state.rpcOffline = true;
  await page.clock.runFor(15020);
  await page.waitForFunction(() =>
    document
      .querySelector(".signer-error")
      ?.textContent.includes("last verified"),
  );
  assert.equal(await page.locator(".signer-count").innerText(), "2");
  state.rpcOffline = false;
  await page
    .locator(".signer-error")
    .getByRole("button", { name: "Retry signatures" })
    .click();
  await page.waitForFunction(() => !document.querySelector(".signer-error"));
  check(
    "RPC outage retention and recovery",
    "verified signer set preserved through failed public RPC reads; retry restores current reads",
  );
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await writeFile(`${output}/axe.json`, JSON.stringify(axe, null, 2));
  assert.equal(
    axe.violations.length,
    0,
    axe.violations.map((v) => `${v.id}: ${v.description}`).join("\n"),
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(missing, []);
  check(
    "Automated accessibility and export resources",
    "zero axe violations, zero script errors, zero missing local resources under /preview/",
  );
  await context.close();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
  });
  await fixture(mobile);
  const phone = await mobile.newPage();
  await phone.clock.install({ time: NOW });
  await phone.goto(url);
  await phone.getByRole("button", { name: "Connect", exact: true }).click();
  for (const name of ["MetaMask", "Coinbase Wallet", "Rabby", "Phantom"])
    assert.equal(
      await phone.getByRole("link", { name: `Open in ${name}` }).count(),
      1,
    );
  assert.equal(
    await phone.getByRole("button", { name: "Coinbase Smart Wallet" }).count(),
    1,
  );
  check(
    "Phone wallet paths",
    "four bundled wallet marks/deep links and Coinbase Smart Wallet; no relay/project ID",
  );
  await mobile.close();
  const empty = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const emptyState = await fixture(empty);
  emptyState.offline = true;
  await empty.addInitScript(() => {
    localStorage.setItem(
      "wheel-canvas:data:v1",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        data: {
          status: {
            data: {
              state: "IDLE",
              speed: 0,
              height: 5204,
              observedAt: "2026-10-31T08:30:00Z",
            },
          },
          hourly: {},
          history: {},
          economy: {},
        },
      }),
    );
  });
  const emptyPage = await empty.newPage();
  const emptyErrors = [];
  emptyPage.on("pageerror", (e) => emptyErrors.push(e.message));
  await emptyPage.clock.install({ time: NOW });
  await emptyPage.goto(url);
  await emptyPage.waitForFunction(() =>
    document
      .querySelector(".data-status")
      ?.textContent.includes("Data is unavailable"),
  );
  assert.equal(
    await emptyPage
      .locator(".below-canvas")
      .getByRole("button", { name: "Download PNG" })
      .isDisabled(),
    true,
  );
  assert.equal(
    await emptyPage
      .locator(".below-canvas")
      .getByRole("button", { name: "Share on X" })
      .isDisabled(),
    true,
  );
  assert.deepEqual(emptyErrors, []);
  check(
    "Unavailable data and malformed cache",
    "invalid cache ignored; explicit empty state; PNG/X sharing disabled; no invented totals or script failure",
  );
  await empty.close();
  try {
    const safari = await webkit.launch();
    browsers.push(safari);
    const safariContext = await safari.newContext({
      viewport: { width: 390, height: 844 },
    });
    await fixture(safariContext);
    const p = await safariContext.newPage();
    await p.clock.install({ time: NOW });
    await p.goto(url);
    await p.locator(".sign-button").click();
    await p.getByRole("dialog").waitFor();
    await p.keyboard.press("Escape");
    check("WebKit main interaction", "connect dialog opens and closes at 390");
    await safariContext.close();
  } catch (error) {
    results.push({
      name: "WebKit main interaction",
      passed: null,
      limitation: String(error).slice(0, 3000),
    });
    console.log(
      "LIMITATION WebKit main interaction could not run; see results.json",
    );
  }
} catch (error) {
  results.push({
    name: "Validation failure",
    passed: false,
    details: String(error.stack ?? error),
  });
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const browser of browsers) await browser.close();
  await new Promise((done) => server.close(done));
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
