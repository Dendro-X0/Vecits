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
    <section style={containerStyle}>
      <strong>{props.title ?? "Example Presets"}</strong>
      <div style={{ display: "flex", gap: "0.55rem", flexWrap: "wrap", marginTop: "0.55rem" }}>
        {props.items.map(item => (
          <Link key={item.href} href={item.href} style={buttonStyle} title={item.description}>
            {item.label}
          </Link>
        ))}
      </div>
      {props.items.some(item => item.description) ? (
        <ul style={listStyle}>
          {props.items.map(item =>
            item.description ? <li key={`${item.href}-hint`}>{item.label}: {item.description}</li> : null
          )}
        </ul>
      ) : null}
    </section>
  );
}

const containerStyle = {
  marginTop: "0.8rem",
  border: "1px solid #2a3458",
  borderRadius: 10,
  padding: "0.75rem",
  background: "#0d1633"
} as const;

const buttonStyle = {
  display: "inline-block",
  padding: "0.38rem 0.6rem",
  borderRadius: 8,
  border: "1px solid #3558a8",
  background: "#14224a",
  color: "#cfe1ff",
  textDecoration: "none"
} as const;

const listStyle = {
  marginTop: "0.65rem",
  marginBottom: 0,
  opacity: 0.85
} as const;
