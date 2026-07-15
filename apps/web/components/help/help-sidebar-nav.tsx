"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ChevronDown, Rocket, Scale, Shield, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { VectisLogo } from "@/components/brand/vectis-logo";
import {
  HELP_NAV_GROUPS,
  activeHelpSlug,
  flattenHelpNavItems,
  isHelpOverviewPath,
  type HelpNavGroup
} from "@/lib/help/navigation";
import { cn } from "@/lib/utils";

const GROUP_ICONS: Partial<Record<HelpNavGroup["id"], typeof BookOpen>> = {
  start: BookOpen,
  "getting-started": Rocket,
  marketplace: Scale,
  founding: Shield
};

type HelpSidebarNavProps = {
  className?: string;
  onNavigate?: () => void;
  variant?: "full" | "links";
};

export function HelpSidebarNav({ className, onNavigate, variant = "full" }: HelpSidebarNavProps) {
  const pathname = usePathname();
  const activeSlug = activeHelpSlug(pathname);
  const overviewActive = isHelpOverviewPath(pathname);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (variant !== "full") {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [variant]);

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return HELP_NAV_GROUPS;
    }
    return HELP_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(trimmed) ||
          item.summary?.toLowerCase().includes(trimmed)
      )
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <div className={cn("flex h-full flex-col", className)}>
      {variant === "full" ? (
        <div className="border-b border-border/70 px-4 py-4">
          <Link
            href="/help"
            onClick={onNavigate}
            className="mb-4 flex items-center gap-2.5 text-sm font-medium text-foreground"
          >
            <VectisLogo size="sm" framed={false} />
            <span>Vectis Help</span>
            <span className="rounded-md border border-border/70 bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              v0.1
            </span>
          </Link>
          <div className="relative">
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search guides…"
              aria-label="Search help guides"
              aria-keyshortcuts="/"
              className="h-9 bg-background/70 pr-10"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              /
            </kbd>
          </div>
        </div>
      ) : null}

      <nav aria-label="Help documentation" className="flex-1 overflow-y-auto px-3 py-4">
        {filteredGroups.map((group) => {
          const GroupIcon = GROUP_ICONS[group.id] ?? BookOpen;
          return (
            <div key={group.id} className="mb-5 last:mb-0">
              <div className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <GroupIcon className="size-3.5 shrink-0" aria-hidden="true" />
                {group.label}
              </div>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const selected =
                    item.slug === null ? overviewActive : activeSlug === item.slug;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm transition-colors",
                          selected
                            ? "bg-muted font-medium text-foreground"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                      >
                        {item.title}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {variant === "full" ? (
        <div className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5">
            <Wallet className="size-3.5" aria-hidden="true" />
            Operator and protocol docs live in the repo under{" "}
            <code className="text-foreground">/docs</code>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function HelpMobileNav() {
  const pathname = usePathname();
  const activeSlug = activeHelpSlug(pathname);
  const items = flattenHelpNavItems();
  const current =
    items.find((item) =>
      item.slug === null ? isHelpOverviewPath(pathname) : item.slug === activeSlug
    ) ?? items[0];

  return (
    <details className="group border-b border-border/70 bg-muted/20 lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>{current?.title ?? "Help guides"}</span>
        <ChevronDown className="size-4 text-muted-foreground transition group-open:rotate-180" />
      </summary>
      <div className="max-h-72 overflow-y-auto border-t border-border/70 px-2 py-2">
        <HelpSidebarNav
          variant="links"
          onNavigate={() => {
            const details = document.querySelector("details.group");
            if (details instanceof HTMLDetailsElement) {
              details.open = false;
            }
          }}
        />
      </div>
    </details>
  );
}
