import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/api-client";
import { NavBar } from "./nav-bar";

// Server wrapper for the marketing NavBar: looks up the current user (via the
// forwarded session cookie) so the public chrome reflects login state — a
// signed-in visitor sees "Dashboard", not "Sign in". Safe on logged-out
// visitors (the lookup just returns null).
export async function MarketingNav() {
  let user = null;
  try {
    user = await getCurrentUser({ cookie: cookies().toString() });
  } catch {
    user = null;
  }
  return <NavBar variant="marketing" user={user} />;
}
