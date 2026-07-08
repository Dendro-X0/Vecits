import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p>
          Vectis is an open coordination protocol. This official client is one marketplace on that
          protocol — communities can run their own stores and apps.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/explorer" className="transition hover:text-foreground">
            Kernel explorer
          </Link>
          <Link href="/dashboard/settings" className="transition hover:text-foreground">
            Settings
          </Link>
          <Link href="/sign-in" className="transition hover:text-foreground">
            Sign in
          </Link>
          <Link href="/register" className="transition hover:text-foreground">
            Register
          </Link>
        </div>
      </div>
    </footer>
  );
}
