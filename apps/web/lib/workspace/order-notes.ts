import type { AuthSession } from "@/lib/auth/session";
import type { NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";

import {
  decryptWorkspaceStore,
  emptyWorkspaceRecord,
  encryptWorkspaceStore,
  isWorkspaceStoreDocument,
  type OrderWorkspaceRecord,
  type OrderWorkspaceStore
} from "./order-notes-crypto";

const STORAGE_KEY = "vectis.workspace.order_notes.v1";

let memoryCache: { publicKeyHex: string; store: OrderWorkspaceStore } | null = null;

export function readWorkspaceStoreDocument(): unknown {
  return readRawDocument();
}

function readRawDocument(): unknown {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeRawDocument(document: unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}

export function isOrderParticipant(
  exchange: NormalizedOrderExchange,
  publicKeyHex: string
): boolean {
  return (
    exchange.buyerPubKey === publicKeyHex || exchange.providerPubKey === publicKeyHex
  );
}

export async function loadWorkspaceStore(session: AuthSession): Promise<OrderWorkspaceStore> {
  if (memoryCache?.publicKeyHex === session.publicKeyHex) {
    return memoryCache.store;
  }

  const raw = readRawDocument();
  if (!isWorkspaceStoreDocument(raw) || raw.publicKeyHex !== session.publicKeyHex) {
    const empty: OrderWorkspaceStore = {};
    memoryCache = { publicKeyHex: session.publicKeyHex, store: empty };
    return empty;
  }

  try {
    const store = await decryptWorkspaceStore(session.secretKeyHex, raw);
    memoryCache = { publicKeyHex: session.publicKeyHex, store };
    return store;
  } catch {
    const empty: OrderWorkspaceStore = {};
    memoryCache = { publicKeyHex: session.publicKeyHex, store: empty };
    return empty;
  }
}

export async function saveWorkspaceStore(
  session: AuthSession,
  store: OrderWorkspaceStore
): Promise<void> {
  const document = await encryptWorkspaceStore(session.secretKeyHex, session.publicKeyHex, store);
  writeRawDocument(document);
  memoryCache = { publicKeyHex: session.publicKeyHex, store };
}

export async function loadOrderWorkspaceRecord(
  session: AuthSession,
  orderId: string
): Promise<OrderWorkspaceRecord> {
  const store = await loadWorkspaceStore(session);
  return store[orderId] ?? emptyWorkspaceRecord();
}

export async function saveOrderWorkspaceRecord(
  session: AuthSession,
  orderId: string,
  record: OrderWorkspaceRecord
): Promise<void> {
  const store = await loadWorkspaceStore(session);
  const hasContent =
    record.note.body.trim().length > 0 ||
    (record.reminder?.enabled && record.reminder.remindAt.trim().length > 0);

  if (!hasContent) {
    delete store[orderId];
  } else {
    store[orderId] = record;
  }

  await saveWorkspaceStore(session, store);
}

export type OrderWorkspaceSummary = {
  hasNote: boolean;
  hasReminder: boolean;
  reminderDue: boolean;
};

export async function loadOrderWorkspaceSummary(
  session: AuthSession,
  orderId: string
): Promise<OrderWorkspaceSummary> {
  const record = await loadOrderWorkspaceRecord(session, orderId);
  const hasNote = record.note.body.trim().length > 0;
  const hasReminder = Boolean(record.reminder?.enabled && record.reminder.remindAt);
  const reminderDue =
    hasReminder &&
    !record.reminder?.firedAt &&
    Number.isFinite(Date.parse(record.reminder?.remindAt ?? "")) &&
    Date.parse(record.reminder!.remindAt) <= Date.now();

  return { hasNote, hasReminder, reminderDue };
}

export async function loadWorkspaceSummaries(
  session: AuthSession,
  orderIds: string[]
): Promise<Map<string, OrderWorkspaceSummary>> {
  const store = await loadWorkspaceStore(session);
  const summaries = new Map<string, OrderWorkspaceSummary>();

  for (const orderId of orderIds) {
    const record = store[orderId];
    if (!record) {
      continue;
    }
    const hasNote = record.note.body.trim().length > 0;
    const hasReminder = Boolean(record.reminder?.enabled && record.reminder.remindAt);
    const reminderDue =
      hasReminder &&
      !record.reminder?.firedAt &&
      Number.isFinite(Date.parse(record.reminder?.remindAt ?? "")) &&
      Date.parse(record.reminder!.remindAt) <= Date.now();

    if (hasNote || hasReminder) {
      summaries.set(orderId, { hasNote, hasReminder, reminderDue });
    }
  }

  return summaries;
}
