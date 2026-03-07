/**
 * SuperAdmin Sidebar Navigation
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Plug
} from 'lucide-react'

export function SuperAdminSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  
  // Navigation items without icon components (render inline instead)
  const navigation = [
    { name: 'Dashboard', href: '/superadmin', iconName: 'dashboard' },
    { name: 'Companies', href: '/superadmin/companies', iconName: 'building' },
    { name: 'Subscriptions', href: '/superadmin/subscriptions', iconName: 'card' },
    { name: 'Integrations', href: '/superadmin/integrations', iconName: 'plug' },
    { name: 'Platform Admins', href: '/superadmin/admins', iconName: 'shield' },
    { name: 'Settings', href: '/superadmin/settings', iconName: 'settings' },
  ]
  
  // Icon mapping
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'dashboard': return <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
      case 'building': return <Building2 className="h-5 w-5 flex-shrink-0" />
      case 'card': return <CreditCard className="h-5 w-5 flex-shrink-0" />
      case 'plug': return <Plug className="h-5 w-5 flex-shrink-0" />
      case 'shield': return <Shield className="h-5 w-5 flex-shrink-0" />
      case 'settings': return <Settings className="h-5 w-5 flex-shrink-0" />
      default: return null
    }
  }

  const handleLogout = async () => {
    
    try {
      // Call logout API (deletes Redis session + clears cookie)
      await fetch('/api/auth/superadmin-logout', {
        method: 'POST',
        credentials: 'include', // Include cookies
      })
      
    } catch (error) {
      console.error('[SuperAdmin] Logout error:', error)
    } finally {
      // Redirect to login regardless of API result
      window.location.href = '/login'
    }
  }

  return (
    <aside className={`bg-gray-900 text-white transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-yellow-400" />
            <span className="font-bold text-lg">SuperAdmin</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
        >
          {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isActive
                  ? 'bg-yellow-500 text-gray-900 font-medium'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
              title={collapsed ? item.name : undefined}
            >
              {getIcon(item.iconName)}
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800 space-y-2">
        <Link
          href="/app/admin"
          className="flex items-center gap-3 px-3 py-2.5 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors"
          title={collapsed ? 'Back to CRM' : undefined}
        >
          <Users className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Back to CRM</span>}
        </Link>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-lg transition-colors"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}

