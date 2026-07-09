"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { validateAsOf, validateBaseUrl } from "../lib";
import {
  legacyButtonStyle,
  legacyInputStyle,
  legacyInvalidInputStyle
} from "@/lib/ui/theme-surfaces";

const BASE_URL_KEY = "new-start.explorer.base_url";
const AS_OF_KEY = "new-start.explorer.as_of";

type NavTarget = {
  href: string;
  label: string;
};

const TARGETS: NavTarget[] = [
  { href: "/explorer/offers", label: "Offers" },
  { href: "/explorer/orders", label: "Orders" },
  { href: "/explorer/milestones", label: "Milestones" },
  { href: "/explorer/reputation", label: "Reputation" },
  { href: "/explorer/discovery", label: "Discovery" },
  { href: "/explorer/identity", label: "Identity" },
  { href: "/explorer/balance", label: "Balance" },
  { href: "/explorer/policy", label: "Policy" }
];

export function ExplorerDefaultsBar() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [baseUrl, setBaseUrl] = useState(searchParams.get("base_url") ?? "");
  const [asOf, setAsOf] = useState(searchParams.get("as_of") ?? "");
  const [status, setStatus] = useState<"idle" | "saved" | "applied">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const trimmedBaseUrl = baseUrl.trim();
  const trimmedAsOf = asOf.trim();
  const baseUrlError = validateBaseUrl(trimmedBaseUrl || undefined);
  const asOfError = validateAsOf(trimmedAsOf || undefined);

  useEffect(() => {
    const qBase = searchParams.get("base_url");
    const qAsOf = searchParams.get("as_of");
    if (qBase !== null) {
      setBaseUrl(qBase);
      localStorage.setItem(BASE_URL_KEY, qBase);
    } else {
      const saved = localStorage.getItem(BASE_URL_KEY);
      if (saved !== null) {
        setBaseUrl(saved);
      }
    }

    if (qAsOf !== null) {
      setAsOf(qAsOf);
      localStorage.setItem(AS_OF_KEY, qAsOf);
    } else {
      const saved = localStorage.getItem(AS_OF_KEY);
      if (saved !== null) {
        setAsOf(saved);
      }
    }
  }, [searchParams]);

  const scopedLinks = useMemo(() => {
    return TARGETS.map(target => {
      const scoped = new URLSearchParams();
      if (trimmedBaseUrl && !baseUrlError) {
        scoped.set("base_url", trimmedBaseUrl);
      }
      if (trimmedAsOf && !asOfError) {
        scoped.set("as_of", trimmedAsOf);
      }
      const query = scoped.toString();
      return {
        ...target,
        href: query ? `${target.href}?${query}` : target.href
      };
    });
  }, [asOfError, baseUrlError, trimmedAsOf, trimmedBaseUrl]);

  function persistDefaults() {
    if (baseUrlError) {
      setErrorMessage(baseUrlError);
      return;
    }

    if (asOfError) {
      setErrorMessage(asOfError);
      return;
    }

    localStorage.setItem(BASE_URL_KEY, trimmedBaseUrl);
    localStorage.setItem(AS_OF_KEY, trimmedAsOf);
    setErrorMessage(null);
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1200);
  }

  function applyDefaults() {
    if (baseUrlError) {
      setErrorMessage(baseUrlError);
      return;
    }

    if (asOfError) {
      setErrorMessage(asOfError);
      return;
    }

    const next = new URLSearchParams(searchParams.toString());
    if (trimmedBaseUrl) {
      next.set("base_url", trimmedBaseUrl);
    } else {
      next.delete("base_url");
    }
    if (trimmedAsOf) {
      next.set("as_of", trimmedAsOf);
    } else {
      next.delete("as_of");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    setErrorMessage(null);
    setStatus("applied");
    setTimeout(() => setStatus("idle"), 1200);
  }

  const statusText = status === "saved" ? "Saved" : status === "applied" ? "Applied" : "Defaults";

  return (
    <section className="mt-4 rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Shared explorer context</h2>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Save a node URL and optional point-in-time snapshot, then carry that same context
            across every explorer surface.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          {statusText}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Node URL
            <input
              value={baseUrl}
              onChange={event => setBaseUrl(event.target.value)}
              style={baseUrlError ? invalidInputStyle : inputStyle}
              placeholder="http://127.0.0.1:7878"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            As of time (optional)
            <input
              value={asOf}
              onChange={event => setAsOf(event.target.value)}
              style={asOfError ? invalidInputStyle : inputStyle}
              placeholder="2026-03-01T00:00:00Z"
            />
          </label>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Format and behavior
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Use RFC3339 time like <code>YYYY-MM-DDTHH:MM:SSZ</code>. Saved defaults stay on this
            device; applying them updates the current URL so the view can be shared.
          </p>
        </div>
      </div>

      {baseUrlError ? <p style={errorTextStyle}>{baseUrlError}</p> : null}
      {asOfError ? <p style={errorTextStyle}>{asOfError}</p> : null}
      {errorMessage ? <p style={errorTextStyle}>{errorMessage}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          style={buttonStyle}
          onClick={persistDefaults}
          disabled={Boolean(asOfError || baseUrlError)}
        >
          Save defaults
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={applyDefaults}
          disabled={Boolean(asOfError || baseUrlError)}
        >
          Apply to URL
        </button>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Jump with this context
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {scopedLinks.map(target => (
            <Link key={target.href} href={target.href} className="inline-flex shrink-0 rounded-full border border-border bg-muted/35 px-3 py-2 text-sm text-foreground transition hover:border-primary/20 hover:bg-muted/50">
              {target.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
const inputStyle = { ...legacyInputStyle, marginBottom: "0.55rem" };
const invalidInputStyle = legacyInvalidInputStyle;
const buttonStyle = { ...legacyButtonStyle, padding: "0.45rem 0.72rem" };

const errorTextStyle = {
  marginTop: "0.55rem",
  marginBottom: 0,
  color: "var(--destructive)"
} as const;
