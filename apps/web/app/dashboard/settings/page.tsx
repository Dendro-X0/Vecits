import { Suspense } from "react";

import { DashboardSettingsPanel } from "@/components/dashboard/dashboard-settings-panel";

export default function DashboardSettingsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading settings…</p>}>
      <DashboardSettingsPanel />
    </Suspense>
  );
}
