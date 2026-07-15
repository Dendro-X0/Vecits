"use client";

import { type ReactNode } from "react";

import { DesktopTitleBar } from "@/components/desktop/desktop-title-bar";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";

export function DesktopShell({ children }: { children: ReactNode }) {
  const desktop = useDesktopShell();

  if (!desktop) {
    return <>{children}</>;
  }

  return (
    <div className="desktop-shell relative flex h-dvh flex-col overflow-hidden">
      <DesktopTitleBar />
      <div className="desktop-shell-content min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
