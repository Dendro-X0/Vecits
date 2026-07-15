import Link from "next/link";
import type { ReactNode } from "react";

import { VectisLogo } from "@/components/brand/vectis-logo";
import { cn } from "@/lib/utils";

type VectisBrandProps = {
  size?: "xs" | "sm" | "md";
  tagline?: string;
  taglineClassName?: string;
  className?: string;
  href?: string;
  showWordmark?: boolean;
  trailing?: ReactNode;
};

const WORDMARK = {
  xs: { title: "text-xs", tagline: "text-[10px]" },
  sm: { title: "text-lg", tagline: "text-xs" },
  md: { title: "text-sm", tagline: "text-xs" }
} as const;

export function VectisBrand({
  size = "md",
  tagline,
  taglineClassName,
  className,
  href = "/marketplace",
  showWordmark = true,
  trailing
}: VectisBrandProps) {
  const typography = WORDMARK[size];

  const content = (
    <>
      <VectisLogo size={size} />
      {showWordmark ? (
        <div className="min-w-0">
          <p className={cn("truncate font-semibold tracking-tight", typography.title)}>Vectis</p>
          {tagline ? (
            <p className={cn("truncate text-muted-foreground", typography.tagline, taglineClassName)}>
              {tagline}
            </p>
          ) : null}
        </div>
      ) : null}
      {trailing}
    </>
  );

  const layout = cn("flex min-w-0 items-center gap-2.5", className);

  if (href) {
    return (
      <Link href={href} className={layout}>
        {content}
      </Link>
    );
  }

  return <div className={layout}>{content}</div>;
}
