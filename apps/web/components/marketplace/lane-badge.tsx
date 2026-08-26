import { Badge } from "@/components/ui/badge";
import { getLaneIcon } from "@/lib/marketplace/lane-icons";
import { formatServiceType, cn } from "@/lib/utils";

type LaneBadgeProps = {
  serviceType: string;
  className?: string;
  /** Hide the text label (icon-only). Default shows icon + label. */
  iconOnly?: boolean;
};

export function LaneBadge({ serviceType, className, iconOnly = false }: LaneBadgeProps) {
  const Icon = getLaneIcon(serviceType);
  const label = formatServiceType(serviceType);

  return (
    <Badge variant="lane" className={cn("gap-1.5", className)} title={label}>
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </Badge>
  );
}
