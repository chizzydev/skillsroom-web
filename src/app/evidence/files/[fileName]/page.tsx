import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { EvidenceFileViewerClient } from "./EvidenceFileViewerClient";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EvidenceFilePage({
  params,
  searchParams
}: {
  params: Promise<{ fileName: string }>;
  searchParams: Promise<{ title?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [{ fileName }, query] = await Promise.all([params, searchParams]);
  const title = firstParam(query.title)?.trim() || "Evidence";
  const safeName = fileName.split(/[\\/]/).pop() ?? fileName;

  return (
    <EvidenceFileViewerClient
      fileName={safeName}
      title={title}
      url={`/api/evidence-files/${encodeURIComponent(safeName)}`}
    />
  );
}
