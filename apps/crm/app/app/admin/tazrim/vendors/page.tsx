import { requireTazrimAccess } from "@/lib/tazrim/guard";
import { addVendor, deleteVendor } from "../actions";
import { PAYMENT_METHODS } from "@/lib/tazrim/payment-methods";
import { NavTabs } from "../components/NavTabs";
import { DeleteButton } from "../components/DeleteButton";

const VENDOR_TYPES = [
  { value: "material_supplier", label: "ספק חומרי גלם" },
  { value: "subcontractor", label: "קבלן משנה" },
  { value: "ad_agency", label: "סוכנות שיווק" },
  { value: "ad_platform", label: "פלטפורמת פרסום" },
  { value: "card_provider", label: "ספק כרטיס" },
  { value: "bank", label: "בנק" },
  { value: "government", label: "מדינה / מיסים" },
  { value: "pension_fund", label: "קרן פנסיה / השתלמות" },
  { value: "fuel_provider", label: "ספק דלק" },
  { value: "leasing", label: "ליסינג" },
  { value: "service_provider", label: "נותן שירות" },
  { value: "other", label: "אחר" },
];

export default async function Home() {
  const { supabase } = await requireTazrimAccess();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: vendors } = await supabase
    .from("tz_vendors")
    .select("id, name, vendor_type, payment_mode, created_at")
    .order("created_at", { ascending: false });

  return (
    <div dir="rtl" className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-zinc-500">
              Pashkovsky Group · Tazrim
            </div>
            <h1 className="text-2xl font-bold">ספקים</h1>
          </div>
          <div className="text-sm text-zinc-500">{user?.email}</div>
        </div>

        <NavTabs active="/app/admin/tazrim/vendors" />

        <form
          action={addVendor}
          className="mb-8 flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-5"
        >
          <div className="text-sm font-semibold">הוספת ספק</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="name"
              required
              placeholder="שם הספק"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500 sm:col-span-1"
            />
            <select
              name="vendor_type"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              defaultValue="material_supplier"
            >
              {VENDOR_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              name="payment_method"
              aria-label="תנאי תשלום"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
              defaultValue={PAYMENT_METHODS[0]}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <input
              name="payment_details"
              placeholder="פירוט (לדוגמה: 60/90, או תאריך)"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="self-start rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400"
          >
            הוספה +
          </button>
        </form>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900">
          {!vendors || vendors.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">
              עדיין אין ספקים — הוסף את הראשון למעלה.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-right text-xs text-zinc-500">
                  <th className="px-5 py-3 font-medium">שם</th>
                  <th className="px-5 py-3 font-medium">סוג</th>
                  <th className="px-5 py-3 font-medium">תנאי תשלום</th>
                  <th className="px-5 py-3 font-medium">
                    <span className="sr-only">פעולות</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => (
                  <tr key={v.id} className="border-b border-zinc-800 last:border-0">
                    <td className="px-5 py-3 font-medium">{v.name}</td>
                    <td className="px-5 py-3 text-zinc-400">
                      {VENDOR_TYPES.find((t) => t.value === v.vendor_type)?.label ??
                        v.vendor_type}
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {v.payment_mode ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-left">
                      <DeleteButton
                        id={v.id}
                        action={deleteVendor}
                        confirmMessage={`למחוק את הספק "${v.name}"?`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
