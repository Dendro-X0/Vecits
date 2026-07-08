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
    <section style={{ marginTop: "0.8rem" }}>
      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
        <strong>{props.title}</strong>
        <button type="button" style={buttonStyle} onClick={() => setPretty(value => !value)}>
          {pretty ? "Compact" : "Pretty"}
        </button>
        <button type="button" style={buttonStyle} onClick={copyJson}>
          {copyLabel}
        </button>
      </div>
      <pre style={jsonStyle}>{text}</pre>
    </section>
  );
}

const buttonStyle = {
  background: "#1a2f66",
  color: "#dbe7ff",
  border: "1px solid #3651a1",
  borderRadius: 8,
  padding: "0.38rem 0.64rem",
  cursor: "pointer"
} as const;

const jsonStyle = {
  marginTop: "0.6rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#0b122b",
  whiteSpace: "pre-wrap"
} as const;
