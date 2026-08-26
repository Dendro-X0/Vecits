"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Eye } from "lucide-react";

import { ListingCard } from "@/components/marketplace/listing-card";
import { LanePublishFitPanel } from "@/components/marketplace/lane-publish-fit-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  SERVICE_LANE_TEMPLATES,
  type ServiceLaneTemplate
} from "@/lib/marketplace/lane-templates";
import {
  composeUnitDefinition,
  parseUnitDefinition,
  UNIT_DEFINITION_MAX,
  type MarketplaceListing
} from "@/lib/marketplace/listings";
import { cn } from "@/lib/utils";

export type OfferCompensationMode = "credits" | "barter" | "mixed";
export type OfferFormDensity = "standard" | "advanced";

export type OfferPublishIntentId =
  | "stalled"
  | "bug"
  | "feature"
  | "testing"
  | "docs"
  | "collab";

const INTENT_CHIPS: Array<{
  id: OfferPublishIntentId;
  label: string;
  templateId: string;
  titleHint: string;
}> = [
  {
    id: "stalled",
    label: "Stalled / AI-broken",
    templateId: "project-maintenance",
    titleHint: "Unstick a vibe-coded or AI-generated project that no longer builds or ships"
  },
  {
    id: "bug",
    label: "Bug / broken feature",
    templateId: "software-fixes",
    titleHint: "Fix a specific broken feature, crash, or CI failure"
  },
  {
    id: "feature",
    label: "Small feature",
    templateId: "feature-work",
    titleHint: "Ship one bounded feature increment with clear acceptance"
  },
  {
    id: "testing",
    label: "Test / reproduce",
    templateId: "testing",
    titleHint: "Reproduce a bug and deliver a verification report"
  },
  {
    id: "docs",
    label: "Docs",
    templateId: "documentation",
    titleHint: "Rewrite setup docs or contributor guides"
  },
  {
    id: "collab",
    label: "Collaboration",
    templateId: "project-maintenance",
    titleHint: "Game mod, music, or OSS collaboration milestone"
  }
];

type OfferPublishEditorProps = {
  density: OfferFormDensity;
  onDensityChange: (density: OfferFormDensity) => void;
  offerId: string;
  onOfferIdChange: (value: string) => void;
  serviceLaneTemplateId: string;
  onServiceLaneTemplateChange: (value: string) => void;
  onResetTemplateDefaults: () => void;
  activeLaneTemplate: ServiceLaneTemplate | null;
  serviceType: string;
  onServiceTypeChange: (value: string) => void;
  unitDefinition: string;
  onUnitDefinitionChange: (value: string) => void;
  pricePerUnitCredits: string;
  onPricePerUnitCreditsChange: (value: string) => void;
  compensationMode: OfferCompensationMode;
  onCompensationModeChange: (value: OfferCompensationMode) => void;
  barterTerms: string;
  onBarterTermsChange: (value: string) => void;
  barterTags: string;
  onBarterTagsChange: (value: string) => void;
  deliveryMode: string;
  onDeliveryModeChange: (value: string) => void;
  offerExpiresAt: string;
  onOfferExpiresAtChange: (value: string) => void;
  allowedEvidenceFormats: string;
  onAllowedEvidenceFormatsChange: (value: string) => void;
  termsHash: string;
  onTermsHashChange: (value: string) => void;
  laneTemplateConstraintWarning: string | null;
  fieldStyle: CSSProperties;
  buttonStyle: CSSProperties;
};

function isDemoOfferId(value: string): boolean {
  const trimmed = value.trim().toLowerCase();
  return !trimmed || trimmed === "mk-demo-offer" || trimmed.startsWith("pm-demo-");
}

export function generateOfferId(): string {
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `offer-${stamp}-${rand}`;
}

function toDateInputValue(iso: string): string {
  const trimmed = iso.trim();
  if (!trimmed) {
    return "";
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed.slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function dateInputToOfferExpiry(dateValue: string): string {
  if (!dateValue.trim()) {
    return "";
  }
  return `${dateValue.trim()}T23:59:59.000Z`;
}

function buildPreviewListing(input: {
  offerId: string;
  serviceType: string;
  unitDefinition: string;
  pricePerUnitCredits: string;
  offerExpiresAt: string;
}): MarketplaceListing {
  const price = Number.parseInt(input.pricePerUnitCredits.trim(), 10);
  const { title, description } = parseUnitDefinition(input.unitDefinition);
  const laneLabel = input.serviceType
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return {
    offer_id: input.offerId.trim() || "preview-offer",
    provider_pub_key: "preview",
    service_type: input.serviceType.trim() || "software-fixes",
    unit_definition: input.unitDefinition.trim(),
    status: "active",
    price_per_unit_credits: Number.isFinite(price) && price > 0 ? price : 0,
    offer_expires_at: input.offerExpiresAt.trim() || new Date().toISOString(),
    global_score: 0,
    lane_score: 0,
    discovery_score: 0,
    created_event_id: "preview",
    title: title || laneLabel || "Untitled offer",
    subtitle: description || "Preview — not published yet",
    showcase: false
  };
}

export function OfferPublishEditor({
  density,
  onDensityChange,
  offerId,
  onOfferIdChange,
  serviceLaneTemplateId,
  onServiceLaneTemplateChange,
  onResetTemplateDefaults,
  activeLaneTemplate,
  serviceType,
  onServiceTypeChange,
  unitDefinition,
  onUnitDefinitionChange,
  pricePerUnitCredits,
  onPricePerUnitCreditsChange,
  compensationMode,
  onCompensationModeChange,
  barterTerms,
  onBarterTermsChange,
  barterTags,
  onBarterTagsChange,
  deliveryMode,
  onDeliveryModeChange,
  offerExpiresAt,
  onOfferExpiresAtChange,
  allowedEvidenceFormats,
  onAllowedEvidenceFormatsChange,
  termsHash,
  onTermsHashChange,
  laneTemplateConstraintWarning,
  fieldStyle,
  buttonStyle
}: OfferPublishEditorProps) {
  const [intentId, setIntentId] = useState<OfferPublishIntentId>("bug");
  const parsedUnit = useMemo(() => parseUnitDefinition(unitDefinition), [unitDefinition]);
  const [titleDraft, setTitleDraft] = useState(parsedUnit.title);
  const [descriptionDraft, setDescriptionDraft] = useState(parsedUnit.description);

  useEffect(() => {
    if (isDemoOfferId(offerId)) {
      onOfferIdChange(generateOfferId());
    }
    // Intentionally once on mount for demo cleanup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const next = parseUnitDefinition(unitDefinition);
    setTitleDraft(next.title);
    setDescriptionDraft(next.description);
  }, [unitDefinition]);

  function syncUnitDefinition(nextTitle: string, nextDescription: string) {
    setTitleDraft(nextTitle);
    setDescriptionDraft(nextDescription);
    onUnitDefinitionChange(composeUnitDefinition(nextTitle, nextDescription));
  }

  const packedLength = composeUnitDefinition(titleDraft, descriptionDraft).length;

  const previewListing = useMemo(
    () =>
      buildPreviewListing({
        offerId,
        serviceType,
        unitDefinition,
        pricePerUnitCredits,
        offerExpiresAt
      }),
    [offerId, serviceType, unitDefinition, pricePerUnitCredits, offerExpiresAt]
  );

  function applyIntent(intent: (typeof INTENT_CHIPS)[number]) {
    setIntentId(intent.id);
    onServiceLaneTemplateChange(intent.templateId);
    syncUnitDefinition(intent.titleHint, descriptionDraft);
  }

  const standardForm = (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">What kind of post is this?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick an intent — we map it to a community lane and proof defaults. Good for stalled
          projects, vibe-coding fallout, and collaboration asks.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INTENT_CHIPS.map((chip) => {
            const selected = intentId === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => applyIntent(chip)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  selected
                    ? "border-primary/40 bg-primary/10 text-foreground ring-1 ring-primary/25"
                    : "border-border bg-muted/30 text-muted-foreground hover:border-primary/25 hover:text-foreground"
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Title — what do you need?</span>
        <input
          name="offerTitle"
          value={titleDraft}
          onChange={(event) => syncUnitDefinition(event.target.value, descriptionDraft)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          placeholder="Short headline buyers will see first"
          maxLength={UNIT_DEFINITION_MAX}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Description — project requirements</span>
        <textarea
          name="offerDescription"
          value={descriptionDraft}
          onChange={(event) => syncUnitDefinition(titleDraft, event.target.value)}
          rows={5}
          className="min-h-28 w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          placeholder="Context, broken behavior, acceptance criteria, stack, links, and anything a fixer needs to take this on."
        />
        <p className="text-xs text-muted-foreground">
          Title + description share a {UNIT_DEFINITION_MAX}-character protocol field ({packedLength}/
          {UNIT_DEFINITION_MAX}).
        </p>
      </label>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">Category</span>
        <Select
          value={serviceLaneTemplateId}
          onValueChange={(value) => {
            if (!value) return;
            const keepTitle = titleDraft;
            const keepDescription = descriptionDraft;
            onServiceLaneTemplateChange(value);
            if (value === "custom") {
              if (!deliveryMode.trim()) {
                onDeliveryModeChange("artifact");
              }
              if (!allowedEvidenceFormats.trim()) {
                onAllowedEvidenceFormatsChange("artifactHash");
              }
            }
            // Templates reset unitDefinition — keep the user's title/description.
            queueMicrotask(() => {
              syncUnitDefinition(keepTitle, keepDescription);
            });
          }}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {SERVICE_LANE_TEMPLATES.filter((template) =>
              [
                "software-fixes",
                "feature-work",
                "documentation",
                "testing",
                "research",
                "project-maintenance",
                "translation"
              ].includes(template.id)
            ).map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom category</SelectItem>
          </SelectContent>
        </Select>
        {serviceLaneTemplateId === "custom" ? (
          <label className="mt-3 block space-y-1.5">
            <span className="text-sm font-medium">Custom service type</span>
            <input
              name="serviceType"
              value={serviceType}
              onChange={(event) => onServiceTypeChange(event.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
              placeholder="e.g. game-mod-collab, music-collab, web-app-rescue"
            />
            <p className="text-xs text-muted-foreground">
              Must be allowed by your node policy. Delivery defaults to artifact proof unless you
              change Advanced.
            </p>
          </label>
        ) : activeLaneTemplate ? (
          <p className="text-xs text-muted-foreground">{activeLaneTemplate.description}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Price (credits)</span>
          <input
            name="pricePerUnitCredits"
            value={pricePerUnitCredits}
            onChange={(event) => onPricePerUnitCreditsChange(event.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            placeholder="100"
            inputMode="numeric"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Offer expires</span>
          <input
            type="date"
            name="offerExpiresDate"
            value={toDateInputValue(offerExpiresAt)}
            onChange={(event) => onOfferExpiresAtChange(dateInputToOfferExpiry(event.target.value))}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Barter or non-credit note (optional)</span>
        <input
          name="barterTerms"
          value={barterTerms}
          onChange={(event) => {
            const next = event.target.value;
            onBarterTermsChange(next);
            if (next.trim()) {
              if (compensationMode === "credits") {
                onCompensationModeChange("mixed");
              }
            } else if (compensationMode !== "barter") {
              onCompensationModeChange("credits");
            }
          }}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          placeholder="Optional: design review, QA hours, or collab trade"
        />
      </label>
    </div>
  );

  const advancedForm = (
    <div className="grid gap-4 lg:grid-cols-2">
      <LanePublishFitPanel
        template={activeLaneTemplate}
        customLane={serviceLaneTemplateId === "custom"}
      />
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Offer ID
        <input
          name="offerId"
          value={offerId}
          onChange={(event) => onOfferIdChange(event.target.value)}
          style={fieldStyle}
          placeholder="offer-…"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Offer template
        <Select
          value={serviceLaneTemplateId}
          onValueChange={(value) => {
            if (!value) return;
            onServiceLaneTemplateChange(value);
          }}
        >
          <SelectTrigger className="mt-1.5 w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            {SERVICE_LANE_TEMPLATES.map((template) => (
              <SelectItem key={template.id} value={template.id}>
                {template.label}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom (manual)</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {serviceLaneTemplateId !== "custom" ? (
        <div style={{ marginBottom: "0.65rem" }}>
          <button type="button" onClick={onResetTemplateDefaults} style={buttonStyle}>
            Reset template defaults
          </button>
        </div>
      ) : null}
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Service category
        <input
          name="serviceType"
          value={serviceType}
          onChange={(event) => onServiceTypeChange(event.target.value)}
          style={fieldStyle}
          placeholder="software-fixes"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        What is being sold
        <input
          name="unitDefinition"
          value={unitDefinition}
          onChange={(event) => onUnitDefinitionChange(event.target.value)}
          style={fieldStyle}
          placeholder="fix per issue"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Price per unit
        <input
          name="pricePerUnitCredits"
          value={pricePerUnitCredits}
          onChange={(event) => onPricePerUnitCreditsChange(event.target.value)}
          style={fieldStyle}
          placeholder="100"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Compensation mode
        <Select
          value={compensationMode}
          onValueChange={(value) => {
            if (!value) return;
            onCompensationModeChange(value as OfferCompensationMode);
          }}
        >
          <SelectTrigger className="mt-1.5 w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="credits">Credits only</SelectItem>
            <SelectItem value="barter">Barter only</SelectItem>
            <SelectItem value="mixed">Mixed (credits + barter)</SelectItem>
          </SelectContent>
        </Select>
      </label>
      {compensationMode !== "credits" ? (
        <>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Barter terms
            <input
              name="barterTerms"
              value={barterTerms}
              onChange={(event) => onBarterTermsChange(event.target.value)}
              style={fieldStyle}
              placeholder="Example: one design revision plus two hours of QA support"
            />
          </label>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Barter tags (optional, comma-separated)
            <input
              name="barterTags"
              value={barterTags}
              onChange={(event) => onBarterTagsChange(event.target.value)}
              style={fieldStyle}
              placeholder="design,qa-support,community-credits"
            />
          </label>
        </>
      ) : null}
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Delivery style
        <input
          name="deliveryMode"
          value={deliveryMode}
          onChange={(event) => onDeliveryModeChange(event.target.value)}
          style={fieldStyle}
          placeholder="artifact"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Offer expires at
        <input
          name="offerExpiresAt"
          value={offerExpiresAt}
          onChange={(event) => onOfferExpiresAtChange(event.target.value)}
          style={fieldStyle}
          placeholder="2026-12-01T00:00:00Z"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Accepted proof formats (comma-separated)
        <input
          name="allowedEvidenceFormats"
          value={allowedEvidenceFormats}
          onChange={(event) => onAllowedEvidenceFormatsChange(event.target.value)}
          style={fieldStyle}
          placeholder="artifactHash,proofUrl"
        />
      </label>
      <label style={{ display: "block", marginBottom: "0.5rem" }}>
        Terms hash (optional)
        <input
          name="termsHash"
          value={termsHash}
          onChange={(event) => onTermsHashChange(event.target.value)}
          style={fieldStyle}
          placeholder="optional terms hash"
        />
      </label>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-border bg-muted/30 p-1">
          <Button
            type="button"
            size="sm"
            variant={density === "standard" ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => onDensityChange("standard")}
          >
            Standard
          </Button>
          <Button
            type="button"
            size="sm"
            variant={density === "advanced" ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => onDensityChange("advanced")}
          >
            Advanced
          </Button>
        </div>
        <Badge variant="muted" className="gap-1.5 font-normal">
          <Eye className="size-3.5" aria-hidden="true" />
          Preview updates as you type
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="space-y-4">
          <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {density === "standard"
              ? "Post a clear ask: stalled work, a broken feature, or a collaboration milestone. Protocol IDs and proof formats stay on Advanced."
              : "Full protocol fields for drills and power users. Values stay in sync with Standard."}
          </div>
          {density === "standard" ? standardForm : advancedForm}
          {laneTemplateConstraintWarning ? (
            <pre className="overflow-x-auto rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              {laneTemplateConstraintWarning}
            </pre>
          ) : null}
        </div>

        <aside className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground">Listing preview</p>
            <p className="mt-1 text-xs text-muted-foreground">
              How this post will look on Marketplace before you sign and submit.
            </p>
          </div>
          <div className="pointer-events-none select-none opacity-95" aria-hidden="true">
            <ListingCard listing={previewListing} searchParams={{}} signedIn={false} />
          </div>
        </aside>
      </div>
    </div>
  );
}
