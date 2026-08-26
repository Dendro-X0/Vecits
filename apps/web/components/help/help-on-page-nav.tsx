"use client";

import { useEffect, useState } from "react";

import { getHelpScrollRoot } from "@/lib/help/scroll-root";
import { cn } from "@/lib/utils";

import { useHelpScrollSpy } from "@/components/help/use-help-scroll-spy";

export type HelpTocEntry = {
  id: string;
  label: string;
};

type HelpOnPageNavProps = {
  entries: HelpTocEntry[];
  className?: string;
};

function useHelpReadingProgress(enabled: boolean): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const root = getHelpScrollRoot();
    const scrollTarget: HTMLElement | Window = root instanceof HTMLElement ? root : window;

    const measure = () => {
      if (root instanceof HTMLElement) {
        const max = root.scrollHeight - root.clientHeight;
        setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, root.scrollTop / max)));
        return;
      }
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max <= 0 ? 0 : Math.min(1, Math.max(0, window.scrollY / max)));
    };

    measure();
    scrollTarget.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      scrollTarget.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [enabled]);

  return progress;
}

export function HelpOnPageNav({ entries, className }: HelpOnPageNavProps) {
  const sectionIds = entries.map((entry) => entry.id);
  const activeId = useHelpScrollSpy(sectionIds);
  const progress = useHelpReadingProgress(entries.length > 0);
  const activeIndex = Math.max(
    0,
    entries.findIndex((entry) => entry.id === activeId)
  );

  // Prefer section-index progress for the rail marker; fall back to scroll progress.
  const railProgress =
    activeId && entries.length > 1
      ? activeIndex / Math.max(entries.length - 1, 1)
      : progress;

  if (entries.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="On this page"
      className={cn("hidden w-56 shrink-0 xl:block", className)}
    >
      <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pb-8 pl-2">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            On this page
          </p>
          <span className="tabular-nums text-[10px] text-muted-foreground" aria-hidden="true">
            {Math.round(progress * 100)}%
          </span>
        </div>

        <div
          className="mb-4 h-1 overflow-hidden rounded-full bg-border/70"
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <ul className="relative space-y-1 border-l border-border/70">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 h-5 w-0.5 -translate-x-px -translate-y-1/2 rounded-full bg-primary transition-[top] duration-200 ease-out"
            style={{ top: `${Math.round(railProgress * 100)}%` }}
          />
          {entries.map((entry) => {
            const active = activeId === entry.id;
            return (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "-ml-px block border-l py-1 pl-3 text-sm transition-colors",
                    active
                      ? "border-primary font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {entry.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
