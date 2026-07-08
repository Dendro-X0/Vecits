"use client";

import { KeyRound, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import { hasStoredSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type KeyQuickActionsProps = {
  onUseSavedKey?: () => void;
  onImportClipboard?: () => void;
  tone?: "dark" | "light";
};

export function KeyQuickActions({
  onUseSavedKey,
  onImportClipboard,
  tone = "dark"
}: KeyQuickActionsProps) {
  const [savedAvailable, setSavedAvailable] = useState(false);
  const isLight = tone === "light";

  useEffect(() => {
    setSavedAvailable(hasStoredSession());
  }, []);

  const buttonClass = cn(
    "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
    isLight
      ? "border-border bg-background text-foreground hover:bg-muted"
      : "border-border bg-muted/50 text-foreground hover:bg-accent"
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        className={buttonClass}
        disabled={!savedAvailable}
        onClick={onUseSavedKey}
      >
        <Wallet className="h-4 w-4" />
        Use saved key
      </button>
      <button type="button" className={buttonClass} onClick={onImportClipboard}>
        <KeyRound className="h-4 w-4" />
        Paste from clipboard
      </button>
    </div>
  );
}
