import Image from "next/image";

interface EmptyStateProps {
  illustration: string;
  title: string;
  body: string;
  cta?: React.ReactNode;
}

export function EmptyState({ illustration, title, body, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center max-w-md mx-auto py-16 px-4">
      <Image src={illustration} alt="" width={240} height={180} className="mb-6 opacity-90" />
      <h2 className="font-serif text-2xl mb-3">{title}</h2>
      <p className="text-muted mb-6 leading-relaxed">{body}</p>
      {cta}
    </div>
  );
}
