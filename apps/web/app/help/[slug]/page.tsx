import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { HELP_ARTICLES, getHelpArticle } from "@/lib/help/articles";

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({ slug: article.slug }));
}

export const dynamicParams = false;

type HelpArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { slug } = await params;
  const article = getHelpArticle(slug);

  if (!article) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/help"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All guides
      </Link>

      <header className="mb-8 space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{article.title}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">{article.summary}</p>
      </header>

      <div className="space-y-8">
        {article.sections.map((section) => (
          <section
            key={section.heading}
            id={slugifyHelpSectionId(section.heading)}
            className="scroll-mt-24 space-y-3"
          >
            <h2 className="text-lg font-medium">{section.heading}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            {section.bullets?.length ? (
              <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                {section.bullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </article>
  );
}

function slugifyHelpSectionId(heading: string): string {
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
