"use client";

import { derivePublicKey } from "@new-start/sdk-ts";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { AuthDivider } from "@/components/auth/auth-divider";
import { KeyBackupPanel } from "@/components/auth/key-backup-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getDesktopVaultStatus,
  isDesktopVaultAvailable,
  saveDesktopVault,
  tryAutoUnlockDesktopVault,
  unlockDesktopVault
} from "@/lib/auth/desktop-vault";
import {
  hasPasskeyVault,
  passkeyVaultCapabilities,
  unlockPasskeyVault
} from "@/lib/auth/passkey-vault";
import { loadStoredSession, mirrorSessionToBrowserStorage, saveSession, type AuthSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

type SignInFormProps = {
  nextPath?: string;
};

function persistTypedSecret(secret: string, rememberKey: boolean): void {
  const trimmed = secret.trim();
  if (!rememberKey || !/^[0-9a-fA-F]{64}$/.test(trimmed) || typeof window === "undefined") {
    return;
  }
  localStorage.setItem("vectis.auth.secret_key_hex", trimmed);
  localStorage.setItem("vectis.auth.remember", "1");
  void derivePublicKey(trimmed)
    .then((publicKeyHex) => {
      saveSession({ secretKeyHex: trimmed, publicKeyHex }, rememberKey);
    })
    .catch(() => {});
}

export function SignInForm({ nextPath = "/marketplace" }: SignInFormProps) {
  const router = useRouter();
  const [secretKeyHex, setSecretKeyHex] = useState("");
  const [remember, setRemember] = useState(true);
  const [vaultPassword, setVaultPassword] = useState("");
  const [desktopVaultExists, setDesktopVaultExists] = useState(false);
  const [desktopVault, setDesktopVault] = useState(isDesktopVaultAvailable());
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyVaultPassword, setPasskeyVaultPassword] = useState("");
  const [needsVaultPassword, setNeedsVaultPassword] = useState(false);

  useEffect(() => {
    if (!desktopVault) {
      return;
    }
    void (async () => {
      const autoSession = await tryAutoUnlockDesktopVault();
      if (autoSession) {
        mirrorSessionToBrowserStorage(autoSession);
        router.push(nextPath);
        router.refresh();
        return;
      }
      const status = await getDesktopVaultStatus();
      setDesktopVaultExists(Boolean(status?.exists));
    })();
  }, [desktopVault, nextPath, router]);

  useEffect(() => {
    void passkeyVaultCapabilities().then((caps) => {
      setPasskeyAvailable(caps.webauthn && hasPasskeyVault());
      setNeedsVaultPassword(!caps.prf && hasPasskeyVault());
    });
  }, []);

  // Persist a valid key as soon as it is entered so split-step browser automation
  // (type in one capture, click in the next) can unlock via "Use saved key".
  useEffect(() => {
    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.id !== "secretKeyHex") {
        return;
      }
      persistTypedSecret(target.value, remember);
    };
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    return () => {
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
    };
  }, [remember]);

  async function completeSignIn(session: AuthSession, rememberKey: boolean, vaultPasswordValue?: string) {
    if (desktopVault && rememberKey) {
      const password = vaultPasswordValue?.trim() ?? vaultPassword.trim();
      if (password.length < 8) {
        throw new Error("Choose a vault password with at least 8 characters.");
      }
      await saveDesktopVault(session, password, true);
    }
    saveSession(session, rememberKey);
    router.push(nextPath);
    router.refresh();
  }

  async function unlockWithSecretKey(
    secret: string,
    rememberKey: boolean,
    vaultPasswordValue?: string
  ) {
    const trimmed = secret.trim();
    if (!trimmed) {
      setError("Enter your secret key hex to continue.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const publicKeyHex = await derivePublicKey(trimmed);
      await completeSignIn({ secretKeyHex: trimmed, publicKeyHex }, rememberKey, vaultPasswordValue);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Invalid secret key.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const domValue = (
      event.currentTarget.elements.namedItem("secretKeyHex") as HTMLInputElement | null
    )?.value;
    await unlockWithSecretKey(domValue?.trim() || secretKeyHex, remember, vaultPassword);
  }

  async function handleUnlockDesktopVault() {
    if (vaultPassword.length < 8) {
      setError("Enter your vault password (8+ characters).");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await unlockDesktopVault(vaultPassword);
      mirrorSessionToBrowserStorage(session);
      saveSession(session, true);
      router.push(nextPath);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Vault unlock failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUseSavedKey() {
    if (desktopVault) {
      setError("Use your desktop vault password to unlock a remembered key.");
      return;
    }
    let session = loadStoredSession();
    if (!session && typeof window !== "undefined") {
      const secretKeyHex = localStorage.getItem("vectis.auth.secret_key_hex")?.trim();
      if (secretKeyHex) {
        try {
          const publicKeyHex = await derivePublicKey(secretKeyHex);
          session = { secretKeyHex, publicKeyHex };
          saveSession(session, true);
        } catch {
          session = null;
        }
      }
    }
    if (!session) {
      setError("No saved key found in this browser.");
      return;
    }
    await unlockWithSecretKey(session.secretKeyHex, true);
  }

  async function handlePasskeyUnlock() {
    setIsSubmitting(true);
    setError(null);
    try {
      const session = await unlockPasskeyVault({
        backupPassword: passkeyVaultPassword.trim() || undefined
      });
      await completeSignIn(session, true, passkeyVaultPassword);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Passkey unlock failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setSecretKeyHex(text.trim());
      setError(null);
    } catch {
      setError("Could not read clipboard. Paste your secret key manually.");
    }
  }

  return (
    <div className="space-y-6">
      {desktopVault && desktopVaultExists ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Desktop secure vault</p>
          <p className="text-xs text-muted-foreground">
            Your key is stored encrypted on this device. Unlock with your vault password or rely on
            OS keychain auto-unlock when enabled.
          </p>
          <div className="space-y-2">
            <Label htmlFor="desktopVaultPassword">Vault password</Label>
            <Input
              id="desktopVaultPassword"
              type="password"
              value={vaultPassword}
              onChange={(event) => setVaultPassword(event.target.value)}
              placeholder="Vault password"
            />
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              void handleUnlockDesktopVault();
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            Unlock vault
          </button>
        </div>
      ) : null}

      {!desktopVault ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void handleUseSavedKey();
          }}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium transition hover:bg-foreground/[0.03] disabled:opacity-60"
        >
          Use saved key
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => {
            void handleImportClipboard();
          }}
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-card text-sm font-medium transition hover:bg-foreground/[0.03] disabled:opacity-60"
        >
          Paste from clipboard
        </button>
      </div>
      ) : null}

      {passkeyAvailable && !desktopVault ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium">Passkey vault</p>
          {needsVaultPassword ? (
            <div className="space-y-2">
              <Label htmlFor="vaultPassword">Vault backup password</Label>
              <Input
                id="vaultPassword"
                type="password"
                value={passkeyVaultPassword}
                onChange={(event) => setPasskeyVaultPassword(event.target.value)}
                placeholder="Required on this device"
              />
            </div>
          ) : null}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              void handlePasskeyUnlock();
            }}
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            Unlock with passkey
          </button>
        </div>
      ) : null}

      <AuthDivider label="Or import key" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="secretKeyHex">Secret key (hex)</Label>
          <Input
            id="secretKeyHex"
            name="secretKeyHex"
            type="password"
            autoComplete="off"
            required
            value={secretKeyHex}
            onChange={(event) => {
              const next = event.target.value;
              setSecretKeyHex(next);
              persistTypedSecret(next, remember);
            }}
            placeholder="64-character Ed25519 secret key"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            No email or password. Your local key unlocks signing for marketplace actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="rememberKey"
            name="rememberKey"
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
            className="size-4 shrink-0 rounded border border-border accent-primary"
          />
          <Label htmlFor="rememberKey" className="cursor-pointer text-sm font-normal text-muted-foreground">
            {desktopVault
              ? "Remember in encrypted desktop vault"
              : "Remember key in this browser"}
          </Label>
        </div>

        {desktopVault && remember ? (
          <div className="space-y-2">
            <Label htmlFor="newVaultPassword">Vault password</Label>
            <Input
              id="newVaultPassword"
              type="password"
              value={vaultPassword}
              onChange={(event) => setVaultPassword(event.target.value)}
              placeholder="8+ characters — unlocks this device vault"
            />
          </div>
        ) : null}

        {error ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Unlocking…" : "Sign in"}
        </button>
      </form>

      <AuthDivider label="Or restore backup file" />

      <KeyBackupPanel
        onImported={(session) => {
          setSecretKeyHex(session.secretKeyHex);
          mirrorSessionToBrowserStorage(session);
          saveSession(session, true);
          setError(null);
        }}
      />
    </div>
  );
}
