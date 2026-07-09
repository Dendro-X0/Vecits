import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { HELP_ARTICLES } from "@/lib/help/articles";

export default function HelpIndexPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4 text-primary" aria-hidden="true" />
          Help center
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Using Vectis</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Plain-language guides for the official marketplace client. For protocol and operator
          documentation, see the project repository under <code className="text-foreground">/docs</code>.
        </p>
      </div>

      <div className="space-y-3">
        {HELP_ARTICLES.map((article) => (
          <Card key={article.slug} className="border-border/70 transition hover:border-primary/25">
            <CardContent className="p-5">
              <Link href={`/help/${article.slug}`} className="group block space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-lg font-medium group-hover:text-primary">{article.title}</h2>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">{article.summary}</p>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
