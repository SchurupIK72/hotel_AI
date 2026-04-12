"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function SignInForm() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setErrorMessage(null);

    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form
      action={handleSubmit}
      className="form-stack"
    >
      <label className="label-stack">
        Email
        <input
          autoComplete="email"
          className="input"
          name="email"
          placeholder="manager@hotel.example"
          required
          type="email"
        />
      </label>

      <label className="label-stack">
        Password
        <input
          autoComplete="current-password"
          className="input"
          name="password"
          placeholder="Your password"
          required
          type="password"
        />
      </label>

      {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

      <button className="button" disabled={isPending} type="submit">
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
