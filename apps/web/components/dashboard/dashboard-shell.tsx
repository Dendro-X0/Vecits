"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeftRight, BookOpen, Handshake, LayoutDashboard, PenLine, QrCode, Settings, Store } from "lucide-react";

import { AuthStatus } from "@/components/auth/auth-status";
import { WorkspaceRoleHint } from "@/components/dashboard/workspace-role-hint";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight, exact: true }
    ]
  },
  {
    label: "Act",
    items: [
      { href: "/dashboard/builder", label: "Publish & transact", icon: PenLine, exact: true },
      { href: "/dashboard/handoff", label: "In-person handoff", icon: Handshake, exact: true }
    ]
  },
  {
    label: "Operate",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings, exact: true },
      { href: "/dashboard/import", label: "Import link", icon: QrCode, exact: true },
      { href: "/help", label: "Help", icon: BookOpen, exact: false }
    ]
  }
];

const FLAT_NAV: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

function pageMeta(pathname: string): { title: string; description: string } {
  if (pathname.startsWith("/dashboard/handoff")) {
    return {
      title: "In-person handoff",
      description:
        "Experimental physical-handoff lane — dual acknowledgment hashes, review before sign, optional offline queue."
    };
  }
  if (pathname.startsWith("/dashboard/import")) {
    return {
      title: "Import link",
      description:
        "Paste, upload, or scan a Tier 1 transport bundle. Review every field before signing — imports never auto-submit."
    };
  }
  if (pathname.startsWith("/dashboard/settings")) {
    return {
      title: "Settings",
      description:
        "Everyday preferences for identity, connection, and security — with advanced tools tucked away for operators."
    };
  }
  if (pathname.startsWith("/dashboard/builder")) {
    return {
      title: "Publish & transact",
      description:
        "Guided marketplace flow — create an offer, place an order, fund escrow, deliver work, and accept completion."
    };
  }
  if (pathname.startsWith("/dashboard/transactions")) {
    return {
      title: "Transactions",
      description:
        "Buying and selling queues — filter by role and see what needs your attention next."
    };
  }
  return {
    title: "Overview",
    description:
      "Role-aware marketplace activity from kernel replay. Credits are protocol units, not fiat money."
  };
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { title, description } = pageMeta(pathname);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex min-h-[84px] items-center border-b border-border px-5 py-4">
          <Link href="/marketplace" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
              V
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Vectis</p>
              <p className="text-xs text-muted-foreground">Identity workspace</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-5 p-3">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-1">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {group.label}
              </p>
              {group.items.map((item) => {
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
            </div>
          ))}
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
        <header className="flex min-h-[84px] items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Identity</p>
            <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex shrink-0 items-start gap-3 pt-1">
            <WorkspaceRoleHint />
            <div className="flex shrink-0 items-center gap-2">
              <ThemeToggle />
              <AuthStatus />
            </div>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 sm:px-6 md:hidden">
          {FLAT_NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
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

        <main className="flex-1">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
