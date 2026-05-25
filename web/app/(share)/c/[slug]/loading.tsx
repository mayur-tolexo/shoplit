import { Skeleton } from "@/components/ui/skeleton";

// Loading UI for the public cart page. Mimics the hero + product grid so
// viewers don't see a layout pop when content loads.
export default function PublicCartLoading() {
  return (
    <div>
      <Skeleton className="w-full" style={{ height: "min(70vh, 640px)" }} />

      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden border border-rule bg-cream"
            >
              <Skeleton className="aspect-square" />
              <div className="p-5 sm:p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/3 mb-4" />
                <Skeleton className="h-12 w-full rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
