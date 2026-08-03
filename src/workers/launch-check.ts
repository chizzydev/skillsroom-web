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
const apiUrl = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100");
  } catch {
    return null;
  }
})();
const evidenceStatus = (() => {
  try {
    return evidenceStorageProviderStatus();
  } catch (error) {
    return error instanceof Error ? error.message : "Evidence storage provider could not be resolved.";
  }
})();
const evidenceErrors: string[] = [];
const deploymentErrors: string[] = [];

if (publicDeployment) {
  if (!apiUrl) {
    deploymentErrors.push("Public deployments must set a valid NEXT_PUBLIC_API_BASE_URL.");
  } else if (["localhost", "127.0.0.1"].includes(apiUrl.hostname.toLowerCase())) {
    deploymentErrors.push("Public deployments must not point NEXT_PUBLIC_API_BASE_URL at localhost.");
  } else if (apiUrl.protocol !== "https:") {
    deploymentErrors.push("Public deployments must use an HTTPS API URL.");
  }

  if (typeof evidenceStatus === "string") {
    evidenceErrors.push(evidenceStatus);
  } else if (!evidenceStatus.external || evidenceStatus.provider === "local") {
    evidenceErrors.push("Public deployments must use an external evidence storage provider.");
  }
}

if (missing.length || deploymentErrors.length || evidenceErrors.length) {
  console.error("Launch check failed", { missing, deploymentErrors, evidenceErrors });
  process.exitCode = 1;
} else {
  console.log("Skillsroom web launch check passed.", {
    evidenceProvider: typeof evidenceStatus === "string" ? "unresolved" : evidenceStatus.provider
  });
}
