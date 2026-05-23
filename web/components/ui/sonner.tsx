"use client";

import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-cream group-[.toaster]:text-ink group-[.toaster]:border-rule group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted",
          actionButton: "group-[.toast]:bg-ink group-[.toast]:text-cream",
          cancelButton: "group-[.toast]:bg-paper group-[.toast]:text-muted",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
