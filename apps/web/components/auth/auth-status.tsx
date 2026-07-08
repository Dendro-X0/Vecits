"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { clearSession, loadActiveSession } from "@/lib/auth/session";
import { cn, truncatePubkey } from "@/lib/utils";

export function AuthStatus() {
  const router = useRouter();
  const [publicKeyHex, setPublicKeyHex] = useState<string | null>(null);

  useEffect(() => {
    const session = loadActiveSession();
    setPublicKeyHex(session?.publicKeyHex ?? null);
  }, []);

  if (!publicKeyHex) {
    return (
      <Link href="/sign-in" className={cn(buttonVariants({ size: "sm" }))}>
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden rounded-lg border border-border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground sm:inline">
        {truncatePubkey(publicKeyHex, 6, 4)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          clearSession();
          setPublicKeyHex(null);
          router.refresh();
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
