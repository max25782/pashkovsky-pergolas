# SuperAdmin Panel Documentation

## 🎨 Overview

SuperAdmin Panel - это платформенная админ-панель для управления всеми компаниями, подписками и настройками SaaS.

---

## 🔐 Access

### URL:
```
http://localhost:3001/superadmin
```

### Authentication:
- Автоматическая проверка через `isSuperAdmin()`
- Только пользователи с ролью `SUPERADMIN` в `platform_admins` могут получить доступ
- Redirect на `/login?error=unauthorized` если не авторизован

---

## 📋 Pages

### 1. Dashboard (`/superadmin`)

**Статистика платформы:**
- ✅ Total Companies
- ✅ Total Users
- ✅ Active Subscriptions
- ✅ MRR (Monthly Recurring Revenue)

**Графики:**
- ✅ Subscription Distribution (по планам)
- ✅ Recent Activity

**Features:**
- Real-time stats from database
- Visual charts and graphs
- Activity timeline

---

### 2. Companies (`/superadmin/companies`)

**Управление компаниями:**
- ✅ View all companies
- ✅ Search and filter
- ✅ Sort by plan, status, created date
- ✅ Quick actions (View, Edit, Delete)

**Table Columns:**
- Company name & email
- Current plan
- Subscription status
- Number of users
- Created date
- Actions

**Filters:**
- By plan (trial, basic, pro, enterprise)
- By status (active, trialing, suspended)
- Search by name or email

---

### 3. Subscriptions (`/superadmin/subscriptions`)

**Управление подписками:**
- ✅ View all subscriptions
- ✅ Stats (Total, Active, Trialing, Canceled)
- ✅ Search by company
- ✅ Filter by status/plan
- ✅ Export functionality (button готов)

**Table Columns:**
- Company name
- Plan
- Status
- Price (monthly/yearly)
- Auto-renew
- Created date
- Actions

**Quick Stats:**
- Total subscriptions
- Active count
- Trialing count
- Canceled count

---

### 4. Platform Admins (`/superadmin/admins`) - TODO

**Управление админами:**
- View all platform admins
- Add new admins
- Change roles (SUPERADMIN, SUPPORT)
- Manage permissions
- Deactivate admins

---

### 5. Settings (`/superadmin/settings`) - TODO

**Настройки платформы:**
- Email templates
- Payment gateway settings
- Platform branding
- Security settings
- API keys

---

## 🎨 UI Components

### Created Components:

1. **SuperAdminSidebar** (`components/superadmin/SuperAdminSidebar.tsx`)
   - Collapsible sidebar
   - Navigation menu
   - Back to CRM link

2. **StatCard** (`components/superadmin/StatCard.tsx`)
   - Stat display with icon
   - Trend indicator
   - Color-coded

3. **SubscriptionChart** (`components/superadmin/SubscriptionChart.tsx`)
   - Visual plan distribution
   - Progress bars
   - Percentage calculations

4. **RecentActivity** (`components/superadmin/RecentActivity.tsx`)
   - Activity timeline
   - Icon indicators
   - Time stamps

5. **CompaniesTable** (`components/superadmin/CompaniesTable.tsx`)
   - Full-featured table
   - Status badges
   - Plan badges
   - Action buttons

6. **SubscriptionsTable** (`components/superadmin/SubscriptionsTable.tsx`)
   - Subscription details
   - Billing info
   - Status management

---

## 🚀 Usage

### Access SuperAdmin Panel:

1. **Login as SuperAdmin:**
   ```
   Email: office@pashkovsky-group.com
   Password: your_password
   ```

2. **Navigate to SuperAdmin:**
   ```
   http://localhost:3001/superadmin
   ```

3. **Or from CRM:**
   - Click user menu
   - Select "SuperAdmin" (if you're a superadmin)

---

## 🔧 Development

### Add New SuperAdmin Page:

```typescript
// apps/crm/app/superadmin/new-page/page.tsx
import { isSuperAdmin } from '@/lib/auth/platform-admin'
import { redirect } from 'next/navigation'

export default async function NewPage() {
  // Layout already checks auth, but you can double-check
  const isSuper = await isSuperAdmin()
  if (!isSuper) redirect('/login')
  
  return (
    <div>
      <h1>New SuperAdmin Page</h1>
    </div>
  )
}
```

### Add Navigation Item:

```typescript
// components/superadmin/SuperAdminSidebar.tsx
const navigation = [
  // ... existing items
  { name: 'New Page', href: '/superadmin/new-page', icon: IconName },
]
```

---

## 📊 Database Queries

### Get Platform Stats:

```typescript
const { count } = await supabase
  .from('companies')
  .select('*', { count: 'exact', head: true })
```

### Get All Companies with Subscriptions:

```typescript
const { data } = await supabase
  .from('companies')
  .select(`
    *,
    company_subscriptions (
      status,
      subscription_plans (plan_key, display_name)
    )
  `)
```

### Calculate MRR:

```typescript
const { data: subscriptions } = await supabase
  .from('company_subscriptions')
  .select(`
    billing_cycle,
    subscription_plans (price_monthly, price_yearly)
  `)
  .eq('status', 'active')

let mrr = 0
subscriptions?.forEach((sub) => {
  const plan = sub.subscription_plans
  if (sub.billing_cycle === 'yearly') {
    mrr += (plan.price_yearly || 0) / 12
  } else {
    mrr += plan.price_monthly || 0
  }
})
```

---

## 🎯 Features

### ✅ Completed:
- SuperAdmin Layout with authentication
- Dashboard with real-time stats
- Companies management page
- Subscriptions management page
- Responsive design
- Dark sidebar
- Collapsible navigation
- Status badges
- Plan badges
- Search and filters
- Pagination (UI ready)

### ⏳ TODO:
- Platform Admins management
- Settings page
- Company details page
- Subscription editing
- Export functionality (backend)
- Real pagination (backend)
- Activity log (real data)
- Email notifications
- Webhooks management

---

## 🔒 Security

- ✅ Server-side auth check in layout
- ✅ RLS policies on database
- ✅ Only SUPERADMIN can access
- ✅ No client-side permissions exposed
- ✅ Token-based API access ready

---

## 🎨 Design System

### Colors:
- **Primary:** Blue (600)
- **Success:** Green (600)
- **Warning:** Yellow (600)
- **Danger:** Red (600)
- **SuperAdmin Accent:** Yellow (500)

### Icons:
- Lucide React icons
- Consistent sizing (h-4, h-5, h-6)
- Color-coded by context

### Spacing:
- Tailwind CSS utility classes
- Consistent padding/margins
- Responsive grid layouts

---

## 📱 Responsive Design

- ✅ Mobile-first approach
- ✅ Grid adapts to screen size
- ✅ Collapsible sidebar
- ✅ Horizontal scroll on tables
- ✅ Touch-friendly buttons

---

## 🚀 Next Steps

1. **Add Platform Admins page**
2. **Add Settings page**
3. **Implement company detail view**
4. **Add subscription editing**
5. **Connect export functionality**
6. **Add real-time activity logs**
7. **Implement webhooks management**
8. **Add email template editor**

---

## 🆘 Troubleshooting

### "Access Denied"
- Check if you're in `platform_admins` table
- Verify `is_active = true`
- Verify `role = 'SUPERADMIN'`

### "No Data Showing"
- Check RLS policies
- Verify service_role grants
- Check console for errors

### "Stats Not Updating"
- Stats are fetched server-side
- Refresh page to see updates
- Check database connection

---

## ✅ Testing Checklist

- [ ] Login as SuperAdmin
- [ ] Access `/superadmin`
- [ ] View dashboard stats
- [ ] Check subscription chart
- [ ] View companies list
- [ ] Search/filter companies
- [ ] View subscriptions list
- [ ] Search/filter subscriptions
- [ ] Check responsive design
- [ ] Test sidebar collapse
- [ ] Verify authentication
- [ ] Test "Back to CRM" link

---

## 🎉 Ready!

Your SuperAdmin Panel is now live at:
```
http://localhost:3001/superadmin
```

Login with your SuperAdmin credentials and start managing your SaaS platform!

