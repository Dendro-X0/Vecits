import Link from "next/link";

import type { QueryParams } from "@/app/explorer/lib";
import { buildMarketplaceHref } from "@/lib/marketplace/node";
import { MARKETPLACE_LANES } from "@/lib/marketplace/lanes";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type CategorySidebarProps = {
  searchParams: QueryParams;
  activeLane?: string;
  activeSection?: "all" | "mutual-aid";
};

export function CategorySidebar({
  searchParams,
  activeLane,
  activeSection = "all"
}: CategorySidebarProps) {
  return (
    <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Browse
        </p>
        <div className="space-y-1">
          <SidebarLink
            href={buildMarketplaceHref("/marketplace", searchParams)}
            active={activeSection === "all" && !activeLane}
            label="All listings"
          />
          <SidebarLink
            href={buildMarketplaceHref("/marketplace/mutual-aid", searchParams)}
            active={activeSection === "mutual-aid"}
            label="Mutual aid"
          />
          <SidebarLink
            href={buildMarketplaceHref("/marketplace/lanes", searchParams)}
            active={false}
            label="Lane catalog"
          />
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Categories
        </p>
        <ScrollArea className="max-h-[min(24rem,calc(100vh-14rem))] pr-3">
          <div className="space-y-1">
            {MARKETPLACE_LANES.map((lane) => (
              <SidebarLink
                key={lane.id}
                href={buildMarketplaceHref(`/marketplace/lanes/${lane.id}`, searchParams)}
                active={activeLane === lane.id}
                label={lane.label}
                hint={lane.mutualAid ? "Aid" : undefined}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  active,
  label,
  hint
}: {
  href: string;
  active?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <span>{label}</span>
      {hint ? (
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-secondary-foreground">
          {hint}
        </span>
      ) : null}
    </Link>
  );
}
