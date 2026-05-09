"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const fieldClass =
  "w-full rounded border bg-[#F8F5EE] px-4 py-3.5 text-base text-[#062F24] placeholder:text-[#062F24]/35 focus:outline-none";

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async () => {
    if (loading) return;
    setLoading(true);
    setError("");

    const supabase = createSupabaseBrowserClient();
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    router.replace("/admin/reservations");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-md rounded bg-[#F8F5EE] p-6 shadow-2xl sm:p-8">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void login();
        }}
      >
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold text-[#062F24]">
            Email
          </span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            spellCheck={false}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
            placeholder="admin@example.com"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-[11px] font-semibold text-[#062F24]">
            Password
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            placeholder="Password…"
          />
        </label>
        {error ? (
          <p
            className="rounded border border-red-900/20 bg-red-900/10 px-4 py-3 text-sm text-red-800"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-3 rounded bg-[#C9A56A] px-6 py-3.5 text-sm font-semibold text-[#062F24] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Signing in… Sign in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
