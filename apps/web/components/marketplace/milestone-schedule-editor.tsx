"use client";

import type { CSSProperties } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { OrderMilestoneDraft } from "@/lib/marketplace/milestone-draft";
import { cn } from "@/lib/utils";

const fieldStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  padding: "0.55rem 0.65rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--border)",
  background: "var(--background)"
};

type MilestoneScheduleEditorProps = {
  rows: OrderMilestoneDraft[];
  guidedTerms: boolean;
  onChange: (rows: OrderMilestoneDraft[]) => void;
  onHashTerms?: () => void;
  termsHashMessage?: string | null;
};

export function MilestoneScheduleEditor({
  rows,
  guidedTerms,
  onChange,
  onHashTerms,
  termsHashMessage
}: MilestoneScheduleEditorProps) {
  function patchRow(index: number, patch: Partial<OrderMilestoneDraft>) {
    onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    onChange([
      ...rows,
      {
        milestoneId: `m${rows.length + 1}`,
        amountCredits: "100",
        evidenceFormat: rows[rows.length - 1]?.evidenceFormat ?? "artifactHash",
        deliverable: "",
        dueWindow: "",
        acceptanceCriteria: ""
      }
    ]);
  }

  function removeRow(index: number) {
    if (rows.length <= 1) {
      return;
    }
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Milestone schedule</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add phased work as separate milestones. Each row maps to an entry in the order payload.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-4" />
          Add milestone
        </Button>
      </div>

      {rows.map((row, index) => (
        <div
          key={`${row.milestoneId}-${index}`}
          className={cn(
            "space-y-3 rounded-xl border border-border/70 bg-card px-4 py-4",
            rows.length > 1 && "border-primary/20"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              Milestone {index + 1}
              {rows.length > 1 ? (
                <span className="ml-2 font-mono text-xs text-muted-foreground">{row.milestoneId}</span>
              ) : null}
            </p>
            {rows.length > 1 ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => removeRow(index)}>
                <Trash2 className="size-4" />
                Remove
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <label style={{ display: "block" }}>
              Milestone ID
              <input
                value={row.milestoneId}
                onChange={(event) => patchRow(index, { milestoneId: event.target.value })}
                style={fieldStyle}
                placeholder={`m${index + 1}`}
              />
            </label>
            <label style={{ display: "block" }}>
              Amount (credits)
              <input
                value={row.amountCredits}
                onChange={(event) => patchRow(index, { amountCredits: event.target.value })}
                style={fieldStyle}
                placeholder="100"
              />
            </label>
            <label style={{ display: "block" }}>
              Proof format
              <input
                value={row.evidenceFormat}
                onChange={(event) => patchRow(index, { evidenceFormat: event.target.value })}
                style={fieldStyle}
                placeholder="artifactHash"
              />
            </label>
          </div>

          {guidedTerms ? (
            <div className="space-y-3 border-t border-border/70 pt-3">
              <label style={{ display: "block" }}>
                Deliverable
                <textarea
                  value={row.deliverable}
                  onChange={(event) => patchRow(index, { deliverable: event.target.value })}
                  style={{ ...fieldStyle, minHeight: "4.5rem", resize: "vertical" }}
                  placeholder="What the provider will deliver for this milestone"
                />
              </label>
              <div className="grid gap-4 lg:grid-cols-2">
                <label style={{ display: "block" }}>
                  Due window
                  <input
                    value={row.dueWindow}
                    onChange={(event) => patchRow(index, { dueWindow: event.target.value })}
                    style={fieldStyle}
                    placeholder="e.g. 7 days after escrow funding or 2026-08-01T00:00:00Z"
                  />
                </label>
                <label style={{ display: "block" }}>
                  Acceptance criteria
                  <textarea
                    value={row.acceptanceCriteria}
                    onChange={(event) => patchRow(index, { acceptanceCriteria: event.target.value })}
                    style={{ ...fieldStyle, minHeight: "4.5rem", resize: "vertical" }}
                    placeholder="How the buyer verifies this milestone"
                  />
                </label>
              </div>
            </div>
          ) : null}
        </div>
      ))}

      {guidedTerms && onHashTerms ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onHashTerms}>
            Hash milestone terms
          </Button>
          {termsHashMessage ? (
            <span className="text-sm text-[var(--status-ok)]">{termsHashMessage}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
