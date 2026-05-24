"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, Share, X } from "lucide-react";

// The `beforeinstallprompt` event isn't in the TS DOM lib.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "shoplit:installNudgeDismissed";

// Dismissible dashboard card nudging the creator to install shoplit on their
// phone. Android gets a native install button (beforeinstallprompt); iOS gets
// "Add to Home Screen" instructions; desktop gets a pointer to the mobile
// guide. Hides itself when already installed (standalone) or dismissed.
// Renders nothing until mounted so the server markup (none) matches the client.
export function InstallNudge() {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [platform, setPlatform] = useState<"android" | "ios" | "desktop">("desktop");
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setMounted(true);

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone || localStorage.getItem(DISMISS_KEY)) {
      setHidden(true);
      return;
    }

    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) setPlatform("android");
    else if (/iphone|ipad|ipod/i.test(ua)) setPlatform("ios");
    else setPlatform("desktop");

    const onBIP = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mounted || hidden) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const doInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setInstallEvt(null);
  };

  return (
    <div className="relative mb-8 rounded-2xl border border-rule bg-paper p-5 sm:p-6">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-muted hover:text-ink transition-colors"
      >
        <X size={18} />
      </button>
      <div className="flex items-start gap-4">
        <span
          className="grid place-items-center size-11 rounded-xl text-accent shrink-0"
          style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Smartphone size={22} />
        </span>
        <div className="flex-1 pr-6">
          <h3 className="font-serif text-xl mb-1">Add products from your phone</h3>

          {platform === "android" && (
            <>
              <p className="text-sm text-muted mb-3">
                Install shoplit, then share any product from Nykaa, Myntra, Amazon &amp; more straight into a cart.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {installEvt ? (
                  <button
                    onClick={doInstall}
                    className="rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Install app
                  </button>
                ) : (
                  <span className="text-sm text-muted">
                    Open Chrome&apos;s menu (⋮) → &ldquo;Add to Home screen&rdquo;.
                  </span>
                )}
                <Link href="/mobile" className="text-sm font-medium text-accent underline underline-offset-4 hover:opacity-80">
                  How it works
                </Link>
              </div>
            </>
          )}

          {platform === "ios" && (
            <>
              <p className="text-sm text-muted mb-3">
                Add shoplit to your Home Screen, then add products by pasting the product link.
              </p>
              <p className="text-sm inline-flex items-center gap-1.5">
                <Share size={15} className="text-accent" /> Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
              </p>
              <div className="mt-3">
                <Link href="/mobile" className="text-sm font-medium text-accent underline underline-offset-4 hover:opacity-80">
                  See the full guide →
                </Link>
              </div>
            </>
          )}

          {platform === "desktop" && (
            <>
              <p className="text-sm text-muted mb-3">
                On your phone, install shoplit to add products in one tap from any shopping app.
              </p>
              <Link
                href="/mobile"
                className="inline-block rounded-full bg-ink text-cream px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
              >
                See the mobile guide →
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
