/**
 * Mobile NFC write bridge (R9-N2). Dynamic-imports the Tauri plugin.
 */

import { VECTIS_TRANSPORT_MIME } from "@/lib/transport/nfc-payload";
import { isNfcScanAvailable } from "@/lib/transport/nfc-scan";
import { isMobileRuntime } from "@/lib/transport/mobile-runtime";

export type NfcWriteResult =
  | { ok: true }
  | { ok: false; error: string; suggestQr: true };

export async function isNfcWriteAvailable(): Promise<boolean> {
  return isNfcScanAvailable();
}

/**
 * Write Tier 1 transport JSON as MIME NDEF (same encoding N1 prefers to read).
 */
export async function writeTransportJsonToNfc(json: string): Promise<NfcWriteResult> {
  const trimmed = json.trim();
  if (!trimmed) {
    return { ok: false, error: "Nothing to write.", suggestQr: true };
  }
  if (!isMobileRuntime()) {
    return {
      ok: false,
      error: "NFC write requires the Android Vectis app. Use the QR code instead.",
      suggestQr: true
    };
  }

  try {
    const nfc = await import("@tauri-apps/plugin-nfc");
    const available = await nfc.isAvailable();
    if (!available) {
      return {
        ok: false,
        error: "NFC is not available on this device. Use the QR code below.",
        suggestQr: true
      };
    }

    const mimeRecord = nfc.record(
      nfc.NFCTypeNameFormat.Media,
      VECTIS_TRANSPORT_MIME,
      [],
      trimmed
    );

    await nfc.write([mimeRecord], {
      kind: { type: "ndef", mimeType: VECTIS_TRANSPORT_MIME },
      message: "Hold a writable tag to share this bundle",
      successfulReadMessage: "Tag ready",
      successMessage: "Bundle written to tag"
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: (message.trim() || "NFC write failed.") + " Use the QR code below.",
      suggestQr: true
    };
  }
}
