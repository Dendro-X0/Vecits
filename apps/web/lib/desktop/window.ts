type DesktopWindow = {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  toggleMaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onResized: (handler: () => void) => Promise<() => void>;
};

type TauriGlobals = {
  webviewWindow?: { getCurrentWebviewWindow?: () => DesktopWindow };
  window?: { getCurrentWindow?: () => DesktopWindow };
};

export function isVectisDesktopShell(): boolean {
  if (typeof globalThis === "undefined") {
    return false;
  }

  const globals = globalThis as {
    __VECTIS_DESKTOP__?: boolean;
    __VECTIS_MOBILE__?: boolean;
    __TAURI__?: TauriGlobals;
  };

  if (globals.__VECTIS_DESKTOP__) {
    return true;
  }

  return Boolean(globals.__TAURI__ && !globals.__VECTIS_MOBILE__);
}

export function readDesktopShellMarker(): boolean {
  if (typeof document === "undefined") {
    return isVectisDesktopShell();
  }

  return document.documentElement.dataset.vectisDesktop === "true" || isVectisDesktopShell();
}

export function getDesktopWindow(): DesktopWindow | null {
  if (!isVectisDesktopShell()) {
    return null;
  }

  const tauri = (globalThis as { __TAURI__?: TauriGlobals }).__TAURI__;
  if (!tauri) {
    return null;
  }

  return (
    tauri.webviewWindow?.getCurrentWebviewWindow?.() ??
    tauri.window?.getCurrentWindow?.() ??
    null
  );
}
