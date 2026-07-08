const SECRET_KEY_STORAGE = "vectis.auth.secret_key_hex";
const PUBLIC_KEY_STORAGE = "vectis.auth.public_key_hex";
const REMEMBER_STORAGE = "vectis.auth.remember";

export type AuthSession = {
  publicKeyHex: string;
  secretKeyHex: string;
};

export function isVectisDesktopClient(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    Boolean((globalThis as { __VECTIS_DESKTOP__?: boolean }).__VECTIS_DESKTOP__)
  );
}

export function mirrorSessionToBrowserStorage(session: AuthSession): void {
  if (typeof window === "undefined") {
    return;
  }
  sessionStorage.setItem(SECRET_KEY_STORAGE, session.secretKeyHex);
  sessionStorage.setItem(PUBLIC_KEY_STORAGE, session.publicKeyHex);
}

export function hasStoredSession(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean(localStorage.getItem(SECRET_KEY_STORAGE) && localStorage.getItem(PUBLIC_KEY_STORAGE));
}

export function loadStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const secretKeyHex = localStorage.getItem(SECRET_KEY_STORAGE);
  const publicKeyHex = localStorage.getItem(PUBLIC_KEY_STORAGE);
  if (!secretKeyHex || !publicKeyHex) {
    return null;
  }
  return { secretKeyHex, publicKeyHex };
}

export function saveSession(session: AuthSession, remember: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  mirrorSessionToBrowserStorage(session);
  if (isVectisDesktopClient()) {
    return;
  }
  if (remember) {
    localStorage.setItem(SECRET_KEY_STORAGE, session.secretKeyHex);
    localStorage.setItem(PUBLIC_KEY_STORAGE, session.publicKeyHex);
    localStorage.setItem(REMEMBER_STORAGE, "1");
  } else {
    localStorage.removeItem(SECRET_KEY_STORAGE);
    localStorage.removeItem(PUBLIC_KEY_STORAGE);
    localStorage.removeItem(REMEMBER_STORAGE);
  }
}

export function loadActiveSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const persisted = loadStoredSession();
  if (persisted) {
    return persisted;
  }
  const secretKeyHex = sessionStorage.getItem(SECRET_KEY_STORAGE);
  const publicKeyHex = sessionStorage.getItem(PUBLIC_KEY_STORAGE);
  if (!secretKeyHex || !publicKeyHex) {
    return null;
  }
  return { secretKeyHex, publicKeyHex };
}

export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(SECRET_KEY_STORAGE);
  localStorage.removeItem(PUBLIC_KEY_STORAGE);
  localStorage.removeItem(REMEMBER_STORAGE);
  sessionStorage.removeItem(SECRET_KEY_STORAGE);
  sessionStorage.removeItem(PUBLIC_KEY_STORAGE);
  if (isVectisDesktopClient()) {
    void import("@/lib/auth/desktop-vault").then(({ lockDesktopVault }) => lockDesktopVault());
  }
}
