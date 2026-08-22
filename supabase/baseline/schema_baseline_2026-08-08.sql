-- Production schema baseline
-- Project: kvqupacmdishpfnscnio
-- Captured: 2026-08-08
-- Schema only: no INSERT/COPY statements, no table rows queried.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

CREATE TYPE public.user_role AS ENUM ('admin', 'manager', 'worker', 'viewer', 'owner');

CREATE SEQUENCE IF NOT EXISTS public.articles_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;

CREATE TABLE public.ai_director_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.ai_director_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.ai_insights (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  insight_type text NOT NULL,
  insight_text text NOT NULL,
  priority text,
  metadata jsonb DEFAULT '{}'::jsonb,
  expires_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  message_count integer DEFAULT 0,
  window_start timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid,
  lead_id uuid,
  reminder_type text NOT NULL,
  title text NOT NULL,
  description text,
  due_date timestamp with time zone NOT NULL,
  completed boolean DEFAULT false,
  completed_at timestamp with time zone,
  priority text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  report_type text NOT NULL,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.ai_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  client_id text NOT NULL,
  last_activity timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  source text DEFAULT 'general'::text
);

CREATE TABLE public.aluminum_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  code text NOT NULL,
  name_he text,
  name_ru text,
  name_en text,
  dimensions text,
  weight_per_meter numeric NOT NULL,
  available_lengths numeric[] DEFAULT ARRAY[6.0, 6.5, 7.0, 8.0],
  category text,
  description_he text,
  description_ru text,
  description_en text,
  image_url text,
  price_per_kg numeric NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.articles (
  id bigint NOT NULL DEFAULT nextval('articles_id_seq'::regclass),
  slug text NOT NULL,
  title jsonb NOT NULL DEFAULT '{"en": "", "he": "", "ru": ""}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{"en": "", "he": "", "ru": ""}'::jsonb,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  author_id uuid,
  company_id uuid,
  published boolean DEFAULT false,
  published_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid,
  user_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id uuid,
  ip_address text,
  user_agent text,
  method text,
  path text,
  changes jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'success'::text,
  error_message text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.batches (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  supplier_id uuid,
  profile_id uuid NOT NULL,
  color text NOT NULL,
  length_meters numeric NOT NULL,
  quantity_pieces integer NOT NULL,
  weight_kg numeric,
  status text DEFAULT 'planned'::text,
  planned_arrival_date date,
  actual_arrival_date date,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.colors (
  id text NOT NULL,
  name_he text NOT NULL,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  hex_code text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.companies (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  status text DEFAULT 'active'::text,
  plan text DEFAULT 'trial'::text,
  industry text,
  primary_email text,
  primary_phone text,
  address text,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  trial_ends_at timestamp with time zone,
  subscription_ends_at timestamp with time zone,
  logo_url text,
  phone text,
  city text,
  country text DEFAULT 'Israel'::text,
  vat_number text,
  bank_name text,
  bank_account text,
  bank_branch text,
  brand_color text DEFAULT '#2563EB'::text,
  email_signature text,
  pdf_footer text,
  early_bird_position integer,
  trial_reminder_sent_at timestamp with time zone
);

CREATE TABLE public.company_integrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'webhook'::text,
  status text NOT NULL DEFAULT 'not_connected'::text,
  website_url text,
  webhook_secret text NOT NULL,
  last_event_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.company_members (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer'::user_role,
  permissions jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  invited_by uuid,
  invited_at timestamp with time zone,
  joined_at timestamp with time zone,
  accepted_at timestamp with time zone,
  crm_intro_completed_at timestamp with time zone
);

CREATE TABLE public.company_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  company_name text,
  logo_url text,
  primary_color text DEFAULT '#3b82f6'::text,
  currency text DEFAULT '₪'::text,
  vat_percent numeric DEFAULT 18,
  default_pergola_price_per_sqm numeric DEFAULT 750,
  default_santaf_basic_price numeric DEFAULT 220,
  default_santaf_structure_price numeric DEFAULT 450,
  default_zip_manual_price numeric DEFAULT 650,
  default_zip_electric_price numeric DEFAULT 800,
  default_lighting_price_per_meter numeric DEFAULT 100,
  default_drainage_price_per_meter numeric DEFAULT 80,
  payment_terms_template text DEFAULT 'תשלום: 40% מקדמה, 30% באמצע עבודה, 30% בסיום'::text,
  warranty_years integer DEFAULT 10,
  warranty_covers text[] DEFAULT ARRAY['מבנה אלומיניום'::text, 'צביעה'::text, 'מנגנונים'::text],
  whatsapp_template text DEFAULT 'שלום {customerName},\n\nלצפייה ואישור הצעת המחיר שלך לחץ כאן:\n{offerUrl}\n\nתודה!\n{companyName}'::text,
  email_subject_template text DEFAULT 'הצעת מחיר - {companyName}'::text,
  email_body_template text DEFAULT '<p>שלום {customerName},</p><p>בצירוף הצעת המחיר שלך.</p>'::text,
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.company_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  plan_id uuid,
  status varchar(20) NOT NULL,
  payment_provider varchar(20),
  payment_provider_subscription_id varchar(255),
  payment_provider_customer_id varchar(255),
  billing_cycle varchar(20),
  auto_renew boolean DEFAULT true,
  trial_ends_at timestamp with time zone,
  current_period_end timestamp with time zone,
  next_billing_date timestamp with time zone,
  canceled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.company_usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  period_start timestamp with time zone NOT NULL,
  period_end timestamp with time zone NOT NULL,
  deals_created integer DEFAULT 0,
  offers_created integer DEFAULT 0,
  pdfs_generated integer DEFAULT 0,
  whatsapp_sent integer DEFAULT 0,
  emails_sent integer DEFAULT 0,
  storage_used_mb numeric DEFAULT 0,
  api_calls integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.configurator_link_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  locale text NOT NULL DEFAULT 'he'::text,
  prefill_config jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone
);

CREATE TABLE public.deal_fence_details (
  deal_id uuid NOT NULL,
  company_id uuid NOT NULL,
  meters_total numeric(10,2) NOT NULL,
  height_cm numeric(10,2),
  fence_variant text NOT NULL,
  color text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.deal_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  company_id uuid NOT NULL,
  amount numeric(10,2) NOT NULL,
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.deal_railings_details (
  deal_id uuid NOT NULL,
  company_id uuid NOT NULL,
  meters_total numeric(10,2) NOT NULL,
  height_cm numeric(10,2),
  profile_type text NOT NULL,
  color text NOT NULL,
  location_type text NOT NULL,
  glass_type text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  railing_type text,
  material text,
  glazing_system text
);

CREATE TABLE public.deal_tags (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL,
  tag text NOT NULL,
  tag_type text NOT NULL,
  confidence_score numeric(3,2),
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.deals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  customer_city text,
  deal_status text NOT NULL DEFAULT 'in_progress'::text,
  deal_type text,
  project_address text,
  project_description text,
  total_amount numeric(10,2),
  deposit_amount numeric(10,2),
  final_amount numeric(10,2),
  currency text DEFAULT 'ILS'::text,
  payment_status text,
  deal_date timestamp with time zone DEFAULT now(),
  confirmed_date timestamp with time zone,
  production_start_date timestamp with time zone,
  completion_date timestamp with time zone,
  delivery_date timestamp with time zone,
  installation_date timestamp with time zone,
  project_config jsonb,
  materials jsonb,
  measurements jsonb,
  notes text,
  internal_notes text,
  communication_log jsonb,
  sales_person text,
  project_manager text,
  installer text,
  source text,
  referral_source text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  created_by text,
  updated_by text,
  project_type text,
  width numeric,
  depth numeric,
  shape text,
  material text,
  color_ral text,
  price numeric,
  stage text DEFAULT 'new'::text,
  files jsonb,
  manager text,
  my_cost numeric,
  order_date timestamp with time zone,
  material_order_date timestamp with time zone,
  material_received_date timestamp with time zone,
  lighting text,
  sketch_image_url text,
  sketch_json jsonb,
  shading_ratio text,
  finish_type text,
  finish_value text,
  laundry_model text,
  laundry_distance numeric(10,2),
  laundry_lighting boolean,
  company_id uuid NOT NULL,
  work_type text NOT NULL DEFAULT 'pergola'::text,
  customer_type text NOT NULL DEFAULT 'private'::text,
  pricing_model text NOT NULL DEFAULT 'fixed'::text,
  contractor_payment_profile jsonb
);

CREATE TABLE public.early_bird_program (
  id integer NOT NULL DEFAULT 1,
  total_spots integer NOT NULL DEFAULT 20
);

CREATE TABLE public.email_verification_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.gallery_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name_he text,
  name_ru text,
  name_en text,
  description_he text,
  description_ru text,
  description_en text,
  image_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.gallery_images (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_key text NOT NULL,
  filename text NOT NULL,
  url text NOT NULL,
  storage_path text NOT NULL,
  size integer,
  width integer,
  height integer,
  mime_type text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.integration_events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  integration_id uuid,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  status text DEFAULT 'waiting'::text,
  source text DEFAULT 'pre-whatsapp'::text,
  last_message text,
  last_message_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  company_id uuid NOT NULL,
  email text,
  message text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  metadata jsonb DEFAULT '{}'::jsonb,
  gclid text,
  google_conv_sent boolean DEFAULT false,
  google_conv_sent_at timestamp with time zone,
  score integer,
  score_updated_at timestamp with time zone,
  score_breakdown_json jsonb DEFAULT '{}'::jsonb,
  city text
);

CREATE TABLE public.material_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  offer_id uuid,
  material_type text NOT NULL,
  material_description text,
  quantity numeric(10,2),
  unit text DEFAULT 'pcs'::text,
  supplier_name text,
  supplier_contact text,
  supplier_email text,
  supplier_phone text,
  order_date timestamp with time zone NOT NULL DEFAULT now(),
  expected_delivery_date timestamp with time zone,
  actual_delivery_date timestamp with time zone,
  unit_price numeric(10,2),
  total_price numeric(10,2),
  currency text DEFAULT 'ILS'::text,
  status text NOT NULL DEFAULT 'ordered'::text,
  tracking_number text,
  tracking_url text,
  notes text,
  internal_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by text,
  company_id uuid NOT NULL
);

CREATE TABLE public.media_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  s3_bucket text NOT NULL,
  s3_key text NOT NULL,
  mime_type text,
  size_bytes bigint,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  caption text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  category text
);

CREATE TABLE public.offers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  deal_id text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  customer_city text,
  pergola_width numeric(10,2),
  pergola_length numeric(10,2),
  pergola_height numeric(10,2),
  pergola_location text,
  pergola_price_per_sqm numeric(10,2) NOT NULL DEFAULT 750,
  color_type text NOT NULL,
  color_ral_code text,
  color_wood_name text,
  roof_type text,
  roof_santaf_color text,
  santaf_enabled boolean NOT NULL DEFAULT false,
  santaf_with_structure boolean NOT NULL DEFAULT false,
  santaf_price_per_sqm_basic numeric(10,2) NOT NULL DEFAULT 220,
  santaf_price_per_sqm_with_structure numeric(10,2) NOT NULL DEFAULT 450,
  zip_screen_enabled boolean NOT NULL DEFAULT false,
  zip_screen_type text,
  zip_screen_price_per_sqm_manual numeric(10,2) NOT NULL DEFAULT 650,
  zip_screen_price_per_sqm_electric numeric(10,2) NOT NULL DEFAULT 800,
  zip_screen_running_meters numeric(10,2),
  lighting_enabled boolean NOT NULL DEFAULT false,
  lighting_price_per_meter numeric(10,2) NOT NULL DEFAULT 200,
  lighting_running_meters numeric(10,2),
  drainage_enabled boolean NOT NULL DEFAULT false,
  drainage_price_per_meter numeric(10,2) NOT NULL DEFAULT 500,
  drainage_running_meters numeric(10,2),
  winter_closure_enabled boolean NOT NULL DEFAULT false,
  winter_closure_type text,
  winter_closure_glass_type text,
  options_notes text,
  area numeric(10,2) NOT NULL,
  pergola_total numeric(10,2) NOT NULL,
  santaf_total numeric(10,2) NOT NULL DEFAULT 0,
  zip_screen_total numeric(10,2) NOT NULL DEFAULT 0,
  lighting_total numeric(10,2) NOT NULL DEFAULT 0,
  drainage_total numeric(10,2) NOT NULL DEFAULT 0,
  total_before_vat numeric(10,2) NOT NULL,
  vat_percent numeric(5,2) NOT NULL DEFAULT 18,
  vat_amount numeric(10,2) NOT NULL,
  price_with_vat numeric(10,2) NOT NULL,
  discount_percent numeric(5,2) NOT NULL DEFAULT 0,
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  final_price numeric(10,2) NOT NULL,
  payment_terms jsonb NOT NULL DEFAULT '{"text": "10% מקדמה וכל השאר בסיום התקנה בהעברה בנקאית", "method": "bankTransfer", "advancePercent": 10, "remainingPercent": 90}'::jsonb,
  warranty jsonb NOT NULL DEFAULT '{"years": 7, "covers": ["צבע", "קונסטרוקציה", "סנטף"]}'::jsonb,
  images text[],
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamp with time zone,
  signature_image text,
  approval_customer_name text,
  approval_customer_phone text,
  pdf_url text,
  pdf_created_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  shading_ratio text,
  finish_type text,
  finish_value text,
  company_id uuid NOT NULL,
  pergola_shape_type text DEFAULT 'rectangle'::text,
  pergola_shape_data jsonb,
  winter_closure_price_per_sqm numeric(10,2),
  winter_closure_area numeric(10,2),
  winter_closure_total numeric(10,2) DEFAULT 0,
  winter_closure_items jsonb DEFAULT '[]'::jsonb,
  pergolas_data jsonb,
  configurator_meta jsonb,
  quick_offer_extra jsonb,
  pdf_locale text
);

CREATE TABLE public.onboarding_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  task_key text NOT NULL,
  completed_at timestamp with time zone,
  skipped_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  color text NOT NULL,
  length_meters numeric NOT NULL,
  quantity_pieces integer NOT NULL,
  weight_per_piece numeric NOT NULL,
  total_weight_kg numeric NOT NULL,
  price_per_kg numeric,
  price_per_piece numeric,
  subtotal numeric
);

CREATE TABLE public.password_reset_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.pergola_config_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  screenshot text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  offer_id uuid,
  configurator_token_id uuid
);

CREATE TABLE public.pergola_projects (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title_he text NOT NULL,
  title_ru text,
  title_en text,
  desc_he text,
  desc_ru text,
  desc_en text,
  images text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  key text NOT NULL,
  description text,
  price_monthly numeric(10,2) NOT NULL DEFAULT 0,
  price_yearly numeric(10,2) NOT NULL DEFAULT 0,
  currency text DEFAULT 'ILS'::text,
  features jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE public.platform_admins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  permissions jsonb DEFAULT '{"manage_plans": true, "manage_billing": true, "view_analytics": true, "manage_all_companies": true}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  phone varchar(20),
  email varchar(255)
);

CREATE TABLE public.platform_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  actor_admin_id uuid,
  actor_user_id uuid,
  company_id uuid,
  event_type text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.platform_settings (
  id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid,
  maintenance_mode boolean DEFAULT false,
  maintenance_message jsonb DEFAULT '{"en": "", "he": "", "ru": ""}'::jsonb,
  default_plan text DEFAULT 'trial'::text,
  trial_days integer DEFAULT 14,
  manual_payments_enabled boolean DEFAULT true,
  manual_payment_methods jsonb DEFAULT '["bit", "paybox", "bank"]'::jsonb,
  ai_enabled boolean DEFAULT true,
  ai_daily_limit integer DEFAULT 100,
  vat_percent numeric(5,2) DEFAULT 17.00,
  feature_flags jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone DEFAULT now(),
  updated_by uuid
);

CREATE TABLE public.profile_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  order_number text,
  customer_name text NOT NULL,
  customer_phone text,
  customer_email text,
  customer_city text,
  status text DEFAULT 'pending_price'::text,
  total_weight_kg numeric,
  total_amount numeric,
  discount_percent numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  final_amount numeric,
  payment_status text DEFAULT 'pending'::text,
  delivery_address text,
  delivery_date date,
  notes text,
  customer_notes text,
  source text DEFAULT 'website'::text,
  deal_id uuid,
  priced_at timestamp with time zone,
  priced_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.profiles (
  id text NOT NULL,
  name_he text NOT NULL,
  name_ru text NOT NULL,
  name_en text NOT NULL,
  category text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  image_url text,
  description_he text,
  description_ru text,
  description_en text,
  is_special boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.refresh_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  last_used_at timestamp with time zone,
  device_info text,
  ip_address text
);

CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  batch_id uuid,
  color text NOT NULL,
  length_meters numeric NOT NULL,
  qty_available integer NOT NULL DEFAULT 0,
  qty_reserved integer NOT NULL DEFAULT 0,
  qty_used integer NOT NULL DEFAULT 0,
  location text,
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.subscription_history (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  company_id uuid NOT NULL,
  old_plan_id uuid,
  new_plan_id uuid NOT NULL,
  changed_by uuid,
  change_reason text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.subscription_plans (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  plan_key varchar(30) NOT NULL,
  display_name jsonb NOT NULL,
  price_monthly numeric(10,2) NOT NULL,
  price_yearly numeric(10,2),
  features jsonb NOT NULL,
  limits jsonb NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer,
  created_at timestamp with time zone DEFAULT now(),
  currency varchar(10) DEFAULT 'USD'::character varying
);

CREATE TABLE public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  external_subscription_id text,
  external_customer_id text,
  payment_provider text,
  status text NOT NULL DEFAULT 'active'::text,
  current_period_start timestamp with time zone NOT NULL,
  current_period_end timestamp with time zone NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.suppliers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  contact_person text,
  phone text,
  email text,
  payment_terms text,
  notes text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.usage (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  order_id uuid,
  color text NOT NULL,
  length_meters numeric NOT NULL,
  quantity_pieces integer NOT NULL,
  weight_kg numeric NOT NULL,
  used_at timestamp with time zone DEFAULT now(),
  notes text
);

CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_login_at timestamp with time zone,
  email_verified_at timestamp with time zone,
  plan text NOT NULL DEFAULT 'offer'::text
);

CREATE TABLE public.weekly_digests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id text NOT NULL,
  period_from date NOT NULL,
  period_to date NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_text text NOT NULL,
  status text NOT NULL DEFAULT 'generated'::text,
  error_message text
);

CREATE TABLE public.whatsapp_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  message_text text NOT NULL,
  direction text NOT NULL,
  sentiment text,
  ai_suggested_response text,
  deal_id uuid,
  lead_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE TABLE public.work_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  date date NOT NULL,
  pay_type text NOT NULL DEFAULT 'daily'::text,
  daily_rate_snapshot numeric(10,2) NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL
);

CREATE TABLE public.worker_shifts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  worker_id uuid NOT NULL,
  deal_id uuid,
  shift_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  minutes_worked integer,
  computed_cost numeric(10,2),
  note text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  project_name text,
  shift_type text NOT NULL DEFAULT 'work'::text
);

CREATE TABLE public.workers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  phone text,
  role text,
  daily_rate numeric(10,2) NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  company_id uuid NOT NULL,
  hourly_rate numeric(10,2)
);

ALTER TABLE public.ai_director_messages ADD CONSTRAINT ai_director_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_director_messages ADD CONSTRAINT ai_director_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));
ALTER TABLE public.ai_director_messages ADD CONSTRAINT ai_director_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES ai_director_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.ai_director_sessions ADD CONSTRAINT ai_director_sessions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.ai_director_sessions ADD CONSTRAINT ai_director_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_insight_type_check CHECK ((insight_type = ANY (ARRAY['recommendation'::text, 'risk'::text, 'price'::text, 'timeline'::text, 'general'::text])));
ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_insights ADD CONSTRAINT ai_insights_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])));
ALTER TABLE public.ai_messages ADD CONSTRAINT ai_messages_session_id_fkey FOREIGN KEY (session_id) REFERENCES ai_sessions(id) ON DELETE CASCADE;
ALTER TABLE public.ai_rate_limits ADD CONSTRAINT ai_rate_limits_client_id_key UNIQUE (client_id);
ALTER TABLE public.ai_rate_limits ADD CONSTRAINT ai_rate_limits_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_reminders ADD CONSTRAINT ai_reminders_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.ai_reminders ADD CONSTRAINT ai_reminders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;
ALTER TABLE public.ai_reminders ADD CONSTRAINT ai_reminders_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_reminders ADD CONSTRAINT ai_reminders_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'critical'::text])));
ALTER TABLE public.ai_reminders ADD CONSTRAINT ai_reminders_reminder_type_check CHECK ((reminder_type = ANY (ARRAY['call'::text, 'message'::text, 'follow_up'::text, 'deadline'::text, 'custom'::text])));
ALTER TABLE public.ai_reports ADD CONSTRAINT ai_reports_pkey PRIMARY KEY (id);
ALTER TABLE public.ai_reports ADD CONSTRAINT ai_reports_report_type_check CHECK ((report_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'custom'::text])));
ALTER TABLE public.ai_sessions ADD CONSTRAINT ai_sessions_pkey PRIMARY KEY (id);
ALTER TABLE public.aluminum_profiles ADD CONSTRAINT aluminum_profiles_category_check CHECK ((category = ANY (ARRAY['pergulas'::text, 'fancy'::text, 'railling'::text, 'concealed'::text, 'window'::text])));
ALTER TABLE public.aluminum_profiles ADD CONSTRAINT aluminum_profiles_company_id_code_key UNIQUE (company_id, code);
ALTER TABLE public.aluminum_profiles ADD CONSTRAINT aluminum_profiles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.aluminum_profiles ADD CONSTRAINT aluminum_profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.articles ADD CONSTRAINT articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.articles ADD CONSTRAINT articles_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.articles ADD CONSTRAINT articles_pkey PRIMARY KEY (id);
ALTER TABLE public.articles ADD CONSTRAINT articles_slug_key UNIQUE (slug);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE public.batches ADD CONSTRAINT batches_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.batches ADD CONSTRAINT batches_pkey PRIMARY KEY (id);
ALTER TABLE public.batches ADD CONSTRAINT batches_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES aluminum_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.batches ADD CONSTRAINT batches_quantity_pieces_check CHECK ((quantity_pieces > 0));
ALTER TABLE public.batches ADD CONSTRAINT batches_status_check CHECK ((status = ANY (ARRAY['planned'::text, 'in_transit'::text, 'arrived'::text, 'cancelled'::text])));
ALTER TABLE public.batches ADD CONSTRAINT batches_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
ALTER TABLE public.colors ADD CONSTRAINT colors_pkey PRIMARY KEY (id);
ALTER TABLE public.companies ADD CONSTRAINT companies_pkey PRIMARY KEY (id);
ALTER TABLE public.companies ADD CONSTRAINT companies_slug_key UNIQUE (slug);
ALTER TABLE public.companies ADD CONSTRAINT companies_status_check CHECK ((status = ANY (ARRAY['trial'::text, 'active'::text, 'suspended'::text, 'cancelled'::text])));
ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_company_id_key UNIQUE (company_id);
ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_pkey PRIMARY KEY (id);
ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_status_check CHECK ((status = ANY (ARRAY['not_connected'::text, 'pending_payment'::text, 'active'::text, 'suspended'::text])));
ALTER TABLE public.company_integrations ADD CONSTRAINT company_integrations_type_check CHECK ((type = ANY (ARRAY['webhook'::text, 'wordpress'::text])));
ALTER TABLE public.company_members ADD CONSTRAINT company_members_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.company_members ADD CONSTRAINT company_members_company_id_user_id_key UNIQUE (company_id, user_id);
ALTER TABLE public.company_members ADD CONSTRAINT company_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES users(id);
ALTER TABLE public.company_members ADD CONSTRAINT company_members_pkey PRIMARY KEY (id);
ALTER TABLE public.company_members ADD CONSTRAINT company_members_role_check CHECK ((role = ANY (ARRAY['owner'::user_role, 'admin'::user_role, 'manager'::user_role, 'worker'::user_role, 'viewer'::user_role])));
ALTER TABLE public.company_members ADD CONSTRAINT company_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);
ALTER TABLE public.company_settings ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_billing_cycle_check CHECK (((billing_cycle)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[])));
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_company_id_key UNIQUE (company_id);
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_payment_provider_check CHECK (((payment_provider IS NULL) OR ((payment_provider)::text = ANY ((ARRAY['stripe'::character varying, 'manual'::character varying, 'bit'::character varying, 'paybox'::character varying, 'paypal'::character varying])::text[]))));
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES subscription_plans(id);
ALTER TABLE public.company_subscriptions ADD CONSTRAINT company_subscriptions_status_check CHECK (((status)::text = ANY ((ARRAY['trialing'::character varying, 'active'::character varying, 'past_due'::character varying, 'canceled'::character varying, 'suspended'::character varying])::text[])));
ALTER TABLE public.company_usage ADD CONSTRAINT company_usage_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.company_usage ADD CONSTRAINT company_usage_company_id_period_start_key UNIQUE (company_id, period_start);
ALTER TABLE public.company_usage ADD CONSTRAINT company_usage_pkey PRIMARY KEY (id);
ALTER TABLE public.configurator_link_tokens ADD CONSTRAINT configurator_link_tokens_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE;
ALTER TABLE public.configurator_link_tokens ADD CONSTRAINT configurator_link_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.configurator_link_tokens ADD CONSTRAINT configurator_link_tokens_token_key UNIQUE (token);
ALTER TABLE public.deal_fence_details ADD CONSTRAINT deal_fence_details_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.deal_fence_details ADD CONSTRAINT deal_fence_details_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.deal_fence_details ADD CONSTRAINT deal_fence_details_fence_variant_check CHECK ((fence_variant = ANY (ARRAY['classic'::text, 'hitech'::text, 'hitech_angular'::text])));
ALTER TABLE public.deal_fence_details ADD CONSTRAINT deal_fence_details_meters_total_check CHECK ((meters_total > (0)::numeric));
ALTER TABLE public.deal_fence_details ADD CONSTRAINT deal_fence_details_pkey PRIMARY KEY (deal_id);
ALTER TABLE public.deal_payments ADD CONSTRAINT deal_payments_amount_check CHECK ((amount > (0)::numeric));
ALTER TABLE public.deal_payments ADD CONSTRAINT deal_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.deal_payments ADD CONSTRAINT deal_payments_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.deal_payments ADD CONSTRAINT deal_payments_pkey PRIMARY KEY (id);
ALTER TABLE public.deal_railings_details ADD CONSTRAINT deal_railings_details_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.deal_railings_details ADD CONSTRAINT deal_railings_details_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.deal_railings_details ADD CONSTRAINT deal_railings_details_glazing_system_check CHECK (((glazing_system IS NULL) OR (glazing_system = ANY (ARRAY['aluminum_glass'::text, 'wet_glazing'::text, 'dry_glazing'::text]))));
ALTER TABLE public.deal_railings_details ADD CONSTRAINT deal_railings_details_location_type_check CHECK ((location_type = ANY (ARRAY['balcony'::text, 'stairs'::text, 'roof'::text, 'yard'::text, 'other'::text])));
ALTER TABLE public.deal_railings_details ADD CONSTRAINT deal_railings_details_meters_total_check CHECK ((meters_total > (0)::numeric));
ALTER TABLE public.deal_railings_details ADD CONSTRAINT deal_railings_details_pkey PRIMARY KEY (deal_id);
ALTER TABLE public.deal_tags ADD CONSTRAINT deal_tags_confidence_score_check CHECK (((confidence_score >= (0)::numeric) AND (confidence_score <= (1)::numeric)));
ALTER TABLE public.deal_tags ADD CONSTRAINT deal_tags_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.deal_tags ADD CONSTRAINT deal_tags_deal_id_tag_key UNIQUE (deal_id, tag);
ALTER TABLE public.deal_tags ADD CONSTRAINT deal_tags_pkey PRIMARY KEY (id);
ALTER TABLE public.deal_tags ADD CONSTRAINT deal_tags_tag_type_check CHECK ((tag_type = ANY (ARRAY['auto'::text, 'manual'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.deals ADD CONSTRAINT deals_customer_type_check CHECK ((customer_type = ANY (ARRAY['private'::text, 'contractor'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_deal_status_check CHECK ((deal_status = ANY (ARRAY['in_progress'::text, 'confirmed'::text, 'in_production'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_finish_type_check CHECK ((finish_type = ANY (ARRAY['ral'::text, 'wood'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.deals ADD CONSTRAINT deals_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'refunded'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_pkey PRIMARY KEY (id);
ALTER TABLE public.deals ADD CONSTRAINT deals_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['fixed'::text, 'per_meter'::text, 'per_sqm'::text, 'custom'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_shading_ratio_check CHECK ((shading_ratio = ANY (ARRAY['40/20'::text, '50/20'::text, '70/20'::text])));
ALTER TABLE public.deals ADD CONSTRAINT deals_work_type_check CHECK ((work_type = ANY (ARRAY['pergola'::text, 'railings'::text, 'gates'::text, 'facade'::text, 'fence'::text, 'other'::text])));
ALTER TABLE public.early_bird_program ADD CONSTRAINT early_bird_program_pkey PRIMARY KEY (id);
ALTER TABLE public.early_bird_program ADD CONSTRAINT early_bird_program_singleton CHECK ((id = 1));
ALTER TABLE public.email_verification_tokens ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.email_verification_tokens ADD CONSTRAINT email_verification_tokens_token_key UNIQUE (token);
ALTER TABLE public.email_verification_tokens ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.email_verification_tokens ADD CONSTRAINT email_verification_tokens_user_id_token_key UNIQUE (user_id, token);
ALTER TABLE public.gallery_categories ADD CONSTRAINT gallery_categories_key_key UNIQUE (key);
ALTER TABLE public.gallery_categories ADD CONSTRAINT gallery_categories_pkey PRIMARY KEY (id);
ALTER TABLE public.gallery_images ADD CONSTRAINT gallery_images_category_key_filename_key UNIQUE (category_key, filename);
ALTER TABLE public.gallery_images ADD CONSTRAINT gallery_images_category_key_fkey FOREIGN KEY (category_key) REFERENCES gallery_categories(key) ON DELETE CASCADE;
ALTER TABLE public.gallery_images ADD CONSTRAINT gallery_images_pkey PRIMARY KEY (id);
ALTER TABLE public.integration_events ADD CONSTRAINT integration_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.integration_events ADD CONSTRAINT integration_events_event_type_check CHECK ((event_type = ANY (ARRAY['lead_received'::text, 'test_ping'::text, 'setup_requested'::text, 'activated'::text, 'suspended'::text])));
ALTER TABLE public.integration_events ADD CONSTRAINT integration_events_integration_id_fkey FOREIGN KEY (integration_id) REFERENCES company_integrations(id) ON DELETE SET NULL;
ALTER TABLE public.integration_events ADD CONSTRAINT integration_events_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.leads ADD CONSTRAINT leads_phone_key UNIQUE (phone);
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_score_check CHECK (((score >= 0) AND (score <= 100)));
ALTER TABLE public.leads ADD CONSTRAINT leads_source_check CHECK (((source IS NULL) OR (length(source) > 0)));
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'busy'::text, 'no_answer'::text, 'thinking'::text, 'meeting_set'::text, 'visited'::text, 'not_relevant'::text, 'not_interested'::text, 'lost_contact'::text])));
ALTER TABLE public.material_orders ADD CONSTRAINT material_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.material_orders ADD CONSTRAINT material_orders_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE public.material_orders ADD CONSTRAINT material_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.material_orders ADD CONSTRAINT material_orders_status_check CHECK ((status = ANY (ARRAY['ordered'::text, 'confirmed'::text, 'in_transit'::text, 'delivered'::text, 'cancelled'::text])));
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_company_id_s3_key_key UNIQUE (company_id, s3_key);
ALTER TABLE public.media_assets ADD CONSTRAINT media_assets_pkey PRIMARY KEY (id);
ALTER TABLE public.offers ADD CONSTRAINT offers_color_type_check CHECK ((color_type = ANY (ARRAY['white'::text, 'black'::text, 'cream'::text, 'ral'::text, 'wood'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.offers ADD CONSTRAINT offers_finish_type_check CHECK ((finish_type = ANY (ARRAY['ral'::text, 'wood'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_pergola_shape_type_check CHECK ((pergola_shape_type = ANY (ARRAY['rectangle'::text, 'L'::text, 'X'::text, 'U'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_pkey PRIMARY KEY (id);
ALTER TABLE public.offers ADD CONSTRAINT offers_roof_santaf_color_check CHECK ((roof_santaf_color = ANY (ARRAY['transparent'::text, 'gray'::text, 'white'::text, 'gold'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_roof_type_check CHECK ((roof_type = ANY (ARRAY['santaf'::text, 'triplexGlass'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_shading_ratio_check CHECK ((shading_ratio = ANY (ARRAY['40/20'::text, '50/20'::text, '70/20'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_winter_closure_glass_type_check CHECK ((winter_closure_glass_type = ANY (ARRAY['tempered'::text, 'triplex'::text, 'insulated'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_winter_closure_type_check CHECK ((winter_closure_type = ANY (ARRAY['foldingGlass'::text, 'windows7000'::text, 'windows9000'::text, 'fixedGlass'::text, 'slidingShowcase7000'::text, 'slidingShowcase9000'::text])));
ALTER TABLE public.offers ADD CONSTRAINT offers_zip_screen_type_check CHECK ((zip_screen_type = ANY (ARRAY['manual'::text, 'electric'::text])));
ALTER TABLE public.onboarding_tasks ADD CONSTRAINT onboarding_tasks_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.onboarding_tasks ADD CONSTRAINT onboarding_tasks_company_id_task_key_key UNIQUE (company_id, task_key);
ALTER TABLE public.onboarding_tasks ADD CONSTRAINT onboarding_tasks_pkey PRIMARY KEY (id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES profile_orders(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES aluminum_profiles(id);
ALTER TABLE public.order_items ADD CONSTRAINT order_items_quantity_pieces_check CHECK ((quantity_pieces > 0));
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_token_key UNIQUE (token);
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.password_reset_tokens ADD CONSTRAINT password_reset_tokens_user_id_token_key UNIQUE (user_id, token);
ALTER TABLE public.pergola_config_submissions ADD CONSTRAINT pergola_config_submissions_configurator_token_id_fkey FOREIGN KEY (configurator_token_id) REFERENCES configurator_link_tokens(id) ON DELETE SET NULL;
ALTER TABLE public.pergola_config_submissions ADD CONSTRAINT pergola_config_submissions_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;
ALTER TABLE public.pergola_config_submissions ADD CONSTRAINT pergola_config_submissions_pkey PRIMARY KEY (id);
ALTER TABLE public.pergola_projects ADD CONSTRAINT pergola_projects_pkey PRIMARY KEY (id);
ALTER TABLE public.plans ADD CONSTRAINT plans_key_key UNIQUE (key);
ALTER TABLE public.plans ADD CONSTRAINT plans_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_phone_key UNIQUE (phone);
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_role_check CHECK ((role = ANY (ARRAY['superadmin'::text, 'admin'::text, 'support'::text])));
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.platform_admins ADD CONSTRAINT platform_admins_user_id_key UNIQUE (user_id);
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT platform_audit_logs_actor_admin_id_fkey FOREIGN KEY (actor_admin_id) REFERENCES platform_admins(user_id) ON DELETE SET NULL;
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT platform_audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT platform_audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT platform_audit_logs_event_type_check CHECK ((event_type = ANY (ARRAY['company_created'::text, 'company_deleted'::text, 'plan_changed'::text, 'payment_confirmed'::text, 'admin_added'::text, 'admin_deactivated'::text, 'settings_updated'::text, 'user_invited'::text, 'subscription_canceled'::text, 'integration_activated'::text, 'integration_suspended'::text, 'integration_secret_rotated'::text])));
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT platform_audit_logs_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_audit_logs ADD CONSTRAINT valid_actor CHECK (((actor_admin_id IS NOT NULL) OR (actor_user_id IS NOT NULL)));
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_ai_daily_limit_check CHECK ((ai_daily_limit > 0));
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_pkey PRIMARY KEY (id);
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_trial_days_check CHECK (((trial_days >= 0) AND (trial_days <= 90)));
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_vat_percent_check CHECK (((vat_percent >= (0)::numeric) AND (vat_percent <= (100)::numeric)));
ALTER TABLE public.platform_settings ADD CONSTRAINT single_row_check CHECK ((id = '00000000-0000-0000-0000-000000000001'::uuid));
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id);
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_discount_amount_check CHECK ((discount_amount >= (0)::numeric));
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_discount_percent_check CHECK (((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric)));
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_order_number_key UNIQUE (order_number);
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'refunded'::text])));
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_pkey PRIMARY KEY (id);
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_priced_by_fkey FOREIGN KEY (priced_by) REFERENCES users(id);
ALTER TABLE public.profile_orders ADD CONSTRAINT profile_orders_status_check CHECK ((status = ANY (ARRAY['pending_price'::text, 'priced'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'delivered'::text, 'cancelled'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_category_check CHECK ((category = ANY (ARRAY['columns'::text, 'shading'::text, 'perimeter'::text, 'dividers'::text])));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE public.refresh_tokens ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);
ALTER TABLE public.refresh_tokens ADD CONSTRAINT refresh_tokens_token_hash_key UNIQUE (token_hash);
ALTER TABLE public.refresh_tokens ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);
ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_resource_action_key UNIQUE (role, resource, action);
ALTER TABLE public.stock ADD CONSTRAINT stock_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES batches(id);
ALTER TABLE public.stock ADD CONSTRAINT stock_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.stock ADD CONSTRAINT stock_company_id_profile_id_batch_id_color_length_meters_key UNIQUE (company_id, profile_id, batch_id, color, length_meters);
ALTER TABLE public.stock ADD CONSTRAINT stock_pkey PRIMARY KEY (id);
ALTER TABLE public.stock ADD CONSTRAINT stock_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES aluminum_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.stock ADD CONSTRAINT stock_qty_available_check CHECK ((qty_available >= 0));
ALTER TABLE public.stock ADD CONSTRAINT stock_qty_reserved_check CHECK ((qty_reserved >= 0));
ALTER TABLE public.stock ADD CONSTRAINT stock_qty_used_check CHECK ((qty_used >= 0));
ALTER TABLE public.subscription_history ADD CONSTRAINT subscription_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id);
ALTER TABLE public.subscription_history ADD CONSTRAINT subscription_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.subscription_history ADD CONSTRAINT subscription_history_new_plan_id_fkey FOREIGN KEY (new_plan_id) REFERENCES subscription_plans(id);
ALTER TABLE public.subscription_history ADD CONSTRAINT subscription_history_old_plan_id_fkey FOREIGN KEY (old_plan_id) REFERENCES subscription_plans(id);
ALTER TABLE public.subscription_history ADD CONSTRAINT subscription_history_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_plan_key_key UNIQUE (plan_key);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_payment_provider_check CHECK ((payment_provider = ANY (ARRAY['stripe'::text, 'tranzila'::text, 'manual'::text])));
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['trialing'::text, 'active'::text, 'past_due'::text, 'cancelled'::text, 'unpaid'::text])));
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);
ALTER TABLE public.usage ADD CONSTRAINT usage_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES batches(id);
ALTER TABLE public.usage ADD CONSTRAINT usage_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.usage ADD CONSTRAINT usage_order_id_fkey FOREIGN KEY (order_id) REFERENCES profile_orders(id);
ALTER TABLE public.usage ADD CONSTRAINT usage_pkey PRIMARY KEY (id);
ALTER TABLE public.usage ADD CONSTRAINT usage_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES aluminum_profiles(id);
ALTER TABLE public.usage ADD CONSTRAINT usage_quantity_pieces_check CHECK ((quantity_pieces > 0));
ALTER TABLE public.users ADD CONSTRAINT users_email_key UNIQUE (email);
ALTER TABLE public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE public.users ADD CONSTRAINT users_saas_plan_check CHECK ((plan = ANY (ARRAY['offer'::text, 'pro'::text, 'business'::text, 'growth'::text])));
ALTER TABLE public.weekly_digests ADD CONSTRAINT unique_company_period UNIQUE (company_id, period_from, period_to);
ALTER TABLE public.weekly_digests ADD CONSTRAINT weekly_digests_pkey PRIMARY KEY (id);
ALTER TABLE public.weekly_digests ADD CONSTRAINT weekly_digests_status_check CHECK ((status = ANY (ARRAY['generated'::text, 'failed'::text])));
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_direction_check CHECK ((direction = ANY (ARRAY['incoming'::text, 'outgoing'::text])));
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_pkey PRIMARY KEY (id);
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_sentiment_check CHECK ((sentiment = ANY (ARRAY['positive'::text, 'neutral'::text, 'negative'::text])));
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_daily_rate_snapshot_check CHECK ((daily_rate_snapshot > (0)::numeric));
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_pay_type_check CHECK ((pay_type = 'daily'::text));
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id);
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_project_id_fkey FOREIGN KEY (project_id) REFERENCES deals(id) ON DELETE CASCADE;
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_project_id_worker_id_date_key UNIQUE (project_id, worker_id, date);
ALTER TABLE public.work_shifts ADD CONSTRAINT work_shifts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE public.worker_shifts ADD CONSTRAINT worker_shifts_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.worker_shifts ADD CONSTRAINT worker_shifts_company_id_worker_id_shift_date_key UNIQUE (company_id, worker_id, shift_date);
ALTER TABLE public.worker_shifts ADD CONSTRAINT worker_shifts_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE SET NULL;
ALTER TABLE public.worker_shifts ADD CONSTRAINT worker_shifts_pkey PRIMARY KEY (id);
ALTER TABLE public.worker_shifts ADD CONSTRAINT worker_shifts_shift_type_check CHECK ((shift_type = ANY (ARRAY['work'::text, 'holiday'::text, 'day_off'::text])));
ALTER TABLE public.worker_shifts ADD CONSTRAINT worker_shifts_worker_id_fkey FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE;
ALTER TABLE public.workers ADD CONSTRAINT workers_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE public.workers ADD CONSTRAINT workers_daily_rate_check CHECK ((daily_rate > (0)::numeric));
ALTER TABLE public.workers ADD CONSTRAINT workers_pkey PRIMARY KEY (id);

CREATE INDEX idx_ai_director_messages_created_at ON public.ai_director_messages USING btree (created_at DESC);
CREATE INDEX idx_ai_director_messages_session_id ON public.ai_director_messages USING btree (session_id);
CREATE INDEX idx_ai_director_sessions_company_id ON public.ai_director_sessions USING btree (company_id);
CREATE INDEX idx_ai_director_sessions_last_activity ON public.ai_director_sessions USING btree (last_activity DESC);
CREATE INDEX idx_ai_insights_deal_id ON public.ai_insights USING btree (deal_id);
CREATE INDEX idx_ai_insights_expires_at ON public.ai_insights USING btree (expires_at);
CREATE INDEX idx_ai_insights_priority ON public.ai_insights USING btree (priority);
CREATE INDEX idx_ai_insights_type ON public.ai_insights USING btree (insight_type);
CREATE INDEX idx_ai_messages_created_at ON public.ai_messages USING btree (created_at);
CREATE INDEX idx_ai_messages_session_id ON public.ai_messages USING btree (session_id);
CREATE INDEX idx_ai_rate_limits_client_id ON public.ai_rate_limits USING btree (client_id);
CREATE INDEX idx_ai_reminders_completed ON public.ai_reminders USING btree (completed);
CREATE INDEX idx_ai_reminders_deal_id ON public.ai_reminders USING btree (deal_id);
CREATE INDEX idx_ai_reminders_due_date ON public.ai_reminders USING btree (due_date);
CREATE INDEX idx_ai_reminders_lead_id ON public.ai_reminders USING btree (lead_id);
CREATE INDEX idx_ai_reminders_priority ON public.ai_reminders USING btree (priority);
CREATE INDEX idx_ai_reports_created_at ON public.ai_reports USING btree (created_at DESC);
CREATE INDEX idx_ai_reports_period_end ON public.ai_reports USING btree (period_end DESC);
CREATE INDEX idx_ai_reports_period_start ON public.ai_reports USING btree (period_start DESC);
CREATE INDEX idx_ai_reports_type ON public.ai_reports USING btree (report_type);
CREATE INDEX idx_ai_sessions_client_id ON public.ai_sessions USING btree (client_id);
CREATE INDEX idx_ai_sessions_client_source ON public.ai_sessions USING btree (client_id, source);
CREATE INDEX idx_ai_sessions_last_activity ON public.ai_sessions USING btree (last_activity DESC);
CREATE INDEX idx_ai_sessions_source ON public.ai_sessions USING btree (source);
CREATE INDEX idx_aluminum_profiles_code ON public.aluminum_profiles USING btree (code);
CREATE INDEX idx_aluminum_profiles_company_active ON public.aluminum_profiles USING btree (company_id, is_active);
CREATE INDEX articles_company_id_idx ON public.articles USING btree (company_id);
CREATE INDEX articles_published_at_idx ON public.articles USING btree (published_at DESC);
CREATE INDEX articles_published_idx ON public.articles USING btree (published) WHERE (published = true);
CREATE INDEX articles_slug_idx ON public.articles USING btree (slug);
CREATE INDEX idx_articles_created_at ON public.articles USING btree (created_at DESC);
CREATE INDEX idx_articles_slug ON public.articles USING btree (slug);
CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);
CREATE INDEX idx_audit_logs_company ON public.audit_logs USING btree (company_id);
CREATE INDEX idx_audit_logs_company_action ON public.audit_logs USING btree (company_id, action, created_at DESC);
CREATE INDEX idx_audit_logs_created ON public.audit_logs USING btree (created_at DESC);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs USING btree (resource_type, resource_id);
CREATE INDEX idx_audit_logs_status ON public.audit_logs USING btree (status);
CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id);
CREATE INDEX idx_batches_company_status ON public.batches USING btree (company_id, status, planned_arrival_date);
CREATE INDEX idx_batches_profile ON public.batches USING btree (profile_id);
CREATE UNIQUE INDEX companies_early_bird_position_uniq ON public.companies USING btree (early_bird_position) WHERE (early_bird_position IS NOT NULL);
CREATE INDEX idx_companies_created_at ON public.companies USING btree (created_at DESC);
CREATE INDEX idx_companies_logo_url ON public.companies USING btree (logo_url) WHERE (logo_url IS NOT NULL);
CREATE INDEX idx_companies_slug ON public.companies USING btree (slug);
CREATE INDEX idx_companies_status ON public.companies USING btree (status);
CREATE INDEX idx_company_integrations_company_id ON public.company_integrations USING btree (company_id);
CREATE INDEX idx_company_integrations_status ON public.company_integrations USING btree (status);
CREATE UNIQUE INDEX idx_company_integrations_webhook_secret ON public.company_integrations USING btree (webhook_secret);
CREATE INDEX idx_company_members_company ON public.company_members USING btree (company_id);
CREATE INDEX idx_company_members_role ON public.company_members USING btree (role);
CREATE INDEX idx_company_members_user ON public.company_members USING btree (user_id);
CREATE INDEX idx_company_members_user_company ON public.company_members USING btree (user_id, company_id);
CREATE INDEX idx_company_settings_company_id ON public.company_settings USING btree (company_id);
CREATE INDEX idx_company_subscriptions_company_id ON public.company_subscriptions USING btree (company_id);
CREATE INDEX idx_company_subscriptions_status ON public.company_subscriptions USING btree (status);
CREATE INDEX idx_company_usage_company_period ON public.company_usage USING btree (company_id, period_start);
CREATE INDEX idx_configurator_link_tokens_expires_at ON public.configurator_link_tokens USING btree (expires_at DESC);
CREATE INDEX idx_configurator_link_tokens_offer_id ON public.configurator_link_tokens USING btree (offer_id);
CREATE INDEX idx_deal_fence_company_created ON public.deal_fence_details USING btree (company_id, created_at);
CREATE INDEX idx_deal_payments_company_paid ON public.deal_payments USING btree (company_id, paid_at);
CREATE INDEX idx_deal_payments_deal ON public.deal_payments USING btree (deal_id);
CREATE INDEX idx_deal_railings_company_created ON public.deal_railings_details USING btree (company_id, created_at);
CREATE INDEX idx_deal_tags_deal_id ON public.deal_tags USING btree (deal_id);
CREATE INDEX idx_deal_tags_tag ON public.deal_tags USING btree (tag);
CREATE INDEX idx_deal_tags_type ON public.deal_tags USING btree (tag_type);
CREATE INDEX idx_deals_company ON public.deals USING btree (company_id);
CREATE INDEX idx_deals_company_installation_date ON public.deals USING btree (company_id, installation_date) WHERE (installation_date IS NOT NULL);
CREATE INDEX idx_deals_created_at ON public.deals USING btree (created_at DESC);
CREATE INDEX idx_deals_customer_phone ON public.deals USING btree (customer_phone);
CREATE INDEX idx_deals_laundry_closet ON public.deals USING btree (project_type) WHERE (project_type = 'laundry_closet'::text);
CREATE INDEX idx_deals_lead_id ON public.deals USING btree (lead_id);
CREATE INDEX idx_deals_project_type ON public.deals USING btree (project_type);
CREATE INDEX idx_deals_stage ON public.deals USING btree (stage);
CREATE INDEX idx_deals_status ON public.deals USING btree (deal_status);
CREATE INDEX idx_email_verification_expires ON public.email_verification_tokens USING btree (expires_at);
CREATE INDEX idx_email_verification_token ON public.email_verification_tokens USING btree (token);
CREATE INDEX idx_email_verification_user ON public.email_verification_tokens USING btree (user_id);
CREATE INDEX idx_gallery_categories_created_at ON public.gallery_categories USING btree (created_at DESC);
CREATE INDEX idx_gallery_categories_key ON public.gallery_categories USING btree (key);
CREATE INDEX idx_gallery_images_category_key ON public.gallery_images USING btree (category_key);
CREATE INDEX idx_gallery_images_created_at ON public.gallery_images USING btree (created_at DESC);
CREATE INDEX idx_gallery_images_filename ON public.gallery_images USING btree (filename);
CREATE INDEX idx_integration_events_company_id ON public.integration_events USING btree (company_id);
CREATE INDEX idx_integration_events_created_at ON public.integration_events USING btree (created_at DESC);
CREATE INDEX idx_integration_events_event_type ON public.integration_events USING btree (event_type);
CREATE INDEX idx_integration_events_integration_id ON public.integration_events USING btree (integration_id);
CREATE INDEX idx_leads_company ON public.leads USING btree (company_id);
CREATE INDEX idx_leads_email ON public.leads USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX idx_leads_gclid ON public.leads USING btree (gclid) WHERE (gclid IS NOT NULL);
CREATE INDEX idx_leads_metadata ON public.leads USING gin (metadata);
CREATE INDEX idx_leads_phone ON public.leads USING btree (phone);
CREATE INDEX idx_leads_score ON public.leads USING btree (score DESC);
CREATE INDEX idx_leads_score_range ON public.leads USING btree (score) WHERE (score IS NOT NULL);
CREATE INDEX idx_leads_score_updated_at ON public.leads USING btree (score_updated_at DESC);
CREATE INDEX idx_leads_source ON public.leads USING btree (source);
CREATE INDEX idx_leads_status_created_at ON public.leads USING btree (status, created_at);
CREATE INDEX idx_leads_utm_source ON public.leads USING btree (utm_source) WHERE (utm_source IS NOT NULL);
CREATE INDEX idx_material_orders_company ON public.material_orders USING btree (company_id);
CREATE INDEX idx_material_orders_deal_id ON public.material_orders USING btree (deal_id);
CREATE INDEX idx_material_orders_offer_id ON public.material_orders USING btree (offer_id);
CREATE INDEX idx_material_orders_order_date ON public.material_orders USING btree (order_date DESC);
CREATE INDEX idx_material_orders_status ON public.material_orders USING btree (status);
CREATE INDEX idx_media_assets_category ON public.media_assets USING btree (company_id, category) WHERE (category IS NOT NULL);
CREATE INDEX idx_media_assets_company_id ON public.media_assets USING btree (company_id);
CREATE INDEX idx_media_assets_company_key ON public.media_assets USING btree (company_id, s3_key);
CREATE INDEX idx_media_assets_tags ON public.media_assets USING gin (tags);
CREATE INDEX idx_media_assets_untagged ON public.media_assets USING btree (company_id, created_at) WHERE ((array_length(tags, 1) IS NULL) OR (array_length(tags, 1) = 0));
CREATE INDEX idx_offers_approved ON public.offers USING btree (approved);
CREATE INDEX idx_offers_company ON public.offers USING btree (company_id);
CREATE INDEX idx_offers_created_at ON public.offers USING btree (created_at DESC);
CREATE INDEX idx_offers_deal_id ON public.offers USING btree (deal_id);
CREATE INDEX idx_offers_pergola_shape_data ON public.offers USING gin (pergola_shape_data);
CREATE INDEX idx_offers_pergola_shape_type ON public.offers USING btree (pergola_shape_type);
CREATE INDEX idx_offers_pergolas_data ON public.offers USING gin (pergolas_data);
CREATE INDEX idx_offers_winter_closure_enabled ON public.offers USING btree (winter_closure_enabled) WHERE (winter_closure_enabled = true);
CREATE INDEX idx_onboarding_company ON public.onboarding_tasks USING btree (company_id);
CREATE INDEX idx_onboarding_completed ON public.onboarding_tasks USING btree (completed_at);
CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);
CREATE INDEX idx_password_reset_expires ON public.password_reset_tokens USING btree (expires_at);
CREATE INDEX idx_password_reset_token ON public.password_reset_tokens USING btree (token);
CREATE INDEX idx_password_reset_user ON public.password_reset_tokens USING btree (user_id);
CREATE INDEX idx_pergola_config_submissions_created_at ON public.pergola_config_submissions USING btree (created_at DESC);
CREATE INDEX idx_pergola_config_submissions_offer_id ON public.pergola_config_submissions USING btree (offer_id);
CREATE INDEX idx_pergola_projects_created_at ON public.pergola_projects USING btree (created_at DESC);
CREATE INDEX idx_plans_is_active ON public.plans USING btree (is_active);
CREATE INDEX idx_plans_key ON public.plans USING btree (key);
CREATE INDEX idx_platform_admins_email ON public.platform_admins USING btree (email);
CREATE INDEX idx_platform_admins_phone ON public.platform_admins USING btree (phone);
CREATE INDEX idx_platform_admins_role ON public.platform_admins USING btree (role);
CREATE INDEX idx_platform_admins_user_id ON public.platform_admins USING btree (user_id);
CREATE INDEX idx_platform_audit_logs_actor_admin ON public.platform_audit_logs USING btree (actor_admin_id) WHERE (actor_admin_id IS NOT NULL);
CREATE INDEX idx_platform_audit_logs_actor_user ON public.platform_audit_logs USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);
CREATE INDEX idx_platform_audit_logs_company_id ON public.platform_audit_logs USING btree (company_id);
CREATE INDEX idx_platform_audit_logs_created_at ON public.platform_audit_logs USING btree (created_at DESC);
CREATE INDEX idx_platform_audit_logs_event_type ON public.platform_audit_logs USING btree (event_type);
CREATE INDEX idx_orders_company_status ON public.profile_orders USING btree (company_id, status, created_at DESC);
CREATE INDEX idx_orders_number ON public.profile_orders USING btree (order_number);
CREATE INDEX idx_profiles_category ON public.profiles USING btree (category);
CREATE INDEX idx_profiles_special ON public.profiles USING btree (is_special);
CREATE INDEX idx_refresh_tokens_active ON public.refresh_tokens USING btree (user_id, revoked_at) WHERE (revoked_at IS NULL);
CREATE INDEX idx_refresh_tokens_expires ON public.refresh_tokens USING btree (expires_at);
CREATE INDEX idx_refresh_tokens_hash ON public.refresh_tokens USING btree (token_hash);
CREATE INDEX idx_refresh_tokens_user ON public.refresh_tokens USING btree (user_id);
CREATE INDEX idx_role_permissions_lookup ON public.role_permissions USING btree (role, resource, action);
CREATE INDEX idx_stock_available ON public.stock USING btree (company_id) WHERE (qty_available > 0);
CREATE INDEX idx_stock_company_profile ON public.stock USING btree (company_id, profile_id, color, length_meters);
CREATE INDEX idx_subscription_history_company_id ON public.subscription_history USING btree (company_id);
CREATE INDEX idx_subscription_history_created_at ON public.subscription_history USING btree (created_at DESC);
CREATE INDEX idx_subscriptions_company ON public.subscriptions USING btree (company_id);
CREATE INDEX idx_subscriptions_external ON public.subscriptions USING btree (external_subscription_id);
CREATE INDEX idx_subscriptions_plan ON public.subscriptions USING btree (plan_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);
CREATE INDEX idx_suppliers_company ON public.suppliers USING btree (company_id, is_active);
CREATE INDEX idx_usage_company_batch_date ON public.usage USING btree (company_id, batch_id, used_at);
CREATE INDEX idx_usage_order ON public.usage USING btree (order_id);
CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_weekly_digests_company ON public.weekly_digests USING btree (company_id);
CREATE INDEX idx_weekly_digests_company_id ON public.weekly_digests USING btree (company_id);
CREATE INDEX idx_weekly_digests_created_at ON public.weekly_digests USING btree (created_at DESC);
CREATE INDEX idx_weekly_digests_period ON public.weekly_digests USING btree (period_from DESC, period_to DESC);
CREATE INDEX idx_weekly_digests_status ON public.weekly_digests USING btree (status);
CREATE INDEX idx_whatsapp_messages_created_at ON public.whatsapp_messages USING btree (created_at DESC);
CREATE INDEX idx_whatsapp_messages_deal_id ON public.whatsapp_messages USING btree (deal_id);
CREATE INDEX idx_whatsapp_messages_lead_id ON public.whatsapp_messages USING btree (lead_id);
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages USING btree (phone);
CREATE INDEX idx_work_shifts_company ON public.work_shifts USING btree (company_id);
CREATE INDEX idx_work_shifts_date ON public.work_shifts USING btree (date);
CREATE INDEX idx_work_shifts_project_date ON public.work_shifts USING btree (project_id, date);
CREATE INDEX idx_work_shifts_project_id ON public.work_shifts USING btree (project_id);
CREATE INDEX idx_work_shifts_worker_id ON public.work_shifts USING btree (worker_id);
CREATE INDEX idx_worker_shifts_company_date ON public.worker_shifts USING btree (company_id, shift_date);
CREATE INDEX idx_worker_shifts_company_worker ON public.worker_shifts USING btree (company_id, worker_id);
CREATE INDEX idx_worker_shifts_deal ON public.worker_shifts USING btree (deal_id) WHERE (deal_id IS NOT NULL);
CREATE INDEX idx_worker_shifts_shift_type ON public.worker_shifts USING btree (shift_type) WHERE (shift_type <> 'work'::text);
CREATE INDEX idx_workers_company ON public.workers USING btree (company_id);
CREATE INDEX idx_workers_is_active ON public.workers USING btree (is_active);

ALTER TABLE public.ai_director_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_director_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluminum_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configurator_link_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_fence_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_railings_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deal_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.early_bird_program ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pergola_config_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pergola_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can do everything on ai_director_messages" ON public.ai_director_messages AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage their company ai_director_messages" ON public.ai_director_messages AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM (ai_director_sessions
     JOIN company_members ON ((company_members.company_id = ai_director_sessions.company_id)))
  WHERE ((ai_director_sessions.id = ai_director_messages.session_id) AND (company_members.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM (ai_director_sessions
     JOIN company_members ON ((company_members.company_id = ai_director_sessions.company_id)))
  WHERE ((ai_director_sessions.id = ai_director_messages.session_id) AND (company_members.user_id = auth.uid())))));

CREATE POLICY "Service role can do everything on ai_director_sessions" ON public.ai_director_sessions AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can manage their company ai_director_sessions" ON public.ai_director_sessions AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM company_members
  WHERE ((company_members.company_id = ai_director_sessions.company_id) AND (company_members.user_id = auth.uid())))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM company_members
  WHERE ((company_members.company_id = ai_director_sessions.company_id) AND (company_members.user_id = auth.uid())))));

CREATE POLICY "Admin can manage insights" ON public.ai_insights AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on ai_messages" ON public.ai_messages AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on ai_rate_limits" ON public.ai_rate_limits AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can manage reminders" ON public.ai_reminders AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can manage reports" ON public.ai_reports AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do everything on ai_sessions" ON public.ai_sessions AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Public view active aluminum profiles" ON public.aluminum_profiles AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));

CREATE POLICY "Users manage own company aluminum profiles" ON public.aluminum_profiles AS PERMISSIVE FOR ALL TO public
  USING ((company_id = ((auth.jwt() ->> 'company_id'::text))::uuid));

CREATE POLICY "Service role manages articles" ON public.articles AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Users access own company batches" ON public.batches AS PERMISSIVE FOR ALL TO public
  USING ((company_id = ((auth.jwt() ->> 'company_id'::text))::uuid));

CREATE POLICY "Users can view companies they belong to" ON public.companies AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM company_members cm
  WHERE ((cm.company_id = companies.id) AND (cm.user_id = auth.uid())))));

CREATE POLICY "Company members can view their integration" ON public.company_integrations AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Service role can manage integrations" ON public.company_integrations AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage all company members" ON public.company_members AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can update their own company membership" ON public.company_members AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view their own company membership" ON public.company_members AS PERMISSIVE FOR SELECT TO authenticated
  USING ((auth.uid() = user_id));

CREATE POLICY "Company owners can update subscription" ON public.company_subscriptions AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE ((company_members.user_id = auth.uid()) AND (company_members.role = 'owner'::user_role)))));

CREATE POLICY "Users can view their company subscription" ON public.company_subscriptions AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Service role can do everything on deal_fence_details" ON public.deal_fence_details AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Users access own company deal_fence_details" ON public.deal_fence_details AS PERMISSIVE FOR ALL TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))))
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Users access own company payments" ON public.deal_payments AS PERMISSIVE FOR ALL TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))))
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Users access own company railings" ON public.deal_railings_details AS PERMISSIVE FOR ALL TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))))
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Admin can manage tags" ON public.deal_tags AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Company members can view own deals" ON public.deals AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Company members view own deals" ON public.deals AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Users can delete own company deals" ON public.deals AS PERMISSIVE FOR DELETE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can insert own company deals" ON public.deals AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can update own company deals" ON public.deals AS PERMISSIVE FOR UPDATE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can view own company deals" ON public.deals AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Company members can view their integration events" ON public.integration_events AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Service role can insert integration events" ON public.integration_events AS PERMISSIVE FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can read all integration events" ON public.integration_events AS PERMISSIVE FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Company members view own leads" ON public.leads AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Users can delete own company leads" ON public.leads AS PERMISSIVE FOR DELETE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can insert own company leads" ON public.leads AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can update own company leads" ON public.leads AS PERMISSIVE FOR UPDATE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can view own company leads" ON public.leads AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Company members create material_orders" ON public.material_orders AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Company members delete material_orders" ON public.material_orders AS PERMISSIVE FOR DELETE TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Company members update material_orders" ON public.material_orders AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))))
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Company members view own material_orders" ON public.material_orders AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Service role can do everything on material_orders" ON public.material_orders AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY company_insert ON public.media_assets AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((company_id = ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid())
 LIMIT 1)));

CREATE POLICY company_select ON public.media_assets AS PERMISSIVE FOR SELECT TO public
  USING ((company_id = ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid())
 LIMIT 1)));

CREATE POLICY company_update ON public.media_assets AS PERMISSIVE FOR UPDATE TO public
  USING ((company_id = ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid())
 LIMIT 1)));

CREATE POLICY service_role_all ON public.media_assets AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text))
  WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY "Anon read offer by id" ON public.offers AS PERMISSIVE FOR SELECT TO anon
  USING (true);

CREATE POLICY "Company members can view own offers" ON public.offers AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Company members create offers" ON public.offers AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Company members view own offers" ON public.offers AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Public can read offer by id" ON public.offers AS PERMISSIVE FOR SELECT TO anon
  USING (true);

CREATE POLICY "Service role can do everything on offers" ON public.offers AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role updates offers" ON public.offers AS PERMISSIVE FOR UPDATE TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Users can delete own company offers" ON public.offers AS PERMISSIVE FOR DELETE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can insert own company offers" ON public.offers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can update own company offers" ON public.offers AS PERMISSIVE FOR UPDATE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can view own company offers" ON public.offers AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users access order items via orders" ON public.order_items AS PERMISSIVE FOR ALL TO public
  USING ((EXISTS ( SELECT 1
   FROM profile_orders
  WHERE ((profile_orders.id = order_items.order_id) AND (profile_orders.company_id = ((auth.jwt() ->> 'company_id'::text))::uuid)))));

CREATE POLICY "Service role can read pergola_config_submissions" ON public.pergola_config_submissions AS PERMISSIVE FOR SELECT TO service_role
  USING (true);

CREATE POLICY "Service role inserts pergola_config_submissions" ON public.pergola_config_submissions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((auth.role() = 'service_role'::text));

CREATE POLICY "Public can read pergola_projects" ON public.pergola_projects AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role can do everything on pergola_projects" ON public.pergola_projects AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Platform admins can view platform admins" ON public.platform_admins AS PERMISSIVE FOR SELECT TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM platform_admins pa
  WHERE ((pa.user_id = auth.uid()) AND (pa.is_active = true)))));

CREATE POLICY "Service role can manage platform admins" ON public.platform_admins AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "SuperAdmin can read audit logs" ON public.platform_audit_logs AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "System can insert audit logs" ON public.platform_audit_logs AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "SuperAdmin can read platform settings" ON public.platform_settings AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "SuperAdmin can update platform settings" ON public.platform_settings AS PERMISSIVE FOR UPDATE TO public
  USING (true);

CREATE POLICY "Users access own company orders" ON public.profile_orders AS PERMISSIVE FOR ALL TO public
  USING ((company_id = ((auth.jwt() ->> 'company_id'::text))::uuid));

CREATE POLICY "Users access own company stock" ON public.stock AS PERMISSIVE FOR ALL TO public
  USING ((company_id = ((auth.jwt() ->> 'company_id'::text))::uuid));

CREATE POLICY "Service role can insert subscription history" ON public.subscription_history AS PERMISSIVE FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Users can view their company subscription history" ON public.subscription_history AS PERMISSIVE FOR SELECT TO authenticated
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Anyone can view active subscription plans" ON public.subscription_plans AS PERMISSIVE FOR SELECT TO public
  USING ((is_active = true));

CREATE POLICY "Users access own company suppliers" ON public.suppliers AS PERMISSIVE FOR ALL TO public
  USING ((company_id = ((auth.jwt() ->> 'company_id'::text))::uuid));

CREATE POLICY "Users access own company usage" ON public.usage AS PERMISSIVE FOR ALL TO public
  USING ((company_id = ((auth.jwt() ->> 'company_id'::text))::uuid));

CREATE POLICY "Service role can do everything on weekly_digests" ON public.weekly_digests AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can insert messages" ON public.whatsapp_messages AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Admin can update messages" ON public.whatsapp_messages AS PERMISSIVE FOR UPDATE TO public
  USING (true);

CREATE POLICY "Admin can view all messages" ON public.whatsapp_messages AS PERMISSIVE FOR SELECT TO public
  USING (true);

CREATE POLICY "Service role can do everything on work_shifts" ON public.work_shifts AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Service role can do everything on worker_shifts" ON public.worker_shifts AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Users access own company worker_shifts" ON public.worker_shifts AS PERMISSIVE FOR ALL TO public
  USING ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))))
  WITH CHECK ((company_id IN ( SELECT company_members.company_id
   FROM company_members
  WHERE (company_members.user_id = auth.uid()))));

CREATE POLICY "Service role can do everything on workers" ON public.workers AS PERMISSIVE FOR ALL TO public
  USING ((auth.role() = 'service_role'::text));

CREATE POLICY "Users can delete own company workers" ON public.workers AS PERMISSIVE FOR DELETE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can insert own company workers" ON public.workers AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can update own company workers" ON public.workers AS PERMISSIVE FOR UPDATE TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE POLICY "Users can view own company workers" ON public.workers AS PERMISSIVE FOR SELECT TO public
  USING ((company_id IN ( SELECT cm.company_id
   FROM company_members cm
  WHERE (cm.user_id = auth.uid()))));

CREATE OR REPLACE FUNCTION public.check_plan_limit(p_company_id uuid, p_limit_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
  v_plan subscription_plans%ROWTYPE;
  v_usage company_usage%ROWTYPE;
  v_current_count integer;
  v_limit integer;
  v_allowed boolean;
BEGIN
  -- Get current plan
  SELECT sp.* INTO v_plan
  FROM subscription_plans sp
  JOIN company_subscriptions cs ON cs.plan_id = sp.id
  WHERE cs.company_id = p_company_id
    AND cs.status = 'active';
  
  -- Get current usage
  SELECT * INTO v_usage
  FROM company_usage
  WHERE company_id = p_company_id
    AND period_start = date_trunc('month', now());
  
  -- Check specific limit
  CASE p_limit_type
    WHEN 'users' THEN
      SELECT COUNT(*) INTO v_current_count
      FROM company_members
      WHERE company_id = p_company_id;
      v_limit := v_plan.max_users;
      
    WHEN 'deals' THEN
      v_current_count := COALESCE(v_usage.deals_created, 0);
      v_limit := v_plan.max_deals_per_month;
      
    WHEN 'storage' THEN
      v_current_count := COALESCE(v_usage.storage_used_mb, 0)::integer;
      v_limit := v_plan.max_storage_mb;
      
    ELSE
      RAISE EXCEPTION 'Unknown limit type: %', p_limit_type;
  END CASE;
  
  -- NULL limit = unlimited
  IF v_limit IS NULL THEN
    v_allowed := true;
  ELSE
    v_allowed := v_current_count < v_limit;
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'allowed', v_allowed,
    'current', v_current_count,
    'limit', v_limit,
    'plan', v_plan.name
  );
  
  RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.check_superadmin_phone(phone_number text)
 RETURNS TABLE(email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT pa.email::TEXT
  FROM public.platform_admins pa
  WHERE pa.phone = phone_number
    AND pa.is_active = true
  LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_early_bird_spot(p_company_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total      INT;
  v_used       INT;
  v_position   INT;
  v_already    INT;
BEGIN
  -- If this company already has a position, return it (idempotent on retry)
  SELECT early_bird_position INTO v_already
  FROM public.companies
  WHERE id = p_company_id;

  IF v_already IS NOT NULL THEN
    RETURN v_already;
  END IF;

  -- Acquire row-level lock on the singleton sentinel
  SELECT total_spots INTO v_total
  FROM public.early_bird_program
  WHERE id = 1
  FOR UPDATE;

  IF v_total IS NULL THEN
    RETURN NULL;
  END IF;

  -- Count current cohort size under the lock
  SELECT COUNT(*) INTO v_used
  FROM public.companies
  WHERE early_bird_position IS NOT NULL;

  IF v_used >= v_total THEN
    RETURN NULL;
  END IF;

  v_position := v_used + 1;

  UPDATE public.companies
  SET early_bird_position = v_position
  WHERE id = p_company_id;

  RETURN v_position;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_refresh_tokens()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.cleanup_expired_tokens()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  DELETE FROM email_verification_tokens WHERE expires_at < NOW();
  DELETE FROM password_reset_tokens WHERE expires_at < NOW();
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_company_settings()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO company_settings (company_id, company_name)
  VALUES (NEW.id, NEW.name)
  ON CONFLICT (company_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_default_subscription()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_trial_plan_id uuid;
BEGIN
  SELECT id INTO v_trial_plan_id
  FROM subscription_plans
  WHERE plan_key = 'trial'
  LIMIT 1;
  
  IF v_trial_plan_id IS NOT NULL THEN
    INSERT INTO company_subscriptions (
      company_id, 
      plan_id,
      status,
      payment_provider,
      trial_ends_at,
      current_period_end
    ) VALUES (
      NEW.id,
      v_trial_plan_id,
      'trialing',
      'manual',
      now() + interval '14 days',
      now() + interval '14 days'
    )
    ON CONFLICT (company_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_company_trial(p_user_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_company_id UUID;
  v_trial_plan_id UUID;
  v_existing_subscription UUID;
BEGIN
  -- Find the newest company membership for this user (prefer owner role)
  SELECT cm.company_id INTO v_company_id
  FROM public.company_members cm
  WHERE cm.user_id = p_user_id
  ORDER BY 
    CASE WHEN cm.role = 'owner' THEN 0 ELSE 1 END,
    cm.created_at DESC
  LIMIT 1;

  -- If no membership found, return NULL
  IF v_company_id IS NULL THEN
    RAISE NOTICE 'No company membership found for user %', p_user_id;
    RETURN NULL;
  END IF;

  -- Get trial plan ID
  SELECT id INTO v_trial_plan_id
  FROM public.subscription_plans
  WHERE plan_key = 'trial'
  LIMIT 1;

  IF v_trial_plan_id IS NULL THEN
    RAISE EXCEPTION 'Trial plan not found';
  END IF;

  -- Check if subscription already exists
  SELECT id INTO v_existing_subscription
  FROM public.company_subscriptions
  WHERE company_id = v_company_id;

  -- If subscription exists and is active/paid, do nothing (idempotent)
  IF v_existing_subscription IS NOT NULL THEN
    -- Check if subscription is already active/paid (not trialing)
    IF EXISTS (
      SELECT 1 FROM public.company_subscriptions
      WHERE id = v_existing_subscription
      AND status IN ('active', 'past_due')
      AND trial_ends_at IS NULL
    ) THEN
      RAISE NOTICE 'Company % already has active/paid subscription, skipping trial', v_company_id;
      RETURN v_company_id;
    END IF;

    -- If subscription exists but is trialing or canceled, update it
    UPDATE public.company_subscriptions
    SET
      plan_id = v_trial_plan_id,
      status = 'trialing',
      trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '30 days'),
      current_period_end = COALESCE(trial_ends_at, NOW() + INTERVAL '30 days'),
      updated_at = NOW()
    WHERE id = v_existing_subscription
    AND (trial_ends_at IS NULL OR status = 'canceled');

    RETURN v_company_id;
  END IF;

  -- Create new trial subscription
  INSERT INTO public.company_subscriptions (
    company_id,
    plan_id,
    status,
    payment_provider,
    trial_ends_at,
    current_period_end
  ) VALUES (
    v_company_id,
    v_trial_plan_id,
    'trialing',
    'manual',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (company_id) DO UPDATE
  SET
    plan_id = EXCLUDED.plan_id,
    status = 'trialing',
    trial_ends_at = COALESCE(company_subscriptions.trial_ends_at, EXCLUDED.trial_ends_at),
    current_period_end = COALESCE(company_subscriptions.trial_ends_at, EXCLUDED.current_period_end),
    updated_at = NOW();

  RETURN v_company_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.generate_order_number()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'PO-' || TO_CHAR(NEW.created_at, 'YYYYMMDD') || '-' || 
      LPAD(NEXTVAL('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_company_settings(p_company_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_settings jsonb;
BEGIN
  SELECT row_to_json(company_settings.*)::jsonb INTO v_settings
  FROM company_settings
  WHERE company_id = p_company_id;
  
  -- Return settings or defaults if not found
  IF v_settings IS NULL THEN
    v_settings := jsonb_build_object(
      'currency', '₪',
      'vat_percent', 18,
      'default_pergola_price_per_sqm', 750
    );
  END IF;
  
  RETURN v_settings;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_early_bird_spots_remaining()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT GREATEST(
    0,
    (SELECT total_spots FROM public.early_bird_program WHERE id = 1)
      - (SELECT COUNT(*)::INT FROM public.companies WHERE early_bird_position IS NOT NULL)
  );
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  DELETE FROM public.users 
  WHERE email = NEW.email AND id != NEW.id;

  INSERT INTO public.users (
    id, email, full_name, avatar_url, created_at, updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.created_at,
    NEW.updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_feature(p_company_id uuid, p_feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_has_feature boolean;
BEGIN
  SELECT (sp.features->>p_feature)::boolean INTO v_has_feature
  FROM subscription_plans sp
  JOIN company_subscriptions cs ON cs.plan_id = sp.id
  WHERE cs.company_id = p_company_id
    AND cs.status = 'active';
  
  RETURN COALESCE(v_has_feature, false);
END;
$function$
;

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id uuid, p_company_id uuid, p_resource text, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_role user_role;
  v_has_permission boolean;
BEGIN
  -- Get user's role in this company
  SELECT role::user_role INTO v_user_role
  FROM company_members
  WHERE user_id = p_user_id 
    AND company_id = p_company_id;
  
  -- If user is not a member, return false
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if role has this permission
  SELECT EXISTS(
    SELECT 1 FROM role_permissions
    WHERE role = v_user_role
      AND resource = p_resource
      AND action = p_action
  ) INTO v_has_permission;
  
  RETURN v_has_permission;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_usage(p_company_id uuid, p_counter text, p_amount integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_period_start timestamptz := date_trunc('month', now());
  v_period_end timestamptz := v_period_start + interval '1 month';
BEGIN
  -- Upsert usage record
  INSERT INTO company_usage (
    company_id,
    period_start,
    period_end
  ) VALUES (
    p_company_id,
    v_period_start,
    v_period_end
  )
  ON CONFLICT (company_id, period_start) DO NOTHING;
  
  -- Increment counter
  CASE p_counter
    WHEN 'deals' THEN
      UPDATE company_usage
      SET deals_created = deals_created + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'offers' THEN
      UPDATE company_usage
      SET offers_created = offers_created + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'pdfs' THEN
      UPDATE company_usage
      SET pdfs_generated = pdfs_generated + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'whatsapp' THEN
      UPDATE company_usage
      SET whatsapp_sent = whatsapp_sent + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    WHEN 'emails' THEN
      UPDATE company_usage
      SET emails_sent = emails_sent + p_amount
      WHERE company_id = p_company_id AND period_start = v_period_start;
      
    ELSE
      RAISE NOTICE 'Unknown counter: %', p_counter;
  END CASE;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_company_creation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  INSERT INTO platform_audit_logs (
    event_type, company_id, actor_user_id, payload
  ) VALUES (
    'company_created', NEW.id, auth.uid(),
    jsonb_build_object('company_name', NEW.name, 'company_slug', NEW.slug)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.prevent_multiple_platform_settings()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.id != '00000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'Only one row allowed';
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_role(target_user uuid, new_role text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pergola_configurator', 'public'
AS $function$ select pergola_configurator.set_user_role(target_user, new_role::pergola_configurator.user_role); $function$
;

CREATE OR REPLACE FUNCTION public.set_user_role_by_email(target_email text, new_role text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pergola_configurator', 'public'
AS $function$
  select pergola_configurator.set_user_role_by_email(
    target_email,
    new_role::pergola_configurator.user_role
  );
$function$
;

CREATE OR REPLACE FUNCTION public.update_ai_insights_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_articles_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_companies_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_company_members_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_company_settings_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_company_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_gallery_categories_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_gallery_category_image_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE gallery_categories
    SET image_count = image_count + 1
    WHERE key = NEW.category_key;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE gallery_categories
    SET image_count = GREATEST(image_count - 1, 0)
    WHERE key = OLD.category_key;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_gallery_images_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_material_orders_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_media_assets_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_offers_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_subscriptions_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_users_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

CREATE TRIGGER update_ai_insights_updated_at BEFORE UPDATE ON public.ai_insights FOR EACH ROW EXECUTE FUNCTION update_ai_insights_updated_at();
CREATE TRIGGER update_aluminum_profiles_updated_at BEFORE UPDATE ON public.aluminum_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER articles_updated_at_trigger BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION update_articles_updated_at();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION update_articles_updated_at();
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON public.batches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER log_company_creation_trigger AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION log_company_creation();
CREATE TRIGGER trigger_create_company_settings AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION create_default_company_settings();
CREATE TRIGGER trigger_create_company_subscription AFTER INSERT ON public.companies FOR EACH ROW EXECUTE FUNCTION create_default_subscription();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION update_companies_updated_at();
CREATE TRIGGER company_integrations_updated_at BEFORE UPDATE ON public.company_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_company_members_updated_at BEFORE UPDATE ON public.company_members FOR EACH ROW EXECUTE FUNCTION update_company_members_updated_at();
CREATE TRIGGER trigger_company_settings_updated_at BEFORE UPDATE ON public.company_settings FOR EACH ROW EXECUTE FUNCTION update_company_settings_updated_at();
CREATE TRIGGER set_company_subscriptions_updated_at BEFORE UPDATE ON public.company_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_deal_fence_updated_at BEFORE UPDATE ON public.deal_fence_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deal_railings_updated_at BEFORE UPDATE ON public.deal_railings_details FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON public.deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_gallery_categories_updated_at BEFORE UPDATE ON public.gallery_categories FOR EACH ROW EXECUTE FUNCTION update_gallery_categories_updated_at();
CREATE TRIGGER update_category_count_on_delete AFTER DELETE ON public.gallery_images FOR EACH ROW EXECUTE FUNCTION update_gallery_category_image_count();
CREATE TRIGGER update_category_count_on_insert AFTER INSERT ON public.gallery_images FOR EACH ROW EXECUTE FUNCTION update_gallery_category_image_count();
CREATE TRIGGER update_gallery_images_updated_at BEFORE UPDATE ON public.gallery_images FOR EACH ROW EXECUTE FUNCTION update_gallery_images_updated_at();
CREATE TRIGGER update_material_orders_updated_at_trigger BEFORE UPDATE ON public.material_orders FOR EACH ROW EXECUTE FUNCTION update_material_orders_updated_at();
CREATE TRIGGER media_assets_updated_at BEFORE UPDATE ON public.media_assets FOR EACH ROW EXECUTE FUNCTION update_media_assets_updated_at();
CREATE TRIGGER update_offers_updated_at_trigger BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION update_offers_updated_at();
CREATE TRIGGER set_platform_admins_updated_at BEFORE UPDATE ON public.platform_admins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER enforce_single_platform_settings_row BEFORE INSERT OR UPDATE ON public.platform_settings FOR EACH ROW EXECUTE FUNCTION prevent_multiple_platform_settings();
CREATE TRIGGER set_order_number BEFORE INSERT ON public.profile_orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.profile_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_stock_updated_at BEFORE UPDATE ON public.stock FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION update_subscriptions_updated_at();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_users_updated_at();
CREATE TRIGGER update_work_shifts_updated_at BEFORE UPDATE ON public.work_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_worker_shifts_updated_at BEFORE UPDATE ON public.worker_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workers_updated_at BEFORE UPDATE ON public.workers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Custom trigger on Supabase-managed auth.users:\nCREATE TRIGGER on_auth_user_created AFTER INSERT OR UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();


CREATE SCHEMA IF NOT EXISTS pergola_configurator;

CREATE TYPE pergola_configurator.ai_role AS ENUM ('user', 'assistant', 'system');
CREATE TYPE pergola_configurator.appointment_status AS ENUM ('pending', 'confirmed', 'rescheduled', 'done', 'cancelled');
CREATE TYPE pergola_configurator.cost_category AS ENUM ('materials', 'accessories', 'production', 'installation', 'delivery', 'marketing', 'other');
CREATE TYPE pergola_configurator.lead_status AS ENUM ('new', 'contacted', 'converted', 'lost');
CREATE TYPE pergola_configurator.material_type AS ENUM ('profile', 'roof', 'accessory', 'glass', 'other');
CREATE TYPE pergola_configurator.project_status AS ENUM ('draft', 'calculated', 'sent', 'ordered', 'completed', 'cancelled');
CREATE TYPE pergola_configurator.roof_type AS ENUM ('none', 'santaph_bh', 'polycarbonate', 'glass');
CREATE TYPE pergola_configurator.structure_type AS ENUM ('attached_wall', 'free_standing', 'corner_G', 'corner_Z', 'custom');
CREATE TYPE pergola_configurator.user_role AS ENUM ('admin', 'manager', 'client');

CREATE TABLE pergola_configurator.ai_sessions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  lead_id uuid,
  project_id uuid,
  role pergola_configurator.ai_role NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.appointments (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  lead_id uuid NOT NULL,
  manager_id uuid,
  scheduled_at timestamp with time zone NOT NULL,
  status pergola_configurator.appointment_status DEFAULT 'pending'::pergola_configurator.appointment_status NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.cost_breakdown (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  category pergola_configurator.cost_category NOT NULL,
  amount numeric NOT NULL,
  description text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.leads (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  project_id uuid,
  name text,
  phone text,
  email text,
  source text,
  preferred_callback_time text,
  discount_offered numeric,
  status pergola_configurator.lead_status DEFAULT 'new'::pergola_configurator.lead_status NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  city text
);

CREATE TABLE pergola_configurator.materials (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  name text NOT NULL,
  type pergola_configurator.material_type NOT NULL,
  weight_per_m numeric,
  weight_per_m2 numeric,
  cost_per_kg numeric,
  cost_per_unit numeric,
  cost_per_m2 numeric,
  description text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.pergola_configurator_uploads (
  id text NOT NULL,
  storage_path text NOT NULL,
  original_filename text,
  file_type text,
  file_size integer,
  uploaded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
  project_id uuid NOT NULL,
  user_id uuid
);

CREATE TABLE pergola_configurator.profiles (
  id uuid NOT NULL,
  role pergola_configurator.user_role DEFAULT 'client'::pergola_configurator.user_role NOT NULL,
  full_name text,
  phone text,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.projects (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid,
  name text,
  structure pergola_configurator.structure_type DEFAULT 'attached_wall'::pergola_configurator.structure_type NOT NULL,
  model text,
  roof pergola_configurator.roof_type DEFAULT 'none'::pergola_configurator.roof_type NOT NULL,
  roof_color text,
  material_profile text,
  width_m numeric NOT NULL,
  depth_m numeric NOT NULL,
  height_m numeric,
  area_m2 numeric GENERATED ALWAYS AS ((width_m * depth_m)) STORED,
  base_price_per_m2 numeric,
  final_price numeric,
  cost_total numeric,
  status pergola_configurator.project_status DEFAULT 'draft'::pergola_configurator.project_status NOT NULL,
  photo_url text,
  pdf_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.quotes (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  project_id uuid NOT NULL,
  pdf_url text NOT NULL,
  sent_to text,
  sent_at timestamp with time zone DEFAULT now()
);

CREATE TABLE pergola_configurator.settings (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE pergola_configurator.ai_sessions ADD CONSTRAINT ai_sessions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES pergola_configurator.leads(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.ai_sessions ADD CONSTRAINT ai_sessions_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.ai_sessions ADD CONSTRAINT ai_sessions_project_id_fkey FOREIGN KEY (project_id) REFERENCES pergola_configurator.projects(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.ai_sessions ADD CONSTRAINT ai_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES pergola_configurator.profiles(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.appointments ADD CONSTRAINT appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES pergola_configurator.leads(id) ON DELETE CASCADE;
ALTER TABLE pergola_configurator.appointments ADD CONSTRAINT appointments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES pergola_configurator.profiles(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.appointments ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.cost_breakdown ADD CONSTRAINT cost_breakdown_amount_check CHECK ((amount >= (0)::numeric));
ALTER TABLE pergola_configurator.cost_breakdown ADD CONSTRAINT cost_breakdown_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.cost_breakdown ADD CONSTRAINT cost_breakdown_project_id_fkey FOREIGN KEY (project_id) REFERENCES pergola_configurator.projects(id) ON DELETE CASCADE;
ALTER TABLE pergola_configurator.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.leads ADD CONSTRAINT leads_project_id_fkey FOREIGN KEY (project_id) REFERENCES pergola_configurator.projects(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.leads ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES pergola_configurator.profiles(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.materials ADD CONSTRAINT materials_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.pergola_configurator_uploads ADD CONSTRAINT pergola_configurator_uploads_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.pergola_configurator_uploads ADD CONSTRAINT pergola_configurator_uploads_project_id_fkey FOREIGN KEY (project_id) REFERENCES pergola_configurator.projects(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE pergola_configurator.pergola_configurator_uploads ADD CONSTRAINT pergola_configurator_uploads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
ALTER TABLE pergola_configurator.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE pergola_configurator.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.projects ADD CONSTRAINT projects_depth_m_check CHECK ((depth_m > (0)::numeric));
ALTER TABLE pergola_configurator.projects ADD CONSTRAINT projects_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.projects ADD CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES pergola_configurator.profiles(id) ON DELETE SET NULL;
ALTER TABLE pergola_configurator.projects ADD CONSTRAINT projects_width_m_check CHECK ((width_m > (0)::numeric));
ALTER TABLE pergola_configurator.quotes ADD CONSTRAINT quotes_pkey PRIMARY KEY (id);
ALTER TABLE pergola_configurator.quotes ADD CONSTRAINT quotes_project_id_fkey FOREIGN KEY (project_id) REFERENCES pergola_configurator.projects(id) ON DELETE CASCADE;
ALTER TABLE pergola_configurator.settings ADD CONSTRAINT settings_pkey PRIMARY KEY (key);

CREATE INDEX idx_ai_sessions_lead ON pergola_configurator.ai_sessions USING btree (lead_id);
CREATE INDEX idx_ai_sessions_project ON pergola_configurator.ai_sessions USING btree (project_id);
CREATE INDEX idx_appt_manager ON pergola_configurator.appointments USING btree (manager_id);
CREATE INDEX idx_appt_when ON pergola_configurator.appointments USING btree (scheduled_at);
CREATE INDEX idx_cbreak_category ON pergola_configurator.cost_breakdown USING btree (category);
CREATE INDEX idx_cbreak_project ON pergola_configurator.cost_breakdown USING btree (project_id);
CREATE INDEX idx_leads_project ON pergola_configurator.leads USING btree (project_id);
CREATE INDEX idx_leads_status ON pergola_configurator.leads USING btree (status);
CREATE INDEX idx_materials_active ON pergola_configurator.materials USING btree (is_active);
CREATE INDEX idx_materials_type ON pergola_configurator.materials USING btree (type);
CREATE INDEX idx_profiles_role ON pergola_configurator.profiles USING btree (role);
CREATE INDEX idx_projects_created ON pergola_configurator.projects USING btree (created_at);
CREATE INDEX idx_projects_status ON pergola_configurator.projects USING btree (status);
CREATE INDEX idx_projects_user ON pergola_configurator.projects USING btree (user_id);
CREATE INDEX idx_quotes_project ON pergola_configurator.quotes USING btree (project_id);

ALTER TABLE pergola_configurator.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.cost_breakdown ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.pergola_configurator_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pergola_configurator.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_owner_insert ON pergola_configurator.ai_sessions AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY ai_owner_staff_select ON pergola_configurator.ai_sessions AS PERMISSIVE FOR SELECT TO public
  USING ((pergola_configurator.is_staff(auth.uid()) OR (user_id = auth.uid())));

CREATE POLICY ai_staff_update_delete ON pergola_configurator.ai_sessions AS PERMISSIVE FOR UPDATE TO public
  USING (pergola_configurator.is_staff(auth.uid()))
  WITH CHECK (pergola_configurator.is_staff(auth.uid()));

CREATE POLICY appointments_staff_all ON pergola_configurator.appointments AS PERMISSIVE FOR ALL TO public
  USING (pergola_configurator.is_staff(auth.uid()))
  WITH CHECK (pergola_configurator.is_staff(auth.uid()));

CREATE POLICY cost_staff_all ON pergola_configurator.cost_breakdown AS PERMISSIVE FOR ALL TO public
  USING (pergola_configurator.is_staff(auth.uid()))
  WITH CHECK (pergola_configurator.is_staff(auth.uid()));

CREATE POLICY leads_admin_manager_all ON pergola_configurator.leads AS PERMISSIVE FOR ALL TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM pergola_configurator.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::pergola_configurator.user_role, 'manager'::pergola_configurator.user_role]))))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM pergola_configurator.profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['admin'::pergola_configurator.user_role, 'manager'::pergola_configurator.user_role]))))));

CREATE POLICY leads_owner_insert ON pergola_configurator.leads AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY leads_owner_select ON pergola_configurator.leads AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY leads_owner_update ON pergola_configurator.leads AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())))
  WITH CHECK (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY leads_select_owner ON pergola_configurator.leads AS PERMISSIVE FOR SELECT TO authenticated
  USING ((user_id = auth.uid()));

CREATE POLICY materials_staff_all ON pergola_configurator.materials AS PERMISSIVE FOR ALL TO public
  USING (pergola_configurator.is_staff(auth.uid()))
  WITH CHECK (pergola_configurator.is_staff(auth.uid()));

CREATE POLICY materials_staff_select ON pergola_configurator.materials AS PERMISSIVE FOR SELECT TO public
  USING (pergola_configurator.is_staff(auth.uid()));

CREATE POLICY uploads_service_role_all ON pergola_configurator.pergola_configurator_uploads AS PERMISSIVE FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY profiles_admin_read_all ON pergola_configurator.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING (pergola_configurator.is_admin(auth.uid()));

CREATE POLICY profiles_admin_update_all ON pergola_configurator.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING (pergola_configurator.is_admin(auth.uid()))
  WITH CHECK (pergola_configurator.is_admin(auth.uid()));

CREATE POLICY profiles_owner_read ON pergola_configurator.profiles AS PERMISSIVE FOR SELECT TO authenticated
  USING ((id = auth.uid()));

CREATE POLICY profiles_owner_select ON pergola_configurator.profiles AS PERMISSIVE FOR SELECT TO public
  USING (((auth.uid() = id) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY profiles_owner_update ON pergola_configurator.profiles AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE POLICY projects_owner_insert ON pergola_configurator.projects AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY projects_owner_select ON pergola_configurator.projects AS PERMISSIVE FOR SELECT TO public
  USING (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY projects_owner_update ON pergola_configurator.projects AS PERMISSIVE FOR UPDATE TO public
  USING (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())))
  WITH CHECK (((user_id = auth.uid()) OR pergola_configurator.is_staff(auth.uid())));

CREATE POLICY quotes_owner_staff_select ON pergola_configurator.quotes AS PERMISSIVE FOR SELECT TO public
  USING ((pergola_configurator.is_staff(auth.uid()) OR (EXISTS ( SELECT 1
   FROM pergola_configurator.projects p
  WHERE ((p.id = quotes.project_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY quotes_staff_all ON pergola_configurator.quotes AS PERMISSIVE FOR ALL TO public
  USING (pergola_configurator.is_staff(auth.uid()))
  WITH CHECK (pergola_configurator.is_staff(auth.uid()));

CREATE POLICY settings_staff_all ON pergola_configurator.settings AS PERMISSIVE FOR ALL TO public
  USING (pergola_configurator.is_staff(auth.uid()))
  WITH CHECK (pergola_configurator.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION pergola_configurator.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pergola_configurator', 'public'
AS $function$
begin
  begin
    insert into profiles (id, role, full_name, phone, created_at)
    values (
      new.id,
      case when new.email = 'max25782@gmail.com' then 'admin'::user_role else 'client'::user_role end,
      new.raw_user_meta_data->>'full_name',
      new.phone,
      now()
    )
    on conflict (id) do nothing;

    insert into leads (id, user_id, email, source, created_at)
    values (gen_random_uuid(), new.id, new.email, 'signup', now())
    on conflict do nothing;
  exception when others then
    -- log if needed: raise notice '%', sqlerrm;
    null; -- do not block signup
  end;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION pergola_configurator.is_admin(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pergola_configurator', 'public'
AS $function$ select exists(select 1 from profiles where id=uid and role='admin'); $function$
;

CREATE OR REPLACE FUNCTION pergola_configurator.is_staff(uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  select exists(
    select 1 from profiles p
     where p.id = uid and p.role in ('admin','manager')
  );
$function$
;

CREATE OR REPLACE FUNCTION pergola_configurator.projects_set_base_price()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  bp numeric;
begin
  select (value->>'price')::numeric into bp
  from settings where key = 'base_price_per_m2';
  if bp is null then
    bp := 900; -- fallback
  end if;

  if new.base_price_per_m2 is null then
    new.base_price_per_m2 := bp;
  end if;

  new.updated_at := now();
  return new;
end$function$
;

CREATE OR REPLACE FUNCTION pergola_configurator.recompute_project_cost_total()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update projects
     set cost_total = coalesce((
       select sum(amount)::numeric from cost_breakdown where project_id = NEW.project_id
     ), 0),
         updated_at = now()
   where id = NEW.project_id;
  return null;
end$function$
;

CREATE OR REPLACE FUNCTION pergola_configurator.set_user_role(target_user uuid, new_role pergola_configurator.user_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pergola_configurator', 'public'
AS $function$
begin
  if not exists (
    select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  update profiles set role = new_role where id = target_user;
end;
$function$
;

CREATE OR REPLACE FUNCTION pergola_configurator.set_user_role_by_email(target_email text, new_role pergola_configurator.user_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pergola_configurator', 'public'
AS $function$
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role='admin') then
    raise exception 'not authorized';
  end if;

  update profiles
  set role = new_role
  where id = (select id from auth.users where email = target_email);
end;
$function$
;

CREATE TRIGGER trg_cost_delete AFTER DELETE ON pergola_configurator.cost_breakdown FOR EACH ROW EXECUTE FUNCTION pergola_configurator.recompute_project_cost_total();
CREATE TRIGGER trg_cost_insert AFTER INSERT ON pergola_configurator.cost_breakdown FOR EACH ROW EXECUTE FUNCTION pergola_configurator.recompute_project_cost_total();
CREATE TRIGGER trg_cost_update AFTER UPDATE ON pergola_configurator.cost_breakdown FOR EACH ROW EXECUTE FUNCTION pergola_configurator.recompute_project_cost_total();
CREATE TRIGGER trg_projects_set_base_price BEFORE INSERT ON pergola_configurator.projects FOR EACH ROW EXECUTE FUNCTION pergola_configurator.projects_set_base_price();

CREATE OR REPLACE VIEW pergola_configurator.vw_project_margins AS SELECT id AS project_id,
    user_id,
    name,
    area_m2,
    final_price,
    cost_total,
    (COALESCE(final_price, (0)::numeric) - COALESCE(cost_total, (0)::numeric)) AS gross_profit,
        CASE
            WHEN (COALESCE(final_price, (0)::numeric) > (0)::numeric) THEN round((((100)::numeric * (COALESCE(final_price, (0)::numeric) - COALESCE(cost_total, (0)::numeric))) / final_price), 2)
            ELSE NULL::numeric
        END AS gross_margin_pct,
    status,
    created_at
   FROM pergola_configurator.projects p;;
