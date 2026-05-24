// web/app/connect-extension/page.tsx
"use client";

import { useEffect, useState } from "react";
import { mintExtensionToken } from "@/lib/api-client";

// The published/dev extension ID. For unpacked dev, set this to the ID Chrome
// assigns at chrome://extensions (stable per machine). Replace before publish.
const EXTENSION_ID = process.env.NEXT_PUBLIC_EXTENSION_ID ?? "";

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        sendMessage?: (id: string, msg: unknown, cb?: (resp: unknown) => void) => void;
      };
    };
  }
}

export default function ConnectExtensionPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<"working" | "handed" | "manual" | "error">("working");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    mintExtensionToken()
      .then((t) => {
        if (!alive) return;
        setToken(t);
        // Try to hand the token to the extension directly.
        const send = window.chrome?.runtime?.sendMessage;
        if (EXTENSION_ID && send) {
          try {
            send(EXTENSION_ID, { type: "shoplit-token", token: t }, () => {});
            setStatus("handed");
            return;
          } catch {
            /* fall through to manual */
          }
        }
        setStatus("manual");
      })
      .catch(() => alive && setStatus("error"));
    return () => {
      alive = false;
    };
  }, []);

  const copy = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mx-auto max-w-lg px-6 py-16">
      <h1 className="font-serif text-3xl mb-3">Connect the shoplit extension</h1>
      {status === "working" && <p className="text-muted">Generating your connection token…</p>}
      {status === "error" && (
        <p className="text-red-600">Couldn&apos;t generate a token. Make sure you&apos;re signed in and try again.</p>
      )}
      {status === "handed" && (
        <p className="text-ink">✓ Connected. You can close this tab and start adding products from any shop.</p>
      )}
      {status === "manual" && token && (
        <div className="space-y-3">
          <p className="text-muted">
            Paste this one-time code into the shoplit extension to connect it. Keep it private — it grants access to your carts.
          </p>
          <div className="flex gap-2">
            <code className="flex-1 truncate rounded-md border border-rule bg-paper px-3 py-2 text-sm">{token}</code>
            <button
              onClick={copy}
              className="rounded-md bg-ink text-cream px-4 py-2 text-sm font-medium hover:opacity-90"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
