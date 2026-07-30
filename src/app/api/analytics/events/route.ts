import { z } from "zod";
import { apiBaseUrl } from "@/lib/api";
import { getAccessToken } from "@/lib/auth-bridge";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const allowedMetadataKeys = new Set([
  "source",
  "action",
  "tab",
  "surface",
  "target",
  "queue",
  "mode",
  "entry_type",
  "status"
]);

const eventSchema = z.object({
  event_name: z.string().trim().min(3).max(120).regex(/^[a-z][a-z0-9_.:-]*$/),
  platform: z.literal("web"),
  session_id: z.string().trim().min(8).max(120).optional(),
  app_version: z.string().trim().min(1).max(40).optional(),
  screen: z.string().trim().min(1).max(120).optional(),
  path: z.string().trim().min(1).max(240).optional(),
  entity_type: z.string().trim().min(2).max(80).optional(),
  entity_id: z.string().trim().min(1).max(160).optional(),
  match_room_id: z.string().uuid().optional(),
  tournament_id: z.string().uuid().optional(),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  occurred_at: z.string().datetime().optional()
});

function cleanMetadata(metadata: Record<string, string | number | boolean> | undefined) {
  if (!metadata) return undefined;

  return Object.fromEntries(
    Object.entries(metadata)
      .filter(([key]) => allowedMetadataKeys.has(key))
      .slice(0, 12)
  );
}

function accepted(acceptedByApi: boolean) {
  return Response.json(
    { ok: true, data: { accepted: acceptedByApi } },
    { status: 202, headers: { "cache-control": "no-store, private" } }
  );
}

export async function POST(request: Request) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: { code: "ANALYTICS_EVENT_INVALID", message: "Analytics event was not accepted." } },
      { status: 400, headers: { "cache-control": "no-store, private" } }
    );
  }

  const token = await getAccessToken();

  const response = await fetch(`${apiBaseUrl()}/analytics/events`, {
    method: "POST",
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json"
    },
    body: JSON.stringify({
      ...parsed.data,
      metadata: cleanMetadata(parsed.data.metadata)
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(1500)
  }).catch(() => null);

  return accepted(Boolean(response?.ok));
}
