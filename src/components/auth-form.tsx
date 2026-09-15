"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Brand } from "./brand";
export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const errorId = "auth-form-error";
  return (
    <main id="main" className="auth-page">
      <div className="auth-aside">
        <Link href="/">
          <Brand />
        </Link>
        <h1>
          A clearer path
          <br />
          starts here.
        </h1>
        <p>
          Make a plan that fits your goals.
          <br />
          Understand the decisions behind it.
        </p>
        <div className="auth-route">
          <span>Where you are</span>
          <i />
          <span>Where you’re going</span>
        </div>
        <small>Independent planning. Official sources.</small>
      </div>
      <div className="auth-form">
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h2>{register ? "Create your account" : "Welcome back"}</h2>
        <p>
          {register
            ? "Save your courses and keep your plans in one place."
            : "Pick up where you left off."}
        </p>
        <form
          aria-busy={busy}
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            setBusy(true);
            const form = new FormData(e.currentTarget);
            const email = String(form.get("email")),
              password = String(form.get("password"));
            try {
              if (register) {
                const response = await fetch("/api/register", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: form.get("name"),
                    email,
                    password,
                  }),
                });
                const data = await response.json();
                if (!response.ok) throw Error(data.error);
              }
              const result = await signIn("credentials", {
                email,
                password,
                redirect: false,
              });
              if (result?.error)
                throw Error(
                  "Email or password was not accepted. Please try again.",
                );
              router.push("/app");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not sign in");
              setBusy(false);
            }
          }}
        >
          {register && (
            <label>
              Name
              <input name="name" autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label>
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              required
            />
          </label>
          <label>
            Password
            <input
              aria-label="Password"
              aria-invalid={Boolean(error)}
              aria-describedby={
                [
                  register ? "password-help" : undefined,
                  error ? errorId : undefined,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              name="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              minLength={register ? 12 : 1}
              maxLength={128}
              required
            />
            {register && (
              <small id="password-help">Use at least 12 characters.</small>
            )}
          </label>
          {error && (
            <p id={errorId} role="alert" className="error">
              {error}
            </p>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
            <ArrowRight size={18} />
          </button>
        </form>
        <p>
          {register ? "Already have an account?" : "New to DegreePath?"}{" "}
          <Link href={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
        <Link className="quiet-link" href="/demo">
          Just exploring? Try the public demo →
        </Link>
      </div>
    </main>
  );
}
