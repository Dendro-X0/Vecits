"use client";

import Link from "next/link";
import { PackageOpen, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { isVectisDesktopClient, loadActiveSession } from "@/lib/auth/session";

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
  const [signedIn, setSignedIn] = useState(false);
  const [desktopClient, setDesktopClient] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(loadActiveSession()));
    setDesktopClient(isVectisDesktopClient());
  }, []);
  if (variant === "connection-error") {
    return (
      <div className="surface-card px-6 py-10 sm:px-8">
        <div className="mx-auto flex max-w-lg flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10">
            <WifiOff className="h-5 w-5 text-destructive" />
          </div>
          <h3 className="text-lg font-medium">Could not load listings</h3>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            {message ??
              "The marketplace could not reach your node. Start vectis-node or check kernel connection settings, then refresh this page."}
          </p>
        </div>

        <div className="mx-auto mt-6 max-w-md rounded-xl border border-border/70 bg-muted/30 px-4 py-4">
          <h4 className="text-sm font-semibold tracking-tight">Get connected in 2 steps</h4>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Start your Vectis node on this device.</li>
            <li>Confirm the node URL in Settings, then refresh this page.</li>
          </ol>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button nativeButton={false} render={<Link href="/dashboard/settings" />} size="lg">
            Settings
          </Button>
          <Button
            nativeButton={false}
            render={<Link href="/dashboard" />}
            variant="outline"
            size="lg"
          >
            Track progress
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
          : desktopClient && signedIn
            ? "Your local node is connected and empty — a normal first-run state. Publish an offer to seed the marketplace, then refresh to browse it."
            : desktopClient
              ? "This desktop node has no active offers yet. Sign in, publish your first offer, then return here to browse."
              : "This node has no active marketplace offers right now. Browse another lane, or publish the first offer from your identity workspace."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button nativeButton={false} render={<Link href="/dashboard/builder" />} size="lg">
          Publish
        </Button>
        {signedIn ? (
          <Button
            nativeButton={false}
            render={<Link href="/dashboard" />}
            variant="outline"
            size="lg"
          >
            Dashboard
          </Button>
        ) : (
          <Button
            nativeButton={false}
            render={<Link href="/sign-in" />}
            variant="outline"
            size="lg"
          >
            Sign in
          </Button>
        )}
      </div>
    </div>
  );
}
