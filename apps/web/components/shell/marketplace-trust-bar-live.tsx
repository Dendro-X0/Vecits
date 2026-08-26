"use client";

import { useEffect, useState } from "react";

import { MarketplaceTrustBar } from "@/components/shell/marketplace-trust-bar";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";
import { readDesktopNodeDisplayUrl } from "@/lib/node-client-base-url";

type MarketplaceTrustBarLiveProps = {
  nodeLabel: string;
  asOf?: string;
  mockMode?: boolean;
};

export function MarketplaceTrustBarLive({
  nodeLabel,
  asOf,
  mockMode
}: MarketplaceTrustBarLiveProps) {
  const desktop = useDesktopShell();
  // Defer label until mount so SSR/client URL resolution cannot disagree.
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (desktop) {
      setLabel(readDesktopNodeDisplayUrl() ?? nodeLabel);
      return;
    }
    setLabel(nodeLabel);
  }, [desktop, nodeLabel]);

  return (
    <MarketplaceTrustBar
      nodeLabel={label ?? "Connecting to node…"}
      asOf={asOf}
      mockMode={mockMode}
    />
  );
}
