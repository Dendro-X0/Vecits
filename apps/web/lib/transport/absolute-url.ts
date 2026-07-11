import { useEffect, useState } from "react";

/** Build an absolute URL for the current client origin (browser only). */
export function buildAbsoluteClientUrl(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (typeof window === "undefined") {
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }
  const normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${window.location.origin}${normalized}`;
}

export function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export function useAbsoluteClientUrl(path: string | null | undefined): string {
  const [absolute, setAbsolute] = useState("");

  useEffect(() => {
    if (!path?.trim()) {
      setAbsolute("");
      return;
    }
    setAbsolute(buildAbsoluteClientUrl(path));
  }, [path]);

  return absolute;
}
