import { NextResponse, type NextRequest } from "next/server";
import { apiBaseUrl } from "@/lib/api";
import { canAccessAdmin, getAccessToken, getCurrentUser } from "@/lib/auth-bridge";
import {
  createEvidenceChainOfCustodyReview,
  evidenceRetentionState,
  readEvidenceMetadata,
  resolveEvidenceRetention
} from "@/lib/evidence-storage";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
};

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100";
}

async function apiRead<T>(pathName: string, token: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${pathName}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json",
      origin: appOrigin()
    },
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.ok || !payload.data) {
    throw new Error("Evidence chain-of-custody audit trail could not be loaded.");
  }
  return payload.data;
}

async function recordChainReviewAudit(input: {
  token: string;
  fileName: string;
}) {
  const metadata = await readEvidenceMetadata(input.fileName);
  const retention = resolveEvidenceRetention(metadata);
  const state = evidenceRetentionState(metadata);

  await fetch(`${apiBaseUrl()}/evidence/access-events`, {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json",
      origin: appOrigin()
    },
    body: JSON.stringify({
      file_name: metadata.fileName,
      storage: "hardened",
      action: "chain_reviewed",
      reason: "chain_of_custody_review",
      status_code: 200,
      context_type: metadata.contextType,
      context_id: metadata.contextId,
      uploaded_by_user_id: metadata.uploadedByUserId,
      evidence_type: metadata.evidenceType,
      mime_type: metadata.mimeType,
      byte_size: metadata.byteSize,
      sha256: metadata.sha256,
      retention_state: state,
      retain_until: retention.retainUntil,
      legal_hold: retention.legalHold
    }),
    cache: "no-store"
  }).catch(() => null);
}

export async function GET(request: NextRequest) {
  const [user, token] = await Promise.all([getCurrentUser(), getAccessToken()]);
  if (!canAccessAdmin(user) || !user || !token) {
    return NextResponse.json({ ok: false, error: "Operator access is required." }, { status: 403 });
  }

  const fileName = request.nextUrl.searchParams.get("file_name")?.trim();
  if (!fileName) {
    return NextResponse.json({ ok: false, error: "Evidence file name is required." }, { status: 400 });
  }

  try {
    const auditData = await apiRead<{ events: unknown[] }>(
      `/evidence/access-events?limit=200&file_name=${encodeURIComponent(fileName)}`,
      token
    );
    const review = await createEvidenceChainOfCustodyReview({
      fileName,
      reviewedByUserId: user.id,
      auditEvents: auditData.events
    });
    await recordChainReviewAudit({ token, fileName });

    return new Response(JSON.stringify(review, null, 2), {
      headers: {
        "cache-control": "no-store",
        "content-disposition": `attachment; filename="${fileName}.chain-of-custody.json"`,
        "content-type": "application/json; charset=utf-8",
        "x-content-type-options": "nosniff",
        "x-evidence-chain-review": review.verdict
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Evidence chain-of-custody review could not be created.";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
