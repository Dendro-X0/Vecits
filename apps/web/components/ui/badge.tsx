import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "lane" | "success" | "muted" | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default: "border-primary/25 bg-primary/10 text-primary",
  lane: "border-primary/25 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  muted: "border-border bg-muted text-muted-foreground",
  outline: "border-border bg-transparent text-muted-foreground"
};

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
