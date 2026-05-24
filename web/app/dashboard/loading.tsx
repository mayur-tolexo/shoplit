import { Skeleton } from "@/components/ui/skeleton";

// Streamed loading UI for /dashboard. Mirrors the real page structure so
// the layout doesn't shift when content lands.
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 pb-24 sm:pb-10">
      <div className="mb-8">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-10 w-64" />
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-6 mb-10">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-rule bg-cream px-4 py-4 sm:px-6 sm:py-5"
          >
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-xl overflow-hidden border border-rule bg-cream"
          >
            <Skeleton className="aspect-[16/10]" />
            <div className="p-5">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
