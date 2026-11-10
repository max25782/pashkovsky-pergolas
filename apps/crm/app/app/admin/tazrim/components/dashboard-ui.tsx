import Link from "next/link";
import type { ReactNode } from "react";
import type { RiskLevel } from "@/lib/tazrim/cash-flow";

// Shared building blocks for the daily, weekly and debts screens.

export const INPUT_CLASS =
  "rounded-[10px] border border-zinc-800 bg-zinc-950 px-3.5 py-[11px] text-sm text-zinc-100 outline-none focus:border-amber-500";

export const RISK_STYLES: Record<
  RiskLevel,
  { card: string; text: string; dot: string; chip: string }
> = {
  red: {
    card: "border-red-500/40 bg-red-500/10",
    text: "text-red-400",
    dot: "bg-red-400",
    chip: "border-red-500/40 bg-red-500/10 text-red-400",
  },
  amber: {
    card: "border-warn/35 bg-warn/10",
    text: "text-warn",
    dot: "bg-warn",
    chip: "border-warn/35 bg-warn/10 text-warn",
  },
  green: {
    card: "border-emerald-400/[0.35] bg-emerald-400/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    chip: "border-emerald-400/[0.35] bg-emerald-400/10 text-emerald-400",
  },
};

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-[14px] border border-zinc-800 bg-zinc-900 p-4 md:rounded-2xl md:px-6 md:py-[22px] ${className}`}
    >
      {children}
    </div>
  );
}

interface StatCardProps {
  labelShort: string;
  labelLong?: string;
  value: string;
  valueClassName?: string;
  note?: ReactNode;
  className?: string;
}

export function StatCard({
  labelShort,
  labelLong,
  value,
  valueClassName = "text-zinc-100",
  note,
  className = "",
}: StatCardProps) {
  return (
    <Card className={`flex flex-col gap-1 md:gap-2 ${className}`}>
      <div className="text-[11.5px] text-zinc-400 md:text-[13px]">
        <span className={labelLong ? "md:hidden" : ""}>{labelShort}</span>
        {labelLong && <span className="hidden md:inline">{labelLong}</span>}
      </div>
      <div
        className={`text-[21px] font-extrabold md:text-[30px] ${valueClassName}`}
      >
        {value}
      </div>
      {note && (
        <div className="hidden text-[12.5px] text-zinc-600 md:block">{note}</div>
      )}
    </Card>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="mr-2 rounded-full border border-zinc-800 bg-zinc-950 px-[9px] py-0.5 text-[11.5px] text-zinc-400">
      {children}
    </span>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  mobileTitle?: string;
  mobileSubtitle?: string;
  children?: ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  mobileTitle,
  mobileSubtitle,
  children,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 md:gap-1.5">
        <div className="text-[11px] uppercase tracking-[0.04em] text-zinc-400 md:text-[13px]">
          Pashkovsky Group · Tazrim
        </div>
        <h1 className="text-[22px] font-extrabold text-zinc-100 md:text-[34px]">
          <span className={mobileTitle ? "hidden md:inline" : ""}>{title}</span>
          {mobileTitle && <span className="md:hidden">{mobileTitle}</span>}
        </h1>
        {subtitle && (
          <div className="text-[13px] text-zinc-400 md:text-[15px]">
            <span className={mobileSubtitle ? "hidden md:inline" : ""}>
              {subtitle}
            </span>
            {mobileSubtitle && (
              <span className="md:hidden">{mobileSubtitle}</span>
            )}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

interface StatusChipProps {
  dotClassName: string;
  className: string;
  children: ReactNode;
  href?: string;
}

export function StatusChip({
  dotClassName,
  className,
  children,
  href,
}: StatusChipProps) {
  const content = (
    <>
      <span
        className={`inline-block h-[7px] w-[7px] rounded-full md:h-[9px] md:w-[9px] ${dotClassName}`}
      />
      <span className="text-[12.5px] md:text-sm">{children}</span>
    </>
  );
  const classes = `flex items-center gap-[7px] whitespace-nowrap rounded-full border px-3 py-[7px] md:gap-2.5 md:px-[18px] md:py-2.5 ${className}`;
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <div className={classes}>{content}</div>
  );
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-[10px] border border-zinc-800 bg-zinc-900 px-[18px] py-2.5 text-sm font-semibold text-amber-500 hover:text-amber-400"
    >
      {children}
    </Link>
  );
}
