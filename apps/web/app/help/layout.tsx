import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";

export default function HelpLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <div className="help-docs-root bg-background">{children}</div>
    </AppShell>
  );
}
