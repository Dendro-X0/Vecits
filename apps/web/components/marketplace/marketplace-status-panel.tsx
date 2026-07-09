import Link from "next/link";
import { PackageOpen, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

type MarketplaceStatusPanelProps = {
  variant: "connection-error" | "empty";
  message?: string;
  mockMode?: boolean;
};

export function MarketplaceStatusPanel({
  variant,
  message,
  mockMode = false
}: MarketplaceStatusPanelProps) {
  if (variant === "connection-error") {
    return (
      <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
          <WifiOff className="h-5 w-5 text-destructive" />
        </div>
        <h3 className="text-lg font-medium">Could not load listings</h3>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          {message ??
            "The marketplace could not reach your node. Start vectis-node or check kernel connection settings, then refresh this page."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/dashboard/settings" />} size="lg">
            Settings
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard/builder" />}
            variant="outline"
            size="lg"
          >
            Publish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted">
        <PackageOpen className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">No listings on this node yet</h3>
      <p className="mt-2 max-w-lg text-sm text-muted-foreground">
        {mockMode
          ? "Mock mode is on, but no sample listings matched this view."
          : "This node has no active marketplace offers right now. Browse another lane, or publish the first offer from your identity workspace."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard/builder" />} size="lg">
          Publish
        </Button>
        <Button
          nativeButton={false}
          render={<Link href="/sign-in" />}
          variant="outline"
          size="lg"
        >
          Sign in
        </Button>
      </div>
    </div>
  );
}
