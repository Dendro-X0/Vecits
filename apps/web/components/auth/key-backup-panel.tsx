"use client";

import { Download, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  backupSecurityNote,
  createKeyBackup,
  downloadKeyBackup,
  readKeyBackupFile,
  restoreKeyBackup
} from "@/lib/auth/key-backup";
import {
  downloadDesktopVaultBackup,
  importDesktopVaultBackup,
  isDesktopVaultAvailable
} from "@/lib/auth/desktop-vault";
import type { AuthSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type KeyBackupPanelProps = {
  session?: AuthSession | null;
  onImported?: (session: AuthSession) => void;
  className?: string;
};

export function KeyBackupPanel({ session, onImported, className }: KeyBackupPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportPassword, setExportPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [pendingBackupFile, setPendingBackupFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importVaultPassword, setImportVaultPassword] = useState("");
  const [rememberOnDesktop, setRememberOnDesktop] = useState(true);
  const [busy, setBusy] = useState(false);
  const desktopVault = isDesktopVaultAvailable();

  async function handleExport() {
    if (!session) {
      setError("Sign in before exporting a key backup.");
      return;
    }
    if (exportPassword.length < 8) {
      setError("Use a backup password with at least 8 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (desktopVault) {
        await downloadDesktopVaultBackup(exportPassword);
      } else {
        const backup = await createKeyBackup(session, exportPassword);
        downloadKeyBackup(backup);
      }
      setMessage("Encrypted backup downloaded.");
      setExportPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!pendingBackupFile) {
      setError("Choose a backup file first.");
      return;
    }
    if (importPassword.length < 8) {
      setError("Enter the backup password used during export.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const backup = await readKeyBackupFile(pendingBackupFile);
      const restored = desktopVault
        ? await importDesktopVaultBackup(
            JSON.stringify(backup),
            importPassword,
            importVaultPassword || importPassword,
            rememberOnDesktop
          )
        : await restoreKeyBackup(backup, importPassword);
      onImported?.(restored);
      setMessage(
        desktopVault
          ? "Backup imported into the desktop vault."
          : "Backup decrypted. Finish sign-in to unlock this browser session."
      );
      setImportPassword("");
      setPendingBackupFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("space-y-6", className)}>
      <p className="text-sm text-muted-foreground">{backupSecurityNote()}</p>

      {session ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            <p className="font-medium">Export encrypted backup</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exportPassword">Backup password</Label>
            <Input
              id="exportPassword"
              type="password"
              value={exportPassword}
              onChange={(event) => setExportPassword(event.target.value)}
              placeholder="Separate from your passkey — store safely"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void handleExport();
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            Download backup file
          </button>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <p className="font-medium">Import encrypted backup</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="backupFile">Backup file</Label>
          <Input
            id="backupFile"
            ref={fileInputRef}
            type="file"
            accept="application/json,.json,.vectis-key.json"
            onChange={(event) => {
              setPendingBackupFile(event.target.files?.[0] ?? null);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="importPassword">Backup password</Label>
          <Input
            id="importPassword"
            type="password"
            value={importPassword}
            onChange={(event) => setImportPassword(event.target.value)}
            placeholder="Password used when exporting"
          />
        </div>
        {desktopVault ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="importVaultPassword">Desktop vault password</Label>
              <Input
                id="importVaultPassword"
                type="password"
                value={importVaultPassword}
                onChange={(event) => setImportVaultPassword(event.target.value)}
                placeholder="Defaults to backup password if empty"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="rememberOnDesktop"
                type="checkbox"
                checked={rememberOnDesktop}
                onChange={(event) => setRememberOnDesktop(event.target.checked)}
                className="size-4 shrink-0 rounded border border-border accent-primary"
              />
              <Label htmlFor="rememberOnDesktop" className="text-sm font-normal text-muted-foreground">
                Remember on this device (OS keychain auto-unlock)
              </Label>
            </div>
          </>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleImport();
          }}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium transition hover:bg-foreground/[0.03] disabled:opacity-60"
        >
          Decrypt backup
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
