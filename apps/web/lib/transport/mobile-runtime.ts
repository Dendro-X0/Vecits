export function isMobileRuntime(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return Boolean((globalThis as { __VECTIS_MOBILE__?: boolean }).__VECTIS_MOBILE__);
}

export function isBarcodeDetectorAvailable(): boolean {
  return typeof window !== "undefined" && "BarcodeDetector" in window;
}
