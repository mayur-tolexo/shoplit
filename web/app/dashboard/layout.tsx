import { NavBar } from "@/components/nav-bar";
import { Footer } from "@/components/footer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar variant="app" />
      <main className="min-h-[calc(100vh-15rem)]">{children}</main>
      <Footer minimal />
    </>
  );
}
