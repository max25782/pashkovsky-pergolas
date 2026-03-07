'use client'

import { useToast } from '@/components/ui/toast'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { authFetch } from '@/lib/api/auth-fetch'
import { Plus, Pencil, Trash2, Check, X, ArrowLeft, Package } from 'lucide-react'

interface StockRow {
  id: string
  color: string
  length_meters: number
  qty_available: number
  qty_reserved: number
  qty_used: number
  location: string | null
  updated_at: string
  aluminum_profiles: {
    id: string
    code: string
    name_he: string | null
    name_ru: string | null
    name_en: string | null
    weight_per_meter: number
    dimensions: string | null
    category: string | null
  } | null
}

interface ProfileOption {
  id: string
  code: string
  name_he: string | null
  name_ru: string | null
}

const emptyForm = {
  profile_id: '',
  color: '',
  length_meters: '',
  qty_available: '',
  location: '',
}

export default function InventoryPage() {
  const toast = useToast()
  const [rows, setRows] = useState<StockRow[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ qty_available: string; color: string; location: string }>({ qty_available: '', color: '', location: '' })
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
    loadProfiles()
  }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/admin/inventory')
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to load')
      setRows(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function loadProfiles() {
    try {
      const res = await authFetch('/api/admin/profiles')
      if (!res.ok) return
      const data = await res.json()
      setProfiles(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }

  async function handleAdd() {
    if (!form.profile_id || !form.color || !form.length_meters) {
      toast.error('Заполните профиль, цвет и длину')
      return
    }
    setSaving(true)
    try {
      const res = await authFetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setForm(emptyForm)
      setShowAdd(false)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true)
    try {
      const res = await authFetch(`/api/admin/inventory/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty_available: editForm.qty_available,
          color: editForm.color,
          location: editForm.location,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      setEditingId(null)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Удалить эту запись?')) return
    try {
      const res = await authFetch(`/api/admin/inventory/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    }
  }

  function startEdit(row: StockRow) {
    setEditingId(row.id)
    setEditForm({
      qty_available: String(row.qty_available),
      color: row.color,
      location: row.location ?? '',
    })
  }

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase()
    const code = r.aluminum_profiles?.code?.toLowerCase() ?? ''
    const name = (r.aluminum_profiles?.name_he ?? r.aluminum_profiles?.name_ru ?? '').toLowerCase()
    const color = r.color.toLowerCase()
    return !q || code.includes(q) || name.includes(q) || color.includes(q)
  })

  const totalAvailable = filtered.reduce((s, r) => s + r.qty_available, 0)
  const totalReserved  = filtered.reduce((s, r) => s + r.qty_reserved, 0)

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="container py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/app/admin" className="p-2 rounded bg-white/10 hover:bg-white/20 transition">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="w-6 h-6 text-blue-400" />
                ספירת מלאי
              </h1>
              <p className="text-white/50 text-sm">Inventory count — aluminum profiles stock</p>
            </div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" />
            הוסף רשומה
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="חיפוש לפי קוד, שם או צבע..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-4 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:border-blue-400"
        />

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-white/50 text-xs mb-1">פריטים</p>
            <p className="text-2xl font-bold">{filtered.length}</p>
          </div>
          <div className="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
            <p className="text-green-300 text-xs mb-1">זמין</p>
            <p className="text-2xl font-bold text-green-400">{totalAvailable}</p>
          </div>
          <div className="bg-yellow-500/10 rounded-lg p-4 border border-yellow-500/20">
            <p className="text-yellow-300 text-xs mb-1">שמור</p>
            <p className="text-2xl font-bold text-yellow-400">{totalReserved}</p>
          </div>
          <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
            <p className="text-blue-300 text-xs mb-1">סה&quot;כ</p>
            <p className="text-2xl font-bold text-blue-400">{totalAvailable + totalReserved}</p>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="bg-white/5 border border-white/20 rounded-xl p-5 mb-6">
            <h3 className="font-bold mb-4 text-lg">הוסף רשומת מלאי</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs text-white/60 mb-1">פרופיל *</label>
                <select
                  value={form.profile_id}
                  onChange={(e) => setForm({ ...form, profile_id: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
                >
                  <option value="">בחר פרופיל...</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code}{p.name_he ? ` — ${p.name_he}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">צבע *</label>
                <input
                  type="text"
                  placeholder="BLACK"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">אורך (מ׳) *</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="6"
                  value={form.length_meters}
                  onChange={(e) => setForm({ ...form, length_meters: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">כמות</label>
                <input
                  type="number"
                  placeholder="0"
                  value={form.qty_available}
                  onChange={(e) => setForm({ ...form, qty_available: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/60 mb-1">מיקום</label>
                <input
                  type="text"
                  placeholder="מחסן א׳"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleAdd}
                disabled={saving}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-sm disabled:opacity-50"
              >
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setForm(emptyForm) }}
                className="px-5 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-20 text-white/40">טוען...</div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            {search ? 'לא נמצאו תוצאות' : 'אין רשומות מלאי. לחץ "הוסף רשומה" כדי להתחיל.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-white/50 text-xs uppercase tracking-wide">
                  <th className="px-4 py-3 text-right">קוד</th>
                  <th className="px-4 py-3 text-right">שם</th>
                  <th className="px-4 py-3 text-center">צבע</th>
                  <th className="px-4 py-3 text-center">אורך</th>
                  <th className="px-4 py-3 text-center">זמין</th>
                  <th className="px-4 py-3 text-center">שמור</th>
                  <th className="px-4 py-3 text-center">בשימוש</th>
                  <th className="px-4 py-3 text-center">מיקום</th>
                  <th className="px-4 py-3 text-right">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-white/5 transition-colors">
                    {/* Code */}
                    <td className="px-4 py-3 font-mono font-bold text-white">
                      {row.aluminum_profiles?.code ?? '—'}
                    </td>
                    {/* Name */}
                    <td className="px-4 py-3 text-white/70 text-xs">
                      {row.aluminum_profiles?.name_he || row.aluminum_profiles?.name_ru || row.aluminum_profiles?.dimensions || '—'}
                    </td>
                    {/* Color */}
                    <td className="px-4 py-3 text-center">
                      {editingId === row.id ? (
                        <input
                          value={editForm.color}
                          onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                          className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs text-center"
                        />
                      ) : (
                        <span className="px-2 py-0.5 bg-white/10 rounded text-white/80 text-xs">{row.color}</span>
                      )}
                    </td>
                    {/* Length */}
                    <td className="px-4 py-3 text-center text-white/80">
                      {row.length_meters}m
                    </td>
                    {/* Qty available */}
                    <td className="px-4 py-3 text-center">
                      {editingId === row.id ? (
                        <input
                          type="number"
                          value={editForm.qty_available}
                          onChange={(e) => setEditForm({ ...editForm, qty_available: e.target.value })}
                          className="w-20 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm text-center"
                        />
                      ) : (
                        <span className={`font-bold text-base ${row.qty_available === 0 ? 'text-red-400' : row.qty_available < 5 ? 'text-yellow-400' : 'text-green-400'}`}>
                          {row.qty_available}
                        </span>
                      )}
                    </td>
                    {/* Reserved */}
                    <td className="px-4 py-3 text-center text-yellow-400/80">{row.qty_reserved}</td>
                    {/* Used */}
                    <td className="px-4 py-3 text-center text-white/40">{row.qty_used}</td>
                    {/* Location */}
                    <td className="px-4 py-3 text-center">
                      {editingId === row.id ? (
                        <input
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="w-28 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-xs text-center"
                          placeholder="מיקום"
                        />
                      ) : (
                        <span className="text-white/50 text-xs">{row.location ?? '—'}</span>
                      )}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {editingId === row.id ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(row.id)}
                              disabled={saving}
                              className="p-1.5 bg-green-600 hover:bg-green-700 rounded text-white transition-colors"
                              title="שמור"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1.5 bg-white/10 hover:bg-white/20 rounded text-white transition-colors"
                              title="ביטול"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(row)}
                              className="p-1.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                              title="ערוך"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(row.id)}
                              className="p-1.5 hover:bg-red-500/20 rounded text-red-400/60 hover:text-red-400 transition-colors"
                              title="מחק"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}
