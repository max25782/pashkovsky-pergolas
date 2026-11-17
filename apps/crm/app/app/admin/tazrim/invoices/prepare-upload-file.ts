import { REQUEST_BODY_BYTES } from "@/lib/tazrim/expense-invoices/constants";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export interface PreparedUpload {
  file: File;
  error: null;
}

export interface RejectedUpload {
  file: null;
  error: string;
}

/** Shrink a photo before it hits the request-body limit. PDFs are left unchanged. */
export async function prepareUploadFile(file: File): Promise<PreparedUpload | RejectedUpload> {
  const type = file.type.toLowerCase();
  if (!IMAGE_TYPES.has(type) && !file.name.toLowerCase().match(/\.(jpe?g|png|webp)$/)) {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      if (file.size > 15 * 1024 * 1024) return { file: null, error: "PDF גדול מ-15MB" };
      return { file, error: null };
    }
    return { file, error: null };
  }
  const compressed = await compressImage(file);
  if (compressed.size > REQUEST_BODY_BYTES) {
    return { file: null, error: "התמונה גדולה מדי גם אחרי דחיסה. שמרו PDF קטן יותר." };
  }
  return { file: compressed, error: null };
}

async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2500 / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

export async function sendInvoiceFile(file: File, dealId?: string): Promise<{ ok: boolean; detail?: string }> {
  if (file.type === "application/pdf" && file.size > REQUEST_BODY_BYTES) {
    return sendPdfDirect(file, dealId);
  }
  return sendThroughApp(file, dealId);
}

function sendThroughApp(file: File, dealId?: string): Promise<{ ok: boolean; detail?: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/tazrim/expense-invoices");
    xhr.onload = () => {
      if (xhr.status === 413) {
        resolve({ ok: false, detail: "הקובץ גדול מדי להעלאה" });
        return;
      }
      if (xhr.status >= 400) {
        resolve({ ok: false, detail: readError(xhr.responseText) });
        return;
      }
      resolve({ ok: true, detail: readDuplicate(xhr.responseText) ? "כבר הועלה" : undefined });
    };
    xhr.onerror = () => resolve({ ok: false, detail: "שגיאת רשת" });
    const form = new FormData();
    form.append("file", file);
    if (dealId) form.append("dealId", dealId);
    xhr.send(form);
  });
}

async function sendPdfDirect(file: File, dealId?: string): Promise<{ ok: boolean; detail?: string }> {
  const signed = await fetch("/api/tazrim/expense-invoices/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sign", filename: file.name, size: file.size }),
  });
  if (!signed.ok) return { ok: false, detail: "לא ניתן לפתוח העלאה ישירה" };
  const ticket = (await signed.json()) as { signedUrl?: string; path?: string };
  if (!ticket.signedUrl || !ticket.path) return { ok: false, detail: "לא ניתן לפתוח העלאה ישירה" };
  const form = new FormData();
  form.append("cacheControl", "3600");
  form.append("", file);
  const uploaded = await fetch(ticket.signedUrl, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
  if (!uploaded.ok) return { ok: false, detail: "העלאת ה-PDF נכשלה" };
  const done = await fetch("/api/tazrim/expense-invoices/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete", path: ticket.path, filename: file.name, dealId: dealId ?? null }),
  });
  if (!done.ok) return { ok: false, detail: "הקובץ הועלה אבל לא נרשם" };
  const body = (await done.json()) as { duplicate?: boolean };
  return { ok: true, detail: body.duplicate ? "כבר הועלה" : undefined };
}

function readError(raw: string): string {
  try {
    const body = JSON.parse(raw) as { error?: string };
    return body.error ?? "שגיאה";
  } catch {
    return "שגיאה";
  }
}

function readDuplicate(raw: string): boolean {
  try {
    return Boolean((JSON.parse(raw) as { duplicate?: boolean }).duplicate);
  } catch {
    return false;
  }
}
