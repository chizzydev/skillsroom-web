import { evidenceStorageProviderStatus } from "../lib/evidence-storage-provider";

const required = [
  ["NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100"],
  ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"]
] as const;

const missing = required.filter(([, value]) => !value).map(([key]) => key);
const host = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100").hostname.toLowerCase();
  } catch {
    return "localhost";
  }
})();
const publicDeployment = !["localhost", "127.0.0.1"].includes(host);
const evidenceStatus = (() => {
  try {
    return evidenceStorageProviderStatus();
  } catch (error) {
    return error instanceof Error ? error.message : "Evidence storage provider could not be resolved.";
  }
})();
const evidenceErrors: string[] = [];

if (publicDeployment) {
  if (typeof evidenceStatus === "string") {
    evidenceErrors.push(evidenceStatus);
  } else if (!evidenceStatus.external || evidenceStatus.provider === "local") {
    evidenceErrors.push("Public deployments must use an external evidence storage provider.");
  }
}

if (missing.length || evidenceErrors.length) {
  console.error("Launch check failed", { missing, evidenceErrors });
  process.exitCode = 1;
} else {
  console.log("Skillsroom web launch check passed.", {
    evidenceProvider: typeof evidenceStatus === "string" ? "unresolved" : evidenceStatus.provider
  });
}
