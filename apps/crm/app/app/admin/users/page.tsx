'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/api/auth-fetch'
import { useToast } from '@/components/ui/toast'

type InviteRole = 'admin' | 'manager' | 'viewer' | 'salesperson'

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  email_verified_at: string | null
  last_login_at: string | null
  joinedAt: string
}

export default function AdminUsersPage() {
  const toast = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<InviteRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => { initializeAndLoadUsers() }, [])

  async function initializeAndLoadUsers() {
    try {
      const meRes = await authFetch('/api/companies/me')
      if (!meRes.ok) {
        setLoading(false)
        return
      }
      const me = await meRes.json() as { company_id?: string; role?: string }
      if (!me.company_id) {
        setLoading(false)
        return
      }

      setCompanyId(me.company_id)
      await loadUsers(me.company_id)
    } catch (error) {
      console.error('[Users] Initialization error:', error)
      setLoading(false)
    }
  }

  async function loadUsers(activeCompanyId: string) {
    try {
      const res = await authFetch(`/admin-api/users?company_id=${activeCompanyId}`)
      if (!res.ok) throw new Error('Failed to load users')
      const data = await res.json() as { users?: User[] }
      setUsers(data.users ?? [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    if (!companyId) { toast.error('Company ID not found'); return }
    setInviting(true)
    try {
      const res = await authFetch('/admin-api/users/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, companyId, role: inviteRole }),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Failed to invite user')
      }
      toast.success('User invited successfully!')
      setInviteEmail('')
      await loadUsers(companyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to invite user'
      toast.error(message)
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    if (!companyId) return
    try {
      const res = await authFetch('/admin-api/users', {
        method: 'PATCH',
        body: JSON.stringify({ userId, companyId, role: newRole }),
      })
      if (!res.ok) throw new Error('Failed to update role')
      await loadUsers(companyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update role'
      toast.error(message)
    }
  }

  async function handleRemove(userId: string) {
    if (!companyId) return
    if (!confirm('Are you sure you want to remove this user?')) return
    try {
      const res = await authFetch(`/admin-api/users?user_id=${userId}&company_id=${companyId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to remove user')
      await loadUsers(companyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove user'
      toast.error(message)
    }
  }

  if (loading) return <div className="p-8">Loading users...</div>

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">User Management</h1>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Invite User</h2>
        <form onSubmit={handleInvite} className="flex gap-4">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email address"
            required
            className="flex-1 px-4 py-2 border rounded-lg"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as InviteRole)}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="salesperson">Salesperson (leads &amp; offers)</option>
            <option value="viewer">Viewer</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={inviting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {inviting ? 'Inviting...' : 'Invite'}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{user.full_name ?? user.email}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    <option value="salesperson">Salesperson</option>
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  {user.email_verified_at !== null
                    ? <span className="text-green-600">Verified</span>
                    : <span className="text-yellow-600">Pending</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.last_login_at !== null
                    ? new Date(user.last_login_at).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <button onClick={() => handleRemove(user.id)} className="text-red-600 hover:text-red-800 text-sm">
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
