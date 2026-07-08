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
  hasParam,
  getOptionalParam,
  getSingleParam,
  parseOptionalInt,
  QueryParams,
  toErrorMessage,
  validateAsOf,
  validateBaseUrl
} from "../lib";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";


export default async function ReputationExplorerPage() {
  const params = STATIC_QUERY_PARAMS;
  const presetLinks = [
    {
      label: "Alice (Buyer) Profile",
      href: buildExplorerHref("/explorer/reputation", params, {
        id: "d04ab232742bb4ab3a1368bd4615e4e6d0224ab71a016baf8520a332c9778737",
        lane: "software-fixes",
        limit: "20",
        cursor: undefined
      }),
      description: "Identity from `fixtures/valid/marketplace-accept.jsonl`"
    },
    {
      label: "Bob (Provider) Profile",
      href: buildExplorerHref("/explorer/reputation", params, {
        id: "a09aa5f47a6759802ff955f8dc2d2a14a5c99d23be97f864127ff9383455a4f0",
        lane: "software-fixes",
        limit: "20",
        cursor: undefined
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
  const lane = getSingleParam(params, "lane");
  const limitRaw = getSingleParam(params, "limit");
  const cursorRaw = getSingleParam(params, "cursor");

  const limitParse = parseOptionalInt(limitRaw, "limit", 1);
  const cursorParse = parseOptionalInt(cursorRaw, "cursor", 0);

  let currentResult: unknown = null;
  let historyResult: unknown = null;
  let error: string | null = null;
  if (baseUrlError) {
    error = baseUrlError;
  } else if (asOfError) {
    error = asOfError;
  } else if (identityError) {
    error = identityError;
  } else if (limitParse.error) {
    error = limitParse.error;
  } else if (cursorParse.error) {
    error = cursorParse.error;
  } else if (identityTrimmed) {
    try {
      const client = new NodeClient({ baseUrl });
      currentResult = await client.getReputation(identityTrimmed, asOfParam);
      historyResult = await client.getReputationHistory(identityTrimmed, {
        as_of: asOfParam,
        lane: lane.trim() || undefined,
        limit: limitParse.value,
        cursor: cursorParse.value
      });
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  return (
    <ExplorerShell title="Reputation Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Query `GET /state/reputation/:id` and `GET /state/reputation/:id/history`.
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
            lane (optional)
            <input
              name="lane"
              defaultValue={lane}
              style={inputStyle}
              placeholder="software-fixes"
            />
          </label>
          <label>
            limit (optional)
            <input
              name="limit"
              defaultValue={limitRaw}
              style={limitParse.error ? invalidInputStyle : inputStyle}
              placeholder="20"
            />
          </label>
          {limitParse.error ? <p style={fieldErrorStyle}>{limitParse.error}</p> : null}
          <label>
            cursor (optional)
            <input
              name="cursor"
              defaultValue={cursorRaw}
              style={cursorParse.error ? invalidInputStyle : inputStyle}
              placeholder="0"
            />
          </label>
          {cursorParse.error ? <p style={fieldErrorStyle}>{cursorParse.error}</p> : null}
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
              Fetch Reputation
            </button>
            <ShareUrlButton />
          </div>
        </form>

        <JsonViewer title="Reputation Response" value={currentResult} />
        <JsonViewer title="Reputation History Response" value={historyResult} />
        {error ? (
          <pre style={{ ...jsonStyle, border: "1px solid #523041", background: "#291724" }}>{error}</pre>
        ) : null}
      </section>
    </ExplorerShell>
  );
}
