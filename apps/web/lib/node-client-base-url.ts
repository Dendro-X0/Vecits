const SERVER_NODE_BASE_URL =
  process.env.NODE_API_BASE_URL ??
  process.env.NEXT_PUBLIC_NODE_API_BASE_URL ??
  "http://127.0.0.1:7878";

/** Same-origin proxy path — see next.config.ts rewrites → vectis-node. */
export const BROWSER_NODE_PROXY = "/api/node";
export const MOBILE_PINNED_NODE_OVERRIDE_KEY = "vectis.mobile.pinnedNodeUrlOverride";

type NodeUrlSource =
  | "desktop-runtime"
  | "mobile-local-override"
  | "mobile-runtime"
  | "mobile-env"
  | "public-env"
  | "browser-proxy"
  | "server-env"
  | "explicit";

export type NodeConnectionInfo = {
  baseUrl: string;
  source: NodeUrlSource;
  isMobileRuntime: boolean;
  isMobileRelease: boolean;
};

function readBrowserDesktopUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const desktopUrl = (globalThis as { __VECTIS_NODE_URL__?: string }).__VECTIS_NODE_URL__;
  if (!desktopUrl?.trim()) {
    return null;
  }

  const proxyUrl = process.env.NEXT_PUBLIC_NODE_API_BASE_URL?.trim();
  if (proxyUrl?.startsWith("/")) {
    return proxyUrl;
  }

  return desktopUrl.trim();
}

/** Human-readable node URL for trust bars (direct sidecar URL in desktop dev). */
export function readDesktopNodeDisplayUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const desktopUrl = (globalThis as { __VECTIS_NODE_URL__?: string }).__VECTIS_NODE_URL__;
  return desktopUrl?.trim() ? desktopUrl.trim() : null;
}

function readBrowserMobileRuntimePinnedUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const runtimeMobileUrl = (
    globalThis as { __VECTIS_MOBILE_PINNED_NODE_URL__?: string }
  ).__VECTIS_MOBILE_PINNED_NODE_URL__;
  if (runtimeMobileUrl?.trim()) {
    return runtimeMobileUrl.trim();
  }
  return null;
}

function readBrowserMobileEnvPinnedUrl(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const envMobileUrl = process.env.NEXT_PUBLIC_MOBILE_PINNED_NODE_URL;
  return envMobileUrl?.trim() ? envMobileUrl.trim() : null;
}

export function readRuntimeMobilePinnedNodeUrl(): string {
  if (typeof window === "undefined") {
    return "";
  }
  const runtimeMobileUrl = (
    globalThis as { __VECTIS_MOBILE_PINNED_NODE_URL__?: string }
  ).__VECTIS_MOBILE_PINNED_NODE_URL__;
  if (runtimeMobileUrl?.trim()) {
    return runtimeMobileUrl.trim();
  }
  const envMobileUrl = process.env.NEXT_PUBLIC_MOBILE_PINNED_NODE_URL;
  return envMobileUrl?.trim() ? envMobileUrl.trim() : "";
}

function isMobileRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((globalThis as { __VECTIS_MOBILE__?: boolean }).__VECTIS_MOBILE__);
}

function isMobileRelease(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    Boolean((globalThis as { __VECTIS_MOBILE_RELEASE__?: boolean }).__VECTIS_MOBILE_RELEASE__) ||
    process.env.NEXT_PUBLIC_VECTIS_MOBILE_RELEASE === "1"
  );
}

export function resolveNodeConnectionInfo(passedBaseUrl?: string): NodeConnectionInfo {
  if (typeof window !== "undefined") {
    const desktopUrl = readBrowserDesktopUrl();
    if (desktopUrl) {
      return {
        baseUrl: desktopUrl,
        source: "desktop-runtime",
        isMobileRuntime: false,
        isMobileRelease: false,
      };
    }

    const localOverride = window.localStorage.getItem(MOBILE_PINNED_NODE_OVERRIDE_KEY);
    if (localOverride?.trim()) {
      return {
        baseUrl: localOverride.trim(),
        source: "mobile-local-override",
        isMobileRuntime: true,
        isMobileRelease: isMobileRelease(),
      };
    }

    const runtimeMobileUrl = readBrowserMobileRuntimePinnedUrl();
    if (runtimeMobileUrl) {
      return {
        baseUrl: runtimeMobileUrl,
        source: "mobile-runtime",
        isMobileRuntime: true,
        isMobileRelease: isMobileRelease(),
      };
    }

    const envMobileUrl = readBrowserMobileEnvPinnedUrl();
    if (envMobileUrl) {
      return {
        baseUrl: envMobileUrl,
        source: "mobile-env",
        isMobileRuntime: isMobileRuntime(),
        isMobileRelease: isMobileRelease(),
      };
    }

    const publicEnvUrl = process.env.NEXT_PUBLIC_NODE_API_BASE_URL;
    if (publicEnvUrl?.trim()) {
      return {
        baseUrl: publicEnvUrl.trim(),
        source: "public-env",
        isMobileRuntime: isMobileRuntime(),
        isMobileRelease: isMobileRelease(),
      };
    }

    if (isMobileRuntime()) {
      return {
        baseUrl: "",
        source: "mobile-runtime",
        isMobileRuntime: true,
        isMobileRelease: isMobileRelease(),
      };
    }

    return {
      baseUrl: BROWSER_NODE_PROXY,
      source: "browser-proxy",
      isMobileRuntime: false,
      isMobileRelease: false,
    };
  }

  return {
    baseUrl: passedBaseUrl?.trim() || SERVER_NODE_BASE_URL,
    source: passedBaseUrl?.trim() ? "explicit" : "server-env",
    isMobileRuntime: false,
    isMobileRelease: false,
  };
}

export function readMobilePinnedNodeOverride(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(MOBILE_PINNED_NODE_OVERRIDE_KEY)?.trim() ?? "";
}

export function writeMobilePinnedNodeOverride(value: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    window.localStorage.removeItem(MOBILE_PINNED_NODE_OVERRIDE_KEY);
  } else {
    window.localStorage.setItem(MOBILE_PINNED_NODE_OVERRIDE_KEY, trimmed);
  }
}

/**
 * NodeClient base URL for the current runtime.
 * Server components call the node directly; browser code uses the Next proxy (no CORS).
 */
export function resolveNodeClientBaseUrl(passedBaseUrl?: string): string {
  return resolveNodeConnectionInfo(passedBaseUrl).baseUrl;
}

/** Default Node API field value for browser operator forms (same-origin proxy). */
export function defaultNodeClientBaseUrlForForms(): string {
  return resolveNodeClientBaseUrl();
}

export function validateNodeClientBaseUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Node API base URL is required.";
  }
  const mobileRelease = isMobileRelease();
  if (trimmed.startsWith("/")) {
    if (mobileRelease) {
      return "Mobile release requires an absolute HTTPS pinned node URL.";
    }
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "Invalid base URL: expected http:// or https://";
    }
    if (mobileRelease && parsed.protocol !== "https:") {
      return "Mobile release requires an HTTPS pinned node URL.";
    }
    return null;
  } catch {
    return "Invalid base URL: expected a valid absolute URL or same-origin path like /api/node";
  }
}

export function validateMobilePinnedNodeUrl(value: string): string | null {
  const validation = validateNodeClientBaseUrl(value);
  if (validation) {
    return validation;
  }
  if (value.startsWith("/")) {
    return "Mobile pinned node must be an absolute URL (not a same-origin path).";
  }
  try {
    const parsed = new URL(value);
    if (isMobileRelease() && parsed.protocol !== "https:") {
      return "Mobile release requires an HTTPS pinned node URL.";
    }
    return null;
  } catch {
    return "Invalid base URL: expected a valid absolute URL.";
  }
}

/** Returns a user-facing error when mobile runtime lacks a valid pinned node URL; null when OK or not mobile. */
export function resolveMobilePinnedNodeError(): string | null {
  const info = resolveNodeConnectionInfo();
  if (!info.isMobileRuntime) {
    return null;
  }
  const pinned = info.baseUrl.trim();
  if (!pinned) {
    return "Mobile pinned node URL is required. Configure it in Settings → Kernel connection.";
  }
  return validateMobilePinnedNodeUrl(pinned);
}
