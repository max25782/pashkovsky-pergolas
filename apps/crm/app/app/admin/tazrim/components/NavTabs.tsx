import Link from "next/link";

const TABS = [
  { href: "/app/admin/tazrim", label: "ראשי" },
  { href: "/app/admin/tazrim/weekly", label: "תזרים שבועי" },
  { href: "/app/admin/tazrim/monthly", label: "תזרים חודשי" },
  { href: "/app/admin/tazrim/balance", label: "יתרת בנק" },
  { href: "/app/admin/tazrim/vendors", label: "ספקים" },
  { href: "/app/admin/tazrim/crm", label: "CRM" },
  { href: "/app/admin/tazrim/checks", label: "שיקים" },
  { href: "/app/admin/tazrim/recurring", label: "חיובים קבועים" },
  { href: "/app/admin/tazrim/debts", label: "חובות" },
  { href: "/app/admin/tazrim/expenses", label: "הוצאות" },
];

export function NavTabs({ active }: { active: string }) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            active === t.href
              ? "bg-amber-500 text-zinc-950"
              : "bg-zinc-900 text-zinc-400 hover:text-zinc-100"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
