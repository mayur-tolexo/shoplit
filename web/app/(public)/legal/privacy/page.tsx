import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export const metadata = { title: "Privacy · shoplit" };

export default function PrivacyPage() {
  return (
    <>
      <NavBar variant="marketing" />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <h1 className="font-serif text-4xl mb-2">Privacy</h1>
        <p className="text-sm text-muted mb-8">Last updated: 2026-05-23</p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What we collect</h2>
        <p className="leading-relaxed text-ink">
          When you sign in, we store your email and/or phone number, your display name and avatar, and the carts and products you create.
          When a follower opens your cart page, we record an anonymous view and click count so you can see how your link is performing.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What we don&apos;t collect</h2>
        <p className="leading-relaxed text-ink">
          We don&apos;t load third-party tracking pixels. We don&apos;t sell your data. We don&apos;t profile your followers beyond the anonymous view/click counts described above.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Cookies</h2>
        <p className="leading-relaxed text-ink">
          We use a first-party session cookie to keep you signed in, and a single anonymous visitor cookie to dedupe view counts.
          That&apos;s it — no third-party cookies.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Affiliate disclosure</h2>
        <p className="leading-relaxed text-ink">
          Outbound product links are rewritten with affiliate tags. We may earn a commission when you shop through a shoplit link.
          This funds the service and keeps it free for creators and followers.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Deleting your data</h2>
        <p className="leading-relaxed text-ink">
          From your account settings (coming soon) you can delete your account. We hard-delete your profile, your carts and products.
          Click histories are retained anonymously (no PII), which means they remain in aggregate analytics but cannot be traced back to you.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Contact</h2>
        <p className="leading-relaxed text-ink">
          Questions? Reach us via the GitHub repo&apos;s issue tracker.
        </p>
      </main>
      <Footer />
    </>
  );
}
