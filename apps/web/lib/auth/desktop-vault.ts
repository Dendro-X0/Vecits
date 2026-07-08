import type { AuthSession } from "@/lib/auth/session";

export type DesktopVaultStatus = {
  exists: boolean;
  unlocked: boolean;
  rememberEnabled: boolean;
  publicKeyHex: string | null;
};

type TauriInvoke = <T>(command: string, args?: Record<string, unknown>) => Promise<T>;

function tauriInvoke(): TauriInvoke | null {
  if (typeof window === "undefined") {
    return null;
  }
  const tauri = (globalThis as { __TAURI__?: { core?: { invoke?: TauriInvoke } } }).__TAURI__;
  return tauri?.core?.invoke ?? null;
}

export function isVectisDesktop(): boolean {
  return typeof globalThis !== "undefined" && Boolean((globalThis as { __VECTIS_DESKTOP__?: boolean }).__VECTIS_DESKTOP__);
}

export function isDesktopVaultAvailable(): boolean {
  return isVectisDesktop() && tauriInvoke() !== null;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const invokeFn = tauriInvoke();
  if (!invokeFn) {
    throw new Error("Desktop vault is unavailable in this environment.");
  }
  return invokeFn<T>(command, args);
}

function toSession(payload: {
  publicKeyHex: string;
  secretKeyHex: string;
}): AuthSession {
  return {
    publicKeyHex: payload.publicKeyHex,
    secretKeyHex: payload.secretKeyHex
  };
}

export async function getDesktopVaultStatus(): Promise<DesktopVaultStatus | null> {
  if (!isDesktopVaultAvailable()) {
    return null;
  }
  return invoke<DesktopVaultStatus>("desktop_vault_status");
}

export async function tryAutoUnlockDesktopVault(): Promise<AuthSession | null> {
  if (!isDesktopVaultAvailable()) {
    return null;
  }
  const unlocked = await invoke<boolean>("desktop_vault_try_auto_unlock");
  if (!unlocked) {
    return null;
  }
  return getDesktopVaultSession();
}

export async function unlockDesktopVault(password: string): Promise<AuthSession> {
  const payload = await invoke<{ publicKeyHex: string; secretKeyHex: string }>("desktop_vault_unlock", {
    password
  });
  return toSession(payload);
}

export async function saveDesktopVault(
  session: AuthSession,
  password: string,
  remember: boolean
): Promise<void> {
  await invoke("desktop_vault_save", {
    session: {
      publicKeyHex: session.publicKeyHex,
      secretKeyHex: session.secretKeyHex
    },
    password,
    remember
  });
}

export async function lockDesktopVault(): Promise<void> {
  if (!isDesktopVaultAvailable()) {
    return;
  }
  await invoke("desktop_vault_lock");
}

export async function clearDesktopVault(): Promise<void> {
  if (!isDesktopVaultAvailable()) {
    return;
  }
  await invoke("desktop_vault_clear");
}

export async function getDesktopVaultSession(): Promise<AuthSession | null> {
  if (!isDesktopVaultAvailable()) {
    return null;
  }
  const payload = await invoke<{ publicKeyHex: string; secretKeyHex: string } | null>(
    "desktop_vault_session"
  );
  return payload ? toSession(payload) : null;
}

export async function exportDesktopVaultBackup(password: string): Promise<string> {
  return invoke<string>("desktop_vault_export", { password });
}

export async function importDesktopVaultBackup(
  backupJson: string,
  backupPassword: string,
  vaultPassword: string,
  remember: boolean
): Promise<AuthSession> {
  const payload = await invoke<{ publicKeyHex: string; secretKeyHex: string }>("desktop_vault_import", {
    backupJson,
    backupPassword,
    vaultPassword,
    remember
  });
  return toSession(payload);
}

export async function downloadDesktopVaultBackup(password: string, filename?: string): Promise<void> {
  const backupJson = await exportDesktopVaultBackup(password);
  const parsed = JSON.parse(backupJson) as { publicKeyHex?: string };
  const blob = new Blob([backupJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ?? `vectis-key-${parsed.publicKeyHex?.slice(0, 8) ?? "backup"}.vectis-key.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
