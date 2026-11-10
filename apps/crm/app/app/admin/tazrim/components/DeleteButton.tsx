"use client";

import { useState, useTransition } from "react";

interface DeleteResult {
  error?: string;
}

interface DeleteButtonProps {
  id: string;
  confirmMessage: string;
  action: (id: string) => Promise<DeleteResult>;
}

export function DeleteButton({ id, confirmMessage, action }: DeleteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await action(id);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="rounded-lg border border-zinc-700 px-3 py-1 text-xs text-red-400 hover:border-red-500 hover:bg-red-500/10 disabled:opacity-50"
      >
        {isPending ? "מוחק…" : "מחיקה"}
      </button>
      {error && <span className="max-w-48 text-xs text-red-400">{error}</span>}
    </div>
  );
}
