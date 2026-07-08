"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LayoutDashboard, PenLine, Settings, Store, Wrench } from "lucide-react";

import { AuthStatus } from "@/components/auth/auth-status";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/builder", label: "Builder", icon: PenLine, exact: true },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true },
  { href: "/dashboard/settings/advanced", label: "Advanced", icon: Wrench, exact: true }
] as const;

function pageTitle(pathname: string): string {
  if (pathname.startsWith("/dashboard/settings/advanced")) {
    return "Advanced";
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return "Settings";
  }
  if (pathname.startsWith("/dashboard/builder")) {
    return "Offer builder";
  }
  return "Identity";
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = pageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
        <div className="border-b border-border px-5 py-5">
          <Link href="/marketplace" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
              V
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Vectis</p>
              <p className="text-xs text-muted-foreground">Identity</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Identity
          </p>
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-primary/10 font-medium text-foreground ring-1 ring-primary/20"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <Link
            href="/marketplace"
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            <Store className="h-4 w-4" />
            Back to marketplace
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-border px-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Identity</p>
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <AuthStatus />
          </div>
        </header>

        <nav className="flex gap-1 border-b border-border px-4 py-2 md:hidden">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
