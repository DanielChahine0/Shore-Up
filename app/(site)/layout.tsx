import { SiteHeader } from "@/components/chrome/SiteHeader";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh bg-abyss">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-4">{children}</main>
    </div>
  );
}
