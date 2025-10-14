"use client"
import { useEffect, useMemo, useState } from "react"

export interface Lead {
  id: string
  name: string
  phone: string
  city?: string | null
  email?: string | null
  source?: string | null
  status?: string | null
  notes?: string | null
  last_message?: string | null
  last_message_at?: string | null
  created_at?: string | null
}

interface Props {
  adminToken: string
}

export function LeadsTable({ adminToken }: Props){
  const [q, setQ] = useState("")
  const [page, setPage] = useState(0)
  const [rows, setRows] = useState<Lead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const limit = 20

  async function load(){
    setLoading(true); setError(null)
    try{
      const url = `/api/admin/leads?q=${encodeURIComponent(q)}&limit=${limit}&offset=${page*limit}`
      console.log('Fetching:', url, 'with token:', adminToken?.slice(0,4)+'...')
      const r = await fetch(url, { headers: { 'x-admin-token': adminToken } })
      console.log('Response status:', r.status)
      const text = await r.text()
      console.log('Response body:', text)
      if(!r.ok) throw new Error(`${r.status}: ${text}`)
      const data = JSON.parse(text)
      setRows(data)
    }catch(e:any){ 
      console.error('Load error:', e)
      setError(e.message) 
    }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ load() }, [q, page])

  async function patch(id: string, updates: Partial<Lead>){
    const r = await fetch('/api/admin/leads', { method:'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken }, body: JSON.stringify({ id, ...updates }) })
    if(!r.ok) throw new Error(await r.text())
  }

  async function del(id: string){
    if(!confirm('Delete lead?')) return
    const r = await fetch(`/api/admin/leads?id=${encodeURIComponent(id)}`, { method:'DELETE', headers: { 'x-admin-token': adminToken } })
    if(!r.ok) throw new Error(await r.text())
    await load()
  }

  return (
    <section className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Search (name/phone/notes)" className="px-3 py-2 rounded border border-white/20 bg-white/5 w-64" />
        <button onClick={()=> setPage(0)} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Search</button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={()=> setPage(p=> Math.max(0, p-1))} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Prev</button>
          <button onClick={()=> setPage(p=> p+1)} className="px-3 py-2 rounded bg-white/10 hover:bg-white/20">Next</button>
        </div>
      </div>
      {error && <div className="text-red-400 mb-2">{error}</div>}
      <div className="overflow-x-auto rounded border border-white/10">
        <table className="min-w-full text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="p-2 text-left">Created</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Source</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Notes (City)</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(lead => (
              <tr key={lead.id} className="odd:bg-white/0 even:bg-white/5">
                <td className="p-2 whitespace-nowrap">{lead.created_at?.slice(0,16).replace('T',' ')}</td>
                <td className="p-2">{lead.name}</td>
                <td className="p-2">{lead.phone}</td>
                <td className="p-2">{lead.source ?? ''}</td>
                <td className="p-2">
                  <select defaultValue={lead.status ?? ''} onChange={async (e)=>{ await patch(lead.id, { status: e.target.value || null }) }} className="bg-transparent border border-white/20 rounded px-2 py-1">
                    <option value="">-</option>
                    <option value="pending">pending</option>
                    <option value="contacted">contacted</option>
                    <option value="qualified">qualified</option>
                    <option value="won">won</option>
                    <option value="lost">lost</option>
                  </select>
                </td>
                <td className="p-2 min-w-[220px]">
                  <input defaultValue={lead.notes ?? ''} onBlur={async (e)=>{ if(e.target.value !== (lead.notes ?? '')) await patch(lead.id, { notes: e.target.value || null }) }} className="w-full bg-transparent border border-white/20 rounded px-2 py-1" />
                </td>
                <td className="p-2">
                  <button onClick={()=> del(lead.id)} className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white">Delete</button>
                </td>
              </tr>
            ))}
            {rows.length===0 && !loading && (
              <tr><td className="p-4 text-center text-white/60" colSpan={7}>No leads</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}


