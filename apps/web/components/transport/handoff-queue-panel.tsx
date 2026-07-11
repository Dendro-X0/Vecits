"use client";

import { useEffect, useState } from "react";

import { NodeApiError, NodeClient } from "@new-start/sdk-ts";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  listHandoffQueuedEvents,
  removeHandoffQueuedEvent,
  updateHandoffQueuedEventError,
  type HandoffQueuedEvent
} from "@/lib/transport/handoff-queue";
import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";

type HandoffQueuePanelProps = {
  onSubmitted?: () => void;
};

export function HandoffQueuePanel({ onSubmitted }: HandoffQueuePanelProps) {
  const [items, setItems] = useState<HandoffQueuedEvent[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setItems(listHandoffQueuedEvents());
  }

  useEffect(() => {
    reload();
  }, []);

  async function submitQueued(item: HandoffQueuedEvent) {
    setBusyId(item.id);
    try {
      const client = new NodeClient({ baseUrl: resolveNodeClientBaseUrl() });
      const result = await client.submitSignedEnvelope(item.signed);
      if (result.accepted) {
        removeHandoffQueuedEvent(item.id);
        reload();
        onSubmitted?.();
      } else {
        updateHandoffQueuedEventError(item.id, result.message ?? "Node rejected queued event.");
        reload();
      }
    } catch (error) {
      const message = error instanceof NodeApiError ? error.message : "Submit failed.";
      updateHandoffQueuedEventError(item.id, message);
      reload();
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Deferred submit queue</h2>
      <p className="text-sm text-muted-foreground">
        Signed events stay on this device until you submit them to the node. Kernel truth updates only
        after successful ingest.
      </p>
      {items.map((item) => (
        <Card key={item.id} className="border-border/70">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="space-y-1 text-sm">
              <p className="font-medium">{item.label}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {item.orderId} · {item.milestoneId}
              </p>
              <p className="text-xs text-muted-foreground">
                Queued {new Date(item.queuedAt).toLocaleString()}
              </p>
              {item.lastError ? (
                <p className="text-xs text-destructive">{item.lastError}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={busyId === item.id}
                onClick={() => void submitQueued(item)}
              >
                Submit now
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  removeHandoffQueuedEvent(item.id);
                  reload();
                }}
              >
                Remove
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
