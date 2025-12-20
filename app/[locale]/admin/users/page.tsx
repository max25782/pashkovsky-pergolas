'use client'

import { useState, useEffect } from 'react'
import type { Locale } from '@/lib/locales'

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  email_verified_at: string | null
  last_login_at: string | null
  joinedAt: string
}

export default function AdminUsersPage({ params }: { params: { locale: Locale } }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'manager' | 'viewer'>('viewer')
  const [inviting, setInviting] = useState(false)

  // Get company ID from token (simplified - in real app, extract from JWT)
  const companyId = '00000000-0000-0000-0000-000000000001' // TODO: Get from context

  useEffect(() => {
    loadUsers()
  }, [])

  async function loadUsers() {
    try {
      const token = localStorage.getItem('token') // TODO: Use proper auth context
      const response = await fetch(`/admin-api/users?company_id=${companyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to load users')
      }

      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/admin-api/users/invite', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          companyId,
          role: inviteRole,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to invite user')
      }

      alert('User invited successfully!')
      setInviteEmail('')
      loadUsers()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setInviting(false)
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/admin-api/users', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          companyId,
          role: newRole,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update role')
      }

      loadUsers()
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role')
    }
  }

  async function handleRemove(userId: string) {
    if (!confirm('Are you sure you want to remove this user?')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/admin-api/users?user_id=${userId}&company_id=${companyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Failed to remove user')
      }

      loadUsers()
    } catch (error) {
      console.error('Error removing user:', error)
      alert('Failed to remove user')
    }
  }

  if (loading) {
    return <div className="p-8">Loading users...</div>
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">User Management</h1>

      {/* Invite User Form */}
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
            onChange={(e) => setInviteRole(e.target.value as any)}
            className="px-4 py-2 border rounded-lg"
          >
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

      {/* Users List */}
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
                  <div>
                    <div className="font-medium">{user.full_name || user.email}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    className="px-3 py-1 border rounded text-sm"
                  >
                    <option value="viewer">Viewer</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="owner">Owner</option>
                  </select>
                </td>
                <td className="px-6 py-4">
                  {user.email_verified_at ? (
                    <span className="text-green-600">Verified</span>
                  ) : (
                    <span className="text-yellow-600">Pending</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {user.last_login_at
                    ? new Date(user.last_login_at).toLocaleDateString()
                    : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleRemove(user.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
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


