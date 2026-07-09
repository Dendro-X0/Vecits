"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SettingsCategory = "profile" | "connection" | "security";

export const SETTINGS_CATEGORIES: Array<{
  id: SettingsCategory;
  label: string;
  description: string;
}> = [
  {
    id: "profile",
    label: "Profile",
    description: "How you appear in the marketplace"
  },
  {
    id: "connection",
    label: "Connection",
    description: "Your node connection status"
  },
  {
    id: "security",
    label: "Security",
    description: "Keys, backups, and session"
  }
];

export function SettingsCategoryNav({
  active,
  onChange
}: {
  active: SettingsCategory;
  onChange: (category: SettingsCategory) => void;
}) {
  return (
    <nav className="space-y-1">
      {SETTINGS_CATEGORIES.map((category) => {
        const selected = active === category.id;
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onChange(category.id)}
            className={cn(
              "w-full rounded-xl border px-4 py-3 text-left transition",
              selected
                ? "border-primary/30 bg-primary/10"
                : "border-transparent hover:border-border hover:bg-muted/50"
            )}
          >
            <p className="text-sm font-medium">{category.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{category.description}</p>
          </button>
        );
      })}
    </nav>
  );
}

export function SettingsSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1">
      <div className="border-b border-border px-1 pb-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

export function SettingsRow({
  icon: Icon,
  title,
  description,
  children,
  badge
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-start">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/60">
            <Icon className="h-4 w-4 text-primary" />
          </span>
          <p className="font-medium">{title}</p>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? <div className="min-w-0 space-y-3">{children}</div> : null}
    </div>
  );
}
