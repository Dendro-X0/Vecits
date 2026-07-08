import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { KernelTruthNotice } from "../../components/kernel-truth-notice";
import { ExplorerDefaultsBar } from "./explorer-defaults-bar";

export function ExplorerShell(props: { title: string; children: ReactNode }) {
  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: "2.2rem 1rem 3rem" }}>
      <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
        <Link href="/" style={{ color: "#9fc2ff" }}>
          ← Back to Home
        </Link>
      </p>

      <h1 style={{ marginTop: 0, marginBottom: "0.65rem" }}>{props.title}</h1>

      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.55rem",
          marginBottom: "1rem"
        }}
      >
        <Link href="/explorer/offers" style={tabStyle}>
          Offers
        </Link>
        <Link href="/explorer/orders" style={tabStyle}>
          Orders
        </Link>
        <Link href="/explorer/milestones" style={tabStyle}>
          Milestones
        </Link>
        <Link href="/explorer/reputation" style={tabStyle}>
          Reputation
        </Link>
        <Link href="/explorer/discovery" style={tabStyle}>
          Discovery
        </Link>
        <Link href="/explorer/identity" style={tabStyle}>
          Identity
        </Link>
        <Link href="/explorer/balance" style={tabStyle}>
          Balance
        </Link>
        <Link href="/explorer/policy" style={tabStyle}>
          Policy
        </Link>
      </nav>

      <Suspense fallback={null}>
        <ExplorerDefaultsBar />
      </Suspense>

      <KernelTruthNotice variant="banner" />

      {props.children}
    </main>
  );
}

export const panelStyle = {
  marginTop: "1rem",
  border: "1px solid #2a3458",
  borderRadius: 12,
  padding: "1rem 1.1rem",
  background: "#111936"
} as const;

export const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  marginBottom: "0.65rem",
  background: "#0b122b",
  color: "#dbe7ff",
  border: "1px solid #2a3458",
  borderRadius: 8,
  padding: "0.58rem 0.7rem"
} as const;

export const invalidInputStyle = {
  ...inputStyle,
  border: "1px solid #b85274"
} as const;

export const helperTextStyle = {
  marginTop: "-0.25rem",
  marginBottom: "0.65rem",
  opacity: 0.72,
  fontSize: "0.9rem"
} as const;

export const fieldErrorStyle = {
  marginTop: "-0.25rem",
  marginBottom: "0.65rem",
  color: "#ff9aae",
  fontSize: "0.9rem"
} as const;

export const buttonStyle = {
  background: "#1a2f66",
  color: "#dbe7ff",
  border: "1px solid #3651a1",
  borderRadius: 8,
  padding: "0.52rem 0.8rem",
  cursor: "pointer"
} as const;

export const jsonStyle = {
  marginTop: "0.8rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#0b122b",
  whiteSpace: "pre-wrap"
} as const;

const tabStyle = {
  display: "inline-block",
  padding: "0.42rem 0.62rem",
  borderRadius: 8,
  border: "1px solid #3558a8",
  background: "#14224a",
  color: "#cfe1ff",
  textDecoration: "none"
} as const;
