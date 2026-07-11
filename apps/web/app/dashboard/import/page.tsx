import { TransportBundleImportPanel } from "@/components/transport/transport-bundle-import-panel";

export default function DashboardImportPage() {
  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Import transport link</h1>
          <p className="text-sm text-muted-foreground">
            Paste, upload, or scan a Tier 1 transport bundle from another person or device. Review
            every field before signing — imports never publish offers or move credits automatically.
          </p>
        </div>
        <TransportBundleImportPanel />
      </div>
    </div>
  );
}
