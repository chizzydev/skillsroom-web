import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page, type Request as PlaywrightRequest } from "@playwright/test";

type MetricName =
  | "initial_chat_load"
  | "channel_switch"
  | "input_latency"
  | "message_append"
  | "reaction"
  | "search"
  | "open_media"
  | "open_thread"
  | "scroll_older_messages";

type Metric = {
  name: MetricName;
  duration_ms: number;
  ok: boolean;
  note?: string;
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

type ResponseTiming = {
  method: string;
  url: string;
  route: string;
  status: number;
  duration_ms: number | null;
};

type NavigationTiming = {
  url: string;
  dom_content_loaded_ms: number;
  load_event_ms: number;
  response_start_ms: number;
  response_end_ms: number;
};

type ChatWebLoadReport = {
  run_id: string;
  started_at: string;
  base_url: string;
  channel: string;
  final_url: string;
  switch_channel_hint: string;
  viewport: { width: number; height: number };
  metrics: Metric[];
  frame_sample: FrameSample;
  heap_before: HeapSnapshot;
  heap_after: HeapSnapshot;
  heap_growth_bytes: number | null;
  navigation_timing: NavigationTiming | null;
  response_timings: ResponseTiming[];
  slow_response_summary: Array<{ route: string; count: number; p50_ms: number | null; p95_ms: number | null; max_ms: number | null }>;
  response_errors: ResponseTiming[];
  console_errors: string[];
  request_failures: string[];
  previous?: {
    path: string;
    metric_deltas_ms: Partial<Record<MetricName, number>>;
    heap_growth_delta_bytes: number | null;
  } | null;
};

const rootDir = process.cwd();
const reportDir = path.join(rootDir, "reports", "chat-web-load");
const latestReportPath = path.join(reportDir, "latest.json");

const config = {
  baseUrl: trimTrailingSlash(process.env.CHAT_WEB_LOAD_BASE_URL ?? "http://localhost:3100"),
  channel: process.env.CHAT_WEB_LOAD_CHANNEL ?? "chat_load_lab",
  switchChannelHint: process.env.CHAT_WEB_LOAD_SWITCH_CHANNEL ?? "Global Chat",
  searchQuery: process.env.CHAT_WEB_LOAD_SEARCH ?? "the",
  email: process.env.CHAT_WEB_LOAD_EMAIL,
  password: process.env.CHAT_WEB_LOAD_PASSWORD,
  storageState: process.env.CHAT_WEB_LOAD_STORAGE_STATE,
  browserChannel: process.env.CHAT_WEB_LOAD_BROWSER_CHANNEL ?? "chrome",
  headless: process.env.CHAT_WEB_LOAD_HEADLESS !== "0",
  viewport: {
    width: Number(process.env.CHAT_WEB_LOAD_WIDTH ?? 1440),
    height: Number(process.env.CHAT_WEB_LOAD_HEIGHT ?? 900)
  }
};

const metricNames: MetricName[] = [
  "initial_chat_load",
  "channel_switch",
  "input_latency",
  "message_append",
  "reaction",
  "search",
  "open_media",
  "open_thread",
  "scroll_older_messages"
];

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const browser = await launchBrowser();
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];
  const responseTimings: ResponseTiming[] = [];
  const requestStartedAt = new WeakMap<PlaywrightRequest, number>();
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    context = await browser.newContext({
      storageState: config.storageState && existsSync(config.storageState) ? config.storageState : undefined,
      viewport: config.viewport
    });
    page = await context.newPage();
    const activePage = page;
    activePage.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    activePage.on("requestfailed", (request) => {
      const failure = request.failure();
      requestFailures.push(`${request.method()} ${request.url()} ${failure?.errorText ?? "failed"}`);
    });
    activePage.on("request", (request) => {
      if (routeLabel(request.url())) requestStartedAt.set(request, performance.now());
    });
    activePage.on("response", async (response) => {
      const request = response.request();
      const route = routeLabel(response.url());
      if (!route) return;
      const startedAt = requestStartedAt.get(request);
      responseTimings.push({
        method: request.method(),
        url: response.url(),
        route,
        status: response.status(),
        duration_ms: startedAt === undefined ? responseDurationMs(request.timing()) : Math.max(0, Math.round(performance.now() - startedAt))
      });
    });

    const metrics: Metric[] = [];
    await activePage.goto(chatUrl(config.channel), { waitUntil: "domcontentloaded" });
    await ensureAuthenticated(activePage);
    const heapBefore = await heapSnapshot(activePage);

    const initialMetric = await timed("initial_chat_load", async () => {
      await activePage.goto(chatUrl(config.channel), { waitUntil: "domcontentloaded" });
      await waitForChatReady(activePage);
    }, undefined, 35_000);
    metrics.push(initialMetric);
    if (!initialMetric.ok) {
      const heapAfter = await heapSnapshot(activePage).catch(() => emptyHeapSnapshot());
      const report: ChatWebLoadReport = {
        run_id: runId,
        started_at: new Date().toISOString(),
        base_url: config.baseUrl,
        channel: config.channel,
        final_url: activePage.url(),
        switch_channel_hint: config.switchChannelHint,
        viewport: config.viewport,
        metrics,
        frame_sample: { duration_ms: 0, frames: 0, dropped_frames: 0, max_frame_ms: 0, average_frame_ms: 0 },
        heap_before: heapBefore,
        heap_after: heapAfter,
        heap_growth_bytes: heapBefore.used_js_heap_size !== null && heapAfter.used_js_heap_size !== null
          ? heapAfter.used_js_heap_size - heapBefore.used_js_heap_size
          : null,
        navigation_timing: await navigationTiming(activePage).catch(() => null),
        response_timings: responseTimings,
        slow_response_summary: summarizeResponses(responseTimings),
        response_errors: responseTimings.filter((item) => item.status >= 400),
        console_errors: consoleErrors.slice(0, 25),
        request_failures: requestFailures.slice(0, 25),
        previous: previousComparison(metrics, heapBefore, heapAfter)
      };
      const reportPath = path.join(reportDir, `chat-web-load-${runId}.json`);
      writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
      writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`);
      printReport(report, reportPath);
      return;
    }
    metrics.push(await timed("channel_switch", async () => {
      const switched = await clickChannelByHint(activePage, config.switchChannelHint);
      if (!switched) {
        await activePage.goto(chatUrl("global"), { waitUntil: "domcontentloaded" });
      }
      await waitForChatReady(activePage);
    }, !config.switchChannelHint ? "No switch channel hint configured." : undefined, 25_000));
    await activePage.goto(chatUrl(config.channel), { waitUntil: "domcontentloaded" });
    await waitForChatReady(activePage);
    const frameSamplePromise = sampleFrames(activePage, 15_000);

    metrics.push(await timed("input_latency", async () => {
      const input = activePage.getByTestId("chat-composer-input").first();
      await input.waitFor({ state: "visible", timeout: 10_000 });
      const marker = `latency ${Date.now()}`;
      const start = Date.now();
      await input.fill(marker);
      await activePage.waitForFunction(
        (value) => {
          const field = document.querySelector("[data-testid='chat-composer-input']") as HTMLTextAreaElement | null;
          return field?.value === value;
        },
        marker,
        { timeout: 5_000 }
      );
      return Date.now() - start;
    }, undefined, 10_000));

    const messageText = `web load ${runId}`;
    metrics.push(await timed("message_append", async () => {
      await activePage.getByTestId("chat-composer-input").first().fill(messageText);
      await activePage.getByTestId("chat-send-button").first().click();
      await activePage.getByText(messageText, { exact: false }).waitFor({ state: "visible", timeout: 15_000 });
    }, undefined, 20_000));

    metrics.push(await timed("reaction", async () => {
      const reacted = await clickFirstVisible(activePage, [
        () => activePage.getByRole("button", { name: /^GG\b/i }).first(),
        () => activePage.getByRole("button", { name: /fire|🔥/i }).first(),
        () => activePage.locator("button").filter({ hasText: "GG" }).first()
      ]);
      if (!reacted) throw new Error("No visible reaction button found.");
    }, undefined, 12_000));

    metrics.push(await timed("search", async () => {
      await activePage.getByRole("button", { name: /search channel messages/i }).first().click();
      await activePage.getByTestId("chat-search-panel").waitFor({ state: "visible", timeout: 8_000 });
      await activePage.getByTestId("chat-search-input").fill(config.searchQuery);
      const searchResponse = activePage.waitForResponse(
        (response) => response.url().includes("/messages/search") && response.status() < 500,
        { timeout: 10_000 }
      );
      await activePage.getByRole("button", { name: /^search$/i }).last().click();
      await searchResponse;
      await activePage.getByTestId("chat-search-panel").waitFor({ state: "visible", timeout: 5_000 });
      await activePage.getByRole("button", { name: /close search/i }).click();
    }, undefined, 20_000));

    metrics.push(await timed("open_media", async () => {
      await activePage.getByRole("button", { name: /open channel details/i }).last().click();
      await clickTabByText(activePage, "Media");
      await activePage.getByTestId("chat-media-panel").waitFor({ state: "visible", timeout: 8_000 });
      await activePage.waitForTimeout(600);
      await activePage.getByRole("button", { name: /close channel details/i }).click();
    }, undefined, 15_000));

    metrics.push(await timed("open_thread", async () => {
      const opened = await clickFirstVisible(activePage, [
        () => activePage.locator("[data-testid='chat-message-row'] button").filter({ hasText: /^Thread$/ }).first(),
        () => activePage.locator("[data-testid='chat-message-row'] button").filter({ hasText: /replies/i }).first(),
        () => activePage.getByRole("button", { name: /^thread$/i }).first(),
        () => activePage.getByRole("button", { name: /\d+ replies/i }).first()
      ]);
      if (!opened) throw new Error("No thread control found.");
      await activePage.getByTestId("chat-thread-panel").waitFor({ state: "visible", timeout: 10_000 });
      await activePage.keyboard.press("Escape").catch(() => undefined);
    }, undefined, 15_000));

    metrics.push(await timed("scroll_older_messages", async () => {
      const list = activePage.getByTestId("chat-thread-virtual-list").first();
      await list.waitFor({ state: "visible", timeout: 8_000 });
      await list.evaluate((element) => {
        element.scrollTop = 0;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await activePage.waitForTimeout(1_200);
    }, undefined, 8_000));

    const frameSample = await frameSamplePromise;
    const heapAfter = await heapSnapshot(activePage);
    const report: ChatWebLoadReport = {
      run_id: runId,
      started_at: new Date().toISOString(),
      base_url: config.baseUrl,
      channel: config.channel,
      final_url: activePage.url(),
      switch_channel_hint: config.switchChannelHint,
      viewport: config.viewport,
      metrics,
      frame_sample: frameSample,
      heap_before: heapBefore,
      heap_after: heapAfter,
      heap_growth_bytes: heapBefore.used_js_heap_size !== null && heapAfter.used_js_heap_size !== null
        ? heapAfter.used_js_heap_size - heapBefore.used_js_heap_size
        : null,
      navigation_timing: await navigationTiming(activePage).catch(() => null),
      response_timings: responseTimings,
      slow_response_summary: summarizeResponses(responseTimings),
      response_errors: responseTimings.filter((item) => item.status >= 400),
      console_errors: consoleErrors.slice(0, 25),
      request_failures: requestFailures.slice(0, 25),
      previous: previousComparison(metrics, heapBefore, heapAfter)
    };

    const reportPath = path.join(reportDir, `chat-web-load-${runId}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`);
    printReport(report, reportPath);
  } finally {
    await page?.close().catch(() => undefined);
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
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
    throw new Error("Chat did not open an authenticated session. Set CHAT_WEB_LOAD_EMAIL and CHAT_WEB_LOAD_PASSWORD, or provide CHAT_WEB_LOAD_STORAGE_STATE.");
  }

  await page.goto(`${config.baseUrl}/sign-in?redirect=${encodeURIComponent(`/chat?channel=${config.channel}`)}`, { waitUntil: "domcontentloaded" });
  await page.locator("input[name='identifier'], input[type='email'], input[name='email']").first().fill(config.email);
  await page.locator("input[name='password'], input[type='password']").first().fill(config.password);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((url) => !/\/(sign-in|login|auth)/i.test(url.pathname), { timeout: 20_000 });
  if (!/\/chat/i.test(new URL(page.url()).pathname)) {
    await page.goto(chatUrl(config.channel), { waitUntil: "domcontentloaded" });
  }
}

async function waitForChatReady(page: Page) {
  await page.getByTestId("chat-composer-input").first().waitFor({ state: "visible", timeout: 20_000 });
  await Promise.race([
    page.getByTestId("chat-message-row").first().waitFor({ state: "visible", timeout: 20_000 }),
    page.getByText(/no messages yet/i).first().waitFor({ state: "visible", timeout: 20_000 })
  ]);
}

async function timed(name: MetricName, action: () => Promise<void | number>, note?: string, timeoutMs = 20_000): Promise<Metric> {
  console.log(`starting ${name}...`);
  const start = performance.now();
  try {
    const overrideDuration = await Promise.race([
      action(),
      new Promise<never>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`${name} timed out after ${timeoutMs}ms`)), timeoutMs);
        timer.unref?.();
      })
    ]);
    const metric = {
      name,
      duration_ms: Math.round(typeof overrideDuration === "number" ? overrideDuration : performance.now() - start),
      ok: true,
      note
    };
    console.log(`finished ${name}: ${metric.duration_ms}ms`);
    return metric;
  } catch (error) {
    const metric = {
      name,
      duration_ms: Math.round(performance.now() - start),
      ok: false,
      note: error instanceof Error ? error.message : String(error)
    };
    console.log(`failed ${name}: ${metric.duration_ms}ms (${metric.note})`);
    return metric;
  }
}

async function clickChannelByHint(page: Page, hint: string) {
  if (!hint) return false;
  return clickFirstVisible(page, [
    () => page.getByRole("button", { name: new RegExp(escapeRegExp(hint), "i") }).first(),
    () => page.getByText(hint, { exact: false }).first()
  ]);
}

async function clickTabByText(page: Page, text: string) {
  const clicked = await clickFirstVisible(page, [
    () => page.getByRole("button", { name: new RegExp(`^${escapeRegExp(text)}$`, "i") }).first(),
    () => page.getByText(text, { exact: true }).first()
  ]);
  if (!clicked) throw new Error(`${text} tab was not found.`);
}

async function clickFirstVisible(page: Page, factories: Array<() => ReturnType<Page["locator"]>>) {
  for (const factory of factories) {
    const locator = factory();
    try {
      await locator.waitFor({ state: "visible", timeout: 1_500 });
      await locator.click();
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function sampleFrames(page: Page, durationMs: number): Promise<FrameSample> {
  return page.evaluate(`
    new Promise((resolve) => {
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
    })
  `) as Promise<FrameSample>;
}

async function heapSnapshot(page: Page): Promise<HeapSnapshot> {
  return page.evaluate(() => {
    const memory = (performance as Performance & {
      memory?: {
        usedJSHeapSize: number;
        totalJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    }).memory;
    return {
      used_js_heap_size: memory?.usedJSHeapSize ?? null,
      total_js_heap_size: memory?.totalJSHeapSize ?? null,
      js_heap_size_limit: memory?.jsHeapSizeLimit ?? null
    };
  });
}

async function navigationTiming(page: Page): Promise<NavigationTiming | null> {
  return page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!entry) return null;
    return {
      url: entry.name,
      dom_content_loaded_ms: Math.round(entry.domContentLoadedEventEnd),
      load_event_ms: Math.round(entry.loadEventEnd),
      response_start_ms: Math.round(entry.responseStart),
      response_end_ms: Math.round(entry.responseEnd)
    };
  });
}

function responseDurationMs(timing: ReturnType<PlaywrightRequest["timing"]>) {
  const start = timing.startTime;
  const end = timing.responseEnd;
  if (start < 0 || end < 0) return null;
  return Math.max(0, Math.round(end - start));
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
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/messages")) return "web-api:messages";
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/heartbeat")) return "web-api:heartbeat";
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/read")) return "web-api:read";
  if (pathName.includes("/api/community/channels/") && pathName.endsWith("/presence")) return "web-api:presence";
  if (pathName.includes("/api/community/channels/") && pathName.includes("/thread")) return "web-api:thread";
  if (pathName.includes("/api/community/channels/") && pathName.includes("/media")) return "web-api:media";
  if (pathName.includes("/api/community/channels/") && pathName.includes("/reactions")) return "web-api:reactions";
  if (pathName === "/api/community/channels") return "web-api:channels";
  if (pathName === "/api/community/dm-requests") return "web-api:dm_requests";
  if (pathName === "/api/community/realtime/stream") return "web-api:realtime_stream";
  if (pathName.startsWith("/api/community/")) return `web-api:${pathName.replace(/^\/api\/community\//, "")}`;
  if (pathName.startsWith("/community/")) return `api:${pathName.replace(/^\/community\//, "")}`;
  return null;
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
      max_ms: values.length ? Math.max(...values) : null
    }))
    .sort((left, right) => (right.max_ms ?? 0) - (left.max_ms ?? 0));
}

function emptyHeapSnapshot(): HeapSnapshot {
  return {
    used_js_heap_size: null,
    total_js_heap_size: null,
    js_heap_size_limit: null
  };
}

function previousComparison(metrics: Metric[], heapBefore: HeapSnapshot, heapAfter: HeapSnapshot): ChatWebLoadReport["previous"] {
  if (!existsSync(latestReportPath)) return null;
  try {
    const previous = JSON.parse(readFileSync(latestReportPath, "utf8")) as ChatWebLoadReport;
    const previousByName = new Map(previous.metrics.map((metric) => [metric.name, metric.duration_ms]));
    const metricDeltas = Object.fromEntries(
      metricNames
        .map((name) => {
          const current = metrics.find((metric) => metric.name === name)?.duration_ms;
          const before = previousByName.get(name);
          return current !== undefined && before !== undefined ? [name, current - before] : null;
        })
        .filter(Boolean) as Array<[MetricName, number]>
    ) as Partial<Record<MetricName, number>>;
    const currentHeapGrowth = heapBefore.used_js_heap_size !== null && heapAfter.used_js_heap_size !== null
      ? heapAfter.used_js_heap_size - heapBefore.used_js_heap_size
      : null;
    return {
      path: latestReportPath,
      metric_deltas_ms: metricDeltas,
      heap_growth_delta_bytes: currentHeapGrowth !== null && previous.heap_growth_bytes !== null ? currentHeapGrowth - previous.heap_growth_bytes : null
    };
  } catch {
    return null;
  }
}

function printReport(report: ChatWebLoadReport, reportPath: string) {
  console.log(`Chat web load report: ${reportPath}`);
  for (const metric of report.metrics) {
    console.log(`${metric.ok ? "ok" : "fail"} ${metric.name}: ${metric.duration_ms}ms${metric.note ? ` (${metric.note})` : ""}`);
  }
  console.log(`frames: dropped=${report.frame_sample.dropped_frames}, max=${report.frame_sample.max_frame_ms}ms, avg=${report.frame_sample.average_frame_ms}ms`);
  console.log(`heap growth: ${report.heap_growth_bytes ?? "n/a"} bytes`);
  if (report.previous) {
    console.log(`compared with previous: ${JSON.stringify(report.previous.metric_deltas_ms)}`);
  } else {
    console.log("no previous report found; this run becomes the baseline.");
  }
  if (report.console_errors.length || report.request_failures.length) {
    console.log(`warnings: console_errors=${report.console_errors.length}, request_failures=${report.request_failures.length}`);
  }
}

function chatUrl(channel: string) {
  return `${config.baseUrl}/chat?channel=${encodeURIComponent(channel)}`;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
