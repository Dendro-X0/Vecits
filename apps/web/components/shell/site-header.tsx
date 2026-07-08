import Link from "next/link";
import { Compass, Search, Settings, UserCircle } from "lucide-react";

import { AuthStatus } from "@/components/auth/auth-status";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof Search;
}> = [
  { href: "/marketplace", label: "Marketplace", icon: Search },
  { href: "/dashboard", label: "Identity", icon: UserCircle },
  { href: "/explorer", label: "Explore", icon: Compass },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link href="/marketplace" className="group flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-sm font-bold text-primary">
              V
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">Vectis</p>
              <p className="hidden text-xs text-muted-foreground sm:block">Official marketplace client</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AuthStatus />
        </div>
      </div>
    </header>
  );
}
