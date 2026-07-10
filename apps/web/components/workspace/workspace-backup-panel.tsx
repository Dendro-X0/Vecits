"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { loadActiveSession } from "@/lib/auth/session";
import {
  downloadWorkspaceStoreBackup,
  resolveWorkspaceStoreBackup,
  workspaceBackupSecurityNote
} from "@/lib/workspace/workspace-backup";
import { cn } from "@/lib/utils";

type WorkspaceBackupPanelProps = {
  className?: string;
};

export function WorkspaceBackupPanel({ className }: WorkspaceBackupPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function handleExport() {
    const session = loadActiveSession();
    if (!session) {
      setError("Sign in before exporting workspace notes.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const document = resolveWorkspaceStoreBackup(session);
      if (!document) {
        setError("No encrypted workspace notes found for this identity on this device.");
        return;
      }
      downloadWorkspaceStoreBackup(document);
      setMessage("Encrypted workspace backup downloaded.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-3 text-sm", className)}>
      <p className="text-muted-foreground">{workspaceBackupSecurityNote()}</p>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={handleExport}>
        <Download className="size-4" />
        Export workspace notes
      </Button>
      {message ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
