# Profiles Store - Aluminum Profiles E-Commerce Frontend

Next.js e-commerce storefront for aluminum profiles, integrated with the Profiles API backend.

## Features

- **Product Catalog**: Browse aluminum profiles with filtering and search
- **Product Details**: View detailed product information with length and color selection
- **Shopping Cart**: Add products to cart with persistent storage
- **Checkout**: Complete order flow with customer information collection
- **Multi-language**: Support for Hebrew, Russian, and English
- **Responsive Design**: Mobile-first responsive layout

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Profiles API running on `http://localhost:3002` (or configure `NEXT_PUBLIC_API_URL`)
- Company ID configured in environment variables

### Installation

```bash
cd apps/profiles-store
npm install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_COMPANY_ID=your-company-uuid
```

### Development

```bash
npm run dev
```

The app will be available at `http://localhost:3003`

### Build

```bash
npm run build
npm start
```

## Project Structure

```
apps/profiles-store/
├── app/
│   ├── [locale]/              # Localized routes
│   │   ├── layout.tsx         # Locale layout with header
│   │   ├── page.tsx          # Catalog page
│   │   ├── [profileId]/      # Product detail page
│   │   ├── cart/             # Shopping cart
│   │   ├── checkout/         # Checkout form
│   │   └── orders/[id]/       # Order confirmation
│   └── globals.css           # Global styles
├── components/
│   ├── layout/               # Layout components
│   ├── catalog/             # Catalog components
│   ├── product/             # Product detail components
│   ├── cart/                # Cart components
│   └── checkout/            # Checkout components
├── lib/
│   ├── api-client.ts        # API client functions
│   ├── cart-store.ts       # Zustand cart store
│   ├── locales.ts          # i18n translations
│   ├── format.ts           # Formatting utilities
│   └── cn.ts               # Class name utility
└── middleware.ts           # Locale routing middleware
```

## API Integration

The frontend communicates with the Profiles API backend:

- `GET /profiles` - List profiles
- `GET /profiles/:id` - Get profile details
- `GET /stock` - Get stock information
- `POST /orders` - Submit order

See `lib/api-client.ts` for implementation details.

## Styling

Uses Tailwind CSS with custom color palette matching the design specifications:

- Primary: `#0a6cff` (brand blue)
- Success: `#22c55e` (in stock badge)
- Gray scale: `#f5f5f5`, `#e5e5e5`, `#666666`, `#1a1a1a`

## Internationalization

Supports three locales:
- `he` (Hebrew) - Default
- `ru` (Russian)
- `en` (English)

Translations are defined in `lib/locales.ts`. The middleware automatically redirects to the default locale if none is specified.

## Cart Persistence

Cart state is persisted to localStorage using Zustand's persist middleware. Cart data survives page refreshes and browser sessions.
