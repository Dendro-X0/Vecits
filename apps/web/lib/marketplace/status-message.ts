export function humanizeMarketplaceError(error: string | undefined): string {
  if (!error) {
    return "The marketplace could not reach your node. Start vectis-node or check kernel connection settings, then refresh this page.";
  }

  const normalized = error.toLowerCase();
  if (normalized.includes("fetch failed") || normalized.includes("failed to fetch")) {
    return "The marketplace could not reach your node. Start vectis-node or verify the node URL in Settings, then refresh this page.";
  }
  if (normalized.includes("econnrefused") || normalized.includes("connection refused")) {
    return "Nothing is listening at the configured node address. Start your node, then try again.";
  }
  if (normalized.includes("base_url") || normalized.includes("base url")) {
    return "The node URL in your connection settings looks invalid. Open Settings and correct the kernel connection URL.";
  }

  return error;
}
