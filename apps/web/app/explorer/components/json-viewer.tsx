"use client";

import { useMemo, useState } from "react";

export function JsonViewer(props: { title: string; value: unknown | null }) {
  const [pretty, setPretty] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const text = useMemo(() => {
    if (props.value === null) {
      return "";
    }
    return pretty ? JSON.stringify(props.value, null, 2) : JSON.stringify(props.value);
  }, [pretty, props.value]);

  if (props.value === null) {
    return null;
  }

  async function copyJson() {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failed");
      setTimeout(() => setCopyState("idle"), 1800);
    }
  }

  const copyLabel =
    copyState === "copied" ? "Copied JSON" : copyState === "failed" ? "Copy failed" : "Copy JSON";

  return (
    <section className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-sm font-semibold text-foreground">{props.title}</strong>
        <div className="flex flex-wrap gap-2">
          <button type="button" style={buttonStyle} onClick={() => setPretty(value => !value)}>
            {pretty ? "Compact view" : "Pretty print"}
          </button>
          <button type="button" style={buttonStyle} onClick={copyJson}>
            {copyLabel}
          </button>
        </div>
      </div>
      <pre style={jsonStyle}>{text}</pre>
    </section>
  );
}

const buttonStyle = {
  background: "var(--surface-control)",
  color: "var(--surface-control-foreground)",
  border: "1px solid var(--surface-control-border)",
  borderRadius: 999,
  padding: "0.42rem 0.78rem",
  cursor: "pointer"
} as const;

const jsonStyle = {
  marginTop: "0.85rem",
  border: "1px solid var(--surface-inset-border)",
  borderRadius: 14,
  padding: "0.9rem 1rem",
  background: "var(--surface-code)",
  color: "var(--surface-code-foreground)",
  whiteSpace: "pre-wrap",
  overflowX: "auto"
} as const;
