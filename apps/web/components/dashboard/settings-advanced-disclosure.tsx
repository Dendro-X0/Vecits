"use client";

import { ChevronDown, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

export function SettingsAdvancedDisclosure({
  defaultOpen = false,
  children
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-12 border-t border-border pt-8">
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full items-start justify-between gap-4 rounded-xl border border-dashed border-border px-4 py-4 text-left transition hover:border-primary/25 hover:bg-muted/30"
        aria-expanded={open}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50">
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </span>
          <div>
            <p className="font-medium">Advanced settings</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Operator drills, node overrides, and legacy tools for technical users.
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? <div className="mt-6 space-y-8">{children}</div> : null}
    </section>
  );
}
