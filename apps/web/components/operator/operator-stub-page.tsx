import Link from "next/link";

export default function OperatorStubPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 px-6 py-16 text-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Operator console</h1>
      <p className="text-muted-foreground">
        The full debug console is not bundled in the desktop static shell. Use Settings → Advanced
        for readiness drills and evidence export, or run the web deployment for the legacy console.
      </p>
      <Link
        href="/dashboard/settings/advanced"
        className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 font-medium text-primary-foreground"
      >
        Open advanced tools
      </Link>
    </main>
  );
}
