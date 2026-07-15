import { VectisMark } from "@/components/brand/vectis-mark";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: { box: "h-5 w-5", mark: "h-3.5 w-3.5", radius: "rounded-[5px_3px_5px_3px]" },
  sm: { box: "h-8 w-8", mark: "h-5 w-5", radius: "rounded-[8px_5px_8px_5px]" },
  md: { box: "h-9 w-9", mark: "h-5 w-5", radius: "rounded-[10px_6px_10px_6px]" },
  lg: { box: "h-12 w-12", mark: "h-7 w-7", radius: "rounded-[12px_7px_12px_7px]" }
} as const;

type VectisLogoProps = {
  size?: keyof typeof SIZE;
  className?: string;
  framed?: boolean;
};

export function VectisLogo({ size = "md", className, framed = true }: VectisLogoProps) {
  const preset = SIZE[size];
  const mark = <VectisMark className={cn("shrink-0 text-cyan-400", preset.mark)} />;

  if (!framed) {
    return <span className={cn("inline-flex shrink-0 items-center justify-center", className)}>{mark}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center border border-cyan-500/20 bg-[#0a1219] ring-1 ring-cyan-500/10",
        preset.box,
        preset.radius,
        className
      )}
    >
      {mark}
    </span>
  );
}
