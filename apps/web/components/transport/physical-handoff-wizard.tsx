"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { NodeApiError, NodeClient, signUnsignedEnvelope } from "@new-start/sdk-ts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HandoffQueuePanel } from "@/components/transport/handoff-queue-panel";
import { TransportQrPanel } from "@/components/transport/transport-qr-panel";
import { loadActiveSession } from "@/lib/auth/session";
import {
  loadPhysicalHandoffOrders,
  type PhysicalHandoffOrderCandidate,
  type PhysicalHandoffOrdersState
} from "@/lib/dashboard/load-physical-handoff-orders";
import {
  buildPhysicalHandoffDeliveryUnsigned,
  validatePhysicalHandoffAckHashes
} from "@/lib/marketplace/physical-handoff-delivery";
import { resolvePolicyVersion } from "@/lib/marketplace/policy";
import { buildServiceAcceptUnsigned } from "@/lib/marketplace/service-accept";
import { resolveNodeClientBaseUrl } from "@/lib/node-client-base-url";
import { enqueueHandoffSignedEvent } from "@/lib/transport/handoff-queue";
import {
  buildHandoffAckStaging,
  parseHandoffAckStaging,
  serializeHandoffAckStaging
} from "@/lib/transport/handoff-staging";
import { TRANSPORT_QR_WARNING } from "@/lib/transport/copy";
import { sha256Hex } from "@/lib/transport/sha256-hex";
import { truncatePubkey } from "@/lib/utils";

type PhysicalHandoffWizardProps = {
  initialOrderId?: string | null;
};

type WizardStep = "pick" | "acks" | "review";

export function PhysicalHandoffWizard({ initialOrderId }: PhysicalHandoffWizardProps) {
  const [state, setState] = useState<PhysicalHandoffOrdersState | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<WizardStep>("pick");
  const [selected, setSelected] = useState<PhysicalHandoffOrderCandidate | null>(null);
  const [providerAckLabel, setProviderAckLabel] = useState("");
  const [providerAckHash, setProviderAckHash] = useState("");
  const [buyerAckLabel, setBuyerAckLabel] = useState("");
  const [buyerAckHash, setBuyerAckHash] = useState("");
  const [notesText, setNotesText] = useState("");
  const [notesHash, setNotesHash] = useState("");
  const [stagingImport, setStagingImport] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const session = loadActiveSession();
    if (!session) {
      setState({ kind: "signed-out", nodeLabel: "" });
      setLoading(false);
      return;
    }
    setLoading(true);
    const next = await loadPhysicalHandoffOrders(session.publicKeyHex);
    setState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!initialOrderId || state?.kind !== "live" || selected) {
      return;
    }
    const match = state.orders.find((order) => order.orderId === initialOrderId);
    if (match) {
      setSelected(match);
      setStep("acks");
    }
  }, [initialOrderId, selected, state]);

  const hashValidationError = useMemo(
    () => validatePhysicalHandoffAckHashes(providerAckHash, buyerAckHash),
    [buyerAckHash, providerAckHash]
  );

  async function hashAckLabel(label: string, role: "provider" | "buyer") {
    const trimmed = label.trim();
    if (!trimmed) {
      setErrorMessage("Enter acknowledgment text before hashing.");
      return;
    }
    const hash = await sha256Hex(trimmed);
    if (role === "provider") {
      setProviderAckHash(hash);
    } else {
      setBuyerAckHash(hash);
    }
    setStatusMessage(`${role === "provider" ? "Provider" : "Buyer"} ack hash generated.`);
    setErrorMessage(null);
  }

  async function hashNotes() {
    const trimmed = notesText.trim();
    if (!trimmed) {
      setErrorMessage("Enter handoff notes before hashing.");
      return;
    }
    setNotesHash(await sha256Hex(trimmed));
    setStatusMessage("Notes hash generated.");
    setErrorMessage(null);
  }

  function applyStagingImport() {
    const result = parseHandoffAckStaging(stagingImport);
    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }
    const { staging } = result;
    if (selected && staging.orderId !== selected.orderId) {
      setErrorMessage("Staging orderId does not match the selected order.");
      return;
    }
    if (staging.partyRole === "provider") {
      setProviderAckHash(staging.ackHash);
      if (staging.ackLabel) {
        setProviderAckLabel(staging.ackLabel);
      }
    } else {
      setBuyerAckHash(staging.ackHash);
      if (staging.ackLabel) {
        setBuyerAckLabel(staging.ackLabel);
      }
    }
    setStatusMessage(`Imported ${staging.partyRole} ack staging.`);
    setErrorMessage(null);
  }

  const providerStagingQr = useMemo(() => {
    if (!selected || !providerAckHash.trim()) {
      return "";
    }
    return serializeHandoffAckStaging(
      buildHandoffAckStaging({
        orderId: selected.orderId,
        milestoneId: selected.activeMilestoneId ?? "m1",
        partyRole: "provider",
        ackHash: providerAckHash,
        ackLabel: providerAckLabel || undefined
      })
    );
  }, [providerAckHash, providerAckLabel, selected]);

  async function submitDelivery(queueOnly: boolean) {
    const session = loadActiveSession();
    if (!session || !selected?.activeMilestoneId) {
      return;
    }
    if (session.publicKeyHex !== selected.exchange.providerPubKey) {
      setErrorMessage("Only the provider may submit physical-handoff delivery.");
      return;
    }
    if (hashValidationError) {
      setErrorMessage(hashValidationError);
      return;
    }
    if (!notesHash.trim()) {
      setErrorMessage("Generate a notes hash before submitting delivery.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const baseUrl = resolveNodeClientBaseUrl();
      const client = new NodeClient({ baseUrl });
      const policyVersion = await resolvePolicyVersion(client);
      const unsigned = buildPhysicalHandoffDeliveryUnsigned({
        authorPubKey: session.publicKeyHex,
        orderId: selected.orderId,
        milestoneId: selected.activeMilestoneId,
        providerAckHash,
        buyerAckHash,
        notesHash,
        orderReferenceEventId: selected.exchange.orderReferenceEventId,
        policyVersion
      });
      const signed = await signUnsignedEnvelope(unsigned, session.secretKeyHex);

      if (queueOnly) {
        enqueueHandoffSignedEvent({
          label: "Physical handoff delivery",
          orderId: selected.orderId,
          milestoneId: selected.activeMilestoneId,
          signed
        });
        setStatusMessage("Delivery queued locally — submit from the queue when online.");
        return;
      }

      const result = await client.submitSignedEnvelope(signed);
      if (result.accepted) {
        setStatusMessage("Delivery submitted — buyer may accept when ready.");
        void refresh();
      } else {
        enqueueHandoffSignedEvent({
          label: "Physical handoff delivery",
          orderId: selected.orderId,
          milestoneId: selected.activeMilestoneId,
          signed
        });
        setErrorMessage(
          `${result.message ?? "Node rejected delivery."} Signed event saved to local queue.`
        );
      }
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Delivery submit failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitAccept() {
    const session = loadActiveSession();
    if (!session || !selected?.activeMilestoneId) {
      return;
    }
    const milestone = selected.exchange.milestones.find(
      (item) => item.id === selected.activeMilestoneId
    );
    if (!milestone?.deliveryEventId) {
      setErrorMessage("Delivery must exist on-node before accept.");
      return;
    }
    if (session.publicKeyHex !== selected.exchange.buyerPubKey) {
      setErrorMessage("Only the buyer may accept this milestone.");
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      const client = new NodeClient({ baseUrl: resolveNodeClientBaseUrl() });
      const policyVersion = await resolvePolicyVersion(client);
      const unsigned = buildServiceAcceptUnsigned({
        authorPubKey: session.publicKeyHex,
        orderId: selected.orderId,
        milestoneId: milestone.id,
        deliveryReferenceEventId: milestone.deliveryEventId,
        policyVersion
      });
      const signed = await signUnsignedEnvelope(unsigned, session.secretKeyHex);
      const result = await client.submitSignedEnvelope(signed);
      if (result.accepted) {
        setStatusMessage("Milestone accepted — order may close per kernel rules.");
        void refresh();
      } else {
        setErrorMessage(result.message ?? "Accept rejected by node.");
      }
    } catch (error) {
      setErrorMessage(error instanceof NodeApiError ? error.message : "Accept failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !state) {
    return <p className="text-sm text-muted-foreground">Loading physical-handoff orders…</p>;
  }

  if (state?.kind === "signed-out") {
    return (
      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-sm text-muted-foreground">Sign in to use the in-person handoff wizard.</p>
          <Button nativeButton={false} render={<Link href="/sign-in" />}>
            Sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/35 bg-amber-500/5">
        <CardContent className="space-y-2 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-300" />
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
              Experimental lane
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Physical handoff uses dual acknowledgment hashes — not proof of item quality. Settlement
            still follows kernel evidence rules (SCN-18). This wizard does not bypass escrow or sponsor
            admission.
          </p>
          <p className="text-xs text-muted-foreground">{TRANSPORT_QR_WARNING}</p>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
          <RefreshCw className="size-4" />
          Refresh orders
        </Button>
      </div>

      {state?.kind === "error" ? (
        <p className="text-sm text-destructive">{state.message}</p>
      ) : null}

      {step === "pick" ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">1. Choose an order</h2>
          {state?.kind === "empty" ? (
            <p className="text-sm text-muted-foreground">
              No active <code>physical-handoff</code> orders found. Seed SCN-18 fixtures or publish an
              experimental offer first.
            </p>
          ) : null}
          {state?.kind === "live"
            ? state.orders.map((order) => (
                <Card key={order.orderId} className="border-border/70">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="space-y-1">
                      <p className="font-mono text-sm">{order.orderId}</p>
                      <p className="text-xs text-muted-foreground">
                        Role: {order.role} · status: {order.orderStatus}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setSelected(order);
                        setStep("acks");
                      }}
                    >
                      Start handoff
                      <ArrowRight className="size-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))
            : null}
        </section>
      ) : null}

      {step !== "pick" && selected ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">
              {step === "acks" ? "2. Capture acknowledgments" : "3. Review & submit"}
            </h2>
            <Button type="button" variant="outline" size="sm" onClick={() => setStep("pick")}>
              Change order
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-2 p-4 text-sm">
              <p>
                Order <span className="font-mono">{selected.orderId}</span> · milestone{" "}
                <span className="font-mono">{selected.activeMilestoneId ?? "—"}</span>
              </p>
              <p className="text-muted-foreground">
                Buyer {truncatePubkey(selected.exchange.buyerPubKey, 8, 8)} · Provider{" "}
                {truncatePubkey(selected.exchange.providerPubKey, 8, 8)}
              </p>
            </CardContent>
          </Card>

          {step === "acks" ? (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <AckCaptureCard
                  title="Provider acknowledgment"
                  label={providerAckLabel}
                  hash={providerAckHash}
                  onLabelChange={setProviderAckLabel}
                  onHash={() => void hashAckLabel(providerAckLabel, "provider")}
                />
                <AckCaptureCard
                  title="Buyer acknowledgment"
                  label={buyerAckLabel}
                  hash={buyerAckHash}
                  onLabelChange={setBuyerAckLabel}
                  onHash={() => void hashAckLabel(buyerAckLabel, "buyer")}
                />
              </div>

              <div className="space-y-3 rounded-xl border border-border/70 p-4">
                <Label htmlFor="handoff-notes">Handoff notes (hashed on device)</Label>
                <textarea
                  id="handoff-notes"
                  value={notesText}
                  onChange={(event) => setNotesText(event.target.value)}
                  className="min-h-[5rem] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Where/when handoff happened — never includes private keys."
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void hashNotes()}>
                    Hash notes
                  </Button>
                  {notesHash ? (
                    <p className="font-mono text-xs text-muted-foreground break-all">{notesHash}</p>
                  ) : null}
                </div>
              </div>

              {providerStagingQr ? (
                <TransportQrPanel
                  value={providerStagingQr}
                  title="Share provider ack staging"
                  description="Counterparty scans to import provider ack hash — still requires buyer ack separately."
                  mode="bundle"
                  downloadFilename="vectis-handoff-provider-ack.svg"
                />
              ) : null}

              <div className="space-y-2 rounded-xl border border-border/70 p-4">
                <Label htmlFor="staging-import">Import ack staging (paste JSON from QR)</Label>
                <textarea
                  id="staging-import"
                  value={stagingImport}
                  onChange={(event) => setStagingImport(event.target.value)}
                  className="min-h-[5rem] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs"
                />
                <Button type="button" size="sm" variant="outline" onClick={applyStagingImport}>
                  Import staging
                </Button>
              </div>

              <Button
                type="button"
                onClick={() => setStep("review")}
                disabled={Boolean(hashValidationError) || !notesHash.trim()}
              >
                Review delivery
                <ArrowRight className="size-4" />
              </Button>
            </>
          ) : null}

          {step === "review" ? (
            <>
              <Card>
                <CardContent className="space-y-3 p-4 text-sm">
                  <p className="font-medium">Delivery evidence preview</p>
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <PreviewField label="Provider ack hash" value={providerAckHash} />
                    <PreviewField label="Buyer ack hash" value={buyerAckHash} />
                    <PreviewField label="notesHash" value={notesHash} />
                    <PreviewField
                      label="evidenceFormat"
                      value="physical-handoff-ack-dual-v1"
                    />
                  </dl>
                </CardContent>
              </Card>

              {selected.canDeliver ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} onClick={() => void submitDelivery(false)}>
                    Sign & submit delivery
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void submitDelivery(true)}
                  >
                    Sign & queue offline
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Delivery submit is available to the provider when the milestone is funded.
                </p>
              )}

              {selected.canAccept ? (
                <Button type="button" variant="outline" disabled={busy} onClick={() => void submitAccept()}>
                  Buyer: accept milestone
                </Button>
              ) : null}

              <Button
                nativeButton={false}
                render={
                  <Link
                    href={`/marketplace/orders/${encodeURIComponent(selected.orderId)}`}
                  />
                }
                variant="ghost"
                size="sm"
              >
                Open order hub
              </Button>
            </>
          ) : null}
        </section>
      ) : null}

      {statusMessage ? <p className="text-sm text-primary">{statusMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

      <HandoffQueuePanel onSubmitted={() => void refresh()} />
    </div>
  );
}

function AckCaptureCard({
  title,
  label,
  hash,
  onLabelChange,
  onHash
}: {
  title: string;
  label: string;
  hash: string;
  onLabelChange: (value: string) => void;
  onHash: () => void;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-3 p-4">
        <p className="text-sm font-medium">{title}</p>
        <Input
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
          placeholder="Short ack phrase, e.g. received guitar case"
        />
        <Button type="button" size="sm" variant="outline" onClick={onHash}>
          Hash acknowledgment
        </Button>
        {hash ? <p className="font-mono text-xs break-all text-muted-foreground">{hash}</p> : null}
      </CardContent>
    </Card>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-xs break-all">{value}</dd>
    </div>
  );
}
