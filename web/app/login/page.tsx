"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api-client";

export default function LoginPage() {
  const [mode, setMode] = useState<"options" | "phone" | "otp">("options");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const handleGoogle = () => {
    // Full-page navigation directly to the backend so the OAuth state +
    // session cookies are set and read by the same origin (:8080). The
    // callback then redirects back to the frontend.
    window.location.href = `${API_BASE}/api/v1/auth/google`;
  };

  const sendOtp = () => {
    toast.info("Phone sign-in coming soon. Use Google for now.");
  };

  const verifyOtp = () => {
    toast.info("Phone sign-in coming soon. Use Google for now.");
  };

  return (
    <main className="min-h-screen flex flex-col">
      <div className="mx-auto max-w-6xl w-full px-4 sm:px-6 py-6">
        <Link href="/" className="font-serif text-2xl tracking-tight">shoplit</Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 pb-16">
        <div className="w-full max-w-sm">
          <div className="rounded-2xl border border-rule bg-cream p-8 shadow-sm">
            <h1 className="font-serif text-3xl mb-2 text-center">Sign in to shoplit</h1>
            <p className="text-sm text-muted text-center mb-8">Free, no card required.</p>

            {mode === "options" && (
              <div className="space-y-3">
                <button
                  onClick={handleGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-full border-2 border-ink bg-cream py-3 px-4 font-medium hover:bg-paper transition-colors"
                >
                  <GoogleGlyph />
                  Continue with Google
                </button>
                <button
                  onClick={() => setMode("phone")}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-rule bg-cream py-3 px-4 font-medium text-muted hover:text-ink hover:border-ink transition-colors"
                >
                  <Phone size={16} />
                  Continue with phone
                </button>
              </div>
            )}

            {mode === "phone" && (
              <div className="space-y-4">
                <button onClick={() => setMode("options")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeft size={14} /> Back
                </button>
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Phone number</span>
                  <div className="flex gap-2">
                    <span className="inline-flex items-center px-3 rounded-md border border-rule bg-paper text-sm">+91</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      className="flex-1 rounded-md border border-rule bg-cream px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </label>
                <button onClick={sendOtp} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
                  Send OTP
                </button>
              </div>
            )}

            {mode === "otp" && (
              <div className="space-y-4">
                <button onClick={() => setMode("phone")} className="flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeft size={14} /> Edit number
                </button>
                <p className="text-sm text-muted">We sent a 6-digit code to <strong className="text-ink">+91 {phone}</strong></p>
                <label className="block">
                  <span className="block text-sm font-medium mb-2">Enter OTP</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="123456"
                    className="w-full rounded-md border border-rule bg-cream px-3 py-3 text-center tracking-[0.5em] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </label>
                <button onClick={verifyOtp} className="w-full rounded-full bg-ink text-cream py-3 font-medium hover:opacity-90">
                  Verify and continue
                </button>
                <p className="text-xs text-muted text-center">
                  Resend in 30s · <em>Mock: any 6 digits will succeed.</em>
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted text-center mt-6">
            By continuing you agree to the <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.07 5.07 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.11A6.6 6.6 0 0 1 5.48 12c0-.74.13-1.46.36-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
    </svg>
  );
}
