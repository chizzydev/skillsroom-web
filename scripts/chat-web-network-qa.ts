import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type CDPSession, type Page, type Request as PlaywrightRequest } from "@playwright/test";

type ScenarioName =
  | "long_channel_baseline"
  | "slow_3g_initial_load"
  | "offline_resilience"
  | "flaky_reconnect"
  | "reload_reconnect";

type ScenarioResult = {
  name: ScenarioName;
  ok: boolean;
  duration_ms: number;
  note?: string;
  observations: Record<string, unknown>;
};

type ResponseTiming = {
  method: string;
  route: string;
  status: number;
  duration_ms: number | null;
};

type FrameSample = {
  duration_ms: number;
  frames: number;
  dropped_frames: number;
  max_frame_ms: number;
  average_frame_ms: number;
};

type HeapSnapshot = {
  used_js_heap_size: number | null;
  total_js_heap_size: number | null;
  js_heap_size_limit: number | null;
};

type NetworkQaReport = {
  run_id: string;
  started_at: string;
  base_url: string;
  channel: string;
  viewport: { width: number; height: number };
  scenarios: ScenarioResult[];
  response_timings: ResponseTiming[];
  slow_response_summary: Array<{ route: string; count: number; p50_ms: number | null; p95_ms: number | null; p99_ms: number | null; max_ms: number | null }>;
  response_errors: ResponseTiming[];
  console_errors: string[];
  request_failures: string[];
  heap_growth_bytes: number | null;
  frame_sample: FrameSample;
};

const rootDir = process.cwd();
const reportDir = path.join(rootDir, "reports", "chat-web-network-qa");
const latestReportPath = path.join(reportDir, "latest.json");

const config = {
  baseUrl: trimTrailingSlash(process.env.CHAT_WEB_NETWORK_QA_BASE_URL ?? process.env.CHAT_WEB_LOAD_BASE_URL ?? "http://localhost:3100"),
  channel: process.env.CHAT_WEB_NETWORK_QA_CHANNEL ?? process.env.CHAT_WEB_LOAD_CHANNEL ?? "chat_load_lab",
  email: process.env.CHAT_WEB_NETWORK_QA_EMAIL ?? process.env.CHAT_WEB_LOAD_EMAIL,
  password: process.env.CHAT_WEB_NETWORK_QA_PASSWORD ?? process.env.CHAT_WEB_LOAD_PASSWORD,
  storageState: process.env.CHAT_WEB_NETWORK_QA_STORAGE_STATE ?? process.env.CHAT_WEB_LOAD_STORAGE_STATE,
  browserChannel: process.env.CHAT_WEB_NETWORK_QA_BROWSER_CHANNEL ?? process.env.CHAT_WEB_LOAD_BROWSER_CHANNEL ?? "chrome",
  headless: process.env.CHAT_WEB_NETWORK_QA_HEADLESS !== "0",
  viewport: {
    width: Number(process.env.CHAT_WEB_NETWORK_QA_WIDTH ?? 390),
    height: Number(process.env.CHAT_WEB_NETWORK_QA_HEIGHT ?? 844)
  }
};

let observedRealtimeRequests = 0;

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const browser = await launchBrowser();
  const responseTimings: ResponseTiming[] = [];
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  const requestStartedAt = new WeakMap<PlaywrightRequest, number>();
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let cdp: CDPSession | null = null;

  try {
    context = await browser.newContext({
      storageState: config.storageState && existsSync(config.storageState) ? config.storageState : undefined,
      viewport: config.viewport
    });
    page = await context.newPage();
    cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("request", (request) => {
      const label = routeLabel(request.url());
      if (label) requestStartedAt.set(request, performance.now());
      if (label === "web-api:realtime_stream") observedRealtimeRequests += 1;
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure();
      const label = routeLabel(request.url());
      if (label) requestFailures.push(`${request.method()} ${label} ${failure?.errorText ?? "failed"}`);
    });
    page.on("response", async (response) => {
      const route = routeLabel(response.url());
      if (!route) return;
      const request = response.request();
      const startedAt = requestStartedAt.get(request);
      responseTimings.push({
        method: request.method(),
        route,
        status: response.status(),
        duration_ms: startedAt === undefined ? responseDurationMs(request.timing()) : Math.max(0, Math.round(performance.now() - startedAt))
      });
    });

    await page.goto(chatUrl(), { waitUntil: "domcontentloaded" });
    await ensureAuthenticated(page);
    await waitForChatReady(page);
    const heapBefore = await heapSnapshot(page);

    const scenarios: ScenarioResult[] = [];
    scenarios.push(await scenario("long_channel_baseline", () => longChannelBaseline(page!)));
    scenarios.push(await scenario("slow_3g_initial_load", () => slow3gInitialLoad(page!, cdp!), 90_000));
    scenarios.push(await scenario("offline_resilience", () => offlineResilience(page!, context!)));
    scenarios.push(await scenario("flaky_reconnect", () => flakyReconnect(page!, context!)));
    scenarios.push(await scenario("reload_reconnect", () => reloadReconnect(page!, cdp!)));

    await normalNetwork(cdp);
    await context.setOffline(false);
    const frameSample = await sampleFrames(page, 8_000).catch(() => emptyFrameSample());
    const heapAfter = await heapSnapshot(page).catch(() => emptyHeapSnapshot());
    const report: NetworkQaReport = {
      run_id: runId,
      started_at: new Date().toISOString(),
      base_url: config.baseUrl,
      channel: config.channel,
      viewport: config.viewport,
      scenarios,
      response_timings: responseTimings,
      slow_response_summary: summarizeResponses(responseTimings),
      response_errors: responseTimings.filter((item) => item.status >= 400),
      console_errors: consoleErrors.slice(0, 25),
      request_failures: requestFailures.slice(0, 50),
      heap_growth_bytes: heapBefore.used_js_heap_size !== null && heapAfter.used_js_heap_size !== null
        ? heapAfter.used_js_heap_size - heapBefore.used_js_heap_size
        : null,
      frame_sample: frameSample
    };
    const reportPath = path.join(reportDir, `chat-web-network-qa-${runId}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`);
    printReport(report, reportPath);
    if (scenarios.some((item) => !item.ok)) process.exitCode = 1;
  } finally {
    await cdp?.detach().catch(() => undefined);
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}

async function scenario(name: ScenarioName, action: () => Promise<Record<string, unknown>>, timeoutMs = 45_000): Promise<ScenarioResult> {
  const startedAt = performance.now();
  try {
    const observations = await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
        timer.unref?.();
      })
    ]);
    return { name, ok: true, duration_ms: Math.round(performance.now() - startedAt), observations };
  } catch (error) {
    return {
      name,
      ok: false,
      duration_ms: Math.round(performance.now() - startedAt),
      note: error instanceof Error ? error.message : String(error),
      observations: {}
    };
  }
}

async function longChannelBaseline(page: Page) {
  await page.goto(chatUrl(), { waitUntil: "domcontentloaded" });
  await waitForChatReady(page);
  const rows = await page.getByTestId("chat-message-row").count();
  const olderButtonVisible = await page.getByTestId("chat-load-older-messages").first().isVisible().catch(() => false);
  return { visible_message_rows: rows, older_button_visible: olderButtonVisible, url: page.url() };
}

async function slow3gInitialLoad(page: Page, cdp: CDPSession) {
  await emulateSlow3g(cdp);
  const startedAt = performance.now();
  await page.goto(chatUrl(), { waitUntil: "domcontentloaded", timeout: 40_000 });
  await page.getByTestId("chat-composer-input").first().waitFor({ state: "visible", timeout: 45_000 });
  const shellMs = Math.round(performance.now() - startedAt);
  await Promise.race([
    page.getByTestId("chat-message-row").first().waitFor({ state: "visible", timeout: 45_000 }),
    page.getByText(/no messages yet/i).first().waitFor({ state: "visible", timeout: 45_000 })
  ]);
  const messagesMs = Math.round(performance.now() - startedAt);
  await normalNetwork(cdp);
  return { shell_ready_ms: shellMs, messages_ready_ms: messagesMs, condition: "slow_3g" };
}

async function offlineResilience(page: Page, context: BrowserContext) {
  await waitForChatReady(page);
  await context.setOffline(true);
  const input = page.getByTestId("chat-composer-input").first();
  const marker = `offline draft ${Date.now()}`;
  await input.fill(marker);
  const retained = await page.evaluate((value) => {
    const field = document.querySelector("[data-testid='chat-composer-input']") as HTMLTextAreaElement | null;
    return field?.value === value;
  }, marker);
  const composerVisible = await input.isVisible().catch(() => false);
  await page.waitForTimeout(2_000);
  await context.setOffline(false);
  await waitForChatReady(page, 25_000);
  return { composer_visible_offline: composerVisible, draft_retained_offline: retained };
}

async function flakyReconnect(page: Page, context: BrowserContext) {
  await waitForChatReady(page);
  const beforeRealtime = observedRealtimeRequests;
  await page.evaluate(() => window.dispatchEvent(new Event("offline"))).catch(() => undefined);
  await context.setOffline(true);
  await page.waitForTimeout(1_500);
  const offlineStatusText = await page.getByTestId("chat-stream-status").first().textContent().catch(() => "");
  const reconnectingSeen = /reconnecting|starting/i.test(offlineStatusText ?? "");
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online"))).catch(() => undefined);
  await page.waitForTimeout(8_000);
  await waitForChatReady(page, 25_000);
  const onlineStatusText = await page.getByTestId("chat-stream-status").first().textContent().catch(() => "");
  const liveSeen = /\b(on|live)\b/i.test(onlineStatusText ?? "");
  if (!reconnectingSeen) throw new Error(`Realtime reconnecting state was not visible while offline. Status text: ${offlineStatusText || "none"}.`);
  if (!liveSeen) throw new Error(`Realtime stream did not visibly recover after network was restored. Status text: ${onlineStatusText || "none"}.`);
  return { reconnecting_seen: reconnectingSeen, recovered_live_indicator_seen: liveSeen, offline_status_text: offlineStatusText, online_status_text: onlineStatusText, realtime_requests_before: beforeRealtime, realtime_requests_after: observedRealtimeRequests };
}

async function reloadReconnect(page: Page, cdp: CDPSession) {
  await normalNetwork(cdp);
  const beforeRealtime = observedRealtimeRequests;
  const startedAt = performance.now();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 35_000 });
  await waitForChatReady(page, 30_000);
  await page.waitForTimeout(2_000);
  return {
    reload_ms: Math.round(performance.now() - startedAt),
    realtime_stream_requests_before: beforeRealtime,
    realtime_stream_requests_after: observedRealtimeRequests
  };
}

async function launchBrowser(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: config.browserChannel || undefined, headless: config.headless });
  } catch (error) {
    if (!config.browserChannel) throw error;
    return chromium.launch({ headless: config.headless });
  }
}

async function ensureAuthenticated(page: Page) {
  if (await page.getByTestId("chat-composer-input").first().isVisible().catch(() => false)) return;
  if (!config.email || !config.password) {
    throw new Error("Set CHAT_WEB_NETWORK_QA_EMAIL and CHAT_WEB_NETWORK_QA_PASSWORD, or provide CHAT_WEB_NETWORK_QA_STORAGE_STATE.");
  }

  await page.goto(`${config.baseUrl}/sign-in?redirect=${encodeURIComponent(`/chat?channel=${config.channel}`)}`, { waitUntil: "domcontentloaded" });
  await page.locator("input[name='identifier'], input[type='email'], input[name='email']").first().fill(config.email);
  await page.locator("input[name='password'], input[type='password']").first().fill(config.password);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((url) => !/\/(sign-in|login|auth)/i.test(url.pathname), { timeout: 20_000 });
  if (!/\/chat/i.test(new URL(page.url()).pathname)) {
    await page.goto(chatUrl(), { waitUntil: "domcontentloaded" });
  }
}

async function waitForChatReady(page: Page, timeout = 20_000) {
  await page.getByTestId("chat-composer-input").first().waitFor({ state: "visible", timeout });
  await Promise.race([
    page.getByTestId("chat-message-row").first().waitFor({ state: "visible", timeout }),
    page.getByText(/no messages yet/i).first().waitFor({ state: "visible", timeout })
  ]);
}

async function emulateSlow3g(cdp: CDPSession) {
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: Math.floor((400 * 1024) / 8),
    uploadThroughput: Math.floor((400 * 1024) / 8)
  });
}

async function normalNetwork(cdp: CDPSession | null) {
  await cdp?.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1
  }).catch(() => undefined);
}

async function sampleFrames(page: Page, durationMs: number): Promise<FrameSample> {
  return page.evaluate(`new Promise((resolve) => {
    const duration = ${JSON.stringify(durationMs)};
    const start = performance.now();
    let last = start;
    let frames = 0;
    let droppedFrames = 0;
    let totalFrameMs = 0;
    let maxFrameMs = 0;
    function tick(now) {
      const delta = now - last;
      if (frames > 0) {
        totalFrameMs += delta;
        maxFrameMs = Math.max(maxFrameMs, delta);
        if (delta > 50) droppedFrames += Math.max(1, Math.round(delta / 16.7) - 1);
      }
      frames += 1;
      last = now;
      if (now - start >= duration) {
        resolve({
          duration_ms: Math.round(now - start),
          frames,
          dropped_frames: droppedFrames,
          max_frame_ms: Math.round(maxFrameMs),
          average_frame_ms: frames > 1 ? Math.round(totalFrameMs / (frames - 1)) : 0
        });
        return;
      }
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })`) as Promise<FrameSample>;
}

async function heapSnapshot(page: Page): Promise<HeapSnapshot> {
  return page.evaluate(() => {
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    return {
      used_js_heap_size: memory?.usedJSHeapSize ?? null,
      total_js_heap_size: memory?.totalJSHeapSize ?? null,
      js_heap_size_limit: memory?.jsHeapSizeLimit ?? null
    };
  });
}

function routeLabel(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.origin !== config.baseUrl && !url.pathname.startsWith("/community/")) return null;
  const pathName = url.pathname;
  if (pathName === "/chat") return "page:/chat";
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/messages/search")) return "web-api:messages_search";
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/messages") && url.searchParams.has("cursor")) return "web-api:older_messages";
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/messages")) return "web-api:messages";
  if (pathName.includes("/api/community/channels/") && pathName.includes("/thread")) return "web-api:thread";
  if (pathName.includes("/api/community/channels/") && pathName.includes("/media")) return "web-api:media";
  if (pathName === "/api/community/channels") return "web-api:channels";
  if (pathName === "/api/community/realtime/stream") return "web-api:realtime_stream";
  if (pathName.startsWith("/api/community/")) return `web-api:${pathName.replace(/^\/api\/community\//, "")}`;
  if (pathName.startsWith("/community/")) return `api:${pathName.replace(/^\/community\//, "")}`;
  return null;
}

function responseDurationMs(timing: ReturnType<PlaywrightRequest["timing"]>) {
  if (timing.startTime < 0 || timing.responseEnd < 0) return null;
  return Math.max(0, Math.round(timing.responseEnd - timing.startTime));
}

function percentile(values: number[], percentileValue: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarizeResponses(timings: ResponseTiming[]) {
  const byRoute = new Map<string, number[]>();
  for (const timing of timings) {
    if (timing.duration_ms === null) continue;
    byRoute.set(timing.route, [...(byRoute.get(timing.route) ?? []), timing.duration_ms]);
  }
  return [...byRoute.entries()]
    .map(([route, values]) => ({
      route,
      count: values.length,
      p50_ms: percentile(values, 50),
      p95_ms: percentile(values, 95),
      p99_ms: percentile(values, 99),
      max_ms: values.length ? Math.max(...values) : null
    }))
    .sort((left, right) => (right.max_ms ?? 0) - (left.max_ms ?? 0));
}

function emptyHeapSnapshot(): HeapSnapshot {
  return { used_js_heap_size: null, total_js_heap_size: null, js_heap_size_limit: null };
}

function emptyFrameSample(): FrameSample {
  return { duration_ms: 0, frames: 0, dropped_frames: 0, max_frame_ms: 0, average_frame_ms: 0 };
}

function printReport(report: NetworkQaReport, reportPath: string) {
  console.log(`Chat web network QA report: ${reportPath}`);
  for (const result of report.scenarios) {
    console.log(`${result.ok ? "ok" : "fail"} ${result.name}: ${result.duration_ms}ms${result.note ? ` (${result.note})` : ""}`);
  }
  console.log(`frames: dropped=${report.frame_sample.dropped_frames}, max=${report.frame_sample.max_frame_ms}ms, avg=${report.frame_sample.average_frame_ms}ms`);
  console.log(`heap growth: ${report.heap_growth_bytes ?? "n/a"} bytes`);
  if (report.console_errors.length || report.request_failures.length || report.response_errors.length) {
    console.log(`warnings: console_errors=${report.console_errors.length}, request_failures=${report.request_failures.length}, response_errors=${report.response_errors.length}`);
  }
}

function chatUrl() {
  return `${config.baseUrl}/chat?channel=${encodeURIComponent(config.channel)}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
