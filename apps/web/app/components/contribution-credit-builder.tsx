"use client";

import Link from "next/link";
import {
  createUnsignedEnvelope,
  derivePublicKey,
  generateEd25519KeyPair,
  NodeApiError,
  NodeClient,
  signUnsignedEnvelope,
  type IngestResult,
  type SignedEnvelope
} from "@new-start/sdk-ts";
import { FormEvent, useState } from "react";
import {
  defaultNodeClientBaseUrlForForms,
  validateNodeClientBaseUrl
} from "@/lib/node-client-base-url";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

type BuilderMode = "claim" | "attest" | "mint" | "spend";
type SourceKind = "signed" | "accepted";

type SessionAcceptedEvent = {
  eventId: string;
  kind: SignedEnvelope["kind"];
  authorPubKey: string;
  payload: Record<string, unknown>;
  references?: Record<string, string>;
  createdAt: string;
};

const DEFAULT_NODE_API_BASE_URL = defaultNodeClientBaseUrlForForms();

const SUPPORTED_SINKS = ["ComputeSink", "AISink", "StorageSink", "BountySink"] as const;
type SpendSinkKind = (typeof SUPPORTED_SINKS)[number];

export function ContributionCreditBuilder() {
  const [mode, setMode] = useState<BuilderMode>("claim");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_NODE_API_BASE_URL);
  const [authorPubKey, setAuthorPubKey] = useState("");
  const [authorSecretKey, setAuthorSecretKey] = useState("");
  const [policyVersion, setPolicyVersion] = useState("v0-default");
  const [createdAt, setCreatedAt] = useState("");

  const [claimId, setClaimId] = useState("claim-1");
  const [claimType, setClaimType] = useState("maintenance");
  const [artifactHash, setArtifactHash] = useState("artifact-abc123");
  const [claimSummary, setClaimSummary] = useState("revived a stalled project");
  const [requestedCredits, setRequestedCredits] = useState("100");
  const [claimBeneficiaryPubKey, setClaimBeneficiaryPubKey] = useState("");

  const [attestClaimId, setAttestClaimId] = useState("claim-1");
  const [attestDecision, setAttestDecision] = useState<"approve" | "reject">("approve");
  const [attestNotesHash, setAttestNotesHash] = useState("");
  const [attestClaimReferenceEventId, setAttestClaimReferenceEventId] = useState("");

  const [mintBeneficiaryPubKey, setMintBeneficiaryPubKey] = useState("");
  const [mintAmount, setMintAmount] = useState("100");
  const [mintExpiresAt, setMintExpiresAt] = useState("2026-12-01T00:00:00Z");
  const [mintReason, setMintReason] = useState("contribution");
  const [mintSourceClaimId, setMintSourceClaimId] = useState("claim-1");
  const [mintSourceOrderId, setMintSourceOrderId] = useState("");
  const [mintSourceMilestoneId, setMintSourceMilestoneId] = useState("");
  const [mintClaimReferenceEventId, setMintClaimReferenceEventId] = useState("");

  const [spendSpenderPubKey, setSpendSpenderPubKey] = useState("");
  const [spendSinkKind, setSpendSinkKind] = useState<SpendSinkKind>("ComputeSink");
  const [spendAmount, setSpendAmount] = useState("50");
  const [spendNonce, setSpendNonce] = useState("nonce-1");
  const [spendSourceReferenceEventId, setSpendSourceReferenceEventId] = useState("");

  const [signedEvent, setSignedEvent] = useState<SignedEnvelope | null>(null);
  const [ingestResult, setIngestResult] = useState<IngestResult | null>(null);
  const [sessionAcceptedEvents, setSessionAcceptedEvents] = useState<SessionAcceptedEvent[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleGenerateAuthor() {
    const keys = await generateEd25519KeyPair();
    setAuthorPubKey(keys.publicKeyHex);
    setAuthorSecretKey(keys.secretKeyHex);
  }

  function setBeneficiaryFromAuthor() {
    const author = authorPubKey.trim();
    setClaimBeneficiaryPubKey(author);
    setMintBeneficiaryPubKey(author);
    setSpendSpenderPubKey(author);
  }

  function handleApplyFixturePreset() {
    const alice = "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737";
    setClaimId("claim-1");
    setClaimType("maintenance");
    setArtifactHash("abc123");
    setClaimSummary("revived a stalled project");
    setRequestedCredits("100");
    setClaimBeneficiaryPubKey(alice);

    setAttestClaimId("claim-1");
    setAttestDecision("approve");
    setAttestNotesHash("");
    setAttestClaimReferenceEventId("");

    setMintBeneficiaryPubKey(alice);
    setMintAmount("100");
    setMintExpiresAt("2026-02-15T00:04:00Z");
    setMintReason("contribution");
    setMintSourceClaimId("claim-1");
    setMintSourceOrderId("");
    setMintSourceMilestoneId("");
    setMintClaimReferenceEventId("");

    setSpendSpenderPubKey(alice);
    setSpendSinkKind("ComputeSink");
    setSpendAmount("50");
    setSpendNonce("nonce-1");
    setSpendSourceReferenceEventId("");

    setCreatedAt(fixtureCreatedAt(mode));
    setErrorMessage(null);
  }

  function handleUseLastSignedEvent() {
    if (!signedEvent) {
      setErrorMessage("No signed event available yet. Sign one event first.");
      return;
    }
    applyAutofillFromSource(signedEvent, "signed");
  }

  function handleUsePreviousAcceptedEvent() {
    const source = findLatestAcceptedEvent(
      sessionAcceptedEvents,
      expectedAutofillKindsForMode(mode)
    );
    if (!source) {
      setErrorMessage(`No accepted prior event found for ${modeLabel(mode)}.`);
      return;
    }
    applyAutofillFromSource(source, "accepted");
  }

  function applyAutofillFromSource(
    source: Pick<SignedEnvelope, "kind" | "eventId" | "authorPubKey" | "payload" | "references">,
    sourceKind: SourceKind
  ) {
    setErrorMessage(null);
    if (!isObjectRecord(source.payload)) {
      setErrorMessage(`Last ${sourceKind} event payload is malformed.`);
      return;
    }
    const payload = source.payload;

    if (mode === "attest") {
      if (source.kind !== "ContributionClaim") {
        setErrorMessage(`Attest autofill expects a ${sourceKind} ContributionClaim event.`);
        return;
      }
      const linkedClaimId = readStringField(payload, "claimId");
      if (linkedClaimId) {
        setAttestClaimId(linkedClaimId);
      }
      setAttestClaimReferenceEventId(source.eventId);
      return;
    }

    if (mode === "mint") {
      if (source.kind === "ContributionClaim") {
        const linkedClaimId = readStringField(payload, "claimId");
        if (linkedClaimId) {
          setMintSourceClaimId(linkedClaimId);
        }
        const beneficiary = readStringField(payload, "beneficiaryPubKey");
        if (beneficiary) {
          setMintBeneficiaryPubKey(beneficiary);
        } else {
          setMintBeneficiaryPubKey(source.authorPubKey);
        }
        setMintClaimReferenceEventId(source.eventId);
        return;
      }
      if (source.kind === "ContributionAttest") {
        const linkedClaimId = readStringField(payload, "claimId");
        if (linkedClaimId) {
          setMintSourceClaimId(linkedClaimId);
        }
        const claimRef = source.references?.claim;
        if (claimRef) {
          setMintClaimReferenceEventId(claimRef);
        }
        return;
      }
      setErrorMessage(`Mint autofill expects a ${sourceKind} ContributionClaim or ContributionAttest event.`);
      return;
    }

    if (mode === "spend") {
      if (source.kind !== "MintCredits") {
        setErrorMessage(`Spend autofill expects a ${sourceKind} MintCredits event.`);
        return;
      }
      const beneficiary = readStringField(payload, "beneficiaryPubKey");
      if (beneficiary) {
        setSpendSpenderPubKey(beneficiary);
      }
      setSpendSourceReferenceEventId(source.eventId);
      return;
    }

    setErrorMessage("ContributionClaim mode does not need upstream autofill.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setIngestResult(null);
    setSignedEvent(null);

    const authorPubKeyTrimmed = authorPubKey.trim();
    const authorSecretKeyTrimmed = authorSecretKey.trim();
    if (!authorPubKeyTrimmed || !authorSecretKeyTrimmed) {
      setErrorMessage("Author public key and secret key are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const derivedPub = await derivePublicKey(authorSecretKeyTrimmed);
      if (derivedPub !== authorPubKeyTrimmed) {
        throw new Error("Author pubkey does not match the provided secret key.");
      }

      const common = {
        authorPubKey: authorPubKeyTrimmed,
        policyVersion: policyVersion.trim() || undefined,
        createdAt: createdAt.trim() || undefined
      };

      const unsigned =
        mode === "claim"
          ? buildClaimUnsigned({
              ...common,
              claimId,
              claimType,
              artifactHash,
              summary: claimSummary,
              requestedCredits,
              beneficiaryPubKey: claimBeneficiaryPubKey
            })
          : mode === "attest"
            ? buildAttestUnsigned({
                ...common,
                claimId: attestClaimId,
                decision: attestDecision,
                notesHash: attestNotesHash,
                claimReferenceEventId: attestClaimReferenceEventId
              })
            : mode === "mint"
              ? buildMintUnsigned({
                  ...common,
                  beneficiaryPubKey: mintBeneficiaryPubKey,
                  amount: mintAmount,
                  expiresAt: mintExpiresAt,
                  mintReason,
                  sourceClaimId: mintSourceClaimId,
                  sourceOrderId: mintSourceOrderId,
                  sourceMilestoneId: mintSourceMilestoneId,
                  claimReferenceEventId: mintClaimReferenceEventId
                })
              : buildSpendUnsigned({
                  ...common,
                  spenderPubKey: spendSpenderPubKey,
                  sinkKind: spendSinkKind,
                  amount: spendAmount,
                  nonce: spendNonce,
                  sourceReferenceEventId: spendSourceReferenceEventId
                });

      const signed = await signUnsignedEnvelope(unsigned, authorSecretKeyTrimmed);
      setSignedEvent(signed);

      const client = new NodeClient({
        baseUrl: baseUrl.trim() || DEFAULT_NODE_API_BASE_URL
      });
      const result = await client.submitSignedEnvelope(signed);
      setIngestResult(result);

      if (result.accepted) {
        setSessionAcceptedEvents(previous => [
          ...previous,
          {
            eventId: signed.eventId,
            kind: signed.kind,
            authorPubKey: signed.authorPubKey,
            payload: signed.payload,
            references: signed.references,
            createdAt: signed.createdAt
          }
        ]);
      }
    } catch (error) {
      if (error instanceof NodeApiError) {
        setErrorMessage(`${error.message} (status ${error.status})`);
      } else if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Unknown error while signing/submitting contribution/credits event.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={{ marginTop: 0 }}>Contribution + Credits Builder (Draft - Sign - Submit)</h2>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Build contribution/credit lifecycle events and submit them to `POST /events`.
      </p>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        <button type="button" style={mode === "claim" ? selectedButtonStyle : buttonStyle} onClick={() => setMode("claim")}>
          ContributionClaim
        </button>
        <button type="button" style={mode === "attest" ? selectedButtonStyle : buttonStyle} onClick={() => setMode("attest")}>
          ContributionAttest
        </button>
        <button type="button" style={mode === "mint" ? selectedButtonStyle : buttonStyle} onClick={() => setMode("mint")}>
          MintCredits
        </button>
        <button type="button" style={mode === "spend" ? selectedButtonStyle : buttonStyle} onClick={() => setMode("spend")}>
          SpendCredits (Non-Escrow)
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Node API Base URL
          <input value={baseUrl} onChange={inputEvent => setBaseUrl(inputEvent.target.value)} style={fieldStyle} placeholder="http://127.0.0.1:7878" />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Author Public Key
          <input value={authorPubKey} onChange={inputEvent => setAuthorPubKey(inputEvent.target.value)} style={fieldStyle} placeholder="64-char hex public key" />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Author Secret Key
          <input value={authorSecretKey} onChange={inputEvent => setAuthorSecretKey(inputEvent.target.value)} style={fieldStyle} placeholder="64-char hex secret key" />
        </label>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <button type="button" onClick={handleGenerateAuthor} style={buttonStyle}>Generate Author Keypair</button>
          <button type="button" onClick={setBeneficiaryFromAuthor} style={buttonStyle}>Use Author as Beneficiary/Spender</button>
          <button type="button" onClick={handleApplyFixturePreset} style={buttonStyle}>Apply Fixture Preset</button>
          {mode !== "claim" ? (
            <button type="button" onClick={handleUseLastSignedEvent} style={buttonStyle}>Autofill From Last Signed Event</button>
          ) : null}
          {mode !== "claim" ? (
            <button type="button" onClick={handleUsePreviousAcceptedEvent} style={buttonStyle}>Autofill From Previous Accepted Event</button>
          ) : null}
        </div>

        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Policy Version (optional)
          <input value={policyVersion} onChange={inputEvent => setPolicyVersion(inputEvent.target.value)} style={fieldStyle} placeholder="v0-default" />
        </label>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          createdAt (optional RFC3339)
          <input value={createdAt} onChange={inputEvent => setCreatedAt(inputEvent.target.value)} style={fieldStyle} placeholder="2026-01-01T00:02:00Z" />
        </label>

        {mode === "claim" ? (
          <>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>claimId<input value={claimId} onChange={inputEvent => setClaimId(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>claimType<input value={claimType} onChange={inputEvent => setClaimType(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>artifactHash<input value={artifactHash} onChange={inputEvent => setArtifactHash(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>summary<textarea value={claimSummary} onChange={inputEvent => setClaimSummary(inputEvent.target.value)} style={{ ...fieldStyle, minHeight: "4rem", resize: "vertical" }} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>requestedCredits<input value={requestedCredits} onChange={inputEvent => setRequestedCredits(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>beneficiaryPubKey (optional)<input value={claimBeneficiaryPubKey} onChange={inputEvent => setClaimBeneficiaryPubKey(inputEvent.target.value)} style={fieldStyle} /></label>
          </>
        ) : null}

        {mode === "attest" ? (
          <>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>claimId<input value={attestClaimId} onChange={inputEvent => setAttestClaimId(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              decision
              <Select
                value={attestDecision}
                onValueChange={value => {
                  if (!value) return;
                  setAttestDecision(value as "approve" | "reject");
                }}
              >
                <SelectTrigger className="mt-1.5 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="approve">approve</SelectItem>
                  <SelectItem value="reject">reject</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>notesHash (optional)<input value={attestNotesHash} onChange={inputEvent => setAttestNotesHash(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>references.claim eventId (optional but recommended)<input value={attestClaimReferenceEventId} onChange={inputEvent => setAttestClaimReferenceEventId(inputEvent.target.value)} style={fieldStyle} /></label>
          </>
        ) : null}

        {mode === "mint" ? (
          <>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>beneficiaryPubKey<input value={mintBeneficiaryPubKey} onChange={inputEvent => setMintBeneficiaryPubKey(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>amount<input value={mintAmount} onChange={inputEvent => setMintAmount(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>expiresAt<input value={mintExpiresAt} onChange={inputEvent => setMintExpiresAt(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>mintReason<input value={mintReason} onChange={inputEvent => setMintReason(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>sourceClaimId<input value={mintSourceClaimId} onChange={inputEvent => setMintSourceClaimId(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>sourceOrderId (optional)<input value={mintSourceOrderId} onChange={inputEvent => setMintSourceOrderId(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>sourceMilestoneId (optional)<input value={mintSourceMilestoneId} onChange={inputEvent => setMintSourceMilestoneId(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>references.claim eventId (optional but recommended)<input value={mintClaimReferenceEventId} onChange={inputEvent => setMintClaimReferenceEventId(inputEvent.target.value)} style={fieldStyle} /></label>
          </>
        ) : null}

        {mode === "spend" ? (
          <>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>spenderPubKey<input value={spendSpenderPubKey} onChange={inputEvent => setSpendSpenderPubKey(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>
              sinkKind
              <Select
                value={spendSinkKind}
                onValueChange={value => {
                  if (!value) return;
                  setSpendSinkKind(value as SpendSinkKind);
                }}
              >
                <SelectTrigger className="mt-1.5 w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {SUPPORTED_SINKS.map(sink => (
                    <SelectItem key={sink} value={sink}>
                      {sink}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>amount<input value={spendAmount} onChange={inputEvent => setSpendAmount(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>nonce<input value={spendNonce} onChange={inputEvent => setSpendNonce(inputEvent.target.value)} style={fieldStyle} /></label>
            <label style={{ display: "block", marginBottom: "0.5rem" }}>references.source eventId (optional)<input value={spendSourceReferenceEventId} onChange={inputEvent => setSpendSourceReferenceEventId(inputEvent.target.value)} style={fieldStyle} /></label>
          </>
        ) : null}

        <button type="submit" disabled={isSubmitting} style={buttonStyle}>
          {isSubmitting ? `Signing + Submitting ${modeLabel(mode)}...` : `Sign + Submit ${modeLabel(mode)}`}
        </button>
      </form>

      {signedEvent ? <pre style={panelStyle}>{JSON.stringify(signedEvent, null, 2)}</pre> : null}
      {ingestResult ? <pre style={panelStyle}>{JSON.stringify(ingestResult, null, 2)}</pre> : null}
      {errorMessage ? (
        <pre style={{ ...panelStyle, border: "1px solid #523041", background: "#291724" }}>
          {errorMessage}
        </pre>
      ) : null}

      {sessionAcceptedEvents.length > 0 ? (
        <section style={panelStyle}>
          <h3 style={{ marginTop: 0, marginBottom: "0.45rem" }}>Accepted Event Session (Contribution/Credits)</h3>
          <p style={{ marginTop: 0, opacity: 0.85 }}>Latest accepted events can be reused for autofill.</p>
          <ul style={{ marginBottom: 0 }}>
            {sessionAcceptedEvents.slice(-8).reverse().map(eventItem => (
              <li key={eventItem.eventId}>
                <code>{eventItem.kind}</code> <code>{eventItem.eventId}</code>
              </li>
            ))}
          </ul>
          <p style={{ marginBottom: 0, marginTop: "0.65rem", opacity: 0.85 }}>
            Inspect related state: <Link href="/explorer/balance" style={{ color: "#9fc2ff" }}>/explorer/balance</Link>
          </p>
        </section>
      ) : null}
    </section>
  );
}

function modeLabel(mode: BuilderMode): string {
  if (mode === "claim") {
    return "ContributionClaim";
  }
  if (mode === "attest") {
    return "ContributionAttest";
  }
  if (mode === "mint") {
    return "MintCredits";
  }
  return "SpendCredits";
}

function expectedAutofillKindsForMode(mode: BuilderMode): SignedEnvelope["kind"][] {
  if (mode === "attest") {
    return ["ContributionClaim"];
  }
  if (mode === "mint") {
    return ["ContributionAttest", "ContributionClaim"];
  }
  if (mode === "spend") {
    return ["MintCredits"];
  }
  return [];
}

function findLatestAcceptedEvent(
  sessionAcceptedEvents: SessionAcceptedEvent[],
  allowedKinds: SignedEnvelope["kind"][]
): SessionAcceptedEvent | null {
  for (let index = sessionAcceptedEvents.length - 1; index >= 0; index -= 1) {
    const eventItem = sessionAcceptedEvents[index];
    if (allowedKinds.includes(eventItem.kind)) {
      return eventItem;
    }
  }
  return null;
}

function fixtureCreatedAt(mode: BuilderMode): string {
  if (mode === "claim") {
    return "2026-01-01T00:02:00Z";
  }
  if (mode === "attest") {
    return "2026-01-01T00:03:00Z";
  }
  if (mode === "mint") {
    return "2026-01-01T00:04:00Z";
  }
  return "2026-01-15T00:04:00Z";
}

function buildClaimUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  claimId: string;
  claimType: string;
  artifactHash: string;
  summary: string;
  requestedCredits: string;
  beneficiaryPubKey: string;
}) {
  const payload: Record<string, unknown> = {
    claimId: requireNonEmpty(input.claimId, "claimId"),
    claimType: requireNonEmpty(input.claimType, "claimType"),
    artifactHash: requireNonEmpty(input.artifactHash, "artifactHash"),
    summary: requireNonEmpty(input.summary, "summary"),
    requestedCredits: parsePositiveInteger(input.requestedCredits, "requestedCredits")
  };
  if (input.beneficiaryPubKey.trim()) {
    payload.beneficiaryPubKey = input.beneficiaryPubKey.trim();
  }

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ContributionClaim",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt
  });
}

function buildAttestUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  claimId: string;
  decision: "approve" | "reject";
  notesHash: string;
  claimReferenceEventId: string;
}) {
  const payload: Record<string, unknown> = {
    claimId: requireNonEmpty(input.claimId, "claimId"),
    decision: input.decision === "reject" ? "reject" : "approve"
  };
  if (input.notesHash.trim()) {
    payload.notesHash = input.notesHash.trim();
  }

  const references =
    input.claimReferenceEventId.trim().length > 0
      ? { claim: input.claimReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "ContributionAttest",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildMintUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  beneficiaryPubKey: string;
  amount: string;
  expiresAt: string;
  mintReason: string;
  sourceClaimId: string;
  sourceOrderId: string;
  sourceMilestoneId: string;
  claimReferenceEventId: string;
}) {
  const reason = requireNonEmpty(input.mintReason, "mintReason");
  const payload: Record<string, unknown> = {
    beneficiaryPubKey: requireNonEmpty(input.beneficiaryPubKey, "beneficiaryPubKey"),
    amount: parsePositiveInteger(input.amount, "amount"),
    expiresAt: requireNonEmpty(input.expiresAt, "expiresAt"),
    mintReason: reason
  };

  if (input.sourceClaimId.trim()) {
    payload.sourceClaimId = input.sourceClaimId.trim();
  }
  if (input.sourceOrderId.trim()) {
    payload.sourceOrderId = input.sourceOrderId.trim();
  }
  if (input.sourceMilestoneId.trim()) {
    payload.sourceMilestoneId = input.sourceMilestoneId.trim();
  }
  if (reason === "contribution" && !input.sourceClaimId.trim()) {
    throw new Error("sourceClaimId is required when mintReason is contribution.");
  }

  const references =
    input.claimReferenceEventId.trim().length > 0
      ? { claim: input.claimReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "MintCredits",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references
  });
}

function buildSpendUnsigned(input: {
  authorPubKey: string;
  policyVersion?: string;
  createdAt?: string;
  spenderPubKey: string;
  sinkKind: SpendSinkKind;
  amount: string;
  nonce: string;
  sourceReferenceEventId: string;
}) {
  const payload: Record<string, unknown> = {
    spenderPubKey: requireNonEmpty(input.spenderPubKey, "spenderPubKey"),
    sinkKind: input.sinkKind,
    amount: parsePositiveInteger(input.amount, "amount")
  };

  const references =
    input.sourceReferenceEventId.trim().length > 0
      ? { source: input.sourceReferenceEventId.trim() }
      : undefined;

  return createUnsignedEnvelope({
    authorPubKey: input.authorPubKey,
    kind: "SpendCredits",
    payload,
    policyVersion: input.policyVersion,
    createdAt: input.createdAt,
    references,
    nonce: requireNonEmpty(input.nonce, "nonce")
  });
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${fieldName} is required.`);
  }
  return trimmed;
}

function parsePositiveInteger(raw: string, fieldName: string): number {
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
  return parsed;
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
  padding: "0.55rem 0.85rem",
  cursor: "pointer"
} as const;

const selectedButtonStyle = {
  ...buttonStyle,
  border: "1px solid #6a86df",
  background: "#24408f"
} as const;

const panelStyle = {
  marginTop: "1rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#0b122b",
  whiteSpace: "pre-wrap"
} as const;
