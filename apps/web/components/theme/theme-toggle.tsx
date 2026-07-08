"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThemePreference } from "@/lib/theme";

const OPTIONS: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor }
];

type ThemeToggleProps = {
  variant?: "icon" | "segmented";
  className?: string;
};

export function ThemeToggle({ variant = "icon", className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();

  if (variant === "segmented") {
    return (
      <div className={cn("inline-flex rounded-lg border border-border bg-card p-1", className)}>
        {OPTIONS.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={preference === option.id ? "default" : "ghost"}
            size="sm"
            onClick={() => setPreference(option.id)}
            className="gap-2"
            aria-pressed={preference === option.id}
          >
            <option.icon className="h-4 w-4" />
            {option.label}
          </Button>
        ))}
      </div>
    );
  }

  const currentIndex = OPTIONS.findIndex((option) => option.id === preference);
  const next = OPTIONS[(currentIndex + 1) % OPTIONS.length];
  const Icon = OPTIONS.find((option) => option.id === preference)?.icon ?? Monitor;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={() => setPreference(next.id)}
      className={className}
      aria-label={`Theme: ${preference}. Switch to ${next.label.toLowerCase()}.`}
      title={`Theme: ${preference}`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export function ThemeSettingRow() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="space-y-3">
      <div>
        <p className="font-medium">Appearance</p>
        <p className="text-sm text-muted-foreground">
          Choose light, dark, or follow your system setting.
        </p>
      </div>
      <ThemeToggle variant="segmented" className="w-full sm:w-auto" />
      <p className="text-xs text-muted-foreground">
        Current: {OPTIONS.find((option) => option.id === preference)?.label ?? preference}
      </p>
    </div>
  );
}
