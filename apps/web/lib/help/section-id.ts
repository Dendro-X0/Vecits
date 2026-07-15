/** Stable anchor ids for help article section headings. */
export function slugifyHelpSectionId(heading: string): string {
  const normalized = heading
    .replace(/^Step \d+ — /i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized.startsWith("file-a-contribution")) {
    return "claim";
  }
  if (normalized.startsWith("collect-attestations")) {
    return "attest";
  }
  if (normalized.startsWith("mint-credits")) {
    return "mint";
  }
  if (normalized.startsWith("fund-escrow")) {
    return "fund";
  }
  return normalized;
}

export function helpSectionAnchors(
  sections: Array<{ heading: string }>
): Array<{ id: string; label: string }> {
  return sections.map((section) => ({
    id: slugifyHelpSectionId(section.heading),
    label: section.heading
  }));
}
