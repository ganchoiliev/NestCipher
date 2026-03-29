"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      setEmail("");
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        disabled={loading}
        className="flex-1 rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
          placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          transition-colors disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={loading || !email.trim()}
        className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-bg-primary
          hover:bg-accent-hover transition-colors whitespace-nowrap disabled:opacity-50"
      >
        {loading ? "Subscribing..." : "Subscribe"}
      </button>
      {success && (
        <div className="absolute mt-14 sm:mt-0 sm:ml-2 text-xs text-accent animate-pulse">
          Thanks for subscribing!
        </div>
      )}
      {error && (
        <div className="absolute mt-14 sm:mt-0 sm:ml-2 text-xs text-[#EF4444]">
          {error}
        </div>
      )}
    </form>
  );
}
