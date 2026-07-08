"use client";

import Link from "next/link";
import {
  buildIdentityCreateUnsigned,
  derivePublicKey,
  generateEd25519KeyPair,
  NodeApiError,
  NodeClient,
  signUnsignedEnvelope,
  type IngestResult,
  type SignedEnvelope
} from "@new-start/sdk-ts";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { KernelTruthNotice, OffProtocolPaymentWarning } from "./kernel-truth-notice";
import {
  defaultNodeClientBaseUrlForForms,
  validateNodeClientBaseUrl
} from "@/lib/node-client-base-url";

const DEFAULT_NODE_API_BASE_URL = defaultNodeClientBaseUrlForForms();
const ONBOARDING_STORAGE_KEY = "new-start.onboarding-wizard";
const ONBOARDING_STORAGE_VERSION = 1;
const RFC3339_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const HEX64_REGEX = /^[0-9a-fA-F]{64}$/;
const TEMPLATE_TOKEN_REGEX = /^<[^<>]+>$/;
const DEFAULT_ONBOARDING_THRESHOLD = 2;

type SponsorParseResult = {
  valid: string[];
  duplicates: string[];
  invalid: string[];
};

type ParsedEvent = {
  eventId: string;
  createdAt: string;
  createdAtMs: number;
  kind: string;
  authorPubKey: string;
  payload: Record<string, unknown>;
  references?: Record<string, unknown>;
};

type ActiveIncomingVouch = {
  voucherPubKey: string;
  weight: number;
  vouchEventId: string;
  createdAt: string;
  expiresAt?: string;
};

type OnboardingStatus = {
  asOf: string;
  identityPubKey: string;
  identityExists: boolean;
  identityEventId: string | null;
  incomingActiveVouches: number;
  incomingActiveVouchWeight: number;
  threshold: number;
  thresholdSource: string;
  thresholdMet: boolean;
  activeIncomingVouches: ActiveIncomingVouch[];
  sponsorsRequested: number;
  sponsorsWithActiveVouch: string[];
  sponsorsMissingVouch: string[];
};

type SponsorVouchDraft = {
  sponsorPubKey: string;
  draft: Record<string, unknown>;
};

type PersistedOnboardingState = {
  version: number;
  baseUrl: string;
  authorPubKey: string;
  displayName: string;
  bio: string;
  policyVersion: string;
  identityCreatedAt: string;
  statusAsOf: string;
  vouchCreatedAtTemplate: string;
  sponsorPubKeysInput: string;
};

export function OnboardingWizard() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_NODE_API_BASE_URL);
  const [authorPubKey, setAuthorPubKey] = useState("");
  const [authorSecretKey, setAuthorSecretKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [policyVersion, setPolicyVersion] = useState("v0-default");
  const [identityCreatedAt, setIdentityCreatedAt] = useState("");
  const [statusAsOf, setStatusAsOf] = useState("");
  const [vouchCreatedAtTemplate, setVouchCreatedAtTemplate] = useState("");
  const [sponsorPubKeysInput, setSponsorPubKeysInput] = useState("");

  const [signedIdentityEvent, setSignedIdentityEvent] = useState<SignedEnvelope | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string>("");
  const [isSubmittingIdentity, setIsSubmittingIdentity] = useState(false);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as PersistedOnboardingState;
      if (!parsed || parsed.version !== ONBOARDING_STORAGE_VERSION) {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
        return;
      }
      setBaseUrl(parsed.baseUrl || DEFAULT_NODE_API_BASE_URL);
      setAuthorPubKey(parsed.authorPubKey || "");
      setDisplayName(parsed.displayName || "");
      setBio(parsed.bio || "");
      setPolicyVersion(parsed.policyVersion || "v0-default");
      setIdentityCreatedAt(parsed.identityCreatedAt || "");
      setStatusAsOf(parsed.statusAsOf || "");
      setVouchCreatedAtTemplate(parsed.vouchCreatedAtTemplate || "");
      setSponsorPubKeysInput(parsed.sponsorPubKeysInput || "");
    } catch {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    const persisted: PersistedOnboardingState = {
      version: ONBOARDING_STORAGE_VERSION,
      baseUrl,
      authorPubKey,
      displayName,
      bio,
      policyVersion,
      identityCreatedAt,
      statusAsOf,
      vouchCreatedAtTemplate,
      sponsorPubKeysInput
    };
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      // ignore persistence failures
    }
  }, [
    isHydrated,
    baseUrl,
    authorPubKey,
    displayName,
    bio,
    policyVersion,
    identityCreatedAt,
    statusAsOf,
    vouchCreatedAtTemplate,
    sponsorPubKeysInput
  ]);

  const sponsorParse = useMemo(
    () => parseSponsorPubKeys(sponsorPubKeysInput),
    [sponsorPubKeysInput]
  );
  const identityPubKey =
    normalizeHexKey(authorPubKey) ??
    normalizeHexKey(signedIdentityEvent?.authorPubKey ?? "") ??
    normalizeHexKey(onboardingStatus?.identityPubKey ?? "") ??
    "";
  const sponsorSelfReferences = useMemo(
    () =>
      identityPubKey
        ? sponsorParse.valid.filter(sponsorPubKey => sponsorPubKey === identityPubKey)
        : [],
    [identityPubKey, sponsorParse.valid]
  );
  const requestedSponsors = useMemo(
    () =>
      sponsorParse.valid.filter(sponsorPubKey =>
        identityPubKey ? sponsorPubKey !== identityPubKey : true
      ),
    [identityPubKey, sponsorParse.valid]
  );
  const identityEventReference = useMemo(() => {
    const statusReference = onboardingStatus?.identityEventId ?? null;
    const signedAuthorPubKey = normalizeHexKey(signedIdentityEvent?.authorPubKey ?? "");
    const ingestAccepted = Boolean(ingestResult?.accepted || ingestResult?.already_present);
    if (!signedIdentityEvent || !ingestAccepted || !signedAuthorPubKey || !identityPubKey) {
      return statusReference;
    }
    if (signedAuthorPubKey !== identityPubKey) {
      return statusReference;
    }
    return ingestResult?.event_id ?? signedIdentityEvent.eventId;
  }, [identityPubKey, onboardingStatus?.identityEventId, signedIdentityEvent, ingestResult]);
  const sponsorDrafts = useMemo(
    () =>
      buildSponsorVouchDrafts({
        sponsors: requestedSponsors,
        identityPubKey,
        identityEventId: identityEventReference,
        policyVersion: policyVersion.trim() || "v0-default",
        createdAtTemplate: vouchCreatedAtTemplate.trim() || "<SPONSOR_RFC3339_TIMESTAMP>"
      }),
    [identityEventReference, identityPubKey, policyVersion, requestedSponsors, vouchCreatedAtTemplate]
  );
  const shareMessage = useMemo(
    () =>
      buildSponsorRequestMessage({
        identityPubKey,
        identityEventId: identityEventReference,
        sponsorPubKeys: requestedSponsors,
        baseUrl: baseUrl.trim() || DEFAULT_NODE_API_BASE_URL
      }),
    [baseUrl, identityEventReference, identityPubKey, requestedSponsors]
  );

  async function handleGenerateIdentityKeys() {
    setErrorMessage(null);
    setIngestResult(null);
    setSignedIdentityEvent(null);
    const generated = await generateEd25519KeyPair();
    setAuthorPubKey(generated.publicKeyHex);
    setAuthorSecretKey(generated.secretKeyHex);
  }

  async function handleIdentityCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIngestResult(null);
    setSignedIdentityEvent(null);

    const baseUrlTrimmed = (baseUrl.trim() || DEFAULT_NODE_API_BASE_URL).trim();
    const baseUrlError = validateNodeClientBaseUrl(baseUrlTrimmed);
    if (baseUrlError) {
      setErrorMessage(baseUrlError);
      return;
    }

    const identityCreatedAtTrimmed = identityCreatedAt.trim();
    const identityCreatedAtError = validateOptionalRfc3339(identityCreatedAtTrimmed || undefined);
    if (identityCreatedAtError) {
      setErrorMessage(identityCreatedAtError);
      return;
    }

    const authorPubKeyTrimmed = authorPubKey.trim();
    const authorSecretKeyTrimmed = authorSecretKey.trim();
    if (!HEX64_REGEX.test(authorPubKeyTrimmed) || !HEX64_REGEX.test(authorSecretKeyTrimmed)) {
      setErrorMessage("Identity pubkey and secret key must both be 64-char hex values.");
      return;
    }

    setIsSubmittingIdentity(true);
    try {
      const normalizedAuthorPubKey = normalizeHexKey(authorPubKeyTrimmed);
      const normalizedDerivedPubKey = normalizeHexKey(await derivePublicKey(authorSecretKeyTrimmed));
      if (!normalizedAuthorPubKey || !normalizedDerivedPubKey) {
        throw new Error("Identity keys must be valid 64-char hex values.");
      }
      if (normalizedDerivedPubKey !== normalizedAuthorPubKey) {
        throw new Error("Identity pubkey does not match the provided secret key.");
      }
      setAuthorPubKey(normalizedAuthorPubKey);

      const metadata =
        displayName.trim() || bio.trim()
          ? {
              ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
              ...(bio.trim() ? { bio: bio.trim() } : {})
            }
          : undefined;

      const unsigned = buildIdentityCreateUnsigned(normalizedAuthorPubKey, {
        metadata,
        createdAt: identityCreatedAtTrimmed || undefined,
        policyVersion: policyVersion.trim() || undefined
      });
      const signed = await signUnsignedEnvelope(unsigned, authorSecretKeyTrimmed);
      setSignedIdentityEvent(signed);

      const client = new NodeClient({ baseUrl: baseUrlTrimmed });
      const result = await client.submitSignedEnvelope(signed);
      setIngestResult(result);
    } catch (error) {
      if (error instanceof NodeApiError) {
        setErrorMessage(`${error.message} (status ${error.status})`);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unknown error while signing/submitting identity event.");
      }
    } finally {
      setIsSubmittingIdentity(false);
    }
  }

  async function handleRefreshOnboardingStatus() {
    setErrorMessage(null);

    const identityPubKeyTrimmed = identityPubKey;
    if (!identityPubKeyTrimmed || !HEX64_REGEX.test(identityPubKeyTrimmed)) {
      setErrorMessage("Identity pubkey is required to refresh onboarding status.");
      return;
    }

    const baseUrlTrimmed = (baseUrl.trim() || DEFAULT_NODE_API_BASE_URL).trim();
    const baseUrlError = validateNodeClientBaseUrl(baseUrlTrimmed);
    if (baseUrlError) {
      setErrorMessage(baseUrlError);
      return;
    }

    const asOf = statusAsOf.trim();
    const asOfError = validateOptionalRfc3339(asOf || undefined);
    if (asOfError) {
      setErrorMessage(asOfError);
      return;
    }

    setIsRefreshingStatus(true);
    try {
      const client = new NodeClient({ baseUrl: baseUrlTrimmed });
      const asOfParam = asOf || undefined;
      const [identityCreates, vouches, vouchRevokes, thresholdInfo] = await Promise.all([
        fetchEventsByKind(client, "IdentityCreate", { authorPubKey: identityPubKeyTrimmed }),
        fetchEventsByKind(client, "Vouch"),
        fetchEventsByKind(client, "VouchRevoke"),
        resolveOnboardingThreshold(client, asOfParam)
      ]);

      const status = computeOnboardingStatus({
        identityPubKey: identityPubKeyTrimmed,
        identityCreateEvents: identityCreates,
        vouchEvents: vouches,
        vouchRevokeEvents: vouchRevokes,
        asOf: asOfParam,
        requestedSponsors,
        threshold: thresholdInfo.threshold,
        thresholdSource: thresholdInfo.source
      });
      setOnboardingStatus(status);
    } catch (error) {
      if (error instanceof NodeApiError) {
        setErrorMessage(`${error.message} (status ${error.status})`);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unknown error while loading onboarding status.");
      }
    } finally {
      setIsRefreshingStatus(false);
    }
  }

  async function copyRequestMessage() {
    if (!identityEventReference) {
      setErrorMessage(
        "Identity event reference is unavailable. Submit identity with accepted ingest or refresh status first."
      );
      return;
    }
    if (requestedSponsors.length === 0) {
      setErrorMessage("Add at least one valid sponsor pubkey before copying a request message.");
      return;
    }
    if (!shareMessage.trim()) {
      setErrorMessage("Nothing to copy yet. Fill identity + sponsor inputs first.");
      return;
    }
    await copyToClipboard(shareMessage, "Request message copied.");
  }

  async function copyAllSponsorDrafts() {
    const createdAtTemplateError = validateVouchCreatedAtTemplate(vouchCreatedAtTemplate.trim() || undefined);
    if (createdAtTemplateError) {
      setErrorMessage(createdAtTemplateError);
      return;
    }
    if (!identityEventReference) {
      setErrorMessage(
        "Identity event reference is unavailable. Submit identity with accepted ingest or refresh status first."
      );
      return;
    }
    if (sponsorDrafts.length === 0) {
      setErrorMessage("No sponsor draft payloads available.");
      return;
    }
    await copyToClipboard(JSON.stringify(sponsorDrafts, null, 2), "Sponsor draft payloads copied.");
  }

  async function copySingleSponsorDraft(draft: SponsorVouchDraft) {
    const createdAtTemplateError = validateVouchCreatedAtTemplate(vouchCreatedAtTemplate.trim() || undefined);
    if (createdAtTemplateError) {
      setErrorMessage(createdAtTemplateError);
      return;
    }
    if (!identityEventReference) {
      setErrorMessage(
        "Identity event reference is unavailable. Submit identity with accepted ingest or refresh status first."
      );
      return;
    }
    await copyToClipboard(JSON.stringify(draft.draft, null, 2), `Draft copied for ${shortKey(draft.sponsorPubKey)}.`);
  }

  function handleResetOnboardingInputs() {
    setErrorMessage(null);
    setCopyMessage("");
    setBaseUrl(DEFAULT_NODE_API_BASE_URL);
    setAuthorPubKey("");
    setAuthorSecretKey("");
    setDisplayName("");
    setBio("");
    setPolicyVersion("v0-default");
    setIdentityCreatedAt("");
    setStatusAsOf("");
    setVouchCreatedAtTemplate("");
    setSponsorPubKeysInput("");
    setSignedIdentityEvent(null);
    setIngestResult(null);
    setOnboardingStatus(null);
    try {
      window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
      // ignore storage cleanup failures
    }
  }

  async function copyToClipboard(value: string, successMessage: string) {
    setErrorMessage(null);
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API is unavailable in this browser.");
      }
      await navigator.clipboard.writeText(value);
      setCopyMessage(successMessage);
      setTimeout(() => setCopyMessage(""), 1400);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Clipboard copy failed.");
      }
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Invite Onboarding Wizard</h2>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Create identity, prepare sponsor vouch requests, and track onboarding status from node
        events only.
      </p>
      <p style={{ marginTop: 0, marginBottom: "0.9rem", opacity: 0.78 }}>
        Informational only: onboarding threshold view does not grant admin privileges and does not
        bypass protocol validation.
      </p>
      <OffProtocolPaymentWarning />
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <span style={{ opacity: 0.82 }}>
          Workspace persistence: {isHydrated ? "enabled" : "loading"}
        </span>
        <button type="button" onClick={handleResetOnboardingInputs} style={buttonStyle}>
          Reset Onboarding Inputs
        </button>
      </div>

      <form onSubmit={handleIdentityCreateSubmit}>
        <h3 style={{ marginBottom: "0.55rem" }}>Step 1 - Identity</h3>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Node API Base URL
          <input
            value={baseUrl}
            onChange={inputEvent => setBaseUrl(inputEvent.target.value)}
            style={fieldStyle}
            placeholder="http://127.0.0.1:7878"
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Identity Public Key
          <input
            value={authorPubKey}
            onChange={inputEvent => setAuthorPubKey(inputEvent.target.value)}
            style={fieldStyle}
            placeholder="64-char hex public key"
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Identity Secret Key
          <input
            value={authorSecretKey}
            onChange={inputEvent => setAuthorSecretKey(inputEvent.target.value)}
            style={fieldStyle}
            placeholder="64-char hex secret key"
          />
        </label>
        <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" onClick={handleGenerateIdentityKeys} style={buttonStyle}>
            Generate Identity Keypair
          </button>
          <button type="submit" disabled={isSubmittingIdentity} style={buttonStyle}>
            {isSubmittingIdentity ? "Signing + Submitting..." : "Sign + Submit IdentityCreate"}
          </button>
        </div>

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Display Name (optional)
          <input
            value={displayName}
            onChange={inputEvent => setDisplayName(inputEvent.target.value)}
            style={fieldStyle}
            placeholder="New contributor"
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Bio (optional)
          <textarea
            value={bio}
            onChange={inputEvent => setBio(inputEvent.target.value)}
            style={{ ...fieldStyle, minHeight: "4rem", resize: "vertical" }}
            placeholder="Working on practical decentralized collaboration."
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          policyVersion (optional)
          <input
            value={policyVersion}
            onChange={inputEvent => setPolicyVersion(inputEvent.target.value)}
            style={fieldStyle}
            placeholder="v0-default"
          />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Identity createdAt (optional RFC3339)
          <input
            value={identityCreatedAt}
            onChange={inputEvent => setIdentityCreatedAt(inputEvent.target.value)}
            style={fieldStyle}
            placeholder="2026-03-01T00:00:00Z"
          />
        </label>
      </form>

      <h3 style={{ marginBottom: "0.55rem" }}>Step 2 - Sponsors</h3>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Sponsor Public Keys (comma/newline separated)
        <textarea
          value={sponsorPubKeysInput}
          onChange={inputEvent => setSponsorPubKeysInput(inputEvent.target.value)}
          style={{ ...fieldStyle, minHeight: "5rem", resize: "vertical" }}
          placeholder="sponsor_pubkey_1&#10;sponsor_pubkey_2"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Vouch draft createdAt template (optional RFC3339)
        <input
          value={vouchCreatedAtTemplate}
          onChange={inputEvent => setVouchCreatedAtTemplate(inputEvent.target.value)}
          style={fieldStyle}
          placeholder="<SPONSOR_RFC3339_TIMESTAMP>"
        />
      </label>
      <p style={{ marginTop: 0, marginBottom: "0.45rem", opacity: 0.82 }}>
        Valid sponsors: {sponsorParse.valid.length}
        {sponsorParse.duplicates.length > 0 ? ` | duplicates removed: ${sponsorParse.duplicates.length}` : ""}
        {sponsorParse.invalid.length > 0 ? ` | invalid: ${sponsorParse.invalid.length}` : ""}
        {sponsorSelfReferences.length > 0 ? ` | self removed: ${sponsorSelfReferences.length}` : ""}
      </p>
      {sponsorParse.invalid.length > 0 ? (
        <pre style={{ ...panelStyle, border: "1px solid #523041", background: "#291724" }}>
          Invalid sponsor keys:
          {"\n"}
          {sponsorParse.invalid.join("\n")}
        </pre>
      ) : null}
      {sponsorSelfReferences.length > 0 ? (
        <pre style={{ ...panelStyle, border: "1px solid #523041", background: "#291724" }}>
          Sponsor list included your identity key. Self-vouch requests were removed:
          {"\n"}
          {sponsorSelfReferences.join("\n")}
        </pre>
      ) : null}

      <h3 style={{ marginBottom: "0.55rem" }}>Step 3 - Share Vouch Requests</h3>
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button type="button" onClick={copyRequestMessage} style={buttonStyle}>
          Copy Request Message
        </button>
        <button type="button" onClick={copyAllSponsorDrafts} style={buttonStyle}>
          Copy All Sponsor Drafts
        </button>
      </div>
      {sponsorDrafts.length > 0 ? (
        <ul style={{ marginBottom: 0, marginTop: "0.75rem" }}>
          {sponsorDrafts.map(draft => (
            <li key={draft.sponsorPubKey} style={{ marginBottom: "0.35rem" }}>
              <code>{shortKey(draft.sponsorPubKey)}</code>{" "}
              <button type="button" onClick={() => copySingleSponsorDraft(draft)} style={buttonStyle}>
                Copy Draft
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <pre style={panelStyle}>{shareMessage || "Add identity + sponsors to generate request message."}</pre>

      <h3 style={{ marginBottom: "0.55rem" }}>Step 4 - Onboarding Status</h3>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        as_of (optional RFC3339)
        <input
          value={statusAsOf}
          onChange={inputEvent => setStatusAsOf(inputEvent.target.value)}
          style={fieldStyle}
          placeholder="2026-03-01T00:30:00Z"
        />
      </label>
      <div style={{ display: "flex", gap: "0.65rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={handleRefreshOnboardingStatus}
          disabled={isRefreshingStatus}
          style={buttonStyle}
        >
          {isRefreshingStatus ? "Refreshing..." : "Refresh Onboarding Status"}
        </button>
      </div>
      <p style={{ marginTop: "0.65rem", marginBottom: 0, opacity: 0.8 }}>
        Threshold uses policy `provider_eligibility_threshold` when available; fallback is{" "}
        {DEFAULT_ONBOARDING_THRESHOLD}.
      </p>

      {onboardingStatus ? (
        <pre style={panelStyle}>{JSON.stringify(onboardingStatus, null, 2)}</pre>
      ) : null}

      {signedIdentityEvent ? (
        <pre style={panelStyle}>{JSON.stringify(signedIdentityEvent, null, 2)}</pre>
      ) : null}
      {ingestResult ? <pre style={panelStyle}>{JSON.stringify(ingestResult, null, 2)}</pre> : null}

      {copyMessage ? (
        <p style={{ marginTop: "0.75rem", marginBottom: 0, color: "#98e9b8" }}>{copyMessage}</p>
      ) : null}

      {errorMessage ? (
        <pre style={{ ...panelStyle, border: "1px solid #523041", background: "#291724" }}>
          {errorMessage}
        </pre>
      ) : null}

      <p style={{ marginTop: "0.9rem", marginBottom: 0, opacity: 0.85 }}>
        Useful reads:{" "}
        <Link href="/explorer/identity" style={{ color: "#9fc2ff" }}>
          `/explorer/identity`
        </Link>{" "}
        |{" "}
        <Link href="/explorer/reputation" style={{ color: "#9fc2ff" }}>
          `/explorer/reputation`
        </Link>{" "}
        |{" "}
        <Link href="/explorer/discovery" style={{ color: "#9fc2ff" }}>
          `/explorer/discovery`
        </Link>
      </p>
    </section>
  );
}

async function fetchEventsByKind(
  client: NodeClient,
  kind: string,
  options: { authorPubKey?: string } = {}
): Promise<ParsedEvent[]> {
  const output: ParsedEvent[] = [];
  let cursor: number | undefined;
  let pages = 0;

  while (pages < 50) {
    const page = await client.listEvents({
      kind,
      author_pub_key: options.authorPubKey,
      limit: 200,
      cursor
    });
    for (const row of page.events) {
      const parsed = parseEventRow(row);
      if (parsed) {
        output.push(parsed);
      }
    }

    if (page.next_cursor === null || page.next_cursor === undefined || page.next_cursor === cursor) {
      break;
    }
    cursor = page.next_cursor;
    pages += 1;
  }

  return output;
}

async function resolveOnboardingThreshold(
  client: NodeClient,
  asOf: string | undefined
): Promise<{ threshold: number; source: string }> {
  try {
    const view = await client.getPolicy(asOf);
    const policy = asRecord(view.data?.policy);
    const threshold = asPositiveInteger(policy?.provider_eligibility_threshold);
    if (threshold !== null) {
      return {
        threshold,
        source: "policy.provider_eligibility_threshold"
      };
    }
  } catch {
    // fallback below
  }
  return {
    threshold: DEFAULT_ONBOARDING_THRESHOLD,
    source: "fallback_default"
  };
}

function parseEventRow(row: Record<string, unknown>): ParsedEvent | null {
  const eventId = asString(row.event_id);
  const createdAt = asString(row.created_at);
  const kind = asString(row.kind);
  const authorPubKey = asString(row.author_pub_key);
  const payload = asRecord(row.payload_json);
  const createdAtMs = toTimestamp(createdAt ?? "");
  if (!eventId || !createdAt || !kind || !authorPubKey || !payload || createdAtMs === null) {
    return null;
  }
  const references = asRecord(row.references_json) ?? undefined;
  return {
    eventId,
    createdAt,
    createdAtMs,
    kind,
    authorPubKey,
    payload,
    references
  };
}

function computeOnboardingStatus(input: {
  identityPubKey: string;
  identityCreateEvents: ParsedEvent[];
  vouchEvents: ParsedEvent[];
  vouchRevokeEvents: ParsedEvent[];
  asOf: string | undefined;
  requestedSponsors: string[];
  threshold: number;
  thresholdSource: string;
}): OnboardingStatus {
  const asOfTimestamp = toTimestamp(input.asOf ?? "");
  const effectiveAsOfMs = asOfTimestamp ?? Date.now();
  const effectiveAsOf = input.asOf ?? new Date(effectiveAsOfMs).toISOString();

  const identityEvents = input.identityCreateEvents
    .filter(event => event.kind === "IdentityCreate")
    .filter(event => event.createdAtMs <= effectiveAsOfMs)
    .filter(event => {
      const identityPubKey = asString(event.payload.identityPubKey);
      return identityPubKey === input.identityPubKey || event.authorPubKey === input.identityPubKey;
    })
    .sort(compareEventsAsc);

  const identityLatest = identityEvents[identityEvents.length - 1];

  const actions = [...input.vouchEvents, ...input.vouchRevokeEvents]
    .filter(event => event.createdAtMs <= effectiveAsOfMs)
    .filter(event => event.kind === "Vouch" || event.kind === "VouchRevoke")
    .filter(event => asString(event.payload.subjectPubKey) === input.identityPubKey)
    .sort(compareEventsAsc);

  const vouchState = new Map<
    string,
    {
      active: boolean;
      weight: number;
      vouchEventId: string;
      createdAt: string;
      expiresAt?: string;
    }
  >();

  for (const action of actions) {
    const voucherPubKey = action.authorPubKey;
    if (action.kind === "Vouch") {
      const weight = asPositiveInteger(action.payload.weight) ?? 1;
      const expiresAt = asString(action.payload.expiresAt) ?? undefined;
      vouchState.set(voucherPubKey, {
        active: true,
        weight,
        vouchEventId: action.eventId,
        createdAt: action.createdAt,
        expiresAt
      });
      continue;
    }

    const existing = vouchState.get(voucherPubKey);
    if (existing) {
      vouchState.set(voucherPubKey, { ...existing, active: false });
    }
  }

  const activeIncomingVouches = [...vouchState.entries()]
    .filter(([, state]) => state.active)
    .filter(([, state]) => !isExpiredAt(state.expiresAt, effectiveAsOfMs))
    .map(([voucherPubKey, state]) => ({
      voucherPubKey,
      weight: state.weight,
      vouchEventId: state.vouchEventId,
      createdAt: state.createdAt,
      expiresAt: state.expiresAt
    }))
    .sort((left, right) => left.voucherPubKey.localeCompare(right.voucherPubKey));

  const activeVoucherSet = new Set(activeIncomingVouches.map(item => item.voucherPubKey));
  const sponsorsWithActiveVouch = input.requestedSponsors
    .filter(sponsor => activeVoucherSet.has(sponsor))
    .sort();
  const sponsorsMissingVouch = input.requestedSponsors
    .filter(sponsor => !activeVoucherSet.has(sponsor))
    .sort();

  const incomingActiveVouchWeight = activeIncomingVouches.reduce(
    (sum, entry) => sum + entry.weight,
    0
  );

  return {
    asOf: effectiveAsOf,
    identityPubKey: input.identityPubKey,
    identityExists: Boolean(identityLatest),
    identityEventId: identityLatest?.eventId ?? null,
    incomingActiveVouches: activeIncomingVouches.length,
    incomingActiveVouchWeight,
    threshold: input.threshold,
    thresholdSource: input.thresholdSource,
    thresholdMet: activeIncomingVouches.length >= input.threshold,
    activeIncomingVouches,
    sponsorsRequested: input.requestedSponsors.length,
    sponsorsWithActiveVouch,
    sponsorsMissingVouch
  };
}

function compareEventsAsc(left: ParsedEvent, right: ParsedEvent): number {
  return (
    left.createdAtMs - right.createdAtMs ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.eventId.localeCompare(right.eventId)
  );
}

function parseSponsorPubKeys(value: string): SponsorParseResult {
  const tokens = value
    .split(/[,\n\r\t ]+/)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  const seen = new Set<string>();
  const valid: string[] = [];
  const duplicates: string[] = [];
  const invalid: string[] = [];
  for (const token of tokens) {
    if (!HEX64_REGEX.test(token)) {
      invalid.push(token);
      continue;
    }
    if (seen.has(token)) {
      duplicates.push(token);
      continue;
    }
    seen.add(token);
    valid.push(token);
  }
  return { valid, duplicates, invalid };
}

function buildSponsorVouchDrafts(input: {
  sponsors: string[];
  identityPubKey: string;
  identityEventId: string | null;
  policyVersion: string;
  createdAtTemplate: string;
}): SponsorVouchDraft[] {
  const identityPubKey = input.identityPubKey.trim();
  if (!HEX64_REGEX.test(identityPubKey)) {
    return [];
  }

  return input.sponsors.map(sponsorPubKey => ({
    sponsorPubKey,
    draft: {
      version: "v0",
      authorPubKey: sponsorPubKey,
      createdAt: input.createdAtTemplate,
      kind: "Vouch",
      policyVersion: input.policyVersion,
      payload: {
        subjectPubKey: identityPubKey
      },
      ...(input.identityEventId
        ? {
            references: {
              identity: input.identityEventId
            }
          }
        : {})
    }
  }));
}

function buildSponsorRequestMessage(input: {
  identityPubKey: string;
  identityEventId: string | null;
  sponsorPubKeys: string[];
  baseUrl: string;
}): string {
  if (!HEX64_REGEX.test(input.identityPubKey)) {
    return "Generate or paste a valid identity pubkey to build sponsor request messages.";
  }

  const sponsorsLine =
    input.sponsorPubKeys.length > 0 ? input.sponsorPubKeys.join(", ") : "<add sponsor pubkeys>";
  const identityReferenceLine = input.identityEventId
    ? `Identity event reference: ${input.identityEventId}`
    : "Identity event reference: <pending>";

  return [
    "New Start Invite Vouch Request",
    "",
    `Identity pubkey: ${input.identityPubKey}`,
    identityReferenceLine,
    `Requested sponsors: ${sponsorsLine}`,
    "",
    "Please sign and submit a Vouch event with payload:",
    JSON.stringify({ subjectPubKey: input.identityPubKey }, null, 2),
    "",
    `Node target: ${input.baseUrl}/events`,
    "Reminder: this is event-driven onboarding, with no admin approval path."
  ].join("\n");
}

function validateOptionalRfc3339(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (!RFC3339_REGEX.test(value)) {
    return "Invalid RFC3339 timestamp. Example: 2026-03-01T00:00:00Z";
  }
  return null;
}

function validateVouchCreatedAtTemplate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  if (RFC3339_REGEX.test(value)) {
    return null;
  }
  if (TEMPLATE_TOKEN_REGEX.test(value)) {
    return null;
  }
  return "Vouch draft createdAt template must be RFC3339 or a token like <SPONSOR_RFC3339_TIMESTAMP>.";
}

function isExpiredAt(expiresAt: string | undefined, asOfMs: number): boolean {
  if (!expiresAt) {
    return false;
  }
  const expiresAtMs = toTimestamp(expiresAt);
  if (expiresAtMs === null) {
    return false;
  }
  return expiresAtMs <= asOfMs;
}

function shortKey(value: string): string {
  if (value.length < 16) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-8)}`;
}

function toTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function normalizeHexKey(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return HEX64_REGEX.test(trimmed) ? trimmed : null;
}

function asPositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const parsed = Math.floor(value);
  return parsed > 0 ? parsed : null;
}

const sectionStyle = {
  marginTop: "1.5rem",
  border: "1px solid #2a3458",
  borderRadius: 12,
  padding: "1rem 1.25rem",
  background: "#111936"
} as const;

const fieldStyle = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  background: "#0b122b",
  color: "#dbe7ff",
  border: "1px solid #2a3458",
  borderRadius: 8,
  padding: "0.6rem 0.7rem"
} as const;

const buttonStyle = {
  background: "#1a2f66",
  color: "#dbe7ff",
  border: "1px solid #3651a1",
  borderRadius: 8,
  padding: "0.45rem 0.72rem",
  cursor: "pointer"
} as const;

const panelStyle = {
  marginTop: "0.8rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#0b122b",
  whiteSpace: "pre-wrap"
} as const;
