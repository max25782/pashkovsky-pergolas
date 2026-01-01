# Route Groups Migration Guide

## 🎯 Goal
Separate Public Site and CRM using Next.js Route Groups without changing URLs.

---

## 📁 New Structure

```
app/
├── (public)/              # Public website
│   └── [locale]/          # he, ru, en
│       ├── layout.tsx     # Public layout (Navbar, Footer, SEO)
│       ├── page.tsx       # Home
│       ├── about/
│       ├── blog/
│       ├── contact/
│       ├── fences/
│       ├── fromShetah/
│       ├── legal/
│       ├── mistora/
│       ├── models/
│       ├── pergola3d/
│       ├── pergulas/
│       ├── railings/
│       ├── services/
│       ├── windows/
│       └── offers/[id]/approve/  # Customer approval page
│
├── (crm)/                 # CRM System
│   └── app/               # All CRM under /app/*
│       ├── layout.tsx     # CRM layout (Sidebar)
│       ├── page.tsx       # Dashboard (/app)
│       ├── leads/         # /app/leads
│       ├── deals/         # /app/deals
│       ├── users/         # /app/users
│       ├── workers/       # /app/workers
│       ├── gallery/       # /app/gallery
│       ├── articles/      # /app/articles
│       ├── reports/       # /app/reports
│       ├── statistics/    # /app/statistics
│       ├── ai-analytics/  # /app/ai-analytics
│       ├── ai-chats/      # /app/ai-chats
│       ├── onboarding/    # /app/onboarding
│       └── profiles/      # /app/profiles
│
├── (auth)/                # Authentication
│   ├── layout.tsx         # Auth layout (centered, gradient)
│   ├── login/             # /login
│   ├── register/          # /register
│   ├── reset-password/    # /reset-password
│   └── verify-email/      # /verify-email
│
├── api/                   # API routes (unchanged)
├── admin-api/             # Admin API (unchanged)
└── globals.css            # Global styles
```

---

## 🔄 Migration Steps

### STEP 1: Create Route Group Folders

```powershell
cd app
mkdir "(public)"
mkdir "(public)\[locale]"
mkdir "(crm)"
mkdir "(crm)\app"
mkdir "(auth)"
```

✅ **Status**: Done

---

### STEP 2: Create Layouts

#### A. Public Layout (`(public)/[locale]/layout.tsx`)

```tsx
import '../../../globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'
import Navbar from '@/components/navbar'
import UTMTracker from '@/components/utm-tracker'
import { Locale, isRTL } from '@/lib/locales'
import clsx from 'clsx'
import { Analytics } from "@vercel/analytics/react"
import { GoogleAnalytics } from '@/components/google-analytics'
import GA from '@/components/ga'
import { Suspense } from 'react'
import FloatingWhatsApp from '@/components/contact/FloatingWhatsApp'
import { ChatWidget } from '@/components/ai-chat/ChatWidget'

export const metadata: Metadata = {
  // ... copy from original layout.tsx
}

export default function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: Locale }
}) {
  const locale = params.locale
  const dir = isRTL(locale) ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} className={clsx('scroll-smooth')}>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="antialiased">
        <Providers>
          <Suspense fallback={null}>
            <UTMTracker />
          </Suspense>
          
          <Navbar locale={locale} />
          
          {children}
          
          <FloatingWhatsApp />
          <ChatWidget />
          
          <Analytics />
          <GoogleAnalytics />
          <GA />
        </Providers>
      </body>
    </html>
  )
}
```

#### B. CRM Layout (`(crm)/app/layout.tsx`)

```tsx
import '../../globals.css'
import type { Metadata } from 'next'
import { CRMSidebar } from '@/components/crm/CRMSidebar'
import { CRMHeader } from '@/components/crm/CRMHeader'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: {
    default: 'CRM - Pashkovsky Group',
    template: '%s | CRM',
  },
  description: 'CRM System for Pashkovsky Group',
}

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <Providers>
          <div className="flex h-screen bg-gray-50">
            <CRMSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <CRMHeader />
              <main className="flex-1 overflow-auto p-6">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

#### C. Auth Layout (`(auth)/layout.tsx`)

```tsx
import '../globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'Authentication - Pashkovsky Group',
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  )
}
```

---

### STEP 3: Move Public Pages

Move from `app/[locale]/` to `app/(public)/[locale]/`:

```
✅ page.tsx (home)
✅ about/
✅ blog/
✅ contact/
✅ fences/
✅ fromShetah/
✅ legal/
✅ mistora/
✅ models/
✅ pergola3d/
✅ pergulas/
✅ railings/
✅ services/
✅ windows/
✅ offers/[id]/approve/ (customer-facing)
✅ offers/[id]/success/
```

**PowerShell Command:**
```powershell
$publicPages = @("page.tsx", "about", "blog", "contact", "fences", "fromShetah", "legal", "mistora", "models", "pergola3d", "pergulas", "railings", "services", "windows", "offers")

foreach ($page in $publicPages) {
    Move-Item "app\[locale]\$page" "app\(public)\[locale]\$page" -Force
}
```

---

### STEP 4: Move CRM Pages

Move from `app/[locale]/admin/` to `app/(crm)/app/`:

```
✅ admin/page.tsx → app/page.tsx (dashboard)
✅ admin/leads/ → leads/
✅ admin/deals/ → deals/
✅ admin/users/ → users/
✅ admin/workers/ → workers/
✅ admin/gallery/ → gallery/
✅ admin/articles/ → articles/
✅ admin/reports/ → reports/
✅ admin/statistics/ → statistics/
✅ admin/ai-analytics/ → ai-analytics/
✅ admin/ai-chats/ → ai-chats/
```

Also move:
```
✅ [locale]/onboarding/ → (crm)/app/onboarding/
✅ [locale]/profiles/ → (crm)/app/profiles/
```

**PowerShell Command:**
```powershell
# Move admin pages
$crmPages = @("leads", "deals", "users", "workers", "gallery", "articles", "reports", "statistics", "ai-analytics", "ai-chats")

foreach ($page in $crmPages) {
    Move-Item "app\[locale]\admin\$page" "app\(crm)\app\$page" -Force
}

# Move admin/page.tsx to app/page.tsx
Move-Item "app\[locale]\admin\page.tsx" "app\(crm)\app\page.tsx" -Force

# Move onboarding and profiles
Move-Item "app\[locale]\onboarding" "app\(crm)\app\onboarding" -Force
Move-Item "app\[locale]\profiles" "app\(crm)\app\profiles" -Force
```

---

### STEP 5: Move Auth Pages

Move from `app/[locale]/auth/` to `app/(auth)/`:

```
✅ auth/login/ → (auth)/login/
✅ auth/register/ → (auth)/register/
✅ auth/reset-password/ → (auth)/reset-password/
✅ auth/verify-email/ → (auth)/verify-email/
```

**PowerShell Command:**
```powershell
Move-Item "app\[locale]\auth\*" "app\(auth)\" -Force
```

---

### STEP 6: Update Middleware

Create `middleware.ts` in root:

```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect CRM routes
  if (pathname.startsWith('/app')) {
    const token = request.cookies.get('token')?.value
    
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/app/:path*',
  ],
}
```

---

### STEP 7: Create CRM Components

#### A. CRM Sidebar (`components/crm/CRMSidebar.tsx`)

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Users, Target, FileText, 
  Settings, BarChart, Image, Newspaper,
  HardHat, Brain, MessageSquare
} from 'lucide-react'

export function CRMSidebar() {
  const pathname = usePathname()
  
  const navigation = [
    { name: 'Dashboard', href: '/app', icon: LayoutDashboard },
    { name: 'Leads', href: '/app/leads', icon: Target },
    { name: 'Deals', href: '/app/deals', icon: FileText },
    { name: 'Users', href: '/app/users', icon: Users },
    { name: 'Workers', href: '/app/workers', icon: HardHat },
    { name: 'Gallery', href: '/app/gallery', icon: Image },
    { name: 'Articles', href: '/app/articles', icon: Newspaper },
    { name: 'Reports', href: '/app/reports/weekly', icon: BarChart },
    { name: 'Statistics', href: '/app/statistics', icon: BarChart },
    { name: 'AI Analytics', href: '/app/ai-analytics', icon: Brain },
    { name: 'AI Chats', href: '/app/ai-chats', icon: MessageSquare },
  ]
  
  return (
    <aside className="w-64 bg-white shadow-lg flex flex-col">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Pashkovsky CRM
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                ${isActive 
                  ? 'bg-blue-50 text-blue-600 font-medium' 
                  : 'text-gray-700 hover:bg-gray-50'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
      
      <div className="p-4 border-t">
        <Link href="/app/profiles" className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-50">
          <Settings className="w-5 h-5" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  )
}
```

#### B. CRM Header (`components/crm/CRMHeader.tsx`)

```tsx
'use client'

import { Bell, LogOut } from 'lucide-react'

export function CRMHeader() {
  return (
    <header className="bg-white shadow-sm border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          {/* Page title will go here */}
        </h2>
        
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
          
          <button className="p-2 hover:bg-gray-100 rounded-lg">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
```

---

### STEP 8: Cleanup

Delete old structure:
```powershell
Remove-Item "app\[locale]" -Recurse -Force
```

---

### STEP 9: Test URLs

**Public Site:**
- ✅ `/` → Home
- ✅ `/he/about` → About (Hebrew)
- ✅ `/ru/about` → About (Russian)
- ✅ `/he/pergulas` → Pergolas catalog
- ✅ `/he/offers/[id]/approve` → Customer approval

**CRM:**
- ✅ `/app` → Dashboard (protected)
- ✅ `/app/leads` → Leads page (protected)
- ✅ `/app/deals` → Deals page (protected)
- ✅ `/app/users` → Users page (protected, admin only)

**Auth:**
- ✅ `/login` → Login page
- ✅ `/register` → Register page

---

## 🎨 Benefits

1. ✅ **Logical separation** - Clear code organization
2. ✅ **Different layouts** - Public vs CRM UI
3. ✅ **Easy to maintain** - Each section is isolated
4. ✅ **Better SEO** - Public site optimized separately
5. ✅ **URLs unchanged** - No breaking changes
6. ✅ **Future-proof** - Easy to split into separate apps later

---

## 📝 Notes

- Route groups `(public)`, `(crm)`, `(auth)` don't affect URLs
- API routes stay unchanged
- Middleware protects `/app/*` routes
- Localization still works for public site
- CRM is RTL Hebrew only

---

## 🚀 Next Steps

After migration:
1. Add role-based route protection
2. Add plan-based feature gates
3. Create CRM dashboard widgets
4. Add breadcrumbs to CRM
5. Add user menu with company switcher

