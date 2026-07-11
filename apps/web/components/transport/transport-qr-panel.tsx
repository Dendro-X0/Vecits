"use client";

import { Copy, Download, QrCode } from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import QRCode from "react-qr-code";

import { Button } from "@/components/ui/button";
import { TRANSPORT_QR_WARNING } from "@/lib/transport/copy";
import { cn } from "@/lib/utils";

export type TransportQrPanelProps = {
  value: string;
  title: string;
  description?: string;
  mode?: "url" | "text" | "bundle";
  className?: string;
  defaultOpen?: boolean;
  downloadFilename?: string;
};

export function TransportQrPanel({
  value,
  title,
  description,
  mode = "url",
  className,
  defaultOpen = false,
  downloadFilename = "vectis-share-qr.svg"
}: TransportQrPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const qrWrapRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const trimmed = value.trim();

  const handleCopy = useCallback(async () => {
    if (!trimmed) {
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1600);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }, [trimmed]);

  const handleDownload = useCallback(() => {
    const svg = qrWrapRef.current?.querySelector("svg");
    if (!svg || !trimmed) {
      return;
    }
    const serialized = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = downloadFilename;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  }, [downloadFilename, trimmed]);

  if (!trimmed) {
    return null;
  }

  const copyLabel =
    copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy";

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-border/70 bg-muted/15 p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p id={labelId} className="text-sm font-medium text-foreground">
            {title}
          </p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-expanded={open}
          aria-controls={`${labelId}-qr-body`}
          onClick={() => setOpen((prev) => !prev)}
        >
          <QrCode className="size-4" />
          {open ? "Hide QR" : "Show QR"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">{TRANSPORT_QR_WARNING}</p>

      {open ? (
        <div id={`${labelId}-qr-body`} className="space-y-3" aria-labelledby={labelId}>
          <div
            ref={qrWrapRef}
            className="mx-auto w-fit rounded-lg border border-border bg-background p-3"
            role="img"
            aria-label={`QR code for ${mode === "url" ? "link" : mode === "bundle" ? "transport bundle" : "text"}: ${title}`}
          >
            <QRCode value={trimmed} size={168} bgColor="transparent" fgColor="currentColor" />
          </div>

          {mode === "url" ? (
            <p className="break-all font-mono text-xs text-muted-foreground">{trimmed}</p>
          ) : mode === "bundle" ? (
            <p className="line-clamp-6 font-mono text-xs text-muted-foreground">{trimmed}</p>
          ) : (
            <p className="line-clamp-4 text-xs text-muted-foreground">{trimmed}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
              <Copy className="size-4" />
              {copyLabel}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-4" />
              Download SVG
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
