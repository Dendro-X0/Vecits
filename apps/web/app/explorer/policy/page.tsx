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
  parseOptionalInt,
  QueryParams,
  toErrorMessage,
  validateAsOf,
  validateBaseUrl
} from "../lib";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";


export default async function PolicyExplorerPage() {
  const params = STATIC_QUERY_PARAMS;
  const presetLinks = [
    {
      label: "Before Policy Activation",
      href: buildExplorerHref("/explorer/policy", params, {
        as_of: "2026-03-01T12:00:00Z",
        limit: "20",
        cursor: undefined
      }),
      description: "Expected default policy before `v0-policy-1` effective time"
    },
    {
      label: "After Policy Activation",
      href: buildExplorerHref("/explorer/policy", params, {
        as_of: "2026-03-02T12:00:00Z",
        limit: "20",
        cursor: undefined
      }),
      description: "Expected `v0-policy-1` after forward `PolicyUpdate` effective time"
    }
  ];
  const baseUrl = getNodeBaseUrl(params);
  const asOf = getSingleParam(params, "as_of");
  const asOfParam = getOptionalParam(params, "as_of");
  const asOfError = validateAsOf(asOfParam);
  const baseUrlInput = getSingleParam(params, "base_url");
  const baseUrlParam = getOptionalParam(params, "base_url");
  const baseUrlError = validateBaseUrl(baseUrlParam);
  const limitRaw = getSingleParam(params, "limit");
  const cursorRaw = getSingleParam(params, "cursor");
  const limitParse = parseOptionalInt(limitRaw, "limit", 1);
  const cursorParse = parseOptionalInt(cursorRaw, "cursor", 0);

  let policyResult: unknown = null;
  let updatesResult: unknown = null;
  let error: string | null = null;

  if (baseUrlError) {
    error = baseUrlError;
  } else if (asOfError) {
    error = asOfError;
  } else if (limitParse.error) {
    error = limitParse.error;
  } else if (cursorParse.error) {
    error = cursorParse.error;
  } else {
    try {
      const client = new NodeClient({ baseUrl });
      policyResult = await client.getPolicy(asOfParam);
      updatesResult = await client.getPolicyUpdates({
        as_of: asOfParam,
        limit: limitParse.value,
        cursor: cursorParse.value
      });
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  return (
    <ExplorerShell title="Policy Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Query `GET /state/policy` and `GET /state/policy/updates` with deterministic metadata.
        </p>
        <ExamplePresets items={presetLinks} />
        <form className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Context & node
            </p>
            <div className="mt-3 space-y-3">
              <label>
                As-of timestamp (optional)
                <input
                  name="as_of"
                  defaultValue={asOf}
                  style={asOfError ? invalidInputStyle : inputStyle}
                  placeholder="2026-03-02T12:00:00Z"
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

            <details className="mt-4 rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground">
                Limits & paging
              </summary>
              <div className="mt-3 space-y-3">
                <label>
                  Result limit (optional)
                  <input
                    name="limit"
                    defaultValue={limitRaw}
                    style={limitParse.error ? invalidInputStyle : inputStyle}
                    placeholder="20"
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
              Fetch Policy State
            </button>
            <ShareUrlButton />
          </div>
        </form>
        <JsonViewer title="Policy Response" value={policyResult} />
        <JsonViewer title="Policy Updates Response" value={updatesResult} />
        {error ? (
          <pre style={{ ...jsonStyle, border: "1px solid #523041", background: "#291724" }}>{error}</pre>
        ) : null}
      </section>
    </ExplorerShell>
  );
}
