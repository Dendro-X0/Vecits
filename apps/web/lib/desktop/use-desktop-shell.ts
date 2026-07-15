"use client";

import { useEffect, useState } from "react";

import { isVectisDesktopShell, readDesktopShellMarker } from "@/lib/desktop/window";

const DESKTOP_PROBE_MS = 25;
const DESKTOP_PROBE_LIMIT = 240;

function detectDesktopShell(): boolean {
  return readDesktopShellMarker() || isVectisDesktopShell();
}

export function useDesktopShell(): boolean {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    if (detectDesktopShell()) {
      setDesktop(true);
      document.documentElement.dataset.vectisDesktop = "true";
      return;
    }

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      if (detectDesktopShell()) {
        setDesktop(true);
        document.documentElement.dataset.vectisDesktop = "true";
        window.clearInterval(timer);
        return;
      }
      if (attempts >= DESKTOP_PROBE_LIMIT) {
        window.clearInterval(timer);
      }
    }, DESKTOP_PROBE_MS);

    return () => window.clearInterval(timer);
  }, []);

  return desktop;
}
