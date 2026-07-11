"use client";

import { useEffect, useRef, useState } from "react";

type TransportQrScannerProps = {
  onScan: (value: string) => void;
  onError?: (message: string) => void;
  className?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

export function TransportQrScanner({ onScan, onError, className }: TransportQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    let cancelled = false;
    let frameId = 0;

    async function start() {
      if (!("BarcodeDetector" in window) || !navigator.mediaDevices?.getUserMedia) {
        const message = "Camera scan is not available in this browser. Paste the bundle JSON instead.";
        setStatus(message);
        onError?.(message);
        setActive(false);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false
        });
        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          return;
        }
        video.srcObject = stream;
        await video.play();

        const detector = new (window as unknown as { BarcodeDetector: new () => BarcodeDetectorLike })
          .BarcodeDetector();

        const tick = async () => {
          if (cancelled || !videoRef.current || videoRef.current.readyState < 2) {
            frameId = window.requestAnimationFrame(() => {
              void tick();
            });
            return;
          }
          try {
            const codes = await detector.detect(videoRef.current);
            const match = codes.find((code) => code.rawValue?.trim());
            if (match?.rawValue) {
              onScan(match.rawValue);
              setStatus("QR detected.");
              setActive(false);
              return;
            }
          } catch {
            // keep scanning
          }
          frameId = window.requestAnimationFrame(() => {
            void tick();
          });
        };

        setStatus("Point the camera at a Vectis transport QR code.");
        void tick();
      } catch {
        const message = "Could not access the camera. Check permissions or paste the bundle JSON.";
        setStatus(message);
        onError?.(message);
        setActive(false);
      }
    }

    void start();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [active, onError, onScan]);

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-lg border border-border bg-muted/20">
        <video ref={videoRef} className="aspect-video w-full bg-black object-cover" muted playsInline />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted/40"
          onClick={() => setActive((prev) => !prev)}
        >
          {active ? "Stop camera" : "Start camera scan"}
        </button>
        {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      </div>
    </div>
  );
}
