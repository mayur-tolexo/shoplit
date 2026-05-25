import type { Metadata, Viewport } from "next";
import { Fraunces, Inter, Noto_Sans_Devanagari, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/components/sw-register";
import { AppFrame } from "@/components/app-frame";
import { getCurrentUser } from "@/lib/api-client";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  display: "swap",
  variable: "--font-noto-deva",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  // metadataBase resolves relative metadata URLs — crucially the per-route
  // opengraph-image cards — to an absolute URL. Without it Next falls back to
  // http://localhost:3000, which makes every shared link's preview unfetchable.
  // In prod NEXT_PUBLIC_API_BASE_URL is the public origin (https://shoplit.in).
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000"),
  title: "shoplit",
  description: "Build a curated cart of products from Amazon, Myntra, Nykaa and more, then share it with a short URL.",
  manifest: "/manifest.webmanifest",
};

// Correct mobile scaling. user-scalable stays enabled for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#B5532A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Resolve the viewer once, globally, so AppFrame's persistent nav surfaces
  // (desktop rail + mobile tab bar) can render across the primary surfaces
  // (Carts/Discover/Feed/Add). Fail open: a logged-out visitor (or any lookup
  // error) yields null so public pages never error.
  const user = await getCurrentUser({ cookie: cookies().toString() }).catch(() => null);

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${notoDeva.variable} ${jetbrains.variable}`}>
      <body>
        <AppFrame user={user}>{children}</AppFrame>
        <Toaster position="bottom-center" richColors />
        <SwRegister />
      </body>
    </html>
  );
}
