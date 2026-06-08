const required = [
  ["NEXT_PUBLIC_API_BASE_URL", process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4100"],
  ["NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3100"]
] as const;

const missing = required.filter(([, value]) => !value).map(([key]) => key);

if (missing.length) {
  console.error("Launch check failed", { missing });
  process.exitCode = 1;
} else {
  console.log("Skillsroom web launch check passed.");
}
