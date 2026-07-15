import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";

function healthUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}/health`;
}

export async function checkNodeHealth(baseUrl = resolveNodeClientBaseUrl()): Promise<boolean> {
  if (!baseUrl.trim()) {
    return false;
  }

  try {
    const response = await fetch(healthUrl(baseUrl), {
      method: "GET",
      cache: "no-store"
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function waitForNodeHealth(
  options: {
    baseUrl?: string;
    timeoutMs?: number;
    intervalMs?: number;
  } = {}
): Promise<boolean> {
  const baseUrl = options.baseUrl ?? resolveNodeClientBaseUrl();
  const timeoutMs = options.timeoutMs ?? 20_000;
  const intervalMs = options.intervalMs ?? 400;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await checkNodeHealth(baseUrl)) {
      return true;
    }
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs));
  }

  return false;
}
