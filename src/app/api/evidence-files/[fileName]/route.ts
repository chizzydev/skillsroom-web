import path from "node:path";
import { NextResponse } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { getAccessToken, getCurrentUser, type CurrentUser } from "@/lib/auth-bridge";
import {
  evidenceCleanupState,
  evidenceFileNamePattern,
  evidenceRetentionState,
  legacyEvidenceFileNamePattern,
  readEvidenceFile,
  readEvidenceMetadata,
  resolveEvidenceRetention,
  statEvidenceFile,
  type StoredEvidenceMetadata
} from "@/lib/evidence-storage";

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

const operatorRoles = new Set<CurrentUser["role"]>(["support", "moderator", "admin", "owner"]);

type MatchRoomEvidenceAccessPayload = {
  room?: {
    id: string;
    created_by_user_id: string;
  };
  participants?: Array<{
    user_id: string;
    participant_status?: string;
  }>;
};

type TournamentEvidenceAccessPayload = {
  tournament?: {
    id: string;
    created_by_user_id: string;
    hosts?: Array<{
      user_id: string;
      status: string;
    }>;
  };
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
};

type EvidenceAccessDecision = {
  allowed: boolean;
  reason: string;
};

type EvidenceAuditAction =
  | "allowed"
  | "denied"
  | "invalid_request"
  | "metadata_mismatch"
  | "not_found"
  | "retention_expired"
  | "quarantined";

type ByteRange = { start: number; end: number };

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
}

function parseByteRange(header: string | null, size: number): ByteRange | "invalid" | null {
  if (!header) return null;
  if (!Number.isSafeInteger(size) || size <= 0) return "invalid";

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return "invalid";

  const [, startRaw, endRaw] = match;
  if (!startRaw && !endRaw) return "invalid";

  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }

  const start = Number(startRaw);
  const end = endRaw ? Number(endRaw) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) {
    return "invalid";
  }

  return { start, end: Math.min(end, size - 1) };
}

function isActiveOperator(user: CurrentUser) {
  return user.status === "active" && operatorRoles.has(user.role);
}

async function apiRead<T>(pathName: string, token: string): Promise<T | null> {
  const response = await fetch(`${apiBaseUrl()}${pathName}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as ApiEnvelope<T>;
  return payload.ok && payload.data ? payload.data : null;
}

async function recordEvidenceAudit(input: {
  request: Request;
  token: string;
  fileName: string;
  storage: "hardened" | "legacy" | "invalid";
  action: EvidenceAuditAction;
  reason: string;
  statusCode: number;
  metadata?: StoredEvidenceMetadata;
}) {
  const forwardedFor = input.request.headers.get("x-forwarded-for");
  const userAgent = input.request.headers.get("user-agent");
  const retention = input.metadata ? resolveEvidenceRetention(input.metadata) : null;
  const retentionState = input.metadata ? evidenceRetentionState(input.metadata) : input.storage === "legacy" ? "legacy_unclassified" : undefined;

  try {
    await fetch(`${apiBaseUrl()}/evidence/access-events`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${input.token}`,
        "content-type": "application/json",
        origin: appOrigin(),
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
        ...(userAgent ? { "user-agent": userAgent } : {})
      },
      body: JSON.stringify({
        file_name: input.fileName,
        storage: input.storage,
        action: input.action,
        reason: input.reason,
        status_code: input.statusCode,
        context_type: input.metadata?.contextType,
        context_id: input.metadata?.contextId,
        uploaded_by_user_id: input.metadata?.uploadedByUserId,
        evidence_type: input.metadata?.evidenceType,
        mime_type: input.metadata?.mimeType,
        byte_size: input.metadata?.byteSize,
        sha256: input.metadata?.sha256,
        retention_state: retentionState,
        retain_until: retention?.retainUntil,
        legal_hold: retention?.legalHold
      }),
      cache: "no-store"
    });
  } catch {
    // Evidence access must not fail just because the audit sink is temporarily unavailable.
  }
}

async function proxyEvidenceFileFromApi(input: { request: Request; token: string; fileName: string }) {
  const forwardedFor = input.request.headers.get("x-forwarded-for");
  const userAgent = input.request.headers.get("user-agent");
  const range = input.request.headers.get("range");
  const response = await fetch(`${apiBaseUrl()}/evidence/files/${encodeURIComponent(input.fileName)}`, {
    headers: {
      authorization: `Bearer ${input.token}`,
      accept: "*/*",
      origin: appOrigin(),
      ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      ...(userAgent ? { "user-agent": userAgent } : {}),
      ...(range ? { range } : {})
    },
    cache: "no-store"
  });

  const passthroughHeaders = new Headers();
  [
    "cache-control",
    "accept-ranges",
    "content-disposition",
    "content-length",
    "content-range",
    "content-security-policy",
    "content-type",
    "x-content-type-options",
    "x-evidence-access",
    "x-evidence-retain-until",
    "x-evidence-retention-state"
  ].forEach((headerName) => {
    const value = response.headers.get(headerName);
    if (value) passthroughHeaders.set(headerName, value);
  });
  passthroughHeaders.set("x-evidence-storage", "api-canonical");

  return new Response(response.body, {
    status: response.status,
    headers: passthroughHeaders
  });
}

async function canOpenMatchRoomEvidence(user: CurrentUser, token: string, matchRoomId: string): Promise<EvidenceAccessDecision> {
  const timeline = await apiRead<MatchRoomEvidenceAccessPayload>(
    `/match-rooms/${encodeURIComponent(matchRoomId)}/timeline`,
    token
  );

  if (!timeline?.room) return { allowed: false, reason: "match_room_unavailable" };
  if (timeline.room.created_by_user_id === user.id) return { allowed: true, reason: "match_room_creator" };

  const activeParticipant = timeline.participants?.some(
    (participant) =>
      participant.user_id === user.id &&
      (!participant.participant_status || ["reserved", "joined"].includes(participant.participant_status))
  );

  return activeParticipant
    ? { allowed: true, reason: "match_room_participant" }
    : { allowed: false, reason: "match_room_forbidden" };
}

async function canOpenTournamentEvidence(user: CurrentUser, token: string, tournamentId: string): Promise<EvidenceAccessDecision> {
  const detail = await apiRead<TournamentEvidenceAccessPayload>(`/tournaments/${encodeURIComponent(tournamentId)}`, token);
  const tournament = detail?.tournament;

  if (!tournament) return { allowed: false, reason: "tournament_unavailable" };
  if (tournament.created_by_user_id === user.id) return { allowed: true, reason: "tournament_creator" };

  const activeHost = tournament.hosts?.some((host) => host.user_id === user.id && host.status === "active");
  return activeHost ? { allowed: true, reason: "tournament_host" } : { allowed: false, reason: "tournament_forbidden" };
}

async function decideEvidenceAccess(
  user: CurrentUser,
  token: string,
  metadata: StoredEvidenceMetadata
): Promise<EvidenceAccessDecision> {
  if (user.id === metadata.uploadedByUserId) return { allowed: true, reason: "uploader" };
  if (isActiveOperator(user)) return { allowed: true, reason: "operator" };

  if (metadata.contextType === "match_room") {
    return canOpenMatchRoomEvidence(user, token, metadata.contextId);
  }

  if (metadata.contextType === "tournament") {
    return canOpenTournamentEvidence(user, token, metadata.contextId);
  }

  return { allowed: false, reason: "unknown_context" };
}

export async function GET(request: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const [user, token] = await Promise.all([getCurrentUser(), getAccessToken()]);
  if (!user || !token) {
    return NextResponse.json({ ok: false, error: "Authentication is required." }, { status: 401 });
  }

  const { fileName } = await params;
  const safeName = path.basename(fileName);
  const isHardenedFile = evidenceFileNamePattern.test(safeName);
  const isLegacyFile = legacyEvidenceFileNamePattern.test(safeName);
  if (safeName !== fileName || (!isHardenedFile && !isLegacyFile)) {
    await recordEvidenceAudit({
      request,
      token,
      fileName,
      storage: "invalid",
      action: "invalid_request",
      reason: "invalid_filename",
      statusCode: 400
    });
    return NextResponse.json({ ok: false, error: "Invalid evidence file." }, { status: 400 });
  }

  try {
    const extension = path.extname(safeName).toLowerCase();
    const contentType = contentTypes[extension] ?? "application/octet-stream";
    let accessReason = "legacy_authenticated";
    let metadata: StoredEvidenceMetadata | undefined;
    let retention = null as ReturnType<typeof resolveEvidenceRetention> | null;
    let retentionState: "active" | "expired" | "legal_hold" | undefined;
    let file: Buffer;
    let fileStat: Awaited<ReturnType<typeof statEvidenceFile>>;
    if (isHardenedFile) {
      metadata = await readEvidenceMetadata(safeName);
      retention = resolveEvidenceRetention(metadata);
      retentionState = evidenceRetentionState(metadata);
      if (evidenceCleanupState(metadata) !== "active") {
        await recordEvidenceAudit({
          request,
          token,
          fileName: safeName,
          storage: "hardened",
          action: "quarantined",
          reason: `evidence_${evidenceCleanupState(metadata)}`,
          statusCode: 410,
          metadata
        });
        return NextResponse.json({ ok: false, error: "Evidence file is not available in active storage." }, { status: 410 });
      }

      [file, fileStat] = await Promise.all([readEvidenceFile(safeName), statEvidenceFile(safeName)]);
      if (metadata.fileName !== safeName || metadata.byteSize !== fileStat.byteSize || metadata.mimeType !== contentType) {
        await recordEvidenceAudit({
          request,
          token,
          fileName: safeName,
          storage: "hardened",
          action: "metadata_mismatch",
          reason: "metadata_mismatch",
          statusCode: 409,
          metadata
        });
        return NextResponse.json({ ok: false, error: "Evidence file metadata does not match." }, { status: 409 });
      }

      if (retentionState === "expired") {
        await recordEvidenceAudit({
          request,
          token,
          fileName: safeName,
          storage: "hardened",
          action: "retention_expired",
          reason: "retention_expired",
          statusCode: 410,
          metadata
        });
        return NextResponse.json({ ok: false, error: "Evidence file retention period has expired." }, { status: 410 });
      }

      const decision = await decideEvidenceAccess(user, token, metadata);
      if (!decision.allowed) {
        await recordEvidenceAudit({
          request,
          token,
          fileName: safeName,
          storage: "hardened",
          action: "denied",
          reason: decision.reason,
          statusCode: 403,
          metadata
        });
        return NextResponse.json({ ok: false, error: "You do not have access to this evidence file." }, { status: 403 });
      }
      accessReason = decision.reason;
    } else {
      [file, fileStat] = await Promise.all([readEvidenceFile(safeName), statEvidenceFile(safeName)]);
    }

    await recordEvidenceAudit({
      request,
      token,
      fileName: safeName,
      storage: isHardenedFile ? "hardened" : "legacy",
      action: "allowed",
      reason: accessReason,
      statusCode: 200,
      metadata
    });

    const range = parseByteRange(request.headers.get("range"), fileStat.byteSize);
    const sharedHeaders = {
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=300",
      "content-disposition": `inline; filename="${safeName}"`,
      "content-security-policy": "default-src 'none'; img-src 'self' blob:; media-src 'self' blob:; style-src 'none'; script-src 'none'; sandbox",
      "content-type": contentType,
      "x-evidence-access": accessReason,
      ...(retention ? { "x-evidence-retain-until": retention.retainUntil } : {}),
      ...(retentionState ? { "x-evidence-retention-state": retentionState } : { "x-evidence-retention-state": "legacy_unclassified" }),
      "x-evidence-storage": isHardenedFile ? "hardened" : "legacy",
      "x-content-type-options": "nosniff"
    };

    if (range === "invalid") {
      return new Response(null, {
        status: 416,
        headers: {
          ...sharedHeaders,
          "content-range": `bytes */${fileStat.byteSize}`
        }
      });
    }

    if (range) {
      const chunk = file.subarray(range.start, range.end + 1);
      return new Response(new Uint8Array(chunk), {
        status: 206,
        headers: {
          ...sharedHeaders,
          "content-length": chunk.byteLength.toString(),
          "content-range": `bytes ${range.start}-${range.end}/${fileStat.byteSize}`
        }
      });
    }

    return new Response(new Uint8Array(file), {
      headers: {
        ...sharedHeaders,
        "content-length": fileStat.byteSize.toString(),
      }
    });
  } catch {
    if (isHardenedFile) {
      try {
        return await proxyEvidenceFileFromApi({ request, token, fileName: safeName });
      } catch {
        // Keep the local route's existing not-found behavior when the API storage fallback is unavailable.
      }
    }

    await recordEvidenceAudit({
      request,
      token,
      fileName: safeName,
      storage: isHardenedFile ? "hardened" : isLegacyFile ? "legacy" : "invalid",
      action: "not_found",
      reason: "not_found",
      statusCode: 404
    });
    return NextResponse.json({ ok: false, error: "Evidence file was not found." }, { status: 404 });
  }
}
