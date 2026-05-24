import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api-client";
import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch the user once at the layout level. Both NavBar and the page get
  // a verified-authenticated render; an auth failure here is the single
  // source of truth for "kick to /login".
  const cookie = cookies().toString();
  try {
    const user = await getCurrentUser({ cookie });
    return (
      <>
        <NavBar variant="app" user={user} />
        <main className="min-h-[calc(100vh-15rem)]">{children}</main>
        <Footer minimal />
        <MobileBottomNav />
      </>
    );
  } catch {
    redirect("/login");
  }
}
