import Link from "next/link";
import { NodeClient } from "@new-start/sdk-ts";

import {
  buttonStyle,
  ExplorerShell,
  fieldErrorStyle,
  helperTextStyle,
  inputStyle,
  invalidInputStyle,
  jsonStyle,
  panelStyle
} from "../components/explorer-shell";
import { ExamplePresets } from "../components/example-presets";
import { JsonViewer } from "../components/json-viewer";
import { ShareUrlButton } from "../components/share-url-button";
import {
  buildExplorerHref,
  getNodeBaseUrl,
  getOptionalParam,
  getSingleParam,
  parseOptionalBooleanFlag,
  parseOptionalInt,
  parseOptionalSignedInt,
  QueryParams,
  toErrorMessage,
  validateAsOf,
  validateBaseUrl
} from "../lib";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";


type DiscoveryRow = {
  offer_id: string;
  provider_pub_key: string;
  service_type: string;
  status: string;
  price_per_unit_credits: number;
  offer_expires_at: string;
  global_score: number;
  lane_score: number;
  discovery_score: number;
  created_event_id: string;
};

export default async function DiscoveryExplorerPage() {
  const params = STATIC_QUERY_PARAMS;
  const presetLinks = [
    {
      label: "Software Lanes",
      href: buildExplorerHref("/explorer/discovery", params, {
        service_type: "software-fixes",
        min_score: "0",
        alpha_defaults: "1",
        limit: "50",
        cursor: undefined
      }),
      description: "Shows active software providers with non-negative discovery score"
    },
    {
      label: "Doc/Translation Lanes",
      href: buildExplorerHref("/explorer/discovery", params, {
        service_type: "documentation",
        min_score: "-5",
        alpha_defaults: "1",
        limit: "50",
        cursor: undefined
      }),
      description: "Shows documentation lane candidates (if present in local data)"
    }
  ];

  const baseUrl = getNodeBaseUrl(params);
  const baseUrlInput = getSingleParam(params, "base_url");
  const baseUrlParam = getOptionalParam(params, "base_url");
  const baseUrlError = validateBaseUrl(baseUrlParam);

  const asOf = getSingleParam(params, "as_of");
  const asOfParam = getOptionalParam(params, "as_of");
  const asOfError = validateAsOf(asOfParam);

  const serviceType = getSingleParam(params, "service_type");
  const serviceTypeParam = getOptionalParam(params, "service_type");
  const minScoreRaw = getSingleParam(params, "min_score");
  const minScoreParse = parseOptionalSignedInt(minScoreRaw, "min_score");
  const alphaDefaultsRaw = getSingleParam(params, "alpha_defaults");
  const alphaDefaultsParse = parseOptionalBooleanFlag(alphaDefaultsRaw, "alpha_defaults");
  const limitRaw = getSingleParam(params, "limit");
  const limitParse = parseOptionalInt(limitRaw, "limit", 1);
  const cursorRaw = getSingleParam(params, "cursor");
  const cursorParse = parseOptionalInt(cursorRaw, "cursor", 0);

  let result: unknown = null;
  let discoveryRows: DiscoveryRow[] = [];
  let nextCursor: number | null = null;
  let error: string | null = null;

  if (baseUrlError) {
    error = baseUrlError;
  } else if (asOfError) {
    error = asOfError;
  } else if (minScoreParse.error) {
    error = minScoreParse.error;
  } else if (alphaDefaultsParse.error) {
    error = alphaDefaultsParse.error;
  } else if (limitParse.error) {
    error = limitParse.error;
  } else if (cursorParse.error) {
    error = cursorParse.error;
  } else {
    try {
      const client = new NodeClient({ baseUrl });
      const discoveryView = await client.getDiscovery({
        as_of: asOfParam,
        service_type: serviceTypeParam,
        min_score: minScoreParse.value,
        limit: limitParse.value,
        cursor: cursorParse.value,
        alpha_defaults: alphaDefaultsParse.value
      });
      nextCursor = discoveryView.data.next_cursor;
      discoveryRows = discoveryView.data.offers;
      result = discoveryView;
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  const nextCursorHref =
    nextCursor === null
      ? null
      : buildExplorerHref("/explorer/discovery", params, {
          service_type: serviceTypeParam,
          min_score: minScoreRaw.trim() || undefined,
          alpha_defaults: alphaDefaultsRaw.trim() || undefined,
          limit: String(limitParse.value ?? 50),
          cursor: String(nextCursor)
        });

  return (
    <ExplorerShell title="Discovery Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Query `GET /state/discovery` to rank active offers with deterministic policy-aligned
          lane filtering.
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.65rem", color: "#ffd79a", fontSize: "0.92rem" }}>
          Informational only: discovery ranking does not affect protocol validity or settlement
          rules.
        </p>
        <ExamplePresets items={presetLinks} />

        <form className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Discovery filters
            </p>
            <div className="mt-3 space-y-3">
              <label>
                Service lane filter (optional)
                <input
                  name="service_type"
                  defaultValue={serviceType}
                  style={inputStyle}
                  placeholder="software-fixes"
                />
              </label>

              <label>
                Minimum score (optional)
                <input
                  name="min_score"
                  defaultValue={minScoreRaw}
                  style={minScoreParse.error ? invalidInputStyle : inputStyle}
                  placeholder="0"
                />
              </label>
              {minScoreParse.error ? <p style={fieldErrorStyle}>{minScoreParse.error}</p> : null}

              <label>
                Alpha lane defaults (optional, default `1`)
                <input
                  name="alpha_defaults"
                  defaultValue={alphaDefaultsRaw}
                  style={alphaDefaultsParse.error ? invalidInputStyle : inputStyle}
                  placeholder="1"
                />
              </label>
              {alphaDefaultsParse.error ? <p style={fieldErrorStyle}>{alphaDefaultsParse.error}</p> : null}

              <p style={helperTextStyle}>
                `1` keeps alpha starter lanes; `0` includes all policy-allowed service lanes.
              </p>
            </div>

            <details className="mt-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Context & timing
              </summary>
              <div className="mt-3 space-y-3">
                <label>
                  As-of timestamp (optional)
                  <input
                    name="as_of"
                    defaultValue={asOf}
                    style={asOfError ? invalidInputStyle : inputStyle}
                    placeholder="2026-03-01T00:00:00Z"
                  />
                </label>
                {asOfError ? <p style={fieldErrorStyle}>{asOfError}</p> : null}
                <p style={helperTextStyle}>Use RFC3339 format: `YYYY-MM-DDTHH:MM:SSZ`</p>

                <label>
                  Node URL override (optional)
                  <input
                    name="base_url"
                    defaultValue={baseUrlInput}
                    style={baseUrlError ? invalidInputStyle : inputStyle}
                    placeholder={baseUrl}
                  />
                </label>
                {baseUrlError ? <p style={fieldErrorStyle}>{baseUrlError}</p> : null}
              </div>
            </details>

            <details className="mt-3 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Limits & paging
              </summary>
              <div className="mt-3 space-y-3">
                <label>
                  Result limit (optional, default 50)
                  <input
                    name="limit"
                    defaultValue={limitRaw}
                    style={limitParse.error ? invalidInputStyle : inputStyle}
                    placeholder="50"
                  />
                </label>
                {limitParse.error ? <p style={fieldErrorStyle}>{limitParse.error}</p> : null}

                <label>
                  Cursor offset (optional)
                  <input
                    name="cursor"
                    defaultValue={cursorRaw}
                    style={cursorParse.error ? invalidInputStyle : inputStyle}
                    placeholder="0"
                  />
                </label>
                {cursorParse.error ? <p style={fieldErrorStyle}>{cursorParse.error}</p> : null}
              </div>
            </details>
          </div>

          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", alignItems: "center" }}>
            <button type="submit" style={buttonStyle}>
              Run Discovery
            </button>
            <ShareUrlButton />
          </div>
        </form>

        <p style={{ marginTop: "0.9rem", marginBottom: "0.6rem", opacity: 0.85 }}>
          Deterministic ranking order: `discovery_score DESC`, `global_score DESC`, `lane_score
          DESC`, then `offer_id ASC`, then `provider_pub_key ASC`.
        </p>
        <p style={{ marginTop: 0, marginBottom: "0.6rem", opacity: 0.85 }}>
          Policy alignment: lane filtering is constrained to `allowed_service_types`; alpha defaults
          narrow this to initial lanes unless overridden.
        </p>
        {nextCursorHref ? (
          <p style={{ marginTop: 0, marginBottom: "0.75rem" }}>
            <Link href={nextCursorHref} style={{ color: "#9fc2ff" }}>
              Next Page
            </Link>
          </p>
        ) : null}

        {discoveryRows.length > 0 ? (
          <ol style={{ marginTop: 0, paddingLeft: "1.25rem", marginBottom: "0.5rem" }}>
            {discoveryRows.map(row => (
              <li key={`${row.offer_id}:${row.provider_pub_key}`} style={resultItemStyle}>
                <div>
                  <strong>{row.offer_id}</strong> ({row.service_type}) - score{" "}
                  <strong>{row.discovery_score}</strong>
                </div>
                <div style={{ opacity: 0.86, marginTop: "0.35rem" }}>
                  provider: {row.provider_pub_key}
                </div>
                <div style={{ opacity: 0.86 }}>
                  global: {row.global_score} | lane: {row.lane_score} | price:{" "}
                  {row.price_per_unit_credits}
                </div>
                <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.45rem" }}>
                  <Link
                    href={buildExplorerHref("/explorer/offers", params, { id: row.offer_id })}
                    style={drillLinkStyle}
                  >
                    Open Offer
                  </Link>
                  <Link
                    href={buildExplorerHref("/explorer/reputation", params, {
                      id: row.provider_pub_key,
                      lane: row.service_type,
                      limit: "20",
                      cursor: undefined
                    })}
                    style={drillLinkStyle}
                  >
                    Open Reputation
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        <JsonViewer title="Discovery Result" value={result} />
        {error ? (
          <pre style={{ ...jsonStyle, border: "1px solid #523041", background: "#291724" }}>{error}</pre>
        ) : null}
      </section>
    </ExplorerShell>
  );
}

const resultItemStyle = {
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.6rem 0.72rem",
  background: "#0d1633",
  marginBottom: "0.55rem"
} as const;

const drillLinkStyle = {
  display: "inline-block",
  padding: "0.3rem 0.54rem",
  borderRadius: 8,
  border: "1px solid #3558a8",
  background: "#14224a",
  color: "#cfe1ff",
  textDecoration: "none"
} as const;
