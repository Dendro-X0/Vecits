"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { KeyBackupPanel } from "@/components/auth/key-backup-panel";
import { PasskeyVaultPanel } from "@/components/auth/passkey-vault-panel";
import { ThemeSettingRow } from "@/components/theme/theme-toggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearSession, loadActiveSession, mirrorSessionToBrowserStorage, saveSession, type AuthSession } from "@/lib/auth/session";
import { clearDesktopVault, isDesktopVaultAvailable } from "@/lib/auth/desktop-vault";
import { EMPTY_PROFILE, loadProfile, saveProfile, type UserProfile } from "@/lib/dashboard/profile";
import {
  readMobilePinnedNodeOverride,
  readRuntimeMobilePinnedNodeUrl,
  resolveNodeConnectionInfo,
  validateMobilePinnedNodeUrl,
  writeMobilePinnedNodeOverride,
} from "@/lib/node-client-base-url";
import { truncatePubkey } from "@/lib/utils";

export function DashboardSettingsPanel() {
  const [session, setSession] = useState<AuthSession | null>(null);
  const desktopVault = isDesktopVaultAvailable();
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [profileSaved, setProfileSaved] = useState(false);
  const [nodeInfo, setNodeInfo] = useState(() => resolveNodeConnectionInfo());
  const [mobilePinnedNodeDraft, setMobilePinnedNodeDraft] = useState("");
  const [mobilePinnedNodeSaved, setMobilePinnedNodeSaved] = useState(false);
  const [runtimeMobilePinnedNodeUrl, setRuntimeMobilePinnedNodeUrl] = useState("");

  useEffect(() => {
    const active = loadActiveSession();
    setSession(active);
    setNodeInfo(resolveNodeConnectionInfo());
    setMobilePinnedNodeDraft(readMobilePinnedNodeOverride());
    setRuntimeMobilePinnedNodeUrl(readRuntimeMobilePinnedNodeUrl());
    if (active) {
      setProfile(loadProfile(active.publicKeyHex));
    }
  }, []);

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session) {
      return;
    }
    saveProfile(session.publicKeyHex, profile);
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 2000);
  }

  function handleMobilePinnedNodeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = mobilePinnedNodeDraft.trim();
    if (trimmed) {
      const error = validateMobilePinnedNodeUrl(trimmed);
      if (error) {
        return;
      }
    }
    writeMobilePinnedNodeOverride(trimmed);
    setNodeInfo(resolveNodeConnectionInfo());
    setMobilePinnedNodeSaved(true);
    window.setTimeout(() => setMobilePinnedNodeSaved(false), 2000);
  }

  function handleMobilePinnedNodeReset() {
    writeMobilePinnedNodeOverride("");
    setMobilePinnedNodeDraft("");
    setNodeInfo(resolveNodeConnectionInfo());
    setMobilePinnedNodeSaved(false);
  }

  const mobilePinnedNodeError =
    mobilePinnedNodeDraft.trim().length > 0
      ? validateMobilePinnedNodeUrl(mobilePinnedNodeDraft.trim())
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm text-muted-foreground">
          App preferences and profile details for your workspace identity.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>App preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSettingRow />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kernel connection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Connected node: <span className="font-mono text-foreground">{nodeInfo.baseUrl}</span>
          </p>
          <p className="text-muted-foreground">
            Source: <span className="text-foreground">{nodeInfo.source}</span>
          </p>
          {nodeInfo.isMobileRuntime ? (
            <p className="text-muted-foreground">
              Mobile runtime: <span className="text-foreground">enabled</span>
            </p>
          ) : null}
          {nodeInfo.isMobileRuntime && !nodeInfo.isMobileRelease ? (
            <form className="space-y-2" onSubmit={handleMobilePinnedNodeSubmit}>
              <Label htmlFor="mobilePinnedNodeUrl">Mobile pinned node URL override</Label>
              {runtimeMobilePinnedNodeUrl ? (
                <p className="text-xs text-muted-foreground">
                  Runtime default:{" "}
                  <span className="font-mono text-foreground">{runtimeMobilePinnedNodeUrl}</span>
                </p>
              ) : null}
              <Input
                id="mobilePinnedNodeUrl"
                value={mobilePinnedNodeDraft}
                onChange={(event) => setMobilePinnedNodeDraft(event.target.value)}
                placeholder="https://node.example.com"
              />
              {mobilePinnedNodeError ? (
                <p className="text-xs text-destructive">{mobilePinnedNodeError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Optional non-release override stored locally on this device.
                </p>
              )}
              <button
                type="submit"
                disabled={Boolean(mobilePinnedNodeError)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-foreground transition hover:bg-accent disabled:opacity-50"
              >
                {mobilePinnedNodeSaved ? "Saved" : "Save mobile node override"}
              </button>
              <button
                type="button"
                onClick={handleMobilePinnedNodeReset}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-xs font-medium text-foreground transition hover:bg-accent"
              >
                Reset to runtime default
              </button>
            </form>
          ) : null}
          {nodeInfo.isMobileRelease ? (
            <p
              className={
                validateMobilePinnedNodeUrl(nodeInfo.baseUrl)
                  ? "text-destructive"
                  : "text-emerald-600 dark:text-emerald-400"
              }
            >
              {validateMobilePinnedNodeUrl(nodeInfo.baseUrl) ??
                "Mobile release policy satisfied (HTTPS pinned node)."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          {session ? (
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <p className="text-sm text-muted-foreground">
                Saved locally for now. Kernel identity updates will wire here later.
              </p>
              <div className="space-y-2">
                <Label htmlFor="displayName">Display name</Label>
                <Input
                  id="displayName"
                  value={profile.displayName}
                  onChange={(event) => setProfile((prev) => ({ ...prev, displayName: event.target.value }))}
                  placeholder="How you appear on listings"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={profile.bio}
                  onChange={(event) => setProfile((prev) => ({ ...prev, bio: event.target.value }))}
                  placeholder="Short introduction for buyers and collaborators"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serviceCategories">Service categories</Label>
                <Input
                  id="serviceCategories"
                  value={profile.serviceCategories}
                  onChange={(event) =>
                    setProfile((prev) => ({ ...prev, serviceCategories: event.target.value }))
                  }
                  placeholder="software-fixes, mutual-aid, documentation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="links">Links</Label>
                <Input
                  id="links"
                  value={profile.links}
                  onChange={(event) => setProfile((prev) => ({ ...prev, links: event.target.value }))}
                  placeholder="https://example.com/portfolio"
                />
              </div>
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                {profileSaved ? "Saved" : "Save profile"}
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Sign in to edit your profile.{" "}
              <Link href="/sign-in" className="text-primary underline underline-offset-4">
                Sign in
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active session</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {session ? (
            <>
              <p>
                Unlocked identity:{" "}
                <span className="font-mono text-foreground">
                  {truncatePubkey(session.publicKeyHex, 10, 10)}
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  clearSession();
                  setSession(null);
                  setProfile(EMPTY_PROFILE);
                }}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm transition hover:bg-accent"
              >
                Sign out
              </button>
            </>
          ) : (
            <p className="text-muted-foreground">
              No unlocked key in this browser.{" "}
              <Link href="/sign-in" className="text-primary underline underline-offset-4">
                Sign in
              </Link>{" "}
              or{" "}
              <Link href="/register" className="text-primary underline underline-offset-4">
                register
              </Link>
              .
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Passkey vault</CardTitle>
        </CardHeader>
        <CardContent>
          <PasskeyVaultPanel
            session={session}
            onUnlocked={(unlocked) => {
              saveSession(unlocked, true);
              mirrorSessionToBrowserStorage(unlocked);
              setSession(unlocked);
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Encrypted key backup</CardTitle>
        </CardHeader>
        <CardContent>
          <KeyBackupPanel
            session={session}
            onImported={(imported) => {
              setSession(imported);
              setProfile(loadProfile(imported.publicKeyHex));
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Advanced</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Preflight drills, evidence export, and lane fixture checks for operators. Not required
            for everyday marketplace use.
          </p>
          <Link
            href="/dashboard/settings/advanced"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition hover:bg-accent"
          >
            Open advanced tools
          </Link>
          {desktopVault ? (
            <button
              type="button"
              onClick={() => {
                void clearDesktopVault().then(() => {
                  clearSession();
                  setSession(null);
                  setProfile(EMPTY_PROFILE);
                });
              }}
              className="inline-flex h-10 items-center justify-center rounded-lg border border-destructive/30 px-4 text-sm font-medium text-destructive transition hover:bg-destructive/10"
            >
              Remove desktop vault
            </button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
