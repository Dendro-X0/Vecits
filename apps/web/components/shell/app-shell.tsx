"use client";

import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  trustBar
}: {
  children: ReactNode;
  trustBar?: ReactNode;
}) {
  const desktop = useDesktopShell();

  return (
    <div className={cn("flex flex-col", desktop ? "min-h-full" : "min-h-screen")}>
      <SiteHeader />
      {trustBar}
      <main className="flex-1">{children}</main>
      {!desktop ? <SiteFooter /> : null}
    </div>
  );
}
