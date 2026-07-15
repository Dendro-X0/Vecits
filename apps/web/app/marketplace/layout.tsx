import type { ReactNode } from "react";

import { MarketplaceNodeBoundary } from "@/components/marketplace/marketplace-node-boundary";
import { AppShell } from "@/components/shell/app-shell";

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <MarketplaceNodeBoundary>{children}</MarketplaceNodeBoundary>
    </AppShell>
  );
}
