"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { validateAsOf, validateBaseUrl } from "../lib";

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
    <section style={sectionStyle}>
      <h3 style={{ marginTop: 0, marginBottom: "0.65rem" }}>Explorer Defaults</h3>
      <p style={{ marginTop: 0, opacity: 0.85 }}>
        Persist `base_url` and `as_of`, then jump across explorer pages with the same context.
      </p>

      <label>
        base_url
        <input
          value={baseUrl}
          onChange={event => setBaseUrl(event.target.value)}
          style={baseUrlError ? invalidInputStyle : inputStyle}
          placeholder="http://127.0.0.1:7878"
        />
      </label>
      {baseUrlError ? <p style={errorTextStyle}>{baseUrlError}</p> : null}
      <label>
        as_of (optional RFC3339)
        <input
          value={asOf}
          onChange={event => setAsOf(event.target.value)}
          style={asOfError ? invalidInputStyle : inputStyle}
          placeholder="2026-03-01T00:00:00Z"
        />
      </label>
      <p style={{ marginTop: "-0.25rem", marginBottom: "0.65rem", opacity: 0.72, fontSize: "0.9rem" }}>
        Format hint: `YYYY-MM-DDTHH:MM:SSZ`
      </p>

      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.2rem" }}>
        <button
          type="button"
          style={buttonStyle}
          onClick={persistDefaults}
          disabled={Boolean(asOfError || baseUrlError)}
        >
          Save Defaults
        </button>
        <button
          type="button"
          style={buttonStyle}
          onClick={applyDefaults}
          disabled={Boolean(asOfError || baseUrlError)}
        >
          Apply to URL
        </button>
        <span style={{ opacity: 0.85, paddingTop: "0.35rem" }}>{statusText}</span>
      </div>
      {asOfError ? <p style={errorTextStyle}>{asOfError}</p> : null}
      {errorMessage ? (
        <p style={errorTextStyle}>{errorMessage}</p>
      ) : null}

      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
        {scopedLinks.map(target => (
          <Link key={target.href} href={target.href} style={linkStyle}>
            {target.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

const sectionStyle = {
  marginTop: "0.95rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.85rem",
  background: "#0d1633"
} as const;

const inputStyle = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  marginBottom: "0.55rem",
  background: "#0b122b",
  color: "#dbe7ff",
  border: "1px solid #2a3458",
  borderRadius: 8,
  padding: "0.58rem 0.7rem"
} as const;

const invalidInputStyle = {
  ...inputStyle,
  border: "1px solid #b85274"
} as const;

const buttonStyle = {
  background: "#1a2f66",
  color: "#dbe7ff",
  border: "1px solid #3651a1",
  borderRadius: 8,
  padding: "0.45rem 0.72rem",
  cursor: "pointer"
} as const;

const linkStyle = {
  display: "inline-block",
  padding: "0.38rem 0.6rem",
  borderRadius: 8,
  border: "1px solid #3558a8",
  background: "#14224a",
  color: "#cfe1ff",
  textDecoration: "none"
} as const;

const errorTextStyle = {
  marginTop: "0.55rem",
  marginBottom: 0,
  color: "#ff9aae"
} as const;
