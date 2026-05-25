"use client";

import { useState } from "react";
import Link from "next/link";
import { submitFeedback } from "@/lib/api-client";
import { Lightbulb, ArrowRight } from "lucide-react";

type State = "idle" | "loading" | "success" | "error";

export default function FeedbackPage() {
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setState("loading");
    setErrorMsg("");
    try {
      await submitFeedback({
        message: message.trim(),
        name: name.trim() || undefined,
        email: email.trim() || undefined,
        page: "feedback",
        // pass hp silently — backend drops if non-empty
        ...(hp ? { hp } : {}),
      } as Parameters<typeof submitFeedback>[0] & { hp?: string });
      setState("success");
    } catch {
      setState("error");
      setErrorMsg("Something went wrong — please try again.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {/* HERO */}
        <section className="pt-16 pb-10 sm:pt-24 sm:pb-14 text-center max-w-2xl mx-auto">
          <span
            className="inline-grid place-items-center size-12 rounded-2xl text-accent mb-5"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
          >
            <Lightbulb size={22} />
          </span>
          <p className="text-sm text-accent uppercase tracking-widest font-medium mb-3">Feature requests</p>
          <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-4">
            Request a feature
          </h1>
          <p className="text-muted text-lg leading-relaxed">
            Every feature on the roadmap started as a creator&apos;s idea. Tell us
            what would make shoplit indispensable for you — we read every request.
          </p>
        </section>

        {/* FORM CARD */}
        <section className="max-w-xl mx-auto pb-24">
          <div className="rounded-2xl border border-rule bg-cream p-6 sm:p-8 shadow-sm">
            {state === "success" ? (
              <div className="text-center py-8">
                <div
                  className="inline-grid place-items-center size-14 rounded-2xl text-accent mb-4"
                  style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
                >
                  <ArrowRight size={24} />
                </div>
                <h2 className="font-serif text-2xl mb-2">Thanks — we read every request.</h2>
                <p className="text-muted mb-6">
                  Your idea is in. We&apos;ll reach out if we have follow-up questions.
                </p>
                <Link
                  href="/roadmap"
                  className="inline-flex items-center gap-2 rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  See the roadmap <ArrowRight size={14} />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
                {/* Honeypot — hidden from real users */}
                <input
                  type="text"
                  name="hp"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="message" className="text-sm font-medium text-ink">
                    What would make shoplit better for you?{" "}
                    <span className="text-accent">*</span>
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="I'd love to have…"
                    className="w-full rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-ink placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="name" className="text-sm font-medium text-ink">
                    Your name <span className="text-muted font-normal">(optional)</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Priya Sharma"
                    className="w-full rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-ink">
                    Email{" "}
                    <span className="text-muted font-normal">(optional — so we can follow up)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-rule bg-paper px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition"
                  />
                </div>

                {state === "error" && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={state === "loading" || !message.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-cream px-6 py-3 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state === "loading" ? (
                    <span className="animate-pulse">Sending…</span>
                  ) : (
                    <>
                      Send request <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>
    </div>
  );
}
