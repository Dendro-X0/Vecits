"use client";

import { useRouter } from "next/navigation";

import { useDesktopNodeRetry } from "@/lib/desktop/use-desktop-node-retry";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";

export function MarketplaceConnectionRecovery({ connectionError }: { connectionError: boolean }) {
  const desktop = useDesktopShell();
  const router = useRouter();

  useDesktopNodeRetry(connectionError && desktop, () => {
    router.refresh();
  });

  return null;
}
