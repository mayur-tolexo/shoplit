import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export const metadata = { title: "Terms · shoplit" };

export default function TermsPage() {
  return (
    <>
      <NavBar variant="marketing" />
      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
        <h1 className="font-serif text-4xl mb-2">Terms</h1>
        <p className="text-sm text-muted mb-8">Last updated: 2026-05-23</p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Using shoplit</h2>
        <p className="leading-relaxed text-ink">
          shoplit is a free service for creators to curate and share shoppable carts.
          By using it you agree to these terms. You can stop using it at any time and delete your account from the settings.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Your content</h2>
        <p className="leading-relaxed text-ink">
          You own the carts, product entries, descriptions and images you upload. You grant shoplit a non-exclusive license to host
          and display them on your cart&apos;s public page. Don&apos;t post anything that&apos;s illegal, abusive, or infringes someone else&apos;s rights.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Affiliate links</h2>
        <p className="leading-relaxed text-ink">
          When a follower clicks a product link on your cart, shoplit redirects them through our domain and appends affiliate tags.
          Any commission earned funds the service. This is disclosed on every public cart page and applies to all outbound links.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Our service</h2>
        <p className="leading-relaxed text-ink">
          shoplit is provided as-is. We work to keep it up and reliable but don&apos;t guarantee uninterrupted service.
          We don&apos;t sell goods ourselves; clicking through a cart takes you to a third-party retailer, governed by their own terms.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Our liability</h2>
        <p className="leading-relaxed text-ink">
          To the extent permitted by law, shoplit and its contributors are not liable for indirect or consequential losses
          arising from your use of the service. Don&apos;t rely on shoplit for anything mission-critical.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Changes to these terms</h2>
        <p className="leading-relaxed text-ink">
          We may update these terms occasionally. Material changes will be highlighted on the landing page.
          Continuing to use shoplit after a change means you accept the updated terms.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Contact</h2>
        <p className="leading-relaxed text-ink">
          Questions or disputes? Reach us via the GitHub repo&apos;s issue tracker.
        </p>
      </main>
      <Footer />
    </>
  );
}
