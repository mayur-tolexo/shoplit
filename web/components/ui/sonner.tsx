"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

// Brand-tinted Sonner toasts. Default cream background with ink text; the
// per-type variants (success/error/info) borrow shoplit's accent + tokens
// so toasts feel like part of the product, not a generic Sonner default.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-cream group-[.toaster]:text-ink group-[.toaster]:border group-[.toaster]:border-rule group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl",
          title: "group-[.toast]:font-serif group-[.toast]:text-base",
          description: "group-[.toast]:text-muted group-[.toast]:text-sm",
          actionButton:
            "group-[.toast]:bg-ink group-[.toast]:text-cream group-[.toast]:rounded-full group-[.toast]:px-3",
          cancelButton:
            "group-[.toast]:bg-paper group-[.toast]:text-muted group-[.toast]:rounded-full group-[.toast]:px-3",
          success:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-accent",
          error:
            "group-[.toaster]:border-l-4 group-[.toaster]:border-l-[#9B2C3E]",
          info: "group-[.toaster]:border-l-4 group-[.toaster]:border-l-ink",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
