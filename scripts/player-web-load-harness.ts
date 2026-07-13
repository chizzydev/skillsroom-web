import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page, type Request as PlaywrightRequest } from "@playwright/test";

type FlowName =
  | "unauthenticated_landing"
  | "sign_in_session_reuse"
  | "home"
  | "rooms_list"
  | "create_room_open_path"
  | "room_detail"
  | "tournaments_list"
  | "tournament_detail"
  | "wallet"
  | "profile"
  | "notifications"
  | "community_hub"
  | "community_public_pages";

type HeapSnapshot = {
  used_js_heap_size: number | null;
  total_js_heap_size: number | null;
  js_heap_size_limit: number | null;
};

type NavigationTiming = {
  url: string;
  dom_content_loaded_ms: number;
  load_event_ms: number;
  response_start_ms: number;
  response_end_ms: number;
};

type ResponseTiming = {
  method: string;
  url: string;
  route: string;
  status: number;
  duration_ms: number | null;
  source?: "browser" | "server";
};

type ServerApiTrace = {
  at: string;
  path: string;
  method: string;
  status: number | null;
  duration_ms: number;
  ok: boolean;
  public: boolean;
};

type FlowMetric = {
  name: FlowName;
  path: string;
  final_url: string;
  ok: boolean;
  note?: string;
  server_response_ms: number | null;
  browser_navigation_ms: number;
  hydration_render_ms: number | null;
  heap_before: HeapSnapshot;
  heap_after: HeapSnapshot;
  heap_growth_bytes: number | null;
  api_request_count: number;
  duplicate_requests: Array<{ route: string; count: number }>;
  failed_requests: ResponseTiming[];
  navigation_timing: NavigationTiming | null;
  response_timings: ResponseTiming[];
};

type PlayerWebLoadReport = {
  run_id: string;
  started_at: string;
  base_url: string;
  viewport: { width: number; height: number };
  flows: FlowMetric[];
  totals: {
    api_request_count: number;
    failed_request_count: number;
    duplicate_request_count: number;
    heap_growth_bytes: number | null;
  };
  slow_response_summary: Array<{ route: string; count: number; p50_ms: number | null; p95_ms: number | null; max_ms: number | null }>;
  console_errors: string[];
  request_failures: string[];
  previous?: {
    path: string;
    navigation_deltas_ms: Partial<Record<FlowName, number>>;
    api_request_count_delta: number;
    heap_growth_delta_bytes: number | null;
  } | null;
};

const rootDir = process.cwd();
const reportDir = path.join(rootDir, "reports", "player-web-load");
const latestReportPath = path.join(reportDir, "latest.json");

const config = {
  baseUrl: trimTrailingSlash(process.env.PLAYER_WEB_LOAD_BASE_URL ?? "http://localhost:3100"),
  email: process.env.PLAYER_WEB_LOAD_EMAIL,
  password: process.env.PLAYER_WEB_LOAD_PASSWORD,
  storageState: process.env.PLAYER_WEB_LOAD_STORAGE_STATE,
  writeStorageState: process.env.PLAYER_WEB_LOAD_WRITE_STORAGE_STATE,
  roomId: process.env.PLAYER_WEB_LOAD_ROOM_ID,
  tournamentId: process.env.PLAYER_WEB_LOAD_TOURNAMENT_ID,
  serverTraceLog: process.env.PLAYER_WEB_LOAD_SERVER_TRACE_LOG ?? path.join(rootDir, "tmp-web-dev.out.log"),
  browserChannel: process.env.PLAYER_WEB_LOAD_BROWSER_CHANNEL ?? "chrome",
  headless: process.env.PLAYER_WEB_LOAD_HEADLESS !== "0",
  viewport: {
    width: Number(process.env.PLAYER_WEB_LOAD_WIDTH ?? 1440),
    height: Number(process.env.PLAYER_WEB_LOAD_HEIGHT ?? 900)
  }
};

const flows: Array<{ name: FlowName; path: string; auth: boolean; resolvePath?: (page: Page) => Promise<string> }> = [
  { name: "unauthenticated_landing", path: "/", auth: false },
  { name: "sign_in_session_reuse", path: "/", auth: true },
  { name: "home", path: "/", auth: true },
  { name: "rooms_list", path: "/matches", auth: true },
  { name: "create_room_open_path", path: "/matches/new", auth: true },
  { name: "room_detail", path: "/matches", auth: true, resolvePath: resolveRoomDetailPath },
  { name: "tournaments_list", path: "/tournaments", auth: true },
  { name: "tournament_detail", path: "/tournaments", auth: true, resolvePath: resolveTournamentDetailPath },
  { name: "wallet", path: "/wallet", auth: true },
  { name: "profile", path: "/profile", auth: true },
  { name: "notifications", path: "/notifications", auth: true },
  { name: "community_hub", path: "/community", auth: true },
  { name: "community_public_pages", path: "/community/highlights", auth: true }
];

async function main() {
  mkdirSync(reportDir, { recursive: true });
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const browser = await launchBrowser();
  const consoleErrors: string[] = [];
  const requestFailures: string[] = [];

  try {
    const unauthenticatedContext = await browser.newContext({ viewport: config.viewport });
    const unauthenticatedPage = await unauthenticatedContext.newPage();
    attachPageDiagnostics(unauthenticatedPage, consoleErrors, requestFailures);
    const flowReports: FlowMetric[] = [
      await measureFlow(unauthenticatedPage, flows[0])
    ];
    await unauthenticatedContext.close();

    const authenticatedContext = await authenticatedBrowserContext(browser);
    const authenticatedPage = await authenticatedContext.newPage();
    attachPageDiagnostics(authenticatedPage, consoleErrors, requestFailures);
    await ensureAuthenticated(authenticatedPage);
    if (config.writeStorageState) {
      await authenticatedContext.storageState({ path: config.writeStorageState });
    }

    for (const flow of flows.slice(1)) {
      if (flow.auth) {
        await ensureAuthenticated(authenticatedPage);
      }
      flowReports.push(await measureFlow(authenticatedPage, flow));
    }

    await authenticatedContext.close();

    const allResponses = flowReports.flatMap((flow) => flow.response_timings);
    const heapGrowthValues = flowReports
      .map((flow) => flow.heap_growth_bytes)
      .filter((value): value is number => value !== null);
    const report: PlayerWebLoadReport = {
      run_id: runId,
      started_at: new Date().toISOString(),
      base_url: config.baseUrl,
      viewport: config.viewport,
      flows: flowReports,
      totals: {
        api_request_count: flowReports.reduce((sum, flow) => sum + flow.api_request_count, 0),
        failed_request_count: flowReports.reduce((sum, flow) => sum + flow.failed_requests.length, 0),
        duplicate_request_count: flowReports.reduce((sum, flow) => sum + flow.duplicate_requests.reduce((inner, item) => inner + item.count - 1, 0), 0),
        heap_growth_bytes: heapGrowthValues.length ? heapGrowthValues.reduce((sum, value) => sum + value, 0) : null
      },
      slow_response_summary: summarizeResponses(allResponses),
      console_errors: consoleErrors.slice(0, 50),
      request_failures: requestFailures.slice(0, 50),
      previous: previousComparison(flowReports)
    };

    const reportPath = path.join(reportDir, `player-web-load-${runId}.json`);
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    writeFileSync(latestReportPath, `${JSON.stringify(report, null, 2)}\n`);
    printReport(report, reportPath);
  } finally {
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

async function authenticatedBrowserContext(browser: Browser) {
  return browser.newContext({
    storageState: config.storageState && existsSync(config.storageState) ? config.storageState : undefined,
    viewport: config.viewport
  });
}

function attachPageDiagnostics(page: Page, consoleErrors: string[], requestFailures: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure();
    requestFailures.push(`${request.method()} ${request.url()} ${failure?.errorText ?? "failed"}`);
  });
}

async function ensureAuthenticated(page: Page) {
  if (config.email && config.password) {
    const session = await loginViaApi();
    await setSessionCookies(page, session);
    await assertAuthenticated(page);
    return;
  }

  await safeGoto(page, `${config.baseUrl}/matches`);
  if (!/\/(sign-in|login|auth)/i.test(new URL(page.url()).pathname)) return;
  throw new Error("Authenticated flows need PLAYER_WEB_LOAD_EMAIL and PLAYER_WEB_LOAD_PASSWORD, or PLAYER_WEB_LOAD_STORAGE_STATE.");
}

async function setSessionCookies(page: Page, session: Awaited<ReturnType<typeof loginViaApi>>) {
  const accessExpires = Math.floor(Date.parse(session.access_token_expires_at) / 1000);
  const refreshExpires = Math.floor(Date.parse(session.refresh_token_expires_at) / 1000);
  await page.context().addCookies([
    cookie("skill_rooms_access_token", session.access_token, accessExpires),
    cookie("__Host-skill_rooms_access_token", session.access_token, accessExpires),
    cookie("skill_rooms_refresh_token", session.refresh_token, refreshExpires),
    cookie("__Host-skill_rooms_refresh_token", session.refresh_token, refreshExpires)
  ]);
}

function cookie(name: string, value: string, expires: number) {
  return {
    name,
    value,
    url: config.baseUrl,
    httpOnly: true,
    sameSite: "Lax" as const,
    expires
  };
}

async function assertAuthenticated(page: Page) {
  const response = await page.request.get(`${config.baseUrl}/api/auth/me`, {
    headers: { accept: "application/json" },
    timeout: 10_000
  });
  const payload = (await response.json().catch(() => null)) as { ok?: boolean; data?: { user?: unknown } } | null;
  if (!response.ok() || payload?.ok !== true || !payload.data?.user) {
    throw new Error(`Player web load authentication did not stick through the web app: ${response.status()}`);
  }
}

async function safeGoto(page: Page, url: string) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35_000 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("net::ERR_ABORTED")) throw error;
    await page.waitForLoadState("domcontentloaded", { timeout: 10_000 }).catch(() => undefined);
  }
}

async function loginViaApi() {
  const response = await fetch(`${apiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: config.baseUrl
    },
    body: JSON.stringify({
      identifier: config.email,
      password: config.password
    })
  });
  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    data?: {
      access_token: string;
      refresh_token: string;
      access_token_expires_at: string;
      refresh_token_expires_at: string;
    };
    error?: { message?: string };
  } | null;
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error(payload?.error?.message ?? `API login failed with status ${response.status}.`);
  }
  return payload.data;
}

async function measureFlow(
  page: Page,
  flow: { name: FlowName; path: string; resolvePath?: (page: Page) => Promise<string> }
): Promise<FlowMetric> {
  console.log(`starting ${flow.name}...`);
  const pathToVisit = flow.resolvePath ? await flow.resolvePath(page).catch(() => flow.path) : flow.path;
  const responseTimings: ResponseTiming[] = [];
  const requestStartedAt = new WeakMap<PlaywrightRequest, number>();
  const serverTraceOffset = traceLogOffset();
  const onRequest = (request: PlaywrightRequest) => {
    if (routeLabel(request.url())) requestStartedAt.set(request, performance.now());
  };
  const onResponse = async (response: Awaited<ReturnType<Page["waitForResponse"]>>) => {
    const request = response.request();
    const route = routeLabel(response.url());
    if (!route) return;
    const startedAt = requestStartedAt.get(request);
    responseTimings.push({
      method: request.method(),
      url: response.url(),
      route,
      status: response.status(),
      duration_ms: startedAt === undefined ? responseDurationMs(request.timing()) : Math.max(0, Math.round(performance.now() - startedAt)),
      source: "browser"
    });
  };

  page.on("request", onRequest);
  page.on("response", onResponse);
  const heapBefore = await heapSnapshot(page).catch(() => emptyHeapSnapshot());
  const targetUrl = `${config.baseUrl}${pathToVisit}`;
  const start = performance.now();
  let ok = true;
  let note: string | undefined;
  let serverResponseMs: number | null = null;
  let hydrationRenderMs: number | null = null;

  try {
    const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });
    serverResponseMs = responseDurationMs(response?.request().timing());
    hydrationRenderMs = await waitForRender(page);
  } catch (error) {
    ok = false;
    note = error instanceof Error ? error.message : String(error);
  }

  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
  const heapAfter = await heapSnapshot(page).catch(() => emptyHeapSnapshot());
  const browserNavigationMs = Math.round(performance.now() - start);
  page.off("request", onRequest);
  page.off("response", onResponse);
  const serverResponseTimings = readServerApiTraces(serverTraceOffset).map(traceToResponseTiming);
  responseTimings.push(...serverResponseTimings);

  const apiResponses = responseTimings.filter((item) => item.route.startsWith("api:") || item.route.startsWith("web-api:"));
  const metric: FlowMetric = {
    name: flow.name,
    path: pathToVisit,
    final_url: page.url(),
    ok,
    note,
    server_response_ms: serverResponseMs,
    browser_navigation_ms: browserNavigationMs,
    hydration_render_ms: hydrationRenderMs,
    heap_before: heapBefore,
    heap_after: heapAfter,
    heap_growth_bytes: heapBefore.used_js_heap_size !== null && heapAfter.used_js_heap_size !== null
      ? heapAfter.used_js_heap_size - heapBefore.used_js_heap_size
      : null,
    api_request_count: apiResponses.length,
    duplicate_requests: duplicateRequests(apiResponses),
    failed_requests: responseTimings.filter((item) => item.status >= 400),
    navigation_timing: await navigationTiming(page).catch(() => null),
    response_timings: responseTimings
  };
  console.log(`${metric.ok ? "finished" : "failed"} ${flow.name}: nav=${metric.browser_navigation_ms}ms api=${metric.api_request_count}`);
  return metric;
}

async function resolveRoomDetailPath(page: Page) {
  if (config.roomId) return `/matches/${encodeURIComponent(config.roomId)}`;
  await page.goto(`${config.baseUrl}/matches`, { waitUntil: "domcontentloaded" });
  const href = await page.evaluate(() => {
    const roomPathPattern = /^\/matches\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
    return anchors.find((anchor) => roomPathPattern.test(new URL(anchor.href).pathname))?.href ?? null;
  });
  return href ? new URL(href, config.baseUrl).pathname : "/matches";
}

async function resolveTournamentDetailPath(page: Page) {
  if (config.tournamentId) return `/tournaments/${encodeURIComponent(config.tournamentId)}`;
  await page.goto(`${config.baseUrl}/tournaments`, { waitUntil: "domcontentloaded" });
  const href = await firstHref(page, ["/tournaments/"]);
  return href ? new URL(href, config.baseUrl).pathname : "/tournaments";
}

async function firstHref(page: Page, pathHints: string[]) {
  return page.evaluate((hints) => {
    const anchors = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")];
    return anchors.find((anchor) => hints.some((hint) => anchor.href.includes(hint)))?.href ?? null;
  }, pathHints);
}

async function waitForRender(page: Page) {
  const start = performance.now();
  await Promise.race([
    page.locator("main, [data-testid], h1").first().waitFor({ state: "visible", timeout: 12_000 }),
    page.waitForLoadState("networkidle", { timeout: 12_000 })
  ]);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return Math.round(performance.now() - start);
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

function responseDurationMs(timing?: ReturnType<PlaywrightRequest["timing"]>) {
  if (!timing) return null;
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

  const base = new URL(config.baseUrl);
  const pathName = url.pathname;
  if (url.origin === config.baseUrl) {
    if (pathName.startsWith("/api/")) return `web-api:${pathName.replace(/^\/api\//, "")}`;
    return `page:${pathName || "/"}`;
  }
  if (url.host === base.host && pathName.startsWith("/api/")) return `web-api:${pathName.replace(/^\/api\//, "")}`;
  if (pathName.startsWith("/match-rooms")) return `api:${normalizeApiRoute(pathName, "/match-rooms")}`;
  if (pathName.startsWith("/tournaments")) return `api:${normalizeApiRoute(pathName, "/tournaments")}`;
  if (pathName.startsWith("/wallet")) return `api:${normalizeApiRoute(pathName, "/wallet")}`;
  if (pathName.startsWith("/player")) return `api:${normalizeApiRoute(pathName, "/player")}`;
  if (pathName.startsWith("/profiles")) return `api:${normalizeApiRoute(pathName, "/profiles")}`;
  if (pathName.startsWith("/community")) return `api:${normalizeApiRoute(pathName, "/community")}`;
  if (pathName.startsWith("/games")) return "api:/games";
  return null;
}

function routeLabelForApiPath(pathName: string) {
  if (pathName.startsWith("/match-rooms")) return `api:${normalizeApiRoute(pathName, "/match-rooms")}`;
  if (pathName.startsWith("/tournaments")) return `api:${normalizeApiRoute(pathName, "/tournaments")}`;
  if (pathName.startsWith("/wallet")) return `api:${normalizeApiRoute(pathName, "/wallet")}`;
  if (pathName.startsWith("/player")) return `api:${normalizeApiRoute(pathName, "/player")}`;
  if (pathName.startsWith("/profiles")) return `api:${normalizeApiRoute(pathName, "/profiles")}`;
  if (pathName.startsWith("/community")) return `api:${normalizeApiRoute(pathName, "/community")}`;
  if (pathName.startsWith("/games")) return "api:/games";
  if (pathName.startsWith("/auth")) return `api:${normalizeApiRoute(pathName, "/auth")}`;
  return `api:${pathName}`;
}

function traceLogOffset() {
  try {
    return existsSync(config.serverTraceLog) ? statSync(config.serverTraceLog).size : 0;
  } catch {
    return 0;
  }
}

function readServerApiTraces(offset: number) {
  if (!existsSync(config.serverTraceLog)) return [];
  try {
    const log = readFileSync(config.serverTraceLog);
    const nextChunk = log.subarray(offset).toString("utf8").replace(/\0/g, "");
    return [...nextChunk.matchAll(/PLAYER_WEB_LOAD_API (\{[\s\S]*?\})/g)]
      .map((match) => match[1].replace(/\r?\n/g, ""))
      .flatMap((value) => {
        try {
          return [JSON.parse(value) as ServerApiTrace];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function traceToResponseTiming(trace: ServerApiTrace): ResponseTiming {
  const pathName = trace.path.split("?")[0] || trace.path;
  return {
    method: trace.method,
    url: `${config.baseUrl}${trace.path}`,
    route: routeLabelForApiPath(pathName),
    status: trace.status ?? 0,
    duration_ms: trace.duration_ms,
    source: "server"
  };
}

function normalizeApiRoute(pathName: string, prefix: string) {
  return pathName
    .replace(new RegExp(`^${escapeRegExp(prefix)}`), prefix)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ":id");
}

function duplicateRequests(responses: ResponseTiming[]) {
  const counts = new Map<string, number>();
  for (const response of responses) {
    const key = `${response.method} ${response.route}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([route, count]) => ({ route, count }))
    .sort((left, right) => right.count - left.count);
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

function previousComparison(flowsToCompare: FlowMetric[]): PlayerWebLoadReport["previous"] {
  if (!existsSync(latestReportPath)) return null;
  try {
    const previous = JSON.parse(readFileSync(latestReportPath, "utf8")) as PlayerWebLoadReport;
    const previousByName = new Map(previous.flows.map((flow) => [flow.name, flow.browser_navigation_ms]));
    const navigationDeltas = Object.fromEntries(
      flowsToCompare
        .map((flow) => {
          const before = previousByName.get(flow.name);
          return before === undefined ? null : [flow.name, flow.browser_navigation_ms - before];
        })
        .filter(Boolean) as Array<[FlowName, number]>
    ) as Partial<Record<FlowName, number>>;
    const heapGrowth = flowsToCompare
      .map((flow) => flow.heap_growth_bytes)
      .filter((value): value is number => value !== null)
      .reduce((sum, value) => sum + value, 0);
    return {
      path: latestReportPath,
      navigation_deltas_ms: navigationDeltas,
      api_request_count_delta: flowsToCompare.reduce((sum, flow) => sum + flow.api_request_count, 0) - previous.totals.api_request_count,
      heap_growth_delta_bytes: previous.totals.heap_growth_bytes === null ? null : heapGrowth - previous.totals.heap_growth_bytes
    };
  } catch {
    return null;
  }
}

function emptyHeapSnapshot(): HeapSnapshot {
  return {
    used_js_heap_size: null,
    total_js_heap_size: null,
    js_heap_size_limit: null
  };
}

function printReport(report: PlayerWebLoadReport, reportPath: string) {
  console.log(`Player web load report: ${reportPath}`);
  for (const flow of report.flows) {
    console.log(`${flow.ok ? "ok" : "fail"} ${flow.name}: nav=${flow.browser_navigation_ms}ms render=${flow.hydration_render_ms ?? "n/a"}ms api=${flow.api_request_count}${flow.note ? ` (${flow.note})` : ""}`);
  }
  console.log(`totals: api=${report.totals.api_request_count}, failed=${report.totals.failed_request_count}, duplicate=${report.totals.duplicate_request_count}, heap_growth=${report.totals.heap_growth_bytes ?? "n/a"}`);
  if (report.previous) {
    console.log(`compared with previous: ${JSON.stringify(report.previous.navigation_deltas_ms)}`);
  } else {
    console.log("no previous report found; this run becomes the baseline.");
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function apiBaseUrl() {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4100");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
