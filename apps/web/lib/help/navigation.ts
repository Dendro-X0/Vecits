import { HELP_ARTICLES, type HelpArticle, type HelpArticleCategory } from "@/lib/help/articles";

export type HelpNavGroupId = "start" | HelpArticleCategory;

export type HelpNavItem = {
  href: string;
  title: string;
  slug: string | null;
  summary?: string;
};

export type HelpNavGroup = {
  id: HelpNavGroupId;
  label: string;
  items: HelpNavItem[];
};

export function helpArticleCategory(article: HelpArticle): HelpArticleCategory {
  return article.category;
}

export const HELP_NAV_GROUPS: HelpNavGroup[] = [
  {
    id: "start",
    label: "Start",
    items: [
      {
        href: "/help",
        title: "Overview",
        slug: null,
        summary: "Documentation index and quick links"
      }
    ]
  },
  {
    id: "getting-started",
    label: "Getting started",
    items: navItemsForCategory("getting-started")
  },
  {
    id: "marketplace",
    label: "Marketplace",
    items: navItemsForCategory("marketplace")
  },
  {
    id: "founding",
    label: "Founding network",
    items: navItemsForCategory("founding")
  }
];

function navItemsForCategory(category: HelpArticleCategory): HelpNavItem[] {
  return HELP_ARTICLES.filter((article) => article.category === category).map((article) => ({
    href: `/help/${article.slug}`,
    title: article.title,
    slug: article.slug,
    summary: article.summary
  }));
}

export function flattenHelpNavItems(): HelpNavItem[] {
  return HELP_NAV_GROUPS.flatMap((group) => group.items);
}

export function isHelpOverviewPath(pathname: string): boolean {
  return pathname === "/help" || pathname === "/help/";
}

export function activeHelpSlug(pathname: string): string | null {
  if (isHelpOverviewPath(pathname)) {
    return null;
  }
  const match = pathname.match(/^\/help\/([^/]+)/);
  return match?.[1] ?? null;
}
