import type { AuthSession } from "@/lib/auth/session";

import { readWorkspaceStoreDocument } from "./order-notes";
import { isWorkspaceStoreDocument, type WorkspaceStoreDocument } from "./order-notes-crypto";

export const WORKSPACE_BACKUP_EXTENSION = ".vectis-workspace.json";

export function workspaceBackupSecurityNote(): string {
  return "Off-protocol: workspace notes and reminders never leave this device unless you export them. The blob is encrypted with your identity key and is not visible to the node or other participants.";
}

export function resolveWorkspaceStoreBackup(
  session: AuthSession
): WorkspaceStoreDocument | null {
  const raw = readWorkspaceStoreDocument();
  if (!isWorkspaceStoreDocument(raw) || raw.publicKeyHex !== session.publicKeyHex) {
    return null;
  }
  return raw;
}

export function downloadWorkspaceStoreBackup(
  document: WorkspaceStoreDocument,
  filename?: string
): void {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download =
    filename ??
    `vectis-workspace-${document.publicKeyHex.slice(0, 8)}${WORKSPACE_BACKUP_EXTENSION}`;
  anchor.click();
  URL.revokeObjectURL(url);
}
