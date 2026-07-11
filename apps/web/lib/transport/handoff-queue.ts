import type { SignedEnvelope } from "@new-start/sdk-ts";

const QUEUE_STORAGE_KEY = "vectis.transport.handoff-queue";

export type HandoffQueuedEvent = {
  id: string;
  label: string;
  orderId: string;
  milestoneId: string;
  signed: SignedEnvelope;
  queuedAt: string;
  lastError?: string;
};

function readQueue(): HandoffQueuedEvent[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as HandoffQueuedEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: HandoffQueuedEvent[]): void {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(items));
}

export function listHandoffQueuedEvents(): HandoffQueuedEvent[] {
  return readQueue();
}

export function enqueueHandoffSignedEvent(input: {
  label: string;
  orderId: string;
  milestoneId: string;
  signed: SignedEnvelope;
}): HandoffQueuedEvent {
  const entry: HandoffQueuedEvent = {
    id: `handoff-${Date.now()}`,
    label: input.label,
    orderId: input.orderId,
    milestoneId: input.milestoneId,
    signed: input.signed,
    queuedAt: new Date().toISOString()
  };
  writeQueue([entry, ...readQueue()]);
  return entry;
}

export function removeHandoffQueuedEvent(id: string): void {
  writeQueue(readQueue().filter((item) => item.id !== id));
}

export function updateHandoffQueuedEventError(id: string, lastError: string): void {
  writeQueue(
    readQueue().map((item) => (item.id === id ? { ...item, lastError } : item))
  );
}
