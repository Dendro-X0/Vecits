import type { CSSProperties } from "react";

export const legacyPanelStyle: CSSProperties = {
  marginTop: "1rem",
  border: "1px solid var(--surface-inset-border)",
  borderRadius: 12,
  padding: "1rem 1.1rem",
  background: "var(--surface-inset)",
  color: "var(--surface-inset-foreground)"
};

export const legacyInputStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  marginBottom: "0.65rem",
  background: "var(--surface-code)",
  color: "var(--surface-code-foreground)",
  border: "1px solid var(--surface-inset-border)",
  borderRadius: 8,
  padding: "0.58rem 0.7rem"
};

export const legacyInvalidInputStyle: CSSProperties = {
  ...legacyInputStyle,
  border: "1px solid color-mix(in oklch, var(--destructive) 55%, var(--surface-inset-border))"
};

export const legacySectionStyle: CSSProperties = {
  marginTop: "1.5rem",
  border: "1px solid var(--surface-inset-border)",
  borderRadius: 12,
  padding: "1rem 1.25rem",
  background: "var(--surface-inset)",
  color: "var(--surface-inset-foreground)"
};

export const legacyFieldStyle: CSSProperties = {
  display: "block",
  width: "100%",
  marginTop: "0.35rem",
  background: "var(--surface-code)",
  color: "var(--surface-code-foreground)",
  border: "1px solid var(--surface-inset-border)",
  borderRadius: 8,
  padding: "0.6rem 0.7rem"
};

export const legacyButtonStyle: CSSProperties = {
  background: "var(--surface-control)",
  color: "var(--surface-control-foreground)",
  border: "1px solid var(--surface-control-border)",
  borderRadius: 8,
  padding: "0.55rem 0.85rem",
  cursor: "pointer"
};

export const legacySelectedButtonStyle: CSSProperties = {
  ...legacyButtonStyle,
  border: "1px solid color-mix(in oklch, var(--primary) 45%, var(--surface-control-border))",
  background: "var(--surface-control-active)"
};

export const legacyDisabledButtonStyle: CSSProperties = {
  ...legacyButtonStyle,
  opacity: 0.6,
  cursor: "not-allowed"
};

export const legacyLinkButtonStyle: CSSProperties = {
  ...legacyButtonStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center"
};

export const legacyCodePanelStyle: CSSProperties = {
  marginTop: "1rem",
  border: "1px solid var(--surface-inset-border)",
  borderRadius: 10,
  padding: "0.75rem",
  background: "var(--surface-code)",
  color: "var(--surface-code-foreground)",
  whiteSpace: "pre-wrap"
};

export const legacyErrorPanelStyle: CSSProperties = {
  ...legacyCodePanelStyle,
  border: "1px solid color-mix(in oklch, var(--destructive) 40%, var(--surface-inset-border))",
  background: "color-mix(in oklch, var(--destructive) 8%, var(--surface-inset))"
};

export const legacySuccessPanelStyle: CSSProperties = {
  ...legacyCodePanelStyle,
  border: "1px solid color-mix(in oklch, var(--success) 35%, var(--surface-inset-border))",
  background: "color-mix(in oklch, var(--success) 10%, var(--surface-inset))"
};

export const legacyWarningPanelStyle: CSSProperties = {
  ...legacyCodePanelStyle,
  border: "1px solid color-mix(in oklch, var(--warning) 35%, var(--surface-inset-border))",
  background: "color-mix(in oklch, var(--warning) 10%, var(--surface-inset))"
};
