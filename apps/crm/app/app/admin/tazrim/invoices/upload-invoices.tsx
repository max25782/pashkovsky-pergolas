"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prepareUploadFile, sendInvoiceFile } from "./prepare-upload-file";

interface UploadItem {
  name: string;
  progress: number;
  state: "uploading" | "done" | "duplicate" | "error";
  detail?: string;
}

export function UploadInvoices({ dealId }: { dealId?: string }) {
  const router = useRouter();
  const [items, setItems] = useState<UploadItem[]>([]);

  function patch(name: string, next: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.name === name ? { ...item, ...next } : item)));
  }

  async function uploadOne(file: File): Promise<void> {
    const prepared = await prepareUploadFile(file);
    if (!prepared.file) {
      patch(file.name, { state: "error", detail: prepared.error });
      return;
    }
    patch(file.name, { progress: 40 });
    const result = await sendInvoiceFile(prepared.file, dealId);
    if (!result.ok) {
      patch(file.name, { state: "error", detail: result.detail ?? "שגיאה" });
      return;
    }
    if (result.detail === "כבר הועלה") {
      patch(file.name, { state: "duplicate", progress: 100, detail: result.detail });
      return;
    }
    patch(file.name, { state: "done", progress: 100 });
  }

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setItems((current) => [
      ...current,
      ...files.map((file) => ({ name: file.name, progress: 0, state: "uploading" as const })),
    ]);
    for (const file of files) {
      await uploadOne(file);
    }
    router.refresh();
    if (dealId) router.push("/app/admin/tazrim/invoices");
  }

  return (
    <section className={dealId ? "" : "mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"}>
      <div className="mb-3 text-sm font-semibold">{dealId ? "העלאת חשבונית" : "העלאת חשבוניות"}</div>
      <label className="inline-flex cursor-pointer rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400">
        {dealId ? "העלאת חשבונית" : "העלאת חשבוניות"}
        <input
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="mt-2 text-xs text-zinc-500">
        אפשר לבחור כמה קבצים, גם מהטלפון. PDF, JPG, PNG, WEBP. תמונות נדחסות לפני השליחה. PDF גדול עולה ישירות.
      </p>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={`${item.name}-${item.state}`} className="text-sm text-zinc-300">
            <div className="flex justify-between gap-3">
              <span className="truncate">{item.name}</span>
              <span className="text-zinc-500">
                {item.state === "duplicate" ? "כפילות" : item.state === "error" ? item.detail : `${item.progress}%`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-zinc-800">
              <div className="h-full bg-amber-500" style={{ width: `${item.progress}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
