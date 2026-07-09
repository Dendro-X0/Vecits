"use client";

import { Bell, NotebookPen, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadActiveSession } from "@/lib/auth/session";
import type { NormalizedOrderExchange } from "@/lib/marketplace/order-normalize";
import {
  isOrderParticipant,
  loadOrderWorkspaceRecord,
  saveOrderWorkspaceRecord
} from "@/lib/workspace/order-notes";
import type { OrderWorkspaceRecord } from "@/lib/workspace/order-notes-crypto";
import { flushDueOrderReminders, requestReminderPermission } from "@/lib/workspace/order-reminders";

type OrderWorkspaceNotesPanelProps = {
  exchange: NormalizedOrderExchange;
};

function toLocalDatetimeValue(iso: string | undefined): string {
  if (!iso?.trim()) {
    return "";
  }
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDatetimeValue(value: string): string {
  if (!value.trim()) {
    return "";
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

export function OrderWorkspaceNotesPanel({ exchange }: OrderWorkspaceNotesPanelProps) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState<OrderWorkspaceRecord | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reminderPermission, setReminderPermission] = useState<
    NotificationPermission | "unsupported" | "unknown"
  >("unknown");

  const canEdit = pubkey ? isOrderParticipant(exchange, pubkey) : false;

  useEffect(() => {
    const session = loadActiveSession();
    setPubkey(session?.publicKeyHex ?? null);
    if (typeof window !== "undefined" && "Notification" in window) {
      setReminderPermission(Notification.permission);
    } else {
      setReminderPermission("unsupported");
    }
  }, []);

  useEffect(() => {
    const session = loadActiveSession();
    if (!session || !canEdit) {
      setLoading(false);
      setRecord(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void Promise.all([
      loadOrderWorkspaceRecord(session, exchange.orderId),
      flushDueOrderReminders(session)
    ]).then(([next]) => {
      if (!cancelled) {
        setRecord(next);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [canEdit, exchange.orderId]);

  async function persist(next: OrderWorkspaceRecord) {
    const session = loadActiveSession();
    if (!session) {
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveOrderWorkspaceRecord(session, exchange.orderId, next);
      setRecord(next);
      setMessage("Saved locally — not on chain.");
    } catch {
      setMessage("Could not save workspace notes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote() {
    if (!record) {
      return;
    }
    await persist({
      ...record,
      note: {
        body: record.note.body,
        updatedAt: new Date().toISOString()
      }
    });
  }

  async function handleToggleReminder(enabled: boolean) {
    if (!record) {
      return;
    }
    if (enabled) {
      const permission = await requestReminderPermission();
      setReminderPermission(permission === "unsupported" ? "unsupported" : permission);
      if (permission !== "granted") {
        setMessage("Enable browser notifications to use local reminders.");
        return;
      }
    }

    await persist({
      ...record,
      reminder: {
        remindAt: record.reminder?.remindAt ?? "",
        label: record.reminder?.label ?? "",
        enabled,
        firedAt: enabled ? null : record.reminder?.firedAt ?? null
      }
    });
  }

  async function handleSaveReminder() {
    if (!record) {
      return;
    }
    await persist({
      ...record,
      reminder: {
        remindAt: record.reminder?.remindAt ?? "",
        label: record.reminder?.label ?? "",
        enabled: Boolean(record.reminder?.enabled),
        firedAt: null
      }
    });
  }

  return (
    <Card className="border-dashed border-warning/40 bg-warning/5">
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <NotebookPen className="size-4" />
            Workspace notes
          </CardTitle>
          <Badge variant="outline" className="border-warning/40 text-warning">
            Not on chain
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Private follow-ups for this order — encrypted in your browser only. They never affect
          escrow, delivery, or settlement.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 rounded-xl border border-warning/25 bg-background/80 px-4 py-3 text-sm">
          <ShieldOff className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Off-protocol layer.</span> Kernel replay
            will not show these notes. Use them for client context, follow-ups, or reminders.
          </p>
        </div>

        {!pubkey ? (
          <p className="text-sm text-muted-foreground">
            Sign in as the buyer or provider to add encrypted workspace notes.
          </p>
        ) : !canEdit ? (
          <p className="text-sm text-muted-foreground">
            Only the buyer or provider on this order can view or edit workspace notes.
          </p>
        ) : loading || !record ? (
          <p className="text-sm text-muted-foreground">Loading workspace notes…</p>
        ) : (
          <>
            <label className="block space-y-2 text-sm">
              <span className="font-medium text-foreground">Note</span>
              <textarea
                value={record.note.body}
                onChange={(event) =>
                  setRecord({
                    ...record,
                    note: { ...record.note, body: event.target.value }
                  })
                }
                className="min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder="Client context, follow-up checklist, links to keep handy…"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={saving} onClick={() => void handleSaveNote()}>
                Save note
              </Button>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" />
                <p className="text-sm font-medium text-foreground">Local reminder</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Optional browser notification — no settlement authority. Fires once, then clears.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(record.reminder?.enabled)}
                  onChange={(event) => void handleToggleReminder(event.target.checked)}
                />
                Enable reminder
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Remind at</span>
                  <input
                    type="datetime-local"
                    value={toLocalDatetimeValue(record.reminder?.remindAt)}
                    onChange={(event) =>
                      setRecord({
                        ...record,
                        reminder: {
                          remindAt: fromLocalDatetimeValue(event.target.value),
                          label: record.reminder?.label ?? "",
                          enabled: Boolean(record.reminder?.enabled),
                          firedAt: record.reminder?.firedAt ?? null
                        }
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="text-muted-foreground">Reminder label</span>
                  <input
                    value={record.reminder?.label ?? ""}
                    onChange={(event) =>
                      setRecord({
                        ...record,
                        reminder: {
                          remindAt: record.reminder?.remindAt ?? "",
                          label: event.target.value,
                          enabled: Boolean(record.reminder?.enabled),
                          firedAt: record.reminder?.firedAt ?? null
                        }
                      })
                    }
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder="e.g. Ping client for feedback"
                  />
                </label>
              </div>
              {reminderPermission === "denied" ? (
                <p className="text-xs text-muted-foreground">
                  Notifications are blocked in this browser. Enable them in site settings to use
                  reminders.
                </p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saving}
                onClick={() => void handleSaveReminder()}
              >
                Save reminder
              </Button>
            </div>
          </>
        )}

        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
