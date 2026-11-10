import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import { requireTazrimAccess } from "@/lib/tazrim/guard";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-heebo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "תזרים",
  description: "תזרים מזומנים — Pashkovsky Group",
};

// Defense in depth: the sidebar already hides the tab, pages and server actions
// re-check access on their own (layouts are not re-run on client navigation).
export default async function TazrimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireTazrimAccess();

  return (
    <div dir="rtl" lang="he" className={`${heebo.variable} font-[family-name:var(--font-heebo)]`}>
      {children}
    </div>
  );
}
