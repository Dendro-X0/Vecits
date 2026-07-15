import { Geist } from "next/font/google";
import type { ReactNode } from "react";

import { DesktopShell } from "@/components/desktop/desktop-shell";
import { DesktopInitScript } from "@/components/desktop/desktop-init-script";
import { ThemeInitScript } from "@/components/theme/theme-init-script";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { DesktopVaultHydrator } from "@/components/auth/desktop-vault-hydrator";
import { THEME_STORAGE_KEY } from "@/lib/theme";

import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "Vectis — Marketplace",
  description:
    "Official Vectis client for freelance work and mutual aid — browse services and settle on-protocol."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <ThemeInitScript storageKey={THEME_STORAGE_KEY} />
        <DesktopInitScript />
      </head>
      <body>
        <ThemeProvider>
          <DesktopShell>
            <DesktopVaultHydrator />
            {children}
          </DesktopShell>
        </ThemeProvider>
      </body>
    </html>
  );
}
