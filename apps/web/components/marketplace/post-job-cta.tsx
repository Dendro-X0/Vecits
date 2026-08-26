"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { loadActiveSession } from "@/lib/auth/session";
import { cn } from "@/lib/utils";

export const POST_JOB_BUILDER_HREF = "/dashboard/builder?step=offer";
export const POST_JOB_SIGN_IN_HREF = `/sign-in?next=${encodeURIComponent(POST_JOB_BUILDER_HREF)}`;

type PostJobCtaProps = {
  size?: "default" | "sm" | "lg";
  variant?: "default" | "outline" | "secondary";
  className?: string;
  showIcon?: boolean;
};

export function PostJobCta({
  size = "default",
  variant = "default",
  className,
  showIcon = true
}: PostJobCtaProps) {
  const [href, setHref] = useState(POST_JOB_SIGN_IN_HREF);

  useEffect(() => {
    setHref(loadActiveSession() ? POST_JOB_BUILDER_HREF : POST_JOB_SIGN_IN_HREF);
  }, []);

  return (
    <Button
      nativeButton={false}
      render={<Link href={href} />}
      size={size}
      variant={variant}
      className={cn(className)}
    >
      {showIcon ? <Plus className="h-4 w-4" /> : null}
      Post a job
    </Button>
  );
}
