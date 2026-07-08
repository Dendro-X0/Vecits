import Link from "next/link";
import type { ReactNode } from "react";

import { AuthCarousel } from "@/components/auth/auth-carousel";
import { ThemeToggle } from "@/components/theme/theme-toggle";

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  topRight?: ReactNode;
  footer?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export function AuthShell({
  title,
  subtitle,
  children,
  topRight,
  footer,
  backHref = "/marketplace",
  backLabel = "Back to marketplace"
}: AuthShellProps) {
  return (
    <main className="min-h-svh bg-background">
      <div className="grid min-h-svh grid-cols-1 lg:grid-cols-2">
        <section className="relative flex min-h-svh items-center justify-center px-6 py-12 lg:px-14">
          <div className="absolute right-4 top-4 lg:right-6 lg:top-6">
            <ThemeToggle />
          </div>

          <div className="w-full max-w-[27.5rem]">
            <div className="text-xs text-muted-foreground">
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-foreground/80 transition hover:text-foreground hover:underline"
              >
                <span aria-hidden="true">←</span>
                {backLabel}
              </Link>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <Link href="/marketplace" className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-bold text-primary">
                  V
                </span>
                <span className="text-lg font-semibold tracking-tight">Vectis</span>
              </Link>
              {topRight ? <div className="text-right text-sm text-muted-foreground">{topRight}</div> : null}
            </div>

            <div className="mt-10 space-y-2">
              <h1 className="text-balance text-3xl font-semibold tracking-tight">{title}</h1>
              <p className="text-balance text-sm text-muted-foreground">{subtitle}</p>
            </div>

            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8">{footer}</div> : null}
          </div>
        </section>

        <section className="relative hidden min-h-svh overflow-hidden bg-[#060912] lg:flex lg:flex-col dark:bg-[#060912]">
          <div
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "32px 32px"
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-sky-500/10 via-transparent to-indigo-500/10" />
          <div className="relative z-10 flex flex-1 flex-col px-12 py-14">
            <AuthCarousel />
          </div>
        </section>

        <div className="absolute left-1/2 top-0 hidden h-full w-px -translate-x-1/2 bg-border lg:block" />
      </div>
    </main>
  );
}
