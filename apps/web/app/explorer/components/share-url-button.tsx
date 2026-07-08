"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ShareUrlButtonInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  async function copyUrl() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      const query = searchParams.toString();
      const href = `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;
      await navigator.clipboard.writeText(href);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("failed");
      setTimeout(() => setStatus("idle"), 1800);
    }
  }

  const label =
    status === "copied" ? "Copied URL" : status === "failed" ? "Copy failed" : "Copy Share URL";

  return (
    <button type="button" onClick={copyUrl} style={buttonStyle}>
      {label}
    </button>
  );
}

export function ShareUrlButton() {
  return (
    <Suspense fallback={null}>
      <ShareUrlButtonInner />
    </Suspense>
  );
}

const buttonStyle = {
  background: "#1a2f66",
  color: "#dbe7ff",
  border: "1px solid #3651a1",
  borderRadius: 8,
  padding: "0.52rem 0.8rem",
  cursor: "pointer"
} as const;
