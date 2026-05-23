export function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto" style={{ maxWidth: 380 }}>
      <div className="relative rounded-[2.5rem] border-8 border-ink bg-ink shadow-2xl overflow-hidden" style={{ aspectRatio: "9 / 19" }}>
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-24 h-5 rounded-b-2xl bg-ink z-10" />
        <div className="absolute inset-2 rounded-[2rem] bg-cream overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
