"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  discoveryDraftImportNote,
  parseDiscoveryDraftJsonl,
  type DiscoveryOfferDraft
} from "@/lib/marketplace/discovery-draft-import";
import { cn } from "@/lib/utils";

type DiscoveryDraftImportPanelProps = {
  onImport: (draft: DiscoveryOfferDraft) => void;
  className?: string;
  variant?: "card" | "inline";
};

export function DiscoveryDraftImportPanel({
  onImport,
  className,
  variant = "card"
}: DiscoveryDraftImportPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteValue, setPasteValue] = useState("");
  const [pendingDrafts, setPendingDrafts] = useState<DiscoveryOfferDraft[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadDrafts(text: string) {
    const drafts = parseDiscoveryDraftJsonl(text);
    setPendingDrafts(drafts);
    setSelectedIndex(0);
    setError(null);
    setMessage(
      drafts.length === 1
        ? "1 draft ready to import."
        : `${drafts.length} drafts loaded — choose one to prefill the builder.`
    );
  }

  async function handleFileChange(file: File | null) {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      loadDrafts(text);
    } catch (caught) {
      setPendingDrafts([]);
      setError(caught instanceof Error ? caught.message : "Could not read draft file.");
    } finally {
      setBusy(false);
    }
  }

  function handleParsePaste() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      loadDrafts(pasteValue);
    } catch (caught) {
      setPendingDrafts([]);
      setError(caught instanceof Error ? caught.message : "Could not parse pasted JSONL.");
    } finally {
      setBusy(false);
    }
  }

  function handleImportSelected() {
    const draft = pendingDrafts[selectedIndex];
    if (!draft) {
      setError("Choose a draft to import.");
      return;
    }
    onImport(draft);
    setMessage(`Imported draft for lane ${draft.provenance.suggestedLane}.`);
    setError(null);
  }

  const shellClass =
    variant === "card"
      ? "space-y-4 rounded-xl border border-border bg-card p-4"
      : "space-y-4";

  return (
    <div className={cn(shellClass, className)}>
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Upload className="h-4 w-4 text-primary" />
          <p className="font-medium">Import a discovery draft</p>
          <Badge variant="outline">Draft ≠ live offer</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{discoveryDraftImportNote()}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discoveryDraftFile">JSONL file (`offer-drafts.jsonl`)</Label>
        <Input
          id="discoveryDraftFile"
          ref={fileInputRef}
          type="file"
          accept="application/json,.json,.jsonl"
          disabled={busy}
          onChange={(event) => {
            void handleFileChange(event.target.files?.[0] ?? null);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="discoveryDraftPaste">Or paste JSONL</Label>
        <textarea
          id="discoveryDraftPaste"
          value={pasteValue}
          onChange={(event) => setPasteValue(event.target.value)}
          rows={5}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          placeholder='{"draftKind":"ServiceOffer",...}'
        />
        <button
          type="button"
          disabled={busy || !pasteValue.trim()}
          onClick={handleParsePaste}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-3 text-sm transition hover:bg-accent disabled:opacity-60"
        >
          Parse pasted drafts
        </button>
      </div>

      {pendingDrafts.length > 0 ? (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <div className="space-y-2">
            <Label htmlFor="discoveryDraftSelect">Draft to import</Label>
            <Select
              value={String(selectedIndex)}
              onValueChange={(value) => {
                if (!value) return;
                setSelectedIndex(Number(value));
              }}
            >
              <SelectTrigger id="discoveryDraftSelect" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {pendingDrafts.map((draft, index) => (
                  <SelectItem key={`${draft.provenance.signalId}-${index}`} value={String(index)}>
                    {draft.provenance.suggestedLane} · {draft.payload.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {pendingDrafts[selectedIndex] ? (
            <div className="space-y-1 text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Classifier lane:</span>{" "}
                {pendingDrafts[selectedIndex].provenance.suggestedLane}
              </p>
              <p>
                <span className="font-medium text-foreground">Signal:</span>{" "}
                <span className="font-mono text-xs">
                  {pendingDrafts[selectedIndex].provenance.signalId.slice(0, 16)}…
                </span>
              </p>
              {pendingDrafts[selectedIndex].provenance.sourceUrl ? (
                <p className="truncate">
                  <span className="font-medium text-foreground">Source:</span>{" "}
                  {pendingDrafts[selectedIndex].provenance.sourceUrl}
                </p>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={handleImportSelected}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            Use this draft
          </button>
        </div>
      ) : null}

      {message ? (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
