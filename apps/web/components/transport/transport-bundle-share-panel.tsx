"use client";

import { TransportNfcWriter } from "@/components/transport/transport-nfc-writer";
import { TransportQrPanel } from "@/components/transport/transport-qr-panel";
import { serializeTransportBundle, type TransportBundle } from "@/lib/transport/bundle";

type TransportBundleSharePanelProps = {
  bundle: TransportBundle;
  title: string;
  description?: string;
  className?: string;
  downloadFilename?: string;
};

export function TransportBundleSharePanel({
  bundle,
  title,
  description,
  className,
  downloadFilename = "vectis-transport-bundle.svg"
}: TransportBundleSharePanelProps) {
  const serialized = serializeTransportBundle(bundle);

  return (
    <div className="space-y-3">
      <TransportQrPanel
        value={serialized}
        title={title}
        description={description}
        mode="bundle"
        className={className}
        downloadFilename={downloadFilename}
      />
      <TransportNfcWriter payload={serialized} />
    </div>
  );
}
