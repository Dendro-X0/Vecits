"use client";

import { Upload } from "lucide-react";
import { useCallback, useId, useState, type ChangeEvent } from "react";

import { TransportBundleReview } from "@/components/transport/transport-bundle-review";
import { TransportQrScanner } from "@/components/transport/transport-qr-scanner";
import { Button } from "@/components/ui/button";
import { parseTransportBundleInput, type ParsedTransportBundle } from "@/lib/transport/bundle";
import { isBarcodeDetectorAvailable, isMobileRuntime } from "@/lib/transport/mobile-runtime";
import { TRANSPORT_QR_WARNING } from "@/lib/transport/copy";
import { cn } from "@/lib/utils";

type ImportTab = "paste" | "file" | "scan";

export function TransportBundleImportPanel({ className }: { className?: string }) {
  const textareaId = useId();
  const [tab, setTab] = useState<ImportTab>("paste");
  const [rawInput, setRawInput] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [review, setReview] = useState<{
    bundle: ParsedTransportBundle;
    expired: boolean;
  } | null>(null);

  const showScanTab = isMobileRuntime() || isBarcodeDetectorAvailable();

  const ingestRaw = useCallback((value: string) => {
    setRawInput(value);
    const result = parseTransportBundleInput(value);
    if (!result.ok) {
      setParseError(result.error);
      setReview(null);
      return;
    }
    setParseError(null);
    setReview({ bundle: result.bundle, expired: result.expired });
  }, []);

  function handleParseClick() {
    ingestRaw(rawInput);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      ingestRaw(text);
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{TRANSPORT_QR_WARNING}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={tab === "paste" ? "default" : "outline"}
          onClick={() => setTab("paste")}
        >
          Paste JSON
        </Button>
        <Button
          type="button"
          size="sm"
          variant={tab === "file" ? "default" : "outline"}
          onClick={() => setTab("file")}
        >
          <Upload className="size-4" />
          Upload file
        </Button>
        {showScanTab ? (
          <Button
            type="button"
            size="sm"
            variant={tab === "scan" ? "default" : "outline"}
            onClick={() => setTab("scan")}
          >
            Scan QR
          </Button>
        ) : null}
      </div>

      {tab === "paste" ? (
        <div className="space-y-3">
          <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
            Transport bundle JSON
          </label>
          <textarea
            id={textareaId}
            value={rawInput}
            onChange={(event) => setRawInput(event.target.value)}
            className="min-h-[10rem] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
            placeholder='{"v":1,"kind":"vectis.transport.v1",...}'
          />
          <Button type="button" size="sm" onClick={handleParseClick} disabled={!rawInput.trim()}>
            Parse bundle
          </Button>
        </div>
      ) : null}

      {tab === "file" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Upload a `.json` file containing a Vectis transport bundle.
          </p>
          <input type="file" accept=".json,application/json" onChange={handleFileChange} />
        </div>
      ) : null}

      {tab === "scan" && showScanTab ? (
        <TransportQrScanner
          onScan={ingestRaw}
          onError={(message) => setParseError(message)}
        />
      ) : null}

      {parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}

      {review ? (
        <TransportBundleReview bundle={review.bundle} expired={review.expired} />
      ) : null}
    </div>
  );
}
