import { apiBaseUrl } from "./api";

if (!apiBaseUrl().startsWith("http")) {
  throw new Error("API base URL must be absolute.");
}

console.log("Phase 0 web smoke test passed.");
