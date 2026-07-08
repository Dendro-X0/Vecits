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


export default async function IdentityExplorerPage() {
  const params = STATIC_QUERY_PARAMS;
  const presetLinks = [
    {
      label: "Alice Root",
      href: buildExplorerHref("/explorer/identity", params, {
        id: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737"
      }),
      description: "Fixture identity from `marketplace-accept.jsonl`"
    },
    {
      label: "Alice Rotated Key",
      href: buildExplorerHref("/explorer/identity", params, {
        id: "d759793bbc13a2819a827c76adb6fba8a49aee007f49f2d0992d99b825ad2c48"
      }),
      description: "Rotated identity key from `identity-rotation.jsonl`"
    },
    {
      label: "Bob",
      href: buildExplorerHref("/explorer/identity", params, {
        id: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0"
      }),
      description: "Provider identity from marketplace fixtures"
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
      result = await client.getIdentity(identityTrimmed, asOfParam);
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  return (
    <ExplorerShell title="Identity Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Query `GET /state/identity/:id` with shareable URL params.
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
              Fetch Identity
            </button>
            <ShareUrlButton />
          </div>
        </form>
        <JsonViewer title="Identity Response" value={result} />
        {error ? (
          <pre style={{ ...jsonStyle, border: "1px solid #523041", background: "#291724" }}>{error}</pre>
        ) : null}
      </section>
    </ExplorerShell>
  );
}
