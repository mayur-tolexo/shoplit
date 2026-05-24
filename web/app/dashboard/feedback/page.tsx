import { cookies } from "next/headers";
import { listFeedback, type FeedbackItem } from "@/lib/api-client";

export const dynamic = "force-dynamic";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default async function FeedbackInboxPage() {
  const cookie = cookies().toString();

  let items: FeedbackItem[] = [];
  let forbidden = false;
  let error = false;

  try {
    items = await listFeedback({ cookie });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("403") || msg.toLowerCase().includes("forbidden")) {
      forbidden = true;
    } else {
      error = true;
    }
  }

  if (forbidden) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted text-sm">You don&apos;t have access to this page.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-muted text-sm">Something went wrong loading the feedback inbox.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl tracking-tight leading-none mb-1">
          Feature requests
        </h1>
        <p className="text-muted text-sm">
          {items.length === 0
            ? "No requests yet."
            : `${items.length} ${items.length === 1 ? "submission" : "submissions"}`}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-rule bg-cream px-6 py-10 text-center">
          <p className="text-muted text-sm">No requests yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-rule bg-cream px-5 py-4"
            >
              <p className="text-ink leading-relaxed mb-3 whitespace-pre-wrap">{item.message}</p>
              <p className="text-muted text-xs flex flex-wrap gap-x-2 gap-y-0.5">
                {(item.name || item.email) && (
                  <span>
                    {item.name && item.email
                      ? `${item.name} (${item.email})`
                      : item.name || item.email}
                  </span>
                )}
                {item.page && (
                  <>
                    <span aria-hidden="true">&middot;</span>
                    <span className="truncate max-w-[200px]">{item.page}</span>
                  </>
                )}
                <span aria-hidden="true">&middot;</span>
                <span>{formatDate(item.createdAt)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
