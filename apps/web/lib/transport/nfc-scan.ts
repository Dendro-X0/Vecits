/**
 * Mobile NFC scan bridge (R9-N1). Dynamic-imports the Tauri plugin so web builds stay clean.
 */

import {
  extractTransportTextFromNdefRecords,
  type NdefTagRecordLike
} from "@/lib/transport/nfc-payload";
import { isMobileRuntime } from "@/lib/transport/mobile-runtime";

export type NfcScanResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export async function isNfcScanAvailable(): Promise<boolean> {
  if (!isMobileRuntime()) {
    return false;
  }
  try {
    const nfc = await import("@tauri-apps/plugin-nfc");
    return await nfc.isAvailable();
  } catch {
    return false;
  }
}

export async function scanNfcTransportPayload(): Promise<NfcScanResult> {
  if (!isMobileRuntime()) {
    return {
      ok: false,
      error: "NFC scan requires the Android Vectis app."
    };
  }

  try {
    const nfc = await import("@tauri-apps/plugin-nfc");
    const available = await nfc.isAvailable();
    if (!available) {
      return {
        ok: false,
        error: "NFC is not available on this device. Use paste or QR instead."
      };
    }

    const tag = await nfc.scan(
      { type: "ndef" },
      {
        message: "Hold near a Vectis transport tag",
        successMessage: "Tag read"
      }
    );

    const records = (tag.records ?? []) as NdefTagRecordLike[];
    const text = extractTransportTextFromNdefRecords(records);
    return { ok: true, text };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: message.trim() || "NFC scan failed."
    };
  }
}
