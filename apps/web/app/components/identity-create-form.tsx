"use client";

import { RegisterForm } from "@/components/auth/register-form";

export function IdentityCreateForm() {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Identity Create (Local Sign + Submit)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Signs an <code className="text-foreground">IdentityCreate</code> event in-browser, then
          submits to <code className="text-foreground">POST /events</code>.
        </p>
      </div>
      <RegisterForm compact />
    </section>
  );
}
