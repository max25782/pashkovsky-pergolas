export const CRM_URL =
  process.env.NEXT_PUBLIC_CRM_URL ?? 'http://localhost:3001';

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://alumincrm.com';

export const LINKS = {
  register: `${CRM_URL}/register`,
  login: `${CRM_URL}/login`,
  contactSales: `mailto:sales@alumincrm.com`,
} as const;
