import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

function safeNextPath(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/marketplace";
  }
  return value;
}

type SignInPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Unlock your local Ed25519 key, passkey vault, or encrypted backup."
      topRight={
        <>
          Don&apos;t have an identity?{" "}
          <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
            Register
          </Link>
        </>
      }
      footer={
        <p className="text-center text-xs text-muted-foreground">
          Prefer browsing without signing?{" "}
          <Link href="/marketplace" className="underline underline-offset-4 hover:text-foreground">
            Continue to marketplace
          </Link>
        </p>
      }
    >
      <SignInForm nextPath={nextPath} />
    </AuthShell>
  );
}
