import { redirect } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminShell } from "@/components/layout/AdminShell";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { DataTable } from "@/components/ui/DataTable";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { canAccessAdmin, canUseAdminSection, getCurrentUser } from "@/lib/auth-bridge";
import { getChatPerformanceMetrics, type ChatPerformanceMetricName, type ChatPerformanceMetrics } from "@/lib/match-room-api";

export const dynamic = "force-dynamic";

const metricLabels: Record<ChatPerformanceMetricName, string> = {
  message_list_latency: "Message list",
  send_latency: "Send",
  search_latency: "Search",
  thread_latency: "Thread",
  media_latency: "Media",
  reaction_latency: "Reaction"
};

const metricOrder = Object.keys(metricLabels) as ChatPerformanceMetricName[];

function numberLabel(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined) return "No data";
  return `${value.toLocaleString("en-NG")}${suffix}`;
}

function latencyTone(value: number | null | undefined): BadgeTone {
  if (value === null || value === undefined) return "neutral";
  if (value >= 2000) return "danger";
  if (value >= 900) return "warning";
  return "success";
}

function failureTone(failed: number, total: number): BadgeTone {
  if (!failed) return "success";
  if (!total || failed / total < 0.02) return "warning";
  return "danger";
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: BadgeTone }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <Badge tone={tone}>{label}</Badge>
      <strong className="mt-3 block text-2xl font-black text-ink">{value}</strong>
      <p className="mt-1 text-sm font-bold leading-6 text-muted">{detail}</p>
    </div>
  );
}

function latencyRows(metrics: ChatPerformanceMetrics) {
  return metricOrder.map((name) => {
    const row = metrics.latency[name];
    return {
      name,
      label: metricLabels[name],
      sample_count: row?.sample_count ?? 0,
      failed_count: row?.failed_count ?? 0,
      p50_ms: row?.p50_ms ?? null,
      p95_ms: row?.p95_ms ?? null,
      p99_ms: row?.p99_ms ?? null,
      max_ms: row?.max_ms ?? null
    };
  });
}

function routeRows(metrics: ChatPerformanceMetrics) {
  return Object.entries(metrics.http.routes)
    .map(([route, row]) => ({ route, ...row }))
    .sort((left, right) => right.failed - left.failed || right.total - left.total)
    .slice(0, 12);
}

export default async function AdminObservabilityPage() {
  const user = await getCurrentUser();
  if (!canAccessAdmin(user)) redirect("/sign-in?redirect=/admin/observability");
  if (!canUseAdminSection(user, "observability")) redirect("/admin");

  let metrics: ChatPerformanceMetrics | null = null;
  let loadError: string | null = null;

  try {
    metrics = await getChatPerformanceMetrics();
  } catch {
    loadError = "Chat performance metrics could not be loaded.";
  }

  const failureRate = metrics ? `${(metrics.http.failure_rate * 100).toFixed(2)}%` : "No data";
  const latency = metrics ? latencyRows(metrics) : [];
  const routes = metrics ? routeRows(metrics) : [];

  return (
    <AdminShell active="observability">
      <section className="grid gap-5">
        <AdminPageHeader
          description="Live process metrics for chat latency, failed requests, realtime clients, and database pool pressure."
          eyebrow="Production"
          title="Chat observability"
        />

        {loadError ? <div className="rounded-md border border-danger bg-red-50 p-4 text-sm font-bold text-danger">{loadError}</div> : null}

        {metrics ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                detail={`${metrics.http.failed_requests.toLocaleString("en-NG")} failed of ${metrics.http.total_requests.toLocaleString("en-NG")} tracked requests.`}
                label="Failed requests"
                tone={failureTone(metrics.http.failed_requests, metrics.http.total_requests)}
                value={failureRate}
              />
              <MetricCard
                detail={`${metrics.sse.opened_total.toLocaleString("en-NG")} opened, ${metrics.sse.closed_total.toLocaleString("en-NG")} closed.`}
                label="SSE clients"
                tone={metrics.sse.active_clients > 1000 ? "warning" : "success"}
                value={metrics.sse.active_clients.toLocaleString("en-NG")}
              />
              <MetricCard
                detail={`${metrics.db_pool.idle_count.toLocaleString("en-NG")} idle of ${metrics.db_pool.total_count.toLocaleString("en-NG")} total connections.`}
                label="DB pool"
                tone={metrics.db_pool.waiting_count > 0 ? "danger" : "success"}
                value={`${metrics.db_pool.waiting_count.toLocaleString("en-NG")} waiting`}
              />
              <MetricCard
                detail={`Sampled ${new Date(metrics.sampled_at).toLocaleString("en-NG")}.`}
                label="Health"
                tone={metrics.health.status === "healthy" ? "success" : "warning"}
                value={metrics.health.status}
              />
            </div>

            <Panel>
              <PanelHeader
                description="Process-local latency samples for the active API instance. Use p95/p99 as the regression signal."
                eyebrow="Latency"
                title="Chat API hot paths"
              />
              <DataTable
                columns={[
                  { key: "label", label: "Path", render: (row) => <span className="text-sm font-black text-ink">{row.label}</span> },
                  { key: "sample_count", label: "Samples", render: (row) => <span className="font-mono text-xs font-bold text-muted">{row.sample_count}</span> },
                  { key: "failed_count", label: "Errors", render: (row) => <Badge tone={row.failed_count ? "danger" : "success"}>{row.failed_count}</Badge> },
                  { key: "p50_ms", label: "p50", render: (row) => <span className="font-mono text-xs font-bold">{numberLabel(row.p50_ms, " ms")}</span> },
                  { key: "p95_ms", label: "p95", render: (row) => <Badge tone={latencyTone(row.p95_ms)}>{numberLabel(row.p95_ms, " ms")}</Badge> },
                  { key: "p99_ms", label: "p99", render: (row) => <Badge tone={latencyTone(row.p99_ms)}>{numberLabel(row.p99_ms, " ms")}</Badge> },
                  { key: "max_ms", label: "Max", render: (row) => <span className="font-mono text-xs font-bold">{numberLabel(row.max_ms, " ms")}</span> }
                ]}
                rows={latency}
              />
            </Panel>

            <Panel>
              <PanelHeader
                description="Tracked HTTP outcomes for chat routes, including rate limits and server errors."
                eyebrow="Requests"
                title="Failures by route"
              />
              {routes.length ? (
                <DataTable
                  columns={[
                    { key: "route", label: "Route", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.route}</span> },
                    { key: "total", label: "Total", render: (row) => <span className="font-mono text-xs font-bold text-muted">{row.total}</span> },
                    { key: "failed", label: "Failed", render: (row) => <Badge tone={failureTone(row.failed, row.total)}>{row.failed}</Badge> }
                  ]}
                  rows={routes}
                />
              ) : (
                <div className="p-4 text-sm font-bold text-muted">No chat requests have been observed by this API process yet.</div>
              )}
            </Panel>

            <Panel>
              <PanelHeader
                description="Most recent non-2xx/3xx chat responses on this API process."
                eyebrow="Errors"
                title="Recent failed requests"
              />
              {metrics.http.recent_failures.length ? (
                <DataTable
                  columns={[
                    { key: "at", label: "Time", render: (row) => <span className="font-mono text-xs font-bold text-muted">{new Date(row.at).toLocaleString("en-NG")}</span> },
                    { key: "method", label: "Method", render: (row) => <Badge tone="neutral">{row.method}</Badge> },
                    { key: "route", label: "Route", render: (row) => <span className="font-mono text-xs font-bold text-ink">{row.route}</span> },
                    { key: "status", label: "Status", render: (row) => <Badge tone={row.status >= 500 ? "danger" : "warning"}>{row.status}</Badge> },
                    { key: "duration_ms", label: "Duration", render: (row) => <span className="font-mono text-xs font-bold">{numberLabel(row.duration_ms, " ms")}</span> }
                  ]}
                  rows={metrics.http.recent_failures}
                />
              ) : (
                <div className="p-4 text-sm font-bold text-muted">No failed chat requests recorded.</div>
              )}
            </Panel>
          </>
        ) : null}
      </section>
    </AdminShell>
  );
}
