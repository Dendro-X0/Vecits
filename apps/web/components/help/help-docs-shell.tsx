"use client";

import type { ReactNode } from "react";

import { HelpMobileNav, HelpSidebarNav } from "@/components/help/help-sidebar-nav";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";
import { cn } from "@/lib/utils";

type HelpDocsShellProps = {
  children: ReactNode;
};

export function HelpDocsShell({ children }: HelpDocsShellProps) {
  const desktop = useDesktopShell();

  return (
    <div
      className={cn(
        "help-docs-shell flex min-h-full w-full flex-col",
        desktop ? "min-h-[calc(100dvh-var(--desktop-titlebar-height))]" : "min-h-[calc(100vh-3.5rem)]"
      )}
    >
      <HelpMobileNav />
      <div className="flex min-h-0 flex-1">
        <aside
          className={cn(
            "help-docs-sidebar sticky top-14 z-20 hidden w-64 shrink-0 self-start overflow-hidden border-r border-border/70 bg-muted/15 lg:flex lg:flex-col",
            desktop
              ? "h-[calc(100dvh-var(--desktop-titlebar-height)-3.5rem)]"
              : "h-[calc(100dvh-3.5rem)]"
          )}
        >
          <HelpSidebarNav className="min-h-0" />
        </aside>
        <div className="help-docs-main min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
