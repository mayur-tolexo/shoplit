import Link from "next/link";

export function Footer({ minimal = false }: { minimal?: boolean }) {
  return (
    <footer className="border-t border-rule mt-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 text-sm text-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <p className="font-serif text-base text-ink">shoplit</p>
        <nav className="flex flex-wrap items-center gap-5">
          <Link href="/roadmap" className="hover:text-ink transition-colors">Roadmap</Link>
          <a
            href="mailto:mayur.das4@gmail.com?subject=shoplit%20feature%20request"
            className="hover:text-ink transition-colors"
          >
            Request a feature
          </a>
          <Link href="/legal/privacy" className="hover:text-ink transition-colors">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-ink transition-colors">Terms</Link>
          {!minimal && (
            <a
              href="https://github.com/mayur-tolexo/shoplit"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-ink transition-colors"
            >
              GitHub
            </a>
          )}
        </nav>
      </div>
    </footer>
  );
}
