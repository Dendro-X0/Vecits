import Link from "next/link";

export type ExamplePreset = {
  label: string;
  href: string;
  description?: string;
};

export function ExamplePresets(props: { title?: string; items: ExamplePreset[] }) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <section className="mt-4 rounded-2xl border border-border/70 bg-muted/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm font-semibold text-foreground">{props.title ?? "Example presets"}</strong>
        <span className="text-xs text-muted-foreground">{props.items.length} ready-made queries</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {props.items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex rounded-full border border-border bg-card/80 px-3 py-2 text-sm text-foreground transition hover:border-primary/20 hover:bg-muted/45"
            title={item.description}
          >
            {item.label}
          </Link>
        ))}
      </div>
      {props.items.some(item => item.description) ? (
        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {props.items.map(item =>
            item.description ? <li key={`${item.href}-hint`}>{item.label}: {item.description}</li> : null
          )}
        </ul>
      ) : null}
    </section>
  );
}
