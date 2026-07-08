type AuthDividerProps = {
  label?: string;
};

export function AuthDivider({ label = "Or continue with" }: AuthDividerProps) {
  return (
    <div
      className="flex items-center gap-3 text-sm text-muted-foreground"
      role="separator"
      aria-label={label}
    >
      <div className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="shrink-0">{label}</span>
      <div className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}
