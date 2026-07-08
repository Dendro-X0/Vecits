import { themeInitScript } from "@/lib/theme";

type ThemeInitScriptProps = {
  storageKey: string;
};

export function ThemeInitScript({ storageKey }: ThemeInitScriptProps) {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: themeInitScript(storageKey)
      }}
    />
  );
}
