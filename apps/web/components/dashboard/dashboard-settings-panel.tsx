"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Fingerprint,
  KeyRound,
  Link2,
  LogOut,
  Moon,
  Server,
  Shield,
  UserRound
} from "lucide-react";

import { KeyBackupPanel } from "@/components/auth/key-backup-panel";
import { PasskeyVaultPanel } from "@/components/auth/passkey-vault-panel";
import { DashboardSettingsTechnicalPanel } from "@/components/dashboard/dashboard-settings-technical-panel";
import { SettingsAdvancedDisclosure } from "@/components/dashboard/settings-advanced-disclosure";
import { TransportQrPanel } from "@/components/transport/transport-qr-panel";
import { TransportBundleSharePanel } from "@/components/transport/transport-bundle-share-panel";
import {
  SettingsCategoryNav,
  SettingsRow,
  SettingsSection,
  type SettingsCategory
} from "@/components/dashboard/settings-primitives";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useTheme } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearSession,
  loadActiveSession,
  mirrorSessionToBrowserStorage,
  saveSession,
  type AuthSession
} from "@/lib/auth/session";
import { EMPTY_PROFILE, loadProfile, saveProfile, type UserProfile } from "@/lib/dashboard/profile";
import {
  readMobilePinnedNodeOverride,
  resolveNodeConnectionInfo,
  validateMobilePinnedNodeUrl
} from "@/lib/node-client-base-url";
import { isAbsoluteHttpUrl } from "@/lib/transport/absolute-url";
import { buildIdentityIntroBundle } from "@/lib/transport/bundle";
import { truncatePubkey } from "@/lib/utils";

const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System"
} as const;

export function DashboardSettingsPanel() {
  const searchParams = useSearchParams();
  const advancedOpenByDefault = searchParams.get("advanced") === "1";
  const { preference } = useTheme();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("profile");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [profile, setProfile] = useState<UserProfile>(EMPTY_PROFILE);
  const [profileSaved, setProfileSaved] = useState(false);
  const [nodeInfo, setNodeInfo] = useState(() => resolveNodeConnectionInfo());
  const [mobilePinnedNodeDraft, setMobilePinnedNodeDraft] = useState("");
  const [mobilePinnedNodeSaved, setMobilePinnedNodeSaved] = useState(false);

  useEffect(() => {
    const active = loadActiveSession();
    setSession(active);
    setNodeInfo(resolveNodeConnectionInfo());
    setMobilePinnedNodeDraft(readMobilePinnedNodeOverride());
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

  function handleSignOut() {
    clearSession();
    setSession(null);
    setProfile(EMPTY_PROFILE);
  }

  function refreshNodeInfo() {
    setNodeInfo(resolveNodeConnectionInfo());
  }

  const connectionIssue = validateMobilePinnedNodeUrl(nodeInfo.baseUrl);
  const identityIntroBundle =
    session && isAbsoluteHttpUrl(nodeInfo.baseUrl)
      ? buildIdentityIntroBundle({
          pubKey: session.publicKeyHex,
          nodeUrl: nodeInfo.baseUrl,
          displayLabel: profile.displayName || undefined,
          bio: profile.bio || undefined
        })
      : null;
  const connectionBadge = connectionIssue ? (
    <Badge variant="outline" className="border-destructive/40 text-destructive">
      Needs attention
    </Badge>
  ) : (
    <Badge variant="outline" className="border-primary/30 text-primary">
      Connected
    </Badge>
  );

  return (
    <div className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <p className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            General
          </p>
          <SettingsCategoryNav active={activeCategory} onChange={setActiveCategory} />
        </aside>

        <div className="min-w-0">
          {activeCategory === "profile" ? (
            <SettingsSection
              title="Profile"
              description="How you appear in the marketplace and which theme this device uses."
            >
              <SettingsRow
                icon={Moon}
                title="Appearance"
                description="Choose light, dark, or match your system theme."
                badge={
                  <Badge variant="muted">{THEME_LABELS[preference] ?? preference}</Badge>
                }
              >
                <ThemeToggle variant="segmented" className="w-full sm:w-auto" />
              </SettingsRow>

              <SettingsRow
                icon={UserRound}
                title="Marketplace profile"
                description="Saved on this device. These fields help buyers recognize you on listings."
                badge={
                  session ? (
                    <Badge variant="success">Signed in</Badge>
                  ) : (
                    <Badge variant="muted">Guest</Badge>
                  )
                }
              >
                {session ? (
                  <form className="space-y-4" onSubmit={handleProfileSubmit}>
                    <div className="space-y-2">
                      <Label htmlFor="displayName">Display name</Label>
                      <Input
                        id="displayName"
                        value={profile.displayName}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, displayName: event.target.value }))
                        }
                        placeholder="How you appear on listings"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Input
                        id="bio"
                        value={profile.bio}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, bio: event.target.value }))
                        }
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
                        placeholder="software-fixes, documentation"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="links">Links</Label>
                      <Input
                        id="links"
                        value={profile.links}
                        onChange={(event) =>
                          setProfile((prev) => ({ ...prev, links: event.target.value }))
                        }
                        placeholder="https://example.com/portfolio"
                      />
                    </div>
                    <Button type="submit">{profileSaved ? "Saved" : "Save profile"}</Button>
                  </form>
                ) : (
                  <div className="space-y-3 text-sm text-muted-foreground">
                    <p>Sign in to edit how your identity appears in the client.</p>
                    <Button nativeButton={false} render={<Link href="/sign-in" />} size="sm">
                      Sign in
                    </Button>
                  </div>
                )}
              </SettingsRow>

              <SettingsRow
                icon={Link2}
                title="Public key"
                description="Your identity reference used for signing marketplace events."
              >
                {session ? (
                  <div className="space-y-3">
                    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                      {session.publicKeyHex}
                    </p>
                    {identityIntroBundle ? (
                      <TransportBundleSharePanel
                        bundle={identityIntroBundle}
                        title="Share identity intro"
                        description="Low-trust meetup handoff — others import on /dashboard/import to copy your pubkey."
                        downloadFilename="vectis-identity-intro-qr.svg"
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No unlocked identity on this device.</p>
                )}
              </SettingsRow>
            </SettingsSection>
          ) : null}

          {activeCategory === "connection" ? (
            <SettingsSection
              title="Connection"
              description="Where this client reads marketplace state and submits signed events."
            >
              <SettingsRow
                icon={Server}
                title="Kernel node"
                description="Your node must be running for live marketplace and transaction data."
                badge={connectionBadge}
              >
                <div className="space-y-2 text-sm">
                  <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all">
                    {nodeInfo.baseUrl}
                  </p>
                  {connectionIssue ? (
                    <p className="text-destructive">{connectionIssue}</p>
                  ) : (
                    <p className="text-muted-foreground">
                      If you operate your own node, open advanced settings below for dev overrides and
                      operator tools.
                    </p>
                  )}
                  {isAbsoluteHttpUrl(nodeInfo.baseUrl) ? (
                    <TransportQrPanel
                      value={nodeInfo.baseUrl}
                      title="Join this node"
                      description="Scan on another device to paste into mobile pinned-node settings. Confirm the hostname before connecting."
                      mode="url"
                      downloadFilename="vectis-node-join-qr.svg"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      QR join appears when this client uses an absolute node URL (desktop sidecar or
                      mobile pinned node override).
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Received a transport bundle?{" "}
                    <Link href="/dashboard/import" className="text-primary hover:underline">
                      Import on dashboard
                    </Link>
                    .
                  </p>
                </div>
              </SettingsRow>
            </SettingsSection>
          ) : null}

          {activeCategory === "security" ? (
            <SettingsSection
              title="Security"
              description="Protect your signing key and control the active session on this device."
            >
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="space-y-1 p-4">
                  <p className="text-sm font-medium text-foreground">Use Vectis on another device</p>
                  <p className="text-sm text-muted-foreground">
                    Before you switch browsers or reinstall, export an encrypted key backup or set up a
                    passkey vault so you can restore the same identity later.
                  </p>
                </CardContent>
              </Card>

              <SettingsRow
                icon={Shield}
                title="Active session"
                description="The identity currently unlocked in this browser or desktop shell."
                badge={
                  session ? <Badge variant="success">Unlocked</Badge> : <Badge variant="muted">Locked</Badge>
                }
              >
                {session ? (
                  <div className="space-y-3">
                    <p className="font-mono text-sm">{truncatePubkey(session.publicKeyHex, 12, 12)}</p>
                    <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button nativeButton={false} render={<Link href="/sign-in" />} size="sm">
                      Sign in
                    </Button>
                    <Button
                      nativeButton={false}
                      render={<Link href="/register" />}
                      size="sm"
                      variant="outline"
                    >
                      Register
                    </Button>
                  </div>
                )}
              </SettingsRow>

              <SettingsRow
                icon={Fingerprint}
                title="Passkey vault"
                description="Unlock your identity with device biometrics or PIN where supported."
              >
                <PasskeyVaultPanel
                  session={session}
                  onUnlocked={(unlocked) => {
                    saveSession(unlocked, true);
                    mirrorSessionToBrowserStorage(unlocked);
                    setSession(unlocked);
                  }}
                />
              </SettingsRow>

              <SettingsRow
                icon={KeyRound}
                title="Encrypted key backup"
                description="Export or restore an encrypted backup if you move devices or reinstall."
              >
                <KeyBackupPanel
                  session={session}
                  onImported={(imported) => {
                    setSession(imported);
                    setProfile(loadProfile(imported.publicKeyHex));
                  }}
                />
              </SettingsRow>
            </SettingsSection>
          ) : null}

          <SettingsAdvancedDisclosure defaultOpen={advancedOpenByDefault}>
            <DashboardSettingsTechnicalPanel
              session={session}
              nodeInfo={nodeInfo}
              mobilePinnedNodeDraft={mobilePinnedNodeDraft}
              onMobilePinnedNodeDraftChange={setMobilePinnedNodeDraft}
              mobilePinnedNodeSaved={mobilePinnedNodeSaved}
              onMobilePinnedNodeSaved={() => {
                setMobilePinnedNodeSaved(true);
                window.setTimeout(() => setMobilePinnedNodeSaved(false), 2000);
              }}
              onNodeInfoRefresh={refreshNodeInfo}
              onSignOut={handleSignOut}
            />
          </SettingsAdvancedDisclosure>
        </div>
      </div>
    </div>
  );
}
