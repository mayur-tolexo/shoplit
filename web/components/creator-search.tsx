"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import type { Creator } from "@/lib/types";
import { listCreators } from "@/lib/api-client";
import { CreatorCard } from "@/components/creator-card";

// As-you-type creator search. Owns the input AND the whole results area: an
// empty query renders the server-provided popularity list (`initialCreators`)
// with no fetch; a non-empty (trimmed) query debounces ~250ms then fetches
// `listCreators({}, { q })` from the browser (credentials:"include" sends the
// session so `isFollowing` is per-viewer). A monotonically increasing request
// id guards against out-of-order responses so fast typing never renders a
// stale result.
const DEBOUNCE_MS = 250;

const GRID = "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3";

type ResultState =
  | { kind: "initial" }
  | { kind: "loading" }
  | { kind: "results"; creators: Creator[]; query: string }
  | { kind: "error" };

export function CreatorSearch({ initialCreators }: { initialCreators: Creator[] }) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<ResultState>({ kind: "initial" });

  // Monotonic id: only the response from the most recent fetch is allowed to
  // commit. Survives re-renders without triggering effects.
  const requestId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();

    // Empty query: cancel any in-flight request (bump the id so a late
    // response is ignored) and fall back to the initial popularity list.
    if (trimmed === "") {
      requestId.current += 1;
      setState({ kind: "initial" });
      return;
    }

    const id = ++requestId.current;
    setState({ kind: "loading" });

    const timer = setTimeout(async () => {
      try {
        const creators = await listCreators({}, { q: trimmed });
        // Only the latest request commits — fast typing can't render a stale
        // (out-of-order) response.
        if (id === requestId.current) {
          setState({ kind: "results", creators, query: trimmed });
        }
      } catch {
        if (id === requestId.current) setState({ kind: "error" });
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div>
      <div className="relative mb-8 max-w-xl">
        <Search
          size={18}
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          inputMode="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search creators"
          placeholder="Search creators…"
          autoComplete="off"
          className="w-full min-h-[44px] rounded-full border border-rule bg-cream pl-11 pr-12 text-base text-ink placeholder:text-muted outline-none transition-colors focus:border-ink"
        />
        {query !== "" && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-muted transition-colors hover:text-ink"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>

      <Results state={state} initialCreators={initialCreators} />
    </div>
  );
}

function Results({
  state,
  initialCreators,
}: {
  state: ResultState;
  initialCreators: Creator[];
}) {
  if (state.kind === "loading") {
    return (
      <p className="py-16 text-center text-muted" role="status" aria-live="polite">
        Searching…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <p className="py-16 text-center text-muted" role="status" aria-live="polite">
        Something went wrong searching. Try again.
      </p>
    );
  }

  const creators = state.kind === "results" ? state.creators : initialCreators;

  if (creators.length === 0) {
    if (state.kind === "results") {
      return (
        <p className="py-16 text-center text-muted" aria-live="polite">
          No creators match &ldquo;{state.query}&rdquo;
        </p>
      );
    }
    return (
      <p className="py-16 text-center text-muted">
        No creators to show yet — check back soon.
      </p>
    );
  }

  return (
    <div className={GRID}>
      {creators.map((c) => (
        <CreatorCard key={c.handle} creator={c} />
      ))}
    </div>
  );
}
