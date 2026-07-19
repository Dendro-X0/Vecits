"use client";

import { FormEvent, useState } from "react";
import { Globe, KeyRound } from "lucide-react";

import { DashboardAdvancedContent } from "@/components/dashboard/dashboard-advanced-panel";
import { SettingsRow, SettingsSection } from "@/components/dashboard/settings-primitives";
import { NodeJoinConfirm } from "@/components/transport/node-join-confirm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearDesktopVault, isDesktopVaultAvailable } from "@/lib/auth/desktop-vault";
import type { AuthSession } from "@/lib/auth/session";
import type { NodeConnectionInfo } from "@/lib/node-client-base-url";
import {
  readRuntimeMobilePinnedNodeUrl,
  validateMobilePinnedNodeUrl,
  writeMobilePinnedNodeOverride
} from "@/lib/node-client-base-url";

type DashboardSettingsTechnicalPanelProps = {
  session: AuthSession | null;
  nodeInfo: NodeConnectionInfo;
  mobilePinnedNodeDraft: string;
  onMobilePinnedNodeDraftChange: (value: string) => void;
  mobilePinnedNodeSaved: boolean;
  onMobilePinnedNodeSaved: () => void;
  onNodeInfoRefresh: () => void;
  onSignOut: () => void;
};

export function DashboardSettingsTechnicalPanel({
  session: _session,
  nodeInfo,
  mobilePinnedNodeDraft,
  onMobilePinnedNodeDraftChange,
  mobilePinnedNodeSaved,
  onMobilePinnedNodeSaved,
  onNodeInfoRefresh,
  onSignOut
}: DashboardSettingsTechnicalPanelProps) {
  const desktopVault = isDesktopVaultAvailable();
  const runtimeMobilePinnedNodeUrl = readRuntimeMobilePinnedNodeUrl();
  const [pendingConfirmUrl, setPendingConfirmUrl] = useState<string | null>(null);

  const mobilePinnedNodeError =
    mobilePinnedNodeDraft.trim().length > 0
      ? validateMobilePinnedNodeUrl(mobilePinnedNodeDraft.trim())
      : null;

  function handleMobilePinnedNodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = mobilePinnedNodeDraft.trim();
    if (!trimmed) {
      writeMobilePinnedNodeOverride("");
      onNodeInfoRefresh();
      onMobilePinnedNodeSaved();
      return;
    }
    const error = validateMobilePinnedNodeUrl(trimmed);
    if (error) {
      return;
    }
    setPendingConfirmUrl(trimmed);
  }

  function handleConfirmPin(normalizedUrl: string) {
    writeMobilePinnedNodeOverride(normalizedUrl);
    onMobilePinnedNodeDraftChange(normalizedUrl);
    setPendingConfirmUrl(null);
    onNodeInfoRefresh();
    onMobilePinnedNodeSaved();
  }

  function handleMobilePinnedNodeReset() {
    writeMobilePinnedNodeOverride("");
    onMobilePinnedNodeDraftChange("");
    setPendingConfirmUrl(null);
    onNodeInfoRefresh();
  }

  return (
    <>
      {nodeInfo.isMobileRuntime ? (
        <SettingsSection
          title="Technical connection"
          description="Mobile dev overrides and pinned-node policy checks."
        >
          <SettingsRow
            icon={Globe}
            title="Mobile pinned node"
            description="Release builds require HTTPS. Dev builds may override the pinned operator URL. Confirm hostname before save."
            badge={
              nodeInfo.isMobileRelease ? (
                validateMobilePinnedNodeUrl(nodeInfo.baseUrl) ? (
                  <Badge variant="outline" className="border-destructive/40 text-destructive">
                    Invalid
                  </Badge>
                ) : (
                  <Badge variant="success">HTTPS OK</Badge>
                )
              ) : (
                <Badge variant="muted">Dev override</Badge>
              )
            }
          >
            {!nodeInfo.isMobileRelease ? (
              <div className="space-y-3">
                {runtimeMobilePinnedNodeUrl ? (
                  <p className="text-xs text-muted-foreground">
                    Runtime default:{" "}
                    <span className="font-mono text-foreground">{runtimeMobilePinnedNodeUrl}</span>
                  </p>
                ) : null}
                {pendingConfirmUrl ? (
                  <NodeJoinConfirm
                    nodeUrl={pendingConfirmUrl}
                    onConfirm={handleConfirmPin}
                    onCancel={() => setPendingConfirmUrl(null)}
                  />
                ) : (
                  <form className="space-y-3" onSubmit={handleMobilePinnedNodeSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="mobilePinnedNodeUrl">Override URL</Label>
                      <Input
                        id="mobilePinnedNodeUrl"
                        value={mobilePinnedNodeDraft}
                        onChange={(event) => onMobilePinnedNodeDraftChange(event.target.value)}
                        placeholder="https://node.example.com"
                      />
                    </div>
                    {mobilePinnedNodeError ? (
                      <p className="text-xs text-destructive">{mobilePinnedNodeError}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Stored locally on this device for non-release mobile builds.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={Boolean(mobilePinnedNodeError)}>
                        {mobilePinnedNodeSaved ? "Saved" : "Review pin"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleMobilePinnedNodeReset}
                      >
                        Reset
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            ) : (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Mobile release policy satisfied — pinned node uses HTTPS.
              </p>
            )}
          </SettingsRow>
        </SettingsSection>
      ) : null}

      {desktopVault ? (
        <SettingsSection
          title="Desktop vault"
          description="Destructive actions for the encrypted desktop identity store."
        >
          <SettingsRow
            icon={KeyRound}
            title="Remove desktop vault"
            description="Deletes the local vault and signs you out. Use only when resetting this device."
          >
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => {
                void clearDesktopVault().then(() => {
                  onSignOut();
                });
              }}
            >
              Remove desktop vault
            </Button>
          </SettingsRow>
        </SettingsSection>
      ) : null}

      <DashboardAdvancedContent embedded />
    </>
  );
}
