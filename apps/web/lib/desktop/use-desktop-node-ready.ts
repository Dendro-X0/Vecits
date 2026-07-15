"use client";

import { useEffect, useState } from "react";

import { waitForNodeHealth } from "@/lib/desktop/node-health";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";

export function useDesktopNodeReady(timeoutMs = 20_000): boolean {
  const desktop = useDesktopShell();
  const [ready, setReady] = useState(!desktop);

  useEffect(() => {
    if (!desktop) {
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    void waitForNodeHealth({ timeoutMs }).then((healthy) => {
      if (!cancelled) {
        setReady(healthy);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [desktop, timeoutMs]);

  return ready;
}
