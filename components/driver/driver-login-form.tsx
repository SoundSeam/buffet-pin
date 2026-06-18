"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const fieldClass =
  "w-full rounded-button border border-[rgba(6,47,36,0.12)] bg-[rgba(6,47,36,0.05)] px-4 py-3.5 text-base text-[#062F24] placeholder:text-[#062F24]/35 focus:outline-none focus-visible:outline-none focus-visible:outline-0";

export default function DriverLoginForm() {
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

    const response = await fetch("/api/driver/orders", { cache: "no-store" });

    if (!response.ok) {
      setError("This Supabase account is not an active driver.");
      setLoading(false);
      return;
    }

    router.replace("/driver/orders");
    router.refresh();
  };

  return (
    <div className="w-full rounded-surface border border-[rgba(6,47,36,0.08)] bg-white p-6 shadow-sm sm:p-8">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void login();
        }}
      >
        <label className="block focus-within:shadow-none">
          <span className="mb-2 block text-[11px] font-semibold uppercase text-[#062F24]">
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
            placeholder="driver@example.com"
          />
        </label>
        <label className="block focus-within:shadow-none">
          <span className="mb-2 block text-[11px] font-semibold uppercase text-[#062F24]">
            Password
          </span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            placeholder="Password"
          />
        </label>
        {error ? (
          <p
            className="rounded-surface border border-red-900/20 bg-red-900/10 px-4 py-3 text-sm text-red-800"
            role="alert"
            aria-live="polite"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-3 rounded-button bg-[#062F24] px-6 py-4 text-base font-extrabold text-white transition-all duration-300 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? "Signing in" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
