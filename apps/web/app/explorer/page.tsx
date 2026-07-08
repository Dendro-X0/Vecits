import Link from "next/link";

import { ExplorerShell, panelStyle } from "./components/explorer-shell";

export default function ExplorerIndexPage() {
  return (
    <ExplorerShell title="Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Choose a query surface. Each page uses URL query params so links can be shared.
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>
            <Link href="/explorer/offers">Offer Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/orders">Order Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/milestones">Milestone Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/reputation">Reputation Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/discovery">Discovery Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/identity">Identity Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/balance">Balance Explorer</Link>
          </li>
          <li>
            <Link href="/explorer/policy">Policy Explorer</Link>
          </li>
        </ul>
      </section>
    </ExplorerShell>
  );
}
