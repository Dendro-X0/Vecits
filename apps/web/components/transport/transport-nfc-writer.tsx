"use client";

import { Nfc } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TRANSPORT_NFC_WARNING } from "@/lib/transport/copy";
import { isMobileRuntime } from "@/lib/transport/mobile-runtime";
import { isNfcWriteAvailable, writeTransportJsonToNfc } from "@/lib/transport/nfc-write";

type TransportNfcWriterProps = {
  payload: string;
  className?: string;
};

export function TransportNfcWriter({ payload, className }: TransportNfcWriterProps) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  if (!isMobileRuntime()) {
    return null;
  }

  async function handleWrite() {
    setBusy(true);
    setStatus(null);
    setFailed(false);

    const available = await isNfcWriteAvailable();
    if (!available) {
      setFailed(true);
      setStatus("NFC write unavailable. Use the QR code below (or paste on Import).");
      setBusy(false);
      return;
    }

    const result = await writeTransportJsonToNfc(payload);
    setBusy(false);
    if (!result.ok) {
      setFailed(true);
      setStatus(result.error);
      return;
    }
    setFailed(false);
    setStatus("Tag written. Recipient: Import → Scan NFC.");
  }

  return (
    <div className={className ?? "space-y-2 rounded-xl border border-border/70 bg-muted/10 px-4 py-3"}>
      <p className="text-xs text-muted-foreground">{TRANSPORT_NFC_WARNING}</p>
      <Button type="button" size="sm" variant="outline" disabled={busy || !payload.trim()} onClick={() => void handleWrite()}>
        <Nfc className="size-4" />
        {busy ? "Hold tag…" : "Write to NFC tag"}
      </Button>
      {status ? (
        <p className={`text-xs ${failed ? "text-destructive" : "text-primary"}`}>{status}</p>
      ) : null}
    </div>
  );
}
