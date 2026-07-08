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
  QueryParams,
  toErrorMessage,
  validateAsOf,
  validateBaseUrl
} from "../lib";
import { STATIC_QUERY_PARAMS } from "@/lib/static-query-params";


export default async function MilestonesExplorerPage() {
  const params = STATIC_QUERY_PARAMS;
  const presetLinks = [
    {
      label: "Accept m1",
      href: buildExplorerHref("/explorer/milestones", params, {
        order_id: "mk-accept-order",
        milestone_id: "m1"
      }),
      description: "Accepted milestone from `fixtures/valid/marketplace-accept.jsonl`"
    },
    {
      label: "Timeout m1",
      href: buildExplorerHref("/explorer/milestones", params, {
        order_id: "mk-timeout-order",
        milestone_id: "m1"
      }),
      description: "Timeout/autorefund milestone from `fixtures/valid/marketplace-timeout-autorefund.jsonl`"
    }
  ];
  const baseUrl = getNodeBaseUrl(params);
  const orderId = getSingleParam(params, "order_id");
  const orderIdTrimmed = orderId.trim();
  const orderIdError =
    hasParam(params, "order_id") && !orderIdTrimmed ? "Order ID is required" : null;
  const milestoneId = getSingleParam(params, "milestone_id");
  const milestoneIdTrimmed = milestoneId.trim();
  const milestoneIdError =
    hasParam(params, "milestone_id") && !milestoneIdTrimmed ? "Milestone ID is required" : null;
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
  } else if (orderIdError) {
    error = orderIdError;
  } else if (milestoneIdError) {
    error = milestoneIdError;
  } else if (orderIdTrimmed && milestoneIdTrimmed) {
    try {
      const client = new NodeClient({ baseUrl });
      result = await client.getMilestone(orderIdTrimmed, milestoneIdTrimmed, asOfParam);
    } catch (caught) {
      error = toErrorMessage(caught);
    }
  }

  return (
    <ExplorerShell title="Milestone Explorer">
      <section style={panelStyle}>
        <p style={{ marginTop: 0, opacity: 0.85 }}>
          Query `GET /state/milestone/:order_id/:milestone_id` with shareable URL params.
        </p>
        <ExamplePresets items={presetLinks} />
        <form>
          <label>
            Order ID
            <input
              name="order_id"
              defaultValue={orderId}
              style={orderIdError ? invalidInputStyle : inputStyle}
              placeholder="order-1"
            />
          </label>
          {orderIdError ? <p style={fieldErrorStyle}>{orderIdError}</p> : null}
          <label>
            Milestone ID
            <input
              name="milestone_id"
              defaultValue={milestoneId}
              style={milestoneIdError ? invalidInputStyle : inputStyle}
              placeholder="m1"
            />
          </label>
          {milestoneIdError ? <p style={fieldErrorStyle}>{milestoneIdError}</p> : null}
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
              Fetch Milestone
            </button>
            <ShareUrlButton />
          </div>
        </form>
        <JsonViewer title="Milestone Response" value={result} />
        {error ? (
          <pre style={{ ...jsonStyle, border: "1px solid #523041", background: "#291724" }}>{error}</pre>
        ) : null}
      </section>
    </ExplorerShell>
  );
}
