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
  const [label, setLabel] = useState(nodeLabel);

  useEffect(() => {
    if (!desktop) {
      setLabel(nodeLabel);
      return;
    }
    setLabel(readDesktopNodeDisplayUrl() ?? nodeLabel);
  }, [desktop, nodeLabel]);

  return <MarketplaceTrustBar nodeLabel={label} asOf={asOf} mockMode={mockMode} />;
}
