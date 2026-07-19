"use client";

import { Nfc } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TRANSPORT_NFC_WARNING, TRANSPORT_NODE_CONFIRM_WARNING } from "@/lib/transport/copy";
import { isNfcScanAvailable, scanNfcTransportPayload } from "@/lib/transport/nfc-scan";

type TransportNfcScannerProps = {
  onScan: (raw: string) => void;
  onError: (message: string) => void;
};

export function TransportNfcScanner({ onScan, onError }: TransportNfcScannerProps) {
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  async function handleScan() {
    setBusy(true);
    setHint(null);
    onError("");

    const available = await isNfcScanAvailable();
    if (!available) {
      const message =
        "NFC is not available here. Use paste or QR, or open the Android Vectis app on a device with NFC.";
      setHint(message);
      onError(message);
      setBusy(false);
      return;
    }

    const result = await scanNfcTransportPayload();
    setBusy(false);
    if (!result.ok) {
      setHint(result.error);
      onError(result.error);
      return;
    }
    setHint("Tag read — review the bundle below.");
    onScan(result.text);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4">
      <p className="text-sm text-muted-foreground">{TRANSPORT_NFC_WARNING}</p>
      <p className="text-sm text-muted-foreground">{TRANSPORT_NODE_CONFIRM_WARNING}</p>
      <Button type="button" size="sm" disabled={busy} onClick={() => void handleScan()}>
        <Nfc className="size-4" />
        {busy ? "Waiting for tag…" : "Scan NFC tag"}
      </Button>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
