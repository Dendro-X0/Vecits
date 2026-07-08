import type { ReactNode } from "react";

import { SiteFooter } from "@/components/shell/site-footer";
import { SiteHeader } from "@/components/shell/site-header";

export function AppShell({
  children,
  trustBar
}: {
  children: ReactNode;
  trustBar?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      {trustBar}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
