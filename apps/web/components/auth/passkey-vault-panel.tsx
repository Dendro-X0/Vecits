"use client";

import { Fingerprint, ShieldCheck, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthSession } from "@/lib/auth/session";
import {
  clearPasskeyVault,
  getPasskeyVaultMeta,
  hasPasskeyVault,
  passkeyVaultCapabilities,
  setupPasskeyVault,
  unlockPasskeyVault
} from "@/lib/auth/passkey-vault";
import { cn, truncatePubkey } from "@/lib/utils";

type PasskeyVaultPanelProps = {
  session?: AuthSession | null;
  onUnlocked?: (session: AuthSession) => void;
  className?: string;
};

export function PasskeyVaultPanel({ session, onUnlocked, className }: PasskeyVaultPanelProps) {
  const [vaultExists, setVaultExists] = useState(false);
  const [vaultMeta, setVaultMeta] = useState<ReturnType<typeof getPasskeyVaultMeta>>(null);
  const [capabilities, setCapabilities] = useState<{ webauthn: boolean; prf: boolean } | null>(
    null
  );
  const [label, setLabel] = useState("Vectis identity");
  const [backupPassword, setBackupPassword] = useState("");
  const [unlockPassword, setUnlockPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setVaultExists(hasPasskeyVault());
    setVaultMeta(getPasskeyVaultMeta());
    void passkeyVaultCapabilities().then(setCapabilities);
  }, []);

  async function handleSetup() {
    if (!session) {
      setError("Sign in with your key before creating a passkey vault.");
      return;
    }
    if (!capabilities?.webauthn) {
      setError("Passkeys are not supported in this browser.");
      return;
    }
    if (!capabilities.prf && backupPassword.length < 8) {
      setError("This device lacks WebAuthn PRF. Provide an 8+ character vault backup password.");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await setupPasskeyVault(session, {
        label,
        backupPassword: backupPassword.trim() || undefined
      });
      setVaultExists(true);
      setVaultMeta(getPasskeyVaultMeta());
      setMessage(
        result.prfEnabled
          ? "Passkey vault created. You can unlock with biometrics or device PIN."
          : "Passkey vault created with password fallback on this device."
      );
      setBackupPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlock() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const unlocked = await unlockPasskeyVault({
        backupPassword: unlockPassword.trim() || undefined
      });
      onUnlocked?.(unlocked);
      setMessage("Passkey vault unlocked.");
      setUnlockPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey unlock failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleRemoveVault() {
    clearPasskeyVault();
    setVaultExists(false);
    setVaultMeta(null);
    setMessage("Passkey vault removed from this browser.");
    setError(null);
  }

  return (
    <div className={cn("space-y-6", className)}>
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">Passkey vault (R7-D4 web fallback)</p>
            <p className="text-muted-foreground">
              Wrap your Ed25519 key behind a platform passkey. When WebAuthn PRF is available,
              unlock derives encryption locally — no plaintext key in storage.
            </p>
            {capabilities ? (
              <p className="text-xs text-muted-foreground">
                WebAuthn: {capabilities.webauthn ? "yes" : "no"} · PRF:{" "}
                {capabilities.prf ? "yes" : "password fallback required"}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      {vaultExists && vaultMeta ? (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div>
            <p className="font-medium">Vault on this device</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {vaultMeta.label ?? "Vectis identity"} ·{" "}
              {truncatePubkey(vaultMeta.publicKeyHex, 8, 8)}
            </p>
          </div>

          {!capabilities?.prf ? (
            <div className="space-y-2">
              <Label htmlFor="unlockPassword">Vault backup password</Label>
              <Input
                id="unlockPassword"
                type="password"
                value={unlockPassword}
                onChange={(event) => setUnlockPassword(event.target.value)}
                placeholder="Required on devices without PRF"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void handleUnlock();
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              <Fingerprint className="h-4 w-4" />
              Unlock with passkey
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleRemoveVault}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm transition hover:bg-foreground/[0.03] disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" />
              Remove vault
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <p className="font-medium">Create passkey vault</p>
          {!session ? (
            <p className="text-sm text-muted-foreground">Sign in first to wrap your current key with a passkey.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="vaultLabel">Passkey label</Label>
                <Input
                  id="vaultLabel"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                  placeholder="Vectis identity"
                />
              </div>
              {!capabilities?.prf ? (
                <div className="space-y-2">
                  <Label htmlFor="vaultBackupPassword">Vault backup password</Label>
                  <Input
                    id="vaultBackupPassword"
                    type="password"
                    value={backupPassword}
                    onChange={(event) => setBackupPassword(event.target.value)}
                    placeholder="Required when PRF is unavailable"
                  />
                </div>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void handleSetup();
                }}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                <Fingerprint className="h-4 w-4" />
                Create passkey vault
              </button>
            </>
          )}
        </div>
      )}

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
