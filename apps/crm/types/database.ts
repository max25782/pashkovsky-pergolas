/**
 * Supabase Database Types
 * Auto-generated types from database schema
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          status: string
          plan: string
          industry?: string
          primary_email?: string
          primary_phone?: string
          address?: string
          logo_url?: string
          settings?: Json
          created_at: string
          updated_at: string
          trial_ends_at?: string
          subscription_ends_at?: string
        }
        Insert: {
          name: string
          slug: string
          status?: string
          plan?: string
          industry?: string
          primary_email?: string
          primary_phone?: string
          address?: string
          logo_url?: string
          settings?: Json
          trial_ends_at?: string
          subscription_ends_at?: string
        }
        Update: {
          name?: string
          slug?: string
          status?: string
          plan?: string
          industry?: string
          primary_email?: string
          primary_phone?: string
          address?: string
          logo_url?: string
          settings?: Json
          trial_ends_at?: string
          subscription_ends_at?: string
        }
      }
      subscription_plans: {
        Row: {
          id: string
          plan_key: string
          display_name: Json
          price_monthly: number
          price_yearly?: number
          features: string[]
          limits: Json
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscription_plans']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['subscription_plans']['Insert']>
      }
      company_subscriptions: {
        Row: {
          id: string
          company_id: string
          plan_id: string
          status: string
          payment_provider?: string
          payment_provider_subscription_id?: string
          payment_provider_customer_id?: string
          billing_cycle?: string
          auto_renew: boolean
          trial_ends_at?: string
          current_period_end?: string
          next_billing_date?: string
          canceled_at?: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['company_subscriptions']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['company_subscriptions']['Insert']>
      }
      subscription_history: {
        Row: {
          id: string
          company_id: string
          old_plan_id?: string
          new_plan_id: string
          changed_by: string
          change_reason?: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscription_history']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['subscription_history']['Insert']>
      }
      company_members: {
        Row: {
          id: string
          company_id: string
          user_id: string
          role: string
          permissions?: Json
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['company_members']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['company_members']['Insert']>
      }
      deals: {
        Row: {
          id: string
          company_id: string
          [key: string]: any
        }
        Insert: any
        Update: any
      }
      leads: {
        Row: {
          id: string
          company_id: string
          [key: string]: any
        }
        Insert: any
        Update: any
      }
      workers: {
        Row: {
          id: string
          company_id: string
          [key: string]: any
        }
        Insert: any
        Update: any
      }
      // Add more tables as needed
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
      }
    }
    Functions: {
      [key: string]: {
        Args: Record<string, any>
        Returns: any
      }
    }
  }
}

