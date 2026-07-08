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
  hasParam,
  QueryParams,
  toErrorMessage,
  validateAsOf,
  validateBaseUrl
} from "../lib";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";


export default async function BalanceExplorerPage() {
  const params = STATIC_QUERY_PARAMS;
  const presetLinks = [
    {
      label: "Alice Balance",
      href: buildExplorerHref("/explorer/balance", params, {
        id: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737"
      }),
      description: "Buyer key used in marketplace fixture logs"
    },
    {
      label: "Bob Balance",
      href: buildExplorerHref("/explorer/balance", params, {
        id: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0"
      }),
      description: "Provider key used in marketplace fixture logs"
    }
  ];
  const baseUrl = getNodeBaseUrl(params);
  const identity = getSingleParam(params, "id");
  const identityTrimmed = identity.trim();
  const identityError =
    hasParam(params, "id") && !identityTrimmed ? "Identity pubkey is required" : null;
  const asOf = getSingleParam(params, "as_of");
  const asOfParam = getOptionalParam(params, "as_of");
  const asOfError = validateAsOf(asOfParam);
  const baseUrlInput = getSingleParam(params, "base_url");
  const baseUrlParam = getOptionalParam(params, "base_url");
  const baseUrlError = validateBaseUrl(baseUrlParam);

  let result: unknown = null;
  let error: string | null = null;
  if (baseUrlError) {
    error = baseUrlError;
  } else if (asOfError) {
    error = asOfError;
  } else if (identityError) {
    error = identityError;
  } else if (identityTrimmed) {
    try {
      const client = new NodeClient({ baseUrl });
      result = await client.getBalance(identityTrimmed, asOfParam);
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  return (
    <ExplorerShell title="Balance Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Query `GET /state/balance/:id` with shareable URL params.
        </p>
        <ExamplePresets items={presetLinks} />
        <form>
          <label>
            Identity Pubkey
            <input
              name="id"
              defaultValue={identity}
              style={identityError ? invalidInputStyle : inputStyle}
              placeholder="identity pubkey"
            />
          </label>
          {identityError ? <p style={fieldErrorStyle}>{identityError}</p> : null}
          <label>
            as_of (optional RFC3339)
            <input
              name="as_of"
              defaultValue={asOf}
              style={asOfError ? invalidInputStyle : inputStyle}
              placeholder="2026-03-01T00:00:00Z"
            />
          </label>
          {asOfError ? <p style={fieldErrorStyle}>{asOfError}</p> : null}
          <p style={helperTextStyle}>Format hint: `YYYY-MM-DDTHH:MM:SSZ`</p>
          <label>
            base_url (optional)
            <input
              name="base_url"
              defaultValue={baseUrlInput}
              style={baseUrlError ? invalidInputStyle : inputStyle}
              placeholder={baseUrl}
            />
          </label>
          {baseUrlError ? <p style={fieldErrorStyle}>{baseUrlError}</p> : null}
          <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap" }}>
            <button type="submit" style={buttonStyle}>
              Fetch Balance
            </button>
            <ShareUrlButton />
          </div>
        </form>
        <JsonViewer title="Balance Response" value={result} />
        {error ? (
          <pre style={{ ...jsonStyle, border: "1px solid #523041", background: "#291724" }}>{error}</pre>
        ) : null}
      </section>
    </ExplorerShell>
  );
}
