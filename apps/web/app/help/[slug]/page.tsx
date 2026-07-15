import Link from "next/link";
import { notFound } from "next/navigation";

import { HelpDocsShell } from "@/components/help/help-docs-shell";
import { HelpOnPageNav } from "@/components/help/help-on-page-nav";
import { HELP_ARTICLES, getHelpArticle } from "@/lib/help/articles";
import { helpSectionAnchors, slugifyHelpSectionId } from "@/lib/help/section-id";

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

  const toc = helpSectionAnchors(article.sections);

  return (
    <HelpDocsShell>
      <div className="mx-auto flex w-full max-w-6xl gap-10 px-4 py-8 sm:px-8 sm:py-10 lg:px-10">
        <article className="min-w-0 flex-1">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted-foreground">
            <Link href="/help" className="transition hover:text-foreground">
              Overview
            </Link>
            <span className="mx-2 text-border">/</span>
            <span className="text-foreground">{article.title}</span>
          </nav>

          <header className="mb-8 space-y-2 border-b border-border/70 pb-8">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{article.title}</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {article.summary}
            </p>
          </header>

          <div className="space-y-10">
            {article.sections.map((section) => (
              <section
                key={section.heading}
                id={slugifyHelpSectionId(section.heading)}
                className="scroll-mt-24 space-y-3"
              >
                <h2 className="text-lg font-semibold tracking-tight">{section.heading}</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
                {section.bullets?.length ? (
                  <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
                    {section.bullets.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>
        </article>

        <HelpOnPageNav entries={toc} />
      </div>
    </HelpDocsShell>
  );
}
