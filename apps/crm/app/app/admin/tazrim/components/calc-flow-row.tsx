"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  formatSourceMonth,
  type CalcMeta,
  type PensionCalcMeta,
  type VatCalcMeta,
} from "@/lib/tazrim/calc-meta";
import {
  flowAmount,
  flowTitle,
  type CashFlowItem,
} from "@/lib/tazrim/cash-flow";
import { formatMoney, formatShortDate } from "@/lib/tazrim/format";
import { Tag } from "@/app/app/admin/tazrim/components/dashboard-ui";

function localizedTitle(
  flow: CashFlowItem,
  t: ReturnType<typeof useTranslations<"tazrimCalc">>
): string {
  if (!flow.calcMeta) return flowTitle(flow);
  // Month fragment is LTR; full string is localized for aria / plain text.
  return `${t(flow.calcMeta.kind)} · ${formatSourceMonth(flow.calcMeta.sourceMonth)}`;
}

function LocalizedCalcLabel({
  flow,
  t,
}: {
  flow: CashFlowItem;
  t: ReturnType<typeof useTranslations<"tazrimCalc">>;
}) {
  if (!flow.calcMeta) return <>{flowTitle(flow)}</>;
  return (
    <>
      {t(flow.calcMeta.kind)} · <Ltr>{formatSourceMonth(flow.calcMeta.sourceMonth)}</Ltr>
    </>
  );
}

function moneyText(value: number, locale: string): string {
  if (locale === "he") return formatMoney(value);
  const abs = Math.abs(value).toLocaleString(locale === "ru" ? "ru-RU" : locale === "sr" ? "sr-RS" : "en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const sign = value < 0 ? "-" : "";
  return `${sign}₪${abs}`;
}

/** Isolate LTR numbers/dates so they do not glue to neighbouring RTL text. */
function Ltr({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

function Money({ value, locale }: { value: number; locale: string }) {
  return <Ltr>{moneyText(value, locale)}</Ltr>;
}

function ShortDate({ iso }: { iso: string }) {
  return <Ltr>{formatShortDate(iso)}</Ltr>;
}

function VatBreakdown({ meta }: { meta: VatCalcMeta }) {
  const t = useTranslations("tazrimCalc");
  const locale = useLocale();
  const linesTotal = meta.lines.reduce((s, l) => s + l.vatPayable, 0);

  return (
    <div className="overflow-x-auto py-2">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-zinc-400">
            <th className="py-1.5 pe-2 font-medium">{t("col_deal")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_payment")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_date")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_vat_on_payment")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_materials_deduction")}</th>
            <th className="py-1.5 font-medium">{t("col_vat_payable")}</th>
          </tr>
        </thead>
        <tbody>
          {meta.lines.map((line) => (
            <tr key={`${line.dealId}-${line.paymentId}`} className="border-t border-zinc-800/80">
              <td className="py-1.5 pe-2 text-zinc-200">
                <Link
                  href={`/app/admin/deals?deal=${encodeURIComponent(line.dealId)}`}
                  className="text-amber-500 hover:text-amber-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  {line.dealName}
                </Link>
                {line.noMaterials && (
                  <span className="ms-1.5 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-[10.5px] text-zinc-400">
                    {t("no_materials")}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-300">
                <Money value={line.paymentAmount} locale={locale} />
              </td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-400">
                <ShortDate iso={line.paidDate} />
              </td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-300">
                <Money value={line.vatOnPayment} locale={locale} />
              </td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-300">
                <Money value={line.materialsVatDeduction} locale={locale} />
              </td>
              <td className="whitespace-nowrap py-1.5 font-semibold text-zinc-100">
                <Money value={line.vatPayable} locale={locale} />
              </td>
            </tr>
          ))}
          <tr className="border-t border-zinc-700">
            <td className="py-2 font-bold text-zinc-100" colSpan={5}>
              {t("total")}
            </td>
            <td className="py-2 font-extrabold text-zinc-100">
              <Money value={Math.abs(linesTotal) || meta.total} locale={locale} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PensionBreakdown({ meta }: { meta: PensionCalcMeta }) {
  const t = useTranslations("tazrimCalc");
  const locale = useLocale();
  const linesTotal = meta.lines.reduce((s, l) => s + l.pension, 0);

  return (
    <div className="overflow-x-auto py-2">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="text-zinc-400">
            <th className="py-1.5 pe-2 font-medium">{t("col_worker")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_days")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_gross")}</th>
            <th className="py-1.5 pe-2 font-medium">{t("col_rate")}</th>
            <th className="py-1.5 font-medium">{t("col_pension")}</th>
          </tr>
        </thead>
        <tbody>
          {meta.lines.map((line) => (
            <tr key={line.workerId} className="border-t border-zinc-800/80">
              <td className="py-1.5 pe-2 text-zinc-200">{line.workerName}</td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-300">
                <Ltr>{line.days}</Ltr>
              </td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-300">
                <Money value={line.gross} locale={locale} />
              </td>
              <td className="whitespace-nowrap py-1.5 pe-2 text-zinc-300">
                <Ltr>{line.pensionRate}%</Ltr>
              </td>
              <td className="whitespace-nowrap py-1.5 font-semibold text-zinc-100">
                <Money value={line.pension} locale={locale} />
              </td>
            </tr>
          ))}
          <tr className="border-t border-zinc-700">
            <td className="py-2 font-bold text-zinc-100" colSpan={4}>
              {t("total")}
            </td>
            <td className="py-2 font-extrabold text-zinc-100">
              <Money value={linesTotal || meta.total} locale={locale} />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function CalcBreakdown({ meta }: { meta: CalcMeta }) {
  if (meta.kind === "pension") return <PensionBreakdown meta={meta} />;
  return <VatBreakdown meta={meta} />;
}

interface CalcTitleProps {
  flow: CashFlowItem;
  open: boolean;
  onToggle: () => void;
  trailing?: ReactNode;
  className?: string;
}

export function CalcTitle({ flow, open, onToggle, trailing, className = "" }: CalcTitleProps) {
  const t = useTranslations("tazrimCalc");

  if (!flow.calcMeta) {
    return (
      <span className={className}>
        {flowTitle(flow)}
        {trailing}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`text-start ${className}`}
      aria-expanded={open}
      aria-label={localizedTitle(flow, t)}
    >
      <span className="text-amber-500 hover:text-amber-400">
        <LocalizedCalcLabel flow={flow} t={t} />
      </span>
      <span className="ms-1.5 text-[10.5px] text-zinc-500">
        {open ? t("collapse") : t("expand")}
      </span>
      {trailing}
    </button>
  );
}

/** Desktop upcoming-expenses row on the main Tazrim screen (4 columns). */
export function MainExpenseCalcRow({
  flow,
  flagged,
}: {
  flow: CashFlowItem;
  flagged: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("tazrimCalc");
  const title = localizedTitle(flow, t);
  const isCalc = Boolean(flow.calcMeta);

  return (
    <>
      <tr className="border-t border-zinc-800 hover:bg-zinc-800/40">
        <td className="whitespace-nowrap p-0 text-sm text-zinc-300">
          {isCalc ? (
            <button
              type="button"
              className="block w-full py-2.5 text-start"
              onClick={() => setOpen((o) => !o)}
            >
              <ShortDate iso={flow.date} />
            </button>
          ) : (
            <Link href={flow.sourceHref} className="block py-2.5">
              <ShortDate iso={flow.date} />
            </Link>
          )}
        </td>
        <td className="p-0 text-sm text-zinc-300">
          {isCalc ? (
            <div className="py-2.5">
              <CalcTitle
                flow={flow}
                open={open}
                onToggle={() => setOpen((o) => !o)}
                trailing={<Tag>{flow.typeLabel}</Tag>}
              />
            </div>
          ) : (
            <Link href={flow.sourceHref} className="block py-2.5">
              {title}
              <Tag>{flow.typeLabel}</Tag>
            </Link>
          )}
        </td>
        <td className="whitespace-nowrap p-0 text-sm font-semibold text-zinc-100">
          {isCalc ? (
            <button
              type="button"
              className="block w-full py-2.5 text-start"
              onClick={() => setOpen((o) => !o)}
            >
              <Ltr>{flowAmount(flow)}</Ltr>
            </button>
          ) : (
            <Link href={flow.sourceHref} className="block py-2.5">
              <Ltr>{flowAmount(flow)}</Ltr>
            </Link>
          )}
        </td>
        <td className="p-0 text-xs text-warn">
          {isCalc ? (
            <button
              type="button"
              className="block w-full py-2.5 text-start"
              onClick={() => setOpen((o) => !o)}
            >
              {flagged ? "⚑" : ""}
            </button>
          ) : (
            <Link href={flow.sourceHref} className="block py-2.5">
              {flagged ? "⚑" : ""}
            </Link>
          )}
        </td>
      </tr>
      {open && flow.calcMeta && (
        <tr className="border-t border-zinc-800 bg-zinc-950/60">
          <td colSpan={4} className="px-2">
            <CalcBreakdown meta={flow.calcMeta} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Mobile list item for upcoming expenses on the main screen. */
export function MainExpenseCalcMobileItem({
  flow,
  flagged,
}: {
  flow: CashFlowItem;
  flagged: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("tazrimCalc");
  const title = localizedTitle(flow, t);
  const isCalc = Boolean(flow.calcMeta);

  if (!isCalc) {
    return (
      <li className="border-t border-zinc-800">
        <Link
          href={flow.sourceHref}
          className="flex items-center justify-between py-[9px]"
        >
          <div className="flex flex-col gap-[3px]">
            <div className="text-[13.5px] text-zinc-100">{title}</div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11.5px] text-zinc-400">
                <ShortDate iso={flow.date} />
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10.5px] text-zinc-400">
                {flow.typeLabel}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {flagged && <span className="text-xs text-warn">⚑</span>}
            <span className="whitespace-nowrap text-sm font-bold text-zinc-100">
              <Ltr>{flowAmount(flow)}</Ltr>
            </span>
          </div>
        </Link>
      </li>
    );
  }

  return (
    <li className="border-t border-zinc-800">
      <button
        type="button"
        className="flex w-full items-center justify-between py-[9px] text-start"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex flex-col gap-[3px]">
          <div className="text-[13.5px] text-amber-500">{title}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11.5px] text-zinc-400">
              <ShortDate iso={flow.date} />
            </span>
            <span className="rounded-full border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10.5px] text-zinc-400">
              {flow.typeLabel}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {flagged && <span className="text-xs text-warn">⚑</span>}
          <span className="whitespace-nowrap text-sm font-bold text-zinc-100">
            <Ltr>{flowAmount(flow)}</Ltr>
          </span>
        </div>
      </button>
      {open && flow.calcMeta && (
        <div className="pb-2">
          <CalcBreakdown meta={flow.calcMeta} />
        </div>
      )}
    </li>
  );
}

/** Compact 3-column table row (weekly / monthly expense lists). */
export function CompactCalcFlowRow({
  flow,
  amountClassName = "text-zinc-100",
  showTag = true,
  pastTag,
}: {
  flow: CashFlowItem;
  amountClassName?: string;
  showTag?: boolean;
  pastTag?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("tazrimCalc");
  const title = localizedTitle(flow, t);
  const isCalc = Boolean(flow.calcMeta);

  return (
    <>
      <tr
        className={`border-t border-zinc-800 ${isCalc ? "cursor-pointer hover:bg-zinc-800/40" : ""}`}
        onClick={isCalc ? () => setOpen((o) => !o) : undefined}
      >
        <td className="w-[70px] py-2.5 text-sm text-zinc-400">
          <ShortDate iso={flow.date} />
        </td>
        <td className="py-2.5 text-sm text-zinc-300">
          {isCalc ? (
            <CalcTitle flow={flow} open={open} onToggle={() => setOpen((o) => !o)} />
          ) : (
            <Link href={flow.sourceHref}>{title}</Link>
          )}
          {showTag && <Tag>{flow.typeLabel}</Tag>}
          {pastTag}
        </td>
        <td className={`py-2.5 text-left text-sm font-semibold ${amountClassName}`}>
          <Ltr>{flowAmount(flow)}</Ltr>
        </td>
      </tr>
      {open && flow.calcMeta && (
        <tr className="border-t border-zinc-800 bg-zinc-950/60">
          <td colSpan={3} className="px-2">
            <CalcBreakdown meta={flow.calcMeta} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Income rows that may also be VAT refunds (expandable when calc). */
export function CompactIncomeCalcRow({
  flow,
  dateFirst = true,
}: {
  flow: CashFlowItem;
  /** weekly/monthly: date | title | amount. Main screen: title | date | amount. */
  dateFirst?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("tazrimCalc");
  const title = localizedTitle(flow, t);
  const isCalc = Boolean(flow.calcMeta);

  const titleCell = (
    <td className="py-2.5 text-sm text-zinc-300">
      {isCalc ? (
        <CalcTitle flow={flow} open={open} onToggle={() => setOpen((o) => !o)} />
      ) : (
        title
      )}
    </td>
  );
  const dateCell = (
    <td className="w-[70px] py-2.5 text-sm text-zinc-400">
      <ShortDate iso={flow.date} />
    </td>
  );

  return (
    <>
      <tr
        className={`border-t border-zinc-800 ${isCalc ? "cursor-pointer hover:bg-zinc-800/40" : ""}`}
        onClick={isCalc ? () => setOpen((o) => !o) : undefined}
      >
        {dateFirst ? (
          <>
            {dateCell}
            {titleCell}
          </>
        ) : (
          <>
            {titleCell}
            {dateCell}
          </>
        )}
        <td className="py-2.5 text-left text-sm font-semibold text-emerald-400">
          <Ltr>{flowAmount(flow)}</Ltr>
        </td>
      </tr>
      {open && flow.calcMeta && (
        <tr className="border-t border-zinc-800 bg-zinc-950/60">
          <td colSpan={3} className="px-2">
            <CalcBreakdown meta={flow.calcMeta} />
          </td>
        </tr>
      )}
    </>
  );
}
