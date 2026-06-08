const fallbackApiBaseUrl = "http://localhost:4100";

export function apiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL || fallbackApiBaseUrl;
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: {
      accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
