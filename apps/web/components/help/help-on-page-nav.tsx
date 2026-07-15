"use client";

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

export function HelpOnPageNav({ entries, className }: HelpOnPageNavProps) {
  const sectionIds = entries.map((entry) => entry.id);
  const activeId = useHelpScrollSpy(sectionIds);

  if (entries.length === 0) {
    return null;
  }

  return (
    <aside
      aria-label="On this page"
      className={cn("hidden w-56 shrink-0 xl:block", className)}
    >
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pb-8 pl-2">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          On this page
        </p>
        <ul className="space-y-1 border-l border-border/70">
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
