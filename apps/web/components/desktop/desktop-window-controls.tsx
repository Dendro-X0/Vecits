"use client";

import { Maximize2, Minus, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getDesktopWindow } from "@/lib/desktop/window";
import { cn } from "@/lib/utils";

type DesktopWindowControlsProps = {
  className?: string;
};

export function DesktopWindowControls({ className }: DesktopWindowControlsProps) {
  const [maximized, setMaximized] = useState(false);

  const syncMaximized = useCallback(async () => {
    const window = getDesktopWindow();
    if (!window) {
      return;
    }
    const isMaximized = await window.isMaximized();
    setMaximized(isMaximized);
    if (isMaximized) {
      document.documentElement.dataset.desktopMaximized = "true";
    } else {
      delete document.documentElement.dataset.desktopMaximized;
    }
  }, []);

  useEffect(() => {
    void syncMaximized();
    const window = getDesktopWindow();
    if (!window) {
      return;
    }

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void window.onResized(() => {
      void syncMaximized();
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
      delete document.documentElement.dataset.desktopMaximized;
    };
  }, [syncMaximized]);

  return (
    <div className={cn("desktop-window-controls flex h-full items-stretch", className)}>
      <button
        type="button"
        className="desktop-window-control inline-flex w-11 items-center justify-center text-foreground/65 transition hover:bg-foreground/8 hover:text-foreground"
        aria-label="Minimize window"
        onClick={() => void getDesktopWindow()?.minimize()}
      >
        <Minus className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        className="desktop-window-control inline-flex w-11 items-center justify-center text-foreground/65 transition hover:bg-foreground/8 hover:text-foreground"
        aria-label={maximized ? "Restore window" : "Maximize window"}
        onClick={() => void getDesktopWindow()?.toggleMaximize().then(() => syncMaximized())}
      >
        {maximized ? (
          <Square className="h-3 w-3" aria-hidden="true" strokeWidth={1.75} />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
        )}
      </button>
      <button
        type="button"
        className="desktop-window-control inline-flex w-11 items-center justify-center text-foreground/65 transition hover:bg-destructive hover:text-white"
        aria-label="Close window"
        onClick={() => void getDesktopWindow()?.close()}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
      </button>
    </div>
  );
}
