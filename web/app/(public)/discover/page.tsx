import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { Creator } from "@/lib/types";
import { listCreators } from "@/lib/api-client";
import { CreatorSearch } from "@/components/creator-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discover creators · shoplit",
  description: "Browse creators on shoplit and follow the ones whose taste you trust.",
};

export default async function DiscoverPage() {
  // Forward the viewer's cookies so `isFollowing` reflects their relationship
  // (logged-out visitors just get false on every card). Never throw on a 401 —
  // discover is public.
  let creators: Creator[] = [];
  try {
    creators = await listCreators({ cookie: cookies().toString() });
  } catch {
    creators = [];
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-24 sm:pb-16">
      <section className="pt-12 pb-8 sm:pt-16 sm:pb-10 max-w-2xl">
        <p className="text-sm text-accent uppercase tracking-widest font-medium mb-3">Discover</p>
        <h1 className="font-serif text-4xl sm:text-5xl leading-[1.05] mb-3">
          Find creators you&apos;ll love
        </h1>
        <p className="text-muted text-lg leading-relaxed">
          Browse the people curating on shoplit. Follow your favourites and their newest carts
          land in your feed.
        </p>
      </section>

      <CreatorSearch initialCreators={creators} />
    </div>
  );
}
