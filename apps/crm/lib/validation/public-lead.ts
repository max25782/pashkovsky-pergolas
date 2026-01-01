import { z } from 'zod'

/**
 * Lead submission schema
 * Used for public lead form submissions from marketing site
 */
export const PublicLeadSchema = z.object({
  // Contact info
  name: z.string().min(2, 'Name is too short').max(100),
  phone: z.string().min(9, 'Phone is too short').max(20),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  
  // Lead details
  message: z.string().max(1000).optional().or(z.literal('')),
  source: z.string().max(50).optional(), // e.g., 'contact-form', 'calculator', 'whatsapp-widget'
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  
  // Honeypot (should be empty)
  website: z.string().optional(),
  
  // Additional data (e.g., from calculator)
  metadata: z.record(z.any()).optional(),
})

export type PublicLeadInput = z.infer<typeof PublicLeadSchema>

