"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { LoaderCircle, Wifi } from "lucide-react";

import { waitForNodeHealth } from "@/lib/desktop/node-health";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";

function MarketplaceConnectingPanel() {
  return (
    <section className="mx-auto flex max-w-lg flex-col items-center px-4 py-20 text-center sm:px-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
        <Wifi className="h-5 w-5 text-primary" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        <span>Connecting to your Vectis node…</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        The desktop client starts a local node sidecar before loading marketplace data.
      </p>
    </section>
  );
}

export function MarketplaceNodeBoundary({ children }: { children: ReactNode }) {
  const desktop = useDesktopShell();
  const router = useRouter();
  const refreshedRef = useRef(false);
  const [connecting, setConnecting] = useState(desktop);

  useEffect(() => {
    if (!desktop) {
      setConnecting(false);
      return;
    }

    let cancelled = false;
    setConnecting(true);

    void waitForNodeHealth().then((healthy) => {
      if (cancelled) {
        return;
      }
      setConnecting(false);
      if (healthy && !refreshedRef.current) {
        refreshedRef.current = true;
        router.refresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [desktop, router]);

  if (desktop && connecting) {
    return <MarketplaceConnectingPanel />;
  }

  return children;
}
