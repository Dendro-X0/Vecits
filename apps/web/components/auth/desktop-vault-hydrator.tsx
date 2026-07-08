"use client";

import { useEffect } from "react";

import { tryAutoUnlockDesktopVault } from "@/lib/auth/desktop-vault";
import { mirrorSessionToBrowserStorage } from "@/lib/auth/session";

export function DesktopVaultHydrator() {
  useEffect(() => {
    void (async () => {
      const session = await tryAutoUnlockDesktopVault();
      if (session) {
        mirrorSessionToBrowserStorage(session);
      }
    })();
  }, []);

  return null;
}
