import { MarketingNav } from "@/components/marketing-nav";
import { Footer } from "@/components/footer";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MarketingNav />
      <main className="min-h-[calc(100vh-15rem)]">{children}</main>
      <Footer />
    </>
  );
}
