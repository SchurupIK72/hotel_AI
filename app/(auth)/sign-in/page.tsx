import { SignInForm } from "@/components/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="centered-card-layout">
      <section className="card">
        <div className="stack">
          <p className="eyebrow">PH1-01</p>
          <h1 className="title">Staff sign in</h1>
          <p className="body-copy">
            Sign in with your hotel staff account. Tenant access is resolved on
            the server after authentication.
          </p>
        </div>
        <SignInForm />
      </section>
    </main>
  );
}

