export const metadata = { title: "Extension Privacy · shoplit" };

export default function ExtensionPrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-6 py-16">
      <h1 className="font-serif text-4xl mb-2">shoplit browser extension — Privacy</h1>
        <p className="text-sm text-muted mb-8">Last updated: 2026-05-24</p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What the extension does</h2>
        <p className="leading-relaxed text-ink">
          The shoplit extension lets a signed-in creator add a product to one of their shoplit carts
          directly from a retailer&apos;s product page (Amazon, Myntra, Nykaa, Flipkart, AJIO).
          It has a single purpose: capturing a product you choose and saving it to your cart.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What it accesses, and when</h2>
        <p className="leading-relaxed text-ink">
          When you click the &ldquo;Add to shoplit&rdquo; button or the toolbar icon on a product page,
          the extension reads <strong>that page&apos;s</strong> product title, image, price and URL so it
          can pre-fill the add form. It only reads a page when you act on it. It does not read pages on
          other sites, and it does not track your browsing history.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What it stores</h2>
        <p className="leading-relaxed text-ink">
          A single access token (created when you connect the extension to your shoplit account) is
          stored locally in the browser&apos;s extension storage. It is used to authenticate your
          requests to the shoplit API. No browsing data is stored.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">What it sends</h2>
        <p className="leading-relaxed text-ink">
          Only when you press &ldquo;Add&rdquo;, the product details you confirmed (title, image, price,
          link, optional note) are sent to shoplit&apos;s servers (shoplit.in) to create the cart item.
          Nothing is sent in the background.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Permissions, explained</h2>
        <ul className="leading-relaxed text-ink list-disc pl-5 space-y-1">
          <li><strong>storage</strong> — keep your connection token so you stay signed in.</li>
          <li><strong>host access (retailer sites)</strong> — show the &ldquo;Add to shoplit&rdquo; button and read the product on supported shopping sites.</li>
          <li><strong>host access (shoplit.in)</strong> — call the shoplit API to list your carts and add the product.</li>
        </ul>

        <h2 className="font-serif text-2xl mt-8 mb-2">What we don&apos;t do</h2>
        <p className="leading-relaxed text-ink">
          We don&apos;t sell or share your data. We don&apos;t use third-party trackers or ad networks.
          We don&apos;t collect browsing history or analytics about the pages you visit.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Removing your data</h2>
        <p className="leading-relaxed text-ink">
          Uninstalling the extension clears the locally stored token. Carts and products you created
          live in your shoplit account and can be deleted from the shoplit dashboard.
        </p>

        <h2 className="font-serif text-2xl mt-8 mb-2">Contact</h2>
        <p className="leading-relaxed text-ink">
          Questions about this policy: <a href="mailto:mayur.das4@gmail.com" className="text-accent underline underline-offset-2">mayur.das4@gmail.com</a>.
        </p>
    </div>
  );
}
