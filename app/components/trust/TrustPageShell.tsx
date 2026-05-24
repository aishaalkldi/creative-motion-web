import Link from "next/link";
import { TrustFooter } from "./TrustFooter";

type TrustPageShellProps = {
  title: string;
  children: React.ReactNode;
};

export function TrustPageShell({ title, children }: TrustPageShellProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-[#F4F6F5] text-[#374151]"
      style={{ fontFamily: "var(--font-inter, ui-sans-serif, sans-serif)" }}
    >
      <header className="border-b border-[#E2E8E5] bg-white px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link
            href="/"
            className="text-[13px] font-bold tracking-[0.14em] text-[#0A0F1A]"
          >
            RASQ
          </Link>
          <Link href="/login" className="text-[12px] font-medium text-[#6B7280] hover:text-[#374151]">
            Provider login
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <h1 className="text-[22px] font-bold text-[#0A0F1A]">{title}</h1>
        <div className="prose-trust mt-6 space-y-4 text-[14px] leading-relaxed text-[#6B7280]">
          {children}
        </div>
      </main>

      <TrustFooter variant="light" className="mx-auto w-full max-w-2xl" />
    </div>
  );
}
