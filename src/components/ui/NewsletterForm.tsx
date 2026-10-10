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
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full" aria-busy={loading}>
      <label
        htmlFor="newsletter-email"
        className="mb-3 block text-xs text-text-secondary"
      >
        Email address
      </label>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={loading}
          className="min-w-0 flex-1 border border-border-hover bg-bg-card min-h-[48px] px-4 py-3 text-base text-text-primary
          placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="min-h-[48px] bg-accent px-6 py-3 text-base font-medium text-on-accent
          hover:bg-accent-hover transition-colors whitespace-nowrap disabled:opacity-50"
        >
          {loading ? "Subscribing..." : "Subscribe"}
        </button>
      </div>
      {success && (
        <div role="status" className="mt-3 text-xs text-success">
          Thanks for subscribing!
        </div>
      )}
      {error && (
        <div role="alert" className="mt-3 text-xs text-danger">
          {error}
        </div>
      )}
    </form>
  );
}
