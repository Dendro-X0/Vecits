"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Compass, Menu, Search, Settings, UserCircle, X } from "lucide-react";
import { useState } from "react";

import { AuthStatus } from "@/components/auth/auth-status";
import { VectisBrand } from "@/components/brand/vectis-brand";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { useDesktopShell } from "@/lib/desktop/use-desktop-shell";
import { cn } from "@/lib/utils";

const NAV_ITEMS: Array<{
  href: string;
  label: string;
  icon: typeof Search;
}> = [
  { href: "/marketplace", label: "Marketplace", icon: Search },
  { href: "/dashboard", label: "Identity", icon: UserCircle },
  { href: "/explorer", label: "Explore", icon: Compass },
  { href: "/help", label: "Help", icon: BookOpen },
  { href: "/dashboard/settings", label: "Settings", icon: Settings }
];

export function SiteHeader() {
  const pathname = usePathname();
  const desktop = useDesktopShell();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          {!desktop ? (
            <VectisBrand
              size="md"
              tagline="Official marketplace client"
              taglineClassName="hidden sm:block"
              className="group"
            />
          ) : null}

          <nav className={cn("hidden items-center gap-1 md:flex", desktop && "flex")}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  pathname.startsWith(item.href)
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="md:hidden"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-site-nav"
            onClick={() => setMobileNavOpen((previous) => !previous)}
          >
            {mobileNavOpen ? (
              <X aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Menu aria-hidden="true" className="h-4 w-4" />
            )}
          </Button>
          <ThemeToggle />
          <AuthStatus />
        </div>
      </div>
      {mobileNavOpen ? (
        <nav
          id="mobile-site-nav"
          className="border-t border-border bg-background px-4 py-3 md:hidden sm:px-6"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={`mobile-${item.href}`}
                href={item.href}
                onClick={() => setMobileNavOpen(false)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition",
                  pathname.startsWith(item.href)
                    ? "bg-primary/10 text-foreground ring-1 ring-primary/25"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon aria-hidden="true" className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}
