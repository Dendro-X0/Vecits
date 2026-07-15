"use client";

import {
  buildIdentityCreateUnsigned,
  generateEd25519KeyPair,
  NodeApiError,
  NodeClient,
  signUnsignedEnvelope,
  type Ed25519KeyPair,
  type IngestResult
} from "@new-start/sdk-ts";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { AuthDivider } from "@/components/auth/auth-divider";
import { MobilePinnedNodeNotice } from "@/components/mobile/mobile-pinned-node-notice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveSession, mirrorSessionToBrowserStorage } from "@/lib/auth/session";
import { isDesktopVaultAvailable, saveDesktopVault } from "@/lib/auth/desktop-vault";
import {
  defaultNodeClientBaseUrlForForms,
  resolveNodeConnectionInfo,
  resolveNodeClientBaseUrl,
  resolveMobilePinnedNodeError
} from "@/lib/node-client-base-url";
import { cn, truncatePubkey } from "@/lib/utils";

const DEFAULT_NODE_API_BASE_URL = defaultNodeClientBaseUrlForForms();

type RegisterFormProps = {
  nextPath?: string;
  compact?: boolean;
};

export function RegisterForm({ nextPath = "/marketplace", compact = false }: RegisterFormProps) {
  const router = useRouter();
  const nodeInfo = resolveNodeConnectionInfo();
  const [baseUrl, setBaseUrl] = useState(DEFAULT_NODE_API_BASE_URL);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [keyPair, setKeyPair] = useState<Ed25519KeyPair | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [vaultPassword, setVaultPassword] = useState("");
  const desktopVault = isDesktopVaultAvailable();
  const mobilePinnedNodeError = resolveMobilePinnedNodeError();

  async function handleGenerateKeys() {
    setErrorMessage(null);
    setIngestResult(null);
    setIsGenerating(true);
    try {
      const generated = await generateEd25519KeyPair();
      setKeyPair(generated);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIngestResult(null);

    if (!keyPair) {
      setErrorMessage("Generate a keypair first.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (mobilePinnedNodeError) {
        setErrorMessage(mobilePinnedNodeError);
        return;
      }

      const metadata =
        displayName.trim() || bio.trim()
          ? {
              ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
              ...(bio.trim() ? { bio: bio.trim() } : {})
            }
          : undefined;

      const unsigned = buildIdentityCreateUnsigned(keyPair.publicKeyHex, { metadata });
      const signed = await signUnsignedEnvelope(unsigned, keyPair.secretKeyHex);

      const clientBaseUrl = nodeInfo.isMobileRuntime
        ? resolveNodeClientBaseUrl()
        : resolveNodeClientBaseUrl(baseUrl.trim() || DEFAULT_NODE_API_BASE_URL);
      const client = new NodeClient({ baseUrl: clientBaseUrl });
      const result = await client.submitSignedEnvelope(signed);
      setIngestResult(result);

      if (result.accepted) {
        const session = {
          secretKeyHex: keyPair.secretKeyHex,
          publicKeyHex: keyPair.publicKeyHex
        };
        if (desktopVault) {
          if (vaultPassword.trim().length < 8) {
            setErrorMessage("Set a desktop vault password with at least 8 characters.");
            return;
          }
          await saveDesktopVault(session, vaultPassword.trim(), true);
        }
        saveSession(session, true);
        mirrorSessionToBrowserStorage(session);
        router.push(nextPath);
        router.refresh();
      }
    } catch (error) {
      if (error instanceof NodeApiError) {
        setErrorMessage(`${error.message} (status ${error.status})`);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unknown error while creating identity.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => {
          void handleGenerateKeys();
        }}
        disabled={isGenerating}
        className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card text-sm font-medium transition hover:bg-foreground/[0.03] disabled:opacity-60"
      >
        {isGenerating ? "Generating…" : "Generate new keypair"}
      </button>

      {keyPair ? (
        <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <p>
            Public key:{" "}
            <span className="font-mono text-foreground">
              {truncatePubkey(keyPair.publicKeyHex, 8, 8)}
            </span>
          </p>
          <p className="mt-1">
            Store your secret key safely — it cannot be recovered from the protocol.
          </p>
        </div>
      ) : null}

      <AuthDivider label="Then publish profile" />

      <MobilePinnedNodeNotice />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Vectis Contributor"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What kind of work or mutual aid do you offer?"
            className="min-h-24 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {!compact && !nodeInfo.isMobileRuntime ? (
          <div className="space-y-2">
            <Label htmlFor="nodeBaseUrl">Marketplace node</Label>
            <Input
              id="nodeBaseUrl"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              placeholder="http://127.0.0.1:7878"
              className="h-11"
            />
            <p className="text-xs text-muted-foreground">
              IdentityCreate is submitted to this operator node&apos;s event log.
            </p>
          </div>
        ) : null}

        {desktopVault ? (
          <div className="space-y-2">
            <Label htmlFor="registerVaultPassword">Desktop vault password</Label>
            <Input
              id="registerVaultPassword"
              type="password"
              value={vaultPassword}
              onChange={(event) => setVaultPassword(event.target.value)}
              placeholder="8+ characters — encrypts your key on this device"
              className="h-11"
            />
          </div>
        ) : null}

        {errorMessage ? (
          <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </p>
        ) : null}

        {ingestResult && !ingestResult.accepted ? (
          <p className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-sm text-warning">
            {ingestResult.message ?? "IdentityCreate was not accepted by the node."}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting || !keyPair || Boolean(mobilePinnedNodeError)}
          className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Publishing identity…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
