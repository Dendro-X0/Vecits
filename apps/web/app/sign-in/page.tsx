import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
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
      <SignInForm nextPath="/marketplace" />
    </AuthShell>
  );
}
