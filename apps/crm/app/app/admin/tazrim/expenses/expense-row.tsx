"use client";

import { useState, useTransition } from "react";
import { DeleteButton } from "../components/DeleteButton";
import { deleteExpense, updateExpense } from "./actions";

export interface ExpenseRowData {
  id: string;
  amount: number;
  due_date: string;
  payment_method: string | null;
  notes: string | null;
  vendor_id: string | null;
  vendor_name: string | null;
}

interface ExpenseRowProps {
  expense: ExpenseRowData;
  vendors: { id: string; name: string }[];
  paymentMethods: { value: string; label: string }[];
}

const INPUT_CLASS =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-amber-500";

export function ExpenseRow({ expense, vendors, paymentMethods }: ExpenseRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const methodLabel =
    paymentMethods.find((m) => m.value === expense.payment_method)?.label ??
    expense.payment_method;

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateExpense(formData);
      if (result.error) setError(result.error);
      else setIsEditing(false);
    });
  }

  if (!isEditing) {
    return (
      <tr className="border-b border-zinc-800 last:border-0">
        <td className="px-5 py-3 font-medium">{expense.vendor_name ?? "—"}</td>
        <td className="px-5 py-3 text-zinc-400">
          ₪{Number(expense.amount).toLocaleString("he-IL")}
        </td>
        <td className="px-5 py-3 text-zinc-400">{expense.due_date}</td>
        <td className="px-5 py-3 text-zinc-400">{methodLabel}</td>
        <td className="px-5 py-3 text-zinc-400">{expense.notes ?? "—"}</td>
        <td className="px-5 py-3">
          <div className="flex items-start justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-amber-400 hover:border-amber-500 hover:bg-amber-500/10"
            >
              תיקון
            </button>
            <DeleteButton
              id={expense.id}
              confirmMessage="למחוק את ההוצאה?"
              action={deleteExpense}
            />
          </div>
        </td>
      </tr>
    );
  }

  const formId = `edit-expense-${expense.id}`;

  return (
    <tr className="border-b border-zinc-800 bg-zinc-950/40 last:border-0">
      <td className="px-3 py-3">
        <form id={formId} action={handleSubmit} />
        <input type="hidden" name="id" value={expense.id} form={formId} />
        <select
          name="vendor_id"
          form={formId}
          defaultValue={expense.vendor_id ?? ""}
          aria-label="ספק"
          className={INPUT_CLASS}
        >
          {!expense.vendor_id && <option value="">—</option>}
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          name="amount"
          form={formId}
          type="number"
          step="0.01"
          min="0.01"
          required
          defaultValue={expense.amount}
          aria-label="סכום"
          className={INPUT_CLASS}
        />
      </td>
      <td className="px-3 py-3">
        <input
          name="due_date"
          form={formId}
          type="date"
          required
          defaultValue={expense.due_date}
          aria-label="תאריך"
          className={INPUT_CLASS}
        />
      </td>
      <td className="px-3 py-3">
        <select
          name="payment_method"
          form={formId}
          required
          defaultValue={expense.payment_method ?? "bank_transfer"}
          aria-label="אמצעי תשלום"
          className={INPUT_CLASS}
        >
          {paymentMethods.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          name="notes"
          form={formId}
          defaultValue={expense.notes ?? ""}
          aria-label="הערות"
          className={INPUT_CLASS}
        />
      </td>
      <td className="px-3 py-3">
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-2">
            <button
              type="submit"
              form={formId}
              disabled={isPending}
              className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
            >
              {isPending ? "שומר…" : "שמירה"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setIsEditing(false);
              }}
              disabled={isPending}
              className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-500 disabled:opacity-50"
            >
              ביטול
            </button>
          </div>
          {error && (
            <span className="max-w-48 text-xs text-red-400">{error}</span>
          )}
        </div>
      </td>
    </tr>
  );
}
