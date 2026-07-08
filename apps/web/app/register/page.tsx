import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Generate a keypair and publish your profile to the event log. No email required."
      topRight={
        <>
          Already have a key?{" "}
          <Link href="/sign-in" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
      footer={
        <p className="text-center text-xs text-muted-foreground">
          After registration, set up a passkey vault or encrypted backup in{" "}
          <Link href="/account" className="underline underline-offset-4 hover:text-foreground">
            Account settings
          </Link>
          .
        </p>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
