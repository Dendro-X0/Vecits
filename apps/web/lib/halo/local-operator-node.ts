/**
 * Classify pinned node URLs for R9-H LAN halo honesty labels.
 * Pure helpers — no DOM / env dependencies.
 */

export type NodeHostClass = "local-operator" | "public" | "relative" | "invalid";

export type ParsedNodeHost = {
  class: NodeHostClass;
  protocol: string | null;
  hostname: string | null;
  port: string | null;
  href: string;
};

function isIpv4Private(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) {
    return false;
  }
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = octets;
  if (a === 10) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 0 && b === 0 && octets[2] === 0 && octets[3] === 0) {
    return true;
  }
  return false;
}

function isIpv6Local(hostname: string): boolean {
  const raw = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (raw === "::1" || raw === "0:0:0:0:0:0:0:1") {
    return true;
  }
  // Unique local fc00::/7 and link-local fe80::/10
  if (raw.startsWith("fc") || raw.startsWith("fd")) {
    return true;
  }
  if (raw.startsWith("fe8") || raw.startsWith("fe9") || raw.startsWith("fea") || raw.startsWith("feb")) {
    return true;
  }
  return false;
}

/** True for loopback, RFC1918, link-local, .local mDNS, and IPv6 ULA/link-local. */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.trim().toLowerCase().replace(/\.$/, "");
  if (!host) {
    return false;
  }
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  if (isIpv4Private(host)) {
    return true;
  }
  if (host.includes(":")) {
    return isIpv6Local(host);
  }
  return false;
}

export function parseNodeHost(nodeUrl: string): ParsedNodeHost {
  const trimmed = nodeUrl.trim();
  if (!trimmed) {
    return { class: "invalid", protocol: null, hostname: null, port: null, href: "" };
  }
  if (trimmed.startsWith("/")) {
    return {
      class: "relative",
      protocol: null,
      hostname: null,
      port: null,
      href: trimmed
    };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { class: "invalid", protocol: parsed.protocol, hostname: null, port: null, href: trimmed };
    }
    const hostname = parsed.hostname;
    const local = isPrivateOrLocalHostname(hostname);
    return {
      class: local ? "local-operator" : "public",
      protocol: parsed.protocol.replace(":", ""),
      hostname,
      port: parsed.port || (parsed.protocol === "https:" ? "443" : "80"),
      href: parsed.href.replace(/\/$/, "")
    };
  } catch {
    return { class: "invalid", protocol: null, hostname: null, port: null, href: trimmed };
  }
}

export function isLocalOperatorNodeUrl(nodeUrl: string): boolean {
  return parseNodeHost(nodeUrl).class === "local-operator";
}

/** Try to treat pasted/scanned text as an absolute node join URL. */
export function tryParseAbsoluteNodeJoinUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.includes("\n")) {
    return null;
  }
  // QR may wrap URL in whitespace only; reject transport JSON.
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  const parsed = parseNodeHost(trimmed);
  if (parsed.class === "invalid" || !parsed.hostname) {
    return null;
  }
  return parsed.href;
}
