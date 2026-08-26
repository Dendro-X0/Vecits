import { MARKETPLACE_LANES } from "@/lib/marketplace/lanes";
import { HELP_NAV_GROUPS } from "@/lib/help/navigation";

const SETTINGS_SEARCH_CATEGORIES = [
  {
    id: "profile",
    label: "Profile",
    description: "How you appear in the marketplace"
  },
  {
    id: "connection",
    label: "Connection",
    description: "Your node connection status"
  },
  {
    id: "security",
    label: "Security",
    description: "Keys, backups, and session"
  }
] as const;

export type GlobalSearchGroupId =
  | "navigate"
  | "marketplace"
  | "workspace"
  | "settings"
  | "explore"
  | "help";

export type GlobalSearchItem = {
  id: string;
  href: string;
  title: string;
  description?: string;
  group: GlobalSearchGroupId;
  keywords?: string[];
};

export const GLOBAL_SEARCH_GROUP_LABELS: Record<GlobalSearchGroupId, string> = {
  navigate: "Navigate",
  marketplace: "Marketplace",
  workspace: "Workspace",
  settings: "Settings",
  explore: "Explore",
  help: "Help"
};

const NAVIGATE_ITEMS: GlobalSearchItem[] = [
  {
    id: "nav-marketplace",
    href: "/marketplace",
    title: "Marketplace",
    description: "Browse listings and post work",
    group: "navigate",
    keywords: ["home", "browse", "listings"]
  },
  {
    id: "nav-identity",
    href: "/dashboard",
    title: "Identity workspace",
    description: "Overview of your marketplace activity",
    group: "navigate",
    keywords: ["dashboard", "overview"]
  },
  {
    id: "nav-explore",
    href: "/explorer",
    title: "Explore",
    description: "Kernel explorer index",
    group: "navigate",
    keywords: ["explorer", "kernel"]
  },
  {
    id: "nav-help",
    href: "/help",
    title: "Help",
    description: "Documentation overview",
    group: "navigate",
    keywords: ["docs", "guides"]
  },
  {
    id: "nav-sign-in",
    href: "/sign-in",
    title: "Sign in",
    description: "Unlock your local identity",
    group: "navigate",
    keywords: ["login", "key", "auth"]
  },
  {
    id: "nav-register",
    href: "/register",
    title: "Register",
    description: "Create a local identity",
    group: "navigate",
    keywords: ["signup", "new identity"]
  }
];

const WORKSPACE_ITEMS: GlobalSearchItem[] = [
  {
    id: "ws-overview",
    href: "/dashboard",
    title: "Overview",
    description: "Role-aware activity from kernel replay",
    group: "workspace",
    keywords: ["dashboard"]
  },
  {
    id: "ws-transactions",
    href: "/dashboard/transactions",
    title: "Transactions",
    description: "Buying and selling queues",
    group: "workspace",
    keywords: ["orders", "deals"]
  },
  {
    id: "ws-builder",
    href: "/dashboard/builder?step=offer",
    title: "Publish & transact",
    description: "Guided offer, order, escrow, delivery, accept",
    group: "workspace",
    keywords: ["builder", "publish", "post", "job", "offer"]
  },
  {
    id: "ws-handoff",
    href: "/dashboard/handoff",
    title: "In-person handoff",
    description: "Physical handoff lane",
    group: "workspace",
    keywords: ["nfc", "offline", "physical"]
  },
  {
    id: "ws-import",
    href: "/dashboard/import",
    title: "Import link",
    description: "Paste, upload, or scan a transport bundle",
    group: "workspace",
    keywords: ["qr", "bundle", "transport"]
  },
  {
    id: "ws-settings",
    href: "/dashboard/settings",
    title: "Settings",
    description: "Profile, connection, and security",
    group: "workspace",
    keywords: ["preferences"]
  },
  {
    id: "ws-settings-advanced",
    href: "/dashboard/settings?advanced=1",
    title: "Advanced settings",
    description: "Operator tools and technical connection",
    group: "workspace",
    keywords: ["operator", "technical"]
  }
];

const MARKETPLACE_ITEMS: GlobalSearchItem[] = [
  {
    id: "mp-all",
    href: "/marketplace",
    title: "All listings",
    description: "Browse every active offer",
    group: "marketplace",
    keywords: ["browse"]
  },
  {
    id: "mp-mutual-aid",
    href: "/marketplace/mutual-aid",
    title: "Mutual aid",
    description: "Community maintenance shelf",
    group: "marketplace",
    keywords: ["aid", "community"]
  },
  {
    id: "mp-lanes",
    href: "/marketplace/lanes",
    title: "Lane catalog",
    description: "Pick a service lane",
    group: "marketplace",
    keywords: ["categories", "lanes"]
  },
  {
    id: "mp-post-job",
    href: "/dashboard/builder?step=offer",
    title: "Post a job",
    description: "Open the offer builder",
    group: "marketplace",
    keywords: ["publish", "offer", "create"]
  },
  ...MARKETPLACE_LANES.map((lane) => ({
    id: `mp-lane-${lane.id}`,
    href: `/marketplace/lanes/${lane.id}`,
    title: lane.label,
    description: lane.description,
    group: "marketplace" as const,
    keywords: [lane.id, "lane", "category", ...(lane.mutualAid ? ["aid"] : [])]
  }))
];

const SETTINGS_ITEMS: GlobalSearchItem[] = SETTINGS_SEARCH_CATEGORIES.map((category) => ({
  id: `settings-${category.id}`,
  href: `/dashboard/settings?category=${category.id}`,
  title: `Settings · ${category.label}`,
  description: category.description,
  group: "settings" as const,
  keywords: [category.id, "settings", "preferences"]
}));

const EXPLORE_ITEMS: GlobalSearchItem[] = [
  { id: "ex-index", href: "/explorer", title: "Explorer index", group: "explore" },
  { id: "ex-offers", href: "/explorer/offers", title: "Offers explorer", group: "explore" },
  { id: "ex-orders", href: "/explorer/orders", title: "Orders explorer", group: "explore" },
  {
    id: "ex-milestones",
    href: "/explorer/milestones",
    title: "Milestones explorer",
    group: "explore"
  },
  {
    id: "ex-reputation",
    href: "/explorer/reputation",
    title: "Reputation explorer",
    group: "explore"
  },
  {
    id: "ex-discovery",
    href: "/explorer/discovery",
    title: "Discovery explorer",
    group: "explore"
  },
  { id: "ex-identity", href: "/explorer/identity", title: "Identity explorer", group: "explore" },
  { id: "ex-balance", href: "/explorer/balance", title: "Balance explorer", group: "explore" },
  { id: "ex-policy", href: "/explorer/policy", title: "Policy explorer", group: "explore" }
].map(
  (item): GlobalSearchItem => ({
    ...item,
    group: "explore",
    description: "Kernel replay explorer",
    keywords: ["explorer", "kernel", "state"]
  })
);

const HELP_ITEMS: GlobalSearchItem[] = HELP_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    id: `help-${item.slug ?? "overview"}`,
    href: item.href,
    title: item.title,
    description: item.summary ?? `${group.label} guide`,
    group: "help" as const,
    keywords: ["help", "docs", "guide", group.id, group.label.toLowerCase()]
  }))
);

export const GLOBAL_SEARCH_ITEMS: GlobalSearchItem[] = [
  ...NAVIGATE_ITEMS,
  ...MARKETPLACE_ITEMS,
  ...WORKSPACE_ITEMS,
  ...SETTINGS_ITEMS,
  ...EXPLORE_ITEMS,
  ...HELP_ITEMS
];

const GROUP_ORDER: GlobalSearchGroupId[] = [
  "navigate",
  "marketplace",
  "workspace",
  "settings",
  "explore",
  "help"
];

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function itemMatches(item: GlobalSearchItem, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    item.title,
    item.description ?? "",
    item.href,
    ...(item.keywords ?? [])
  ]
    .join(" ")
    .toLowerCase();
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

export function filterGlobalSearchItems(query: string): GlobalSearchItem[] {
  const normalized = normalizeQuery(query);
  const matched = GLOBAL_SEARCH_ITEMS.filter((item) => itemMatches(item, normalized));
  return matched.sort(
    (left, right) => GROUP_ORDER.indexOf(left.group) - GROUP_ORDER.indexOf(right.group)
  );
}

export function groupGlobalSearchItems(
  items: GlobalSearchItem[]
): Array<{ group: GlobalSearchGroupId; label: string; items: GlobalSearchItem[] }> {
  const buckets = new Map<GlobalSearchGroupId, GlobalSearchItem[]>();
  for (const group of GROUP_ORDER) {
    buckets.set(group, []);
  }
  for (const item of items) {
    buckets.get(item.group)?.push(item);
  }
  return GROUP_ORDER.map((group) => ({
    group,
    label: GLOBAL_SEARCH_GROUP_LABELS[group],
    items: buckets.get(group) ?? []
  })).filter((entry) => entry.items.length > 0);
}
