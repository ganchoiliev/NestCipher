"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setEmail("");
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full max-w-md mx-auto">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        className="flex-1 rounded-lg border border-border-subtle bg-bg-card px-4 py-3 text-sm text-text-primary
          placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
          transition-colors"
      />
      <button
        type="submit"
        className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-bg-primary
          hover:bg-accent-hover transition-colors whitespace-nowrap"
      >
        Subscribe
      </button>
      {submitted && (
        <div className="absolute mt-14 sm:mt-0 sm:ml-2 text-xs text-accent animate-pulse">
          Thanks for subscribing!
        </div>
      )}
    </form>
  );
}
