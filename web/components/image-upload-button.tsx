"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadImage } from "@/lib/api-client";

// One reusable photo picker used everywhere an image can be set (product add,
// product edit, cover). On iPhone `accept="image/*"` opens Camera / Photo
// Library directly. Uploads via the API and hands back the stored image URL.
export function ImageUploadButton({
  onUploaded,
  label = "📷 Add a photo",
  className,
}: {
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const [uploading, setUploading] = useState(false);

  const MAX_BYTES = 5 * 1024 * 1024; // mirrors the server's 5MB cap

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast.error("That photo is over 5MB — pick a smaller one.");
      return;
    }
    setUploading(true);
    try {
      onUploaded(await uploadImage(file));
    } catch {
      toast.error("Couldn't upload that photo — try a smaller image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <label
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-full border border-ink px-4 py-2 text-sm font-medium cursor-pointer hover:bg-paper whitespace-nowrap"
      }
    >
      {uploading ? "Uploading…" : label}
      <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={onPick} />
    </label>
  );
}
