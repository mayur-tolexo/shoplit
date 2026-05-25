import Link from "next/link";
import { MarketingNav } from "@/components/marketing-nav";
import { Footer } from "@/components/footer";

export default function NotFound() {
  return (
    <>
      <MarketingNav />
      <main className="mx-auto max-w-md px-4 sm:px-6 py-24 text-center">
        <h1 className="font-serif text-4xl mb-3">Not found</h1>
        <p className="text-muted mb-8">This page doesn&apos;t exist or was removed.</p>
        <Link href="/" className="inline-flex rounded-full bg-ink text-cream px-5 py-2.5 font-medium hover:opacity-90">
          ← Back to shoplit
        </Link>
      </main>
      <Footer />
    </>
  );
}
