import { desktopInitScript } from "@/lib/desktop/desktop-init-script";

export function DesktopInitScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: desktopInitScript()
      }}
    />
  );
}
