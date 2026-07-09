import type { AuthSession } from "@/lib/auth/session";

import { loadWorkspaceStore, saveWorkspaceStore } from "./order-notes";

export async function requestReminderPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  if (Notification.permission === "denied") {
    return "denied";
  }
  return Notification.requestPermission();
}

export async function flushDueOrderReminders(session: AuthSession): Promise<void> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }

  const store = await loadWorkspaceStore(session);
  const now = Date.now();
  let changed = false;

  for (const [orderId, record] of Object.entries(store)) {
    const reminder = record.reminder;
    if (!reminder?.enabled || reminder.firedAt) {
      continue;
    }
    const due = Date.parse(reminder.remindAt);
    if (!Number.isFinite(due) || due > now) {
      continue;
    }

    const body =
      reminder.label.trim() ||
      (record.note.body.trim()
        ? record.note.body.trim().slice(0, 120)
        : "Follow up on this order in your workspace.");

    new Notification(`Order follow-up · ${orderId}`, {
      body,
      tag: `vectis-order-reminder-${orderId}`
    });

    record.reminder = {
      ...reminder,
      firedAt: new Date().toISOString(),
      enabled: false
    };
    changed = true;
  }

  if (changed) {
    await saveWorkspaceStore(session, store);
  }
}
