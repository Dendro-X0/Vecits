import { NodeClient } from "@new-start/sdk-ts";

export async function resolvePolicyVersion(client: NodeClient): Promise<string | undefined> {
  const policyView = await client.getPolicy();
  const policyData = policyView.data ?? {};
  if (typeof policyData.effective_version === "string") {
    return policyData.effective_version;
  }
  if (typeof policyData.effectiveVersion === "string") {
    return policyData.effectiveVersion;
  }
  return undefined;
}
