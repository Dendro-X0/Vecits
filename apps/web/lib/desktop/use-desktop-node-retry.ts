"use client";

import { useEffect, useRef } from "react";

import { waitForNodeHealth } from "@/lib/desktop/node-health";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";

export function useDesktopNodeRetry(shouldRetry: boolean, onRetry: () => void) {
  const desktop = useDesktopShell();
  const onRetryRef = useRef(onRetry);

  useEffect(() => {
    onRetryRef.current = onRetry;
  }, [onRetry]);

  useEffect(() => {
    if (!desktop || !shouldRetry) {
      return;
    }

    let cancelled = false;

    void waitForNodeHealth({ timeoutMs: 15_000, intervalMs: 500 }).then((healthy) => {
      if (!cancelled && healthy) {
        onRetryRef.current();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [desktop, shouldRetry]);
}
