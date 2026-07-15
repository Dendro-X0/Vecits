import Link from "next/link";

import { HelpDocsShell } from "@/components/help/help-docs-shell";
import { HELP_NAV_GROUPS } from "@/lib/help/navigation";

export default function HelpIndexPage() {
  return (
    <HelpDocsShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        <header className="space-y-3 border-b border-border/70 pb-8">
          <p className="text-sm text-muted-foreground">Vectis documentation</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Using Vectis</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Plain-language guides for the official marketplace client — deals, disputes, identity,
            node connection, and founding-network onboarding. For protocol and operator
            documentation, see the project repository under{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">/docs</code>.
          </p>
        </header>

        <div className="space-y-8">
          {HELP_NAV_GROUPS.filter((group) => group.id !== "start").map((group) => (
            <section key={group.id} className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">{group.label}</h2>
              <ul className="space-y-3">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group block rounded-xl border border-border/70 bg-card/40 px-4 py-3 transition hover:border-primary/25 hover:bg-muted/30"
                    >
                      <p className="font-medium text-foreground group-hover:text-primary">
                        {item.title}
                      </p>
                      {item.summary ? (
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {item.summary}
                        </p>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </HelpDocsShell>
  );
}
