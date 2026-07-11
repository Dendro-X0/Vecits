"use client";

import Link from "next/link";

import { resolveMobilePinnedNodeError } from "@/lib/node-client-base-url";

type MobilePinnedNodeNoticeProps = {
  className?: string;
};

export function MobilePinnedNodeNotice({ className }: MobilePinnedNodeNoticeProps) {
  const error = resolveMobilePinnedNodeError();
  if (!error) {
    return null;
  }

  return (
    <p
      className={
        className ??
        "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      }
    >
      <strong>Kernel unreachable:</strong> {error}{" "}
      <Link href="/dashboard/settings" className="underline underline-offset-4">
        Open settings
      </Link>{" "}
      or{" "}
      <Link href="/dashboard/import" className="underline underline-offset-4">
        import a transport bundle
      </Link>
      .
    </p>
  );
}
