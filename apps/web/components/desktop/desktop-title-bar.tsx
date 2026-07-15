"use client";

import { DesktopWindowControls } from "@/components/desktop/desktop-window-controls";
import { VectisBrand } from "@/components/brand/vectis-brand";

export function DesktopTitleBar() {
  return (
    <header className="desktop-titlebar flex h-[var(--desktop-titlebar-height)] shrink-0 items-stretch border-b border-border/80 bg-background/95 backdrop-blur-xl">
      <div className="flex min-w-0 flex-1 items-center px-3" data-tauri-drag-region>
        <VectisBrand
          size="xs"
          tagline="Official marketplace client"
          href={undefined}
          className="min-w-0"
        />
      </div>
      <DesktopWindowControls className="h-[var(--desktop-titlebar-height)] shrink-0 border-l border-border/80 bg-muted/20" />
    </header>
  );
}
