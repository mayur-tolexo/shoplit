"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DownloadStoryButton } from "@/components/download-story-button";

export function ShareSheet({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/c/${slug}` : `/c/${slug}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(fullUrl)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy. Long-press the link to copy manually.");
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Share your cart</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              readOnly
              value={fullUrl}
              className="flex-1 rounded-md border border-rule bg-paper px-3 py-2 text-sm font-mono"
            />
            <Button onClick={handleCopy} variant="default">
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </Button>
          </div>
          <div className="flex justify-center py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR code" width={240} height={240} className="rounded-lg border border-rule" />
          </div>
          <p className="text-center text-sm text-muted">
            Scan with a phone camera, or share the link on WhatsApp / Instagram / Twitter.
          </p>
          <div className="border-t border-rule pt-4">
            <DownloadStoryButton
              href={`/c/${slug}/story`}
              label="Download story card"
              className="w-full"
            />
            <p className="mt-2 text-center text-xs text-muted">
              Perfect for Instagram / TikTok stories.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
